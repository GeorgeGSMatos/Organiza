'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {UserError}=require('./errors.cjs');
const {revision,within,matchesRule,exclusionReason,typeOf}=require('./preview.cjs');
const {targetDirectory}=require('./rules-service.cjs');
const key=p=>process.platform==='win32'?p.toLowerCase():p;
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const same=(a,b)=>a.size===b.size && Math.abs(a.mtimeMs-b.mtimeMs)<=1 && (!a.nodeIdentity || a.nodeIdentity===`${b.dev}:${b.ino}`);
async function exists(file){try{await fs.lstat(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
function candidateFor(row){return row.candidates.find(c=>c.ruleId===(row.selectedRuleId||row.ruleId)) || (row.candidates.length===1?row.candidates[0]:null);}
function eligible(row){const c=candidateFor(row);return row.status!=='ignored' && !row.ignoreReason && !!c && (!c.problem || c.issue==='occupied');}
async function safeParents(directory){
  let current=directory;
  for(let count=0;count<256;count++){
    try{const stat=await fs.lstat(current);if(!stat.isDirectory()||stat.isSymbolicLink())throw new UserError('O caminho contém um arquivo ou atalho. A movimentação foi recusada.');}
    catch(error){if(error.code!=='ENOENT')throw error;}
    const parent=path.dirname(current);if(parent===current)return;current=parent;
  }
  throw new UserError('Caminho muito profundo.');
}
async function uniqueDestination(destination,reserved=new Set()){
  const parent=path.dirname(destination),extension=path.extname(destination),base=path.basename(destination,extension);
  for(let n=1;n<=10000;n++){
    const candidate=n===1?destination:path.join(parent,`${base} (${n})${extension}`);
    if(!reserved.has(key(candidate)) && !await exists(candidate)){reserved.add(key(candidate));return candidate;}
  }
  throw new UserError('Há muitos arquivos com o mesmo nome no destino.');
}
class Organizer {
  constructor(store,preview,history,transfer,options={}){
    this.store=store;this.preview=preview;this.history=history;this.transfer=transfer;this.progress=options.progress||(()=>{});this.stabilityMs=options.stabilityMs??1000;this.protectedRoots=options.protectedRoots||[];this.busy=false;this.kind=null;this.stopRequested=false;this.current=null;this.plans=new Map();this.idle=Promise.resolve();this.onChanged=options.onChanged||(()=>{});this.recovering=false;
  }
  supported(){return this.transfer.supported && !this.history.error;}
  ensureIdle(){if(this.busy||this.recovering)throw new UserError('Aguarde a operação atual terminar antes de continuar.');if(this.history.error)throw new UserError(this.history.error);}
  async exclusive(kind,fn){
    this.ensureIdle();this.busy=true;this.kind=kind;this.stopRequested=false;let finish;this.idle=new Promise(resolve=>{finish=resolve;});
    try{return await fn();}finally{await this.transfer.abort();this.busy=false;this.kind=null;this.current=null;finish();this.progress({busy:false});}
  }
  stop(){this.stopRequested=true;}
  async mutate(fn){return this.exclusive('configuration',fn);}
  assertSupported(){if(!this.supported())throw new UserError(this.history.error||'A movimentação está disponível no aplicativo para Windows.');}
  protected(file){return this.protectedRoots.some(root=>root&&within(root,file));}
  async currentRow(row,mode='manual'){
    const state=this.store.snapshot(),folder=state.folders.find(f=>f.id===row.folderId),candidate=candidateFor(row);
    if(!folder||!candidate)throw new UserError('A pasta ou regra mudou. Atualize a prévia.');
    const persistedRule=folder.organization.rules.find(r=>r.id===candidate.ruleId);
    const rule=persistedRule || (mode==='manual' && row.assignmentRule?.id===candidate.ruleId ? row.assignmentRule : null);
    if(!rule || !within(folder.path,row.path) || key(row.path)===key(folder.path))throw new UserError('Regra ou origem inválida. Atualize a prévia.');
    if(this.protected(row.path) || this.protected(candidate.destination))throw new UserError('Arquivos de sistema e do aplicativo são protegidos. Escolha outra pasta.');
    if(this.history.blockedSource(row.path))throw new UserError('Há uma operação interrompida para este arquivo. Confira o histórico.');
    await safeParents(path.dirname(row.path));
    const stat=await fs.lstat(row.path);
    if(!stat.isFile()||stat.isSymbolicLink()||!same(row,stat))throw new UserError('O arquivo mudou desde a prévia. Atualize a análise.');
    const file={...row,type:typeOf(row.name),size:stat.size,mtimeMs:stat.mtimeMs};
    if(!matchesRule(rule,file)||exclusionReason(file,folder.organization,Date.now()))throw new UserError('O arquivo não está pronto ou não corresponde mais à regra. Atualize a prévia.');
    const relative=path.relative(folder.path,row.path),segments=relative.split(path.sep);
    if((!folder.includeSubfolders||rule.scope==='root')&&segments.length>1)throw new UserError('Este arquivo está fora do escopo da regra.');
    if(folder.organization.exclusions.subfolders.some(sub=>within(path.join(folder.path,...sub.split('/')),row.path)))throw new UserError('O arquivo está em uma subpasta excluída.');
    if(state.folders.some(other=>other.id!==folder.id && within(folder.path,other.path)&&within(other.path,row.path)))throw new UserError('O arquivo pertence a outra pasta cadastrada. Atualize a prévia.');
    const expected=path.join(targetDirectory(folder,rule),row.name);
    if(key(expected)!==key(candidate.destination))throw new UserError('O destino da regra mudou. Atualize a prévia.');
    if(mode==='auto'){
      if(!persistedRule||rule.action!=='move'||row.reviewReason||row.candidates.length!==1)throw new UserError('Este arquivo exige revisão manual.');
      if(this.history.managed(row.path,stat))throw new UserError('Este arquivo já foi organizado ou restaurado; revisão manual necessária.');
    }
    return {folder,rule,stat,candidate};
  }
  async plan(previewId,ids){
    this.ensureIdle();this.assertSupported();const snapshot=this.preview.result;
    if(!snapshot||snapshot.id!==previewId||snapshot.revision!==revision(this.store.snapshot()))throw new UserError('A prévia expirou. Analise os arquivos novamente.');
    if(!Array.isArray(ids)||!ids.length||ids.length>5000||ids.some(id=>typeof id!=='string'))throw new UserError('Selecione de 1 a 5000 arquivos.');
    const selected=[...new Set(ids)].map(id=>snapshot.rows.find(row=>row.id===id));
    if(selected.some(row=>!row||!eligible(row)))throw new UserError('A seleção contém itens sem regra definida ou com conflitos que precisam de ajuste.');
    const reserved=new Set(),entries=[];
    for(const row of selected){const {candidate}=await this.currentRow(row);await safeParents(path.dirname(candidate.destination));const destination=await uniqueDestination(candidate.destination,reserved);entries.push({row:structuredClone(row),destination,renamed:key(destination)!==key(candidate.destination),requiresReview:row.status==='review'||!!row.reviewReason||candidate.action==='suggest'});}
    const plan={id:randomUUID(),revision:snapshot.revision,expires:Date.now()+300000,entries};this.plans.clear();this.plans.set(plan.id,plan);
    return {id:plan.id,expires:plan.expires,entries:entries.map(e=>({name:e.row.name,source:e.row.path,destination:e.destination,renamed:e.renamed,requiresReview:e.requiresReview})),reviewCount:entries.filter(e=>e.requiresReview).length};
  }
  async execute(planId,approveReview=false){
    this.assertSupported();const plan=this.plans.get(planId);this.plans.delete(planId);
    if(!plan||plan.expires<Date.now()||plan.revision!==revision(this.store.snapshot()))throw new UserError('A confirmação expirou. Atualize a prévia.');
    if(plan.entries.some(e=>e.requiresReview)&&approveReview!==true)throw new UserError('Confirme a revisão dos arquivos marcados antes de organizar.');
    return this.exclusive('manual',async()=>this.batch(plan.entries,'manual',plan.revision));
  }
  async batch(entries,mode,expectedRevision,allowed=()=>true){
    const batchId=randomUUID(),result={batchId,moved:0,failed:0,cancelled:false,entries:[],completedIds:[],failures:[]};
    for(let index=0;index<entries.length;index++){
      if(this.stopRequested||!allowed()||expectedRevision!==revision(this.store.snapshot())){result.cancelled=true;break;}
      const item=entries[index];this.current=item.row.name;this.progress({busy:true,kind:mode,name:this.current,index,total:entries.length});
      try{const entry=await this.moveOne(item,mode,batchId,allowed);result.moved++;result.entries.push(entry);result.completedIds.push(item.row.id);}
      catch(error){result.failed++;result.failures.push({id:item.row.id,message:error.message});result.entries.push({source:item.row.path,destination:item.destination,message:error.message,status:'failed'});if(this.history.error)break;}
      this.progress({busy:true,kind:mode,name:this.current,index,total:entries.length,completed:index+1});
    }
    this.preview.invalidate();this.onChanged();return result;
  }
  async moveOne(item,mode,batchId,allowed){
    const {row}=item;let entry,prepared=false;
    try{
      const {stat,folder,candidate}=await this.currentRow(row,mode);await safeParents(path.dirname(item.destination));
      if(mode==='auto'&&!allowed())throw new UserError('Monitoramento pausado.');
      // Independent observation followed by the Windows exclusive handle and attribute checks.
      await sleep(this.stabilityMs);const after=await fs.lstat(row.path);if(!same({...stat,nodeIdentity:`${stat.dev}:${stat.ino}`},after))throw new UserError('O arquivo está sendo alterado. Ficou para uma próxima revisão.');
      if(this.stopRequested||!allowed())throw new UserError('Operação cancelada antes de mover.');
      const native=await this.transfer.prepare({source:row.path,destination:item.destination,size:after.size,mtimeMs:after.mtimeMs});prepared=true;
      entry={version:1,id:randomUUID(),operation:'move',status:'prepared',batchId,mode,folderId:folder.id,folderName:folder.name,ruleName:candidate.ruleName,source:row.path,destination:item.destination,time:new Date().toISOString(),size:native.size,mtimeMs:native.mtimeMs,hash:native.hash,sourceIdentity:native.identity};
      await this.history.append(entry);
      if(this.stopRequested||!allowed()){await this.transfer.abort();prepared=false;throw new UserError('Operação cancelada antes da movimentação.');}
      const moved=await this.transfer.commit();prepared=false;
      if(await exists(row.path))throw new UserError('O destino foi gravado, mas a origem continua presente. Confira ambos no histórico.');
      let nodeIdentity;try{const target=await fs.lstat(item.destination);if(same(moved,target))nodeIdentity=`${target.dev}:${target.ino}`;}catch{}
      entry={...entry,status:'moved',completedAt:new Date().toISOString(),destinationMeta:moved,nodeIdentity,message:item.renamed?'Nome ajustado para preservar o arquivo que já existia.':'Arquivo organizado.'};
      await this.history.append(entry);return entry;
    }catch(error){
      if(prepared)await this.transfer.abort();
      if(entry && !this.history.error){
        const sourcePresent=await exists(entry.source).catch(()=>false),destinationPresent=await exists(entry.destination).catch(()=>true);
        const uncertain=error.code!=='collision' && (!sourcePresent||destinationPresent);await this.history.append({...entry,status:uncertain?'attention':'failed',message:error.message}).catch(()=>{});
      }else if(!entry&&!this.history.error){await this.history.append({version:1,id:randomUUID(),operation:'move',status:'failed',batchId,mode,source:row.path,destination:item.destination,folderId:row.folderId,folderName:row.folderName,ruleName:row.ruleName||'',time:new Date().toISOString(),message:error.message}).catch(()=>{});}
      throw error;
    }
  }
  async undo(id){
    this.assertSupported();return this.exclusive('undo',async()=>{
      const original=this.history.entries().find(e=>e.id===id);if(!original||original.effectiveStatus!=='moved')throw new UserError('Esta movimentação não está disponível para desfazer.');
      if(await exists(original.source))throw new UserError('O local original já está ocupado. Nenhum arquivo foi substituído.');
      if(this.protected(original.source)||this.protected(original.destination))throw new UserError('O caminho está protegido.');
      const current=await fs.lstat(original.destination);if(!current.isFile()||!same(original.destinationMeta,current))throw new UserError('O arquivo foi alterado ou removido do destino. A reversão foi recusada.');
      await safeParents(path.dirname(original.source));await safeParents(path.dirname(original.destination));
      const prepared=await this.transfer.prepare({source:original.destination,destination:original.source,size:original.destinationMeta.size,mtimeMs:original.destinationMeta.mtimeMs,hash:original.hash});
      const entry={version:1,id:randomUUID(),operation:'undo',status:'prepared',undoOf:id,batchId:randomUUID(),source:original.destination,destination:original.source,time:new Date().toISOString(),size:prepared.size,mtimeMs:prepared.mtimeMs,hash:prepared.hash};
      try{await this.history.append(entry);const moved=await this.transfer.commit();if(await exists(entry.source))throw new UserError('A cópia original foi restaurada, mas o destino anterior ainda existe. Confira ambos.');let nodeIdentity;try{const s=await fs.lstat(entry.destination);nodeIdentity=`${s.dev}:${s.ino}`;}catch{}await this.history.append({...entry,status:'moved',completedAt:new Date().toISOString(),destinationMeta:moved,nodeIdentity,message:'Arquivo restaurado ao local original.'});this.preview.invalidate();this.onChanged();return {restored:true};}
      catch(error){if(!this.history.error){const uncertain=!await exists(entry.source).catch(()=>false)||await exists(entry.destination).catch(()=>true);await this.history.append({...entry,status:uncertain?'attention':'failed',message:error.message}).catch(()=>{});}throw error;}
    });
  }
  async recover(){
    if(this.recovering||this.busy||this.history.error)return;this.recovering=true;
    try{
      for(const entry of this.history.all().filter(e=>['prepared','attention'].includes(e.status))){
        if(entry.operation==='trash'){
          let verified=false;
          try{if(await exists(entry.source)){const actual=await this.transfer.inspect(entry.source);verified=actual.hash===entry.hash&&actual.identity===entry.sourceIdentity;}}catch{}
          if(verified)await this.history.append({...entry,status:'failed',message:'Pedido de Lixeira interrompido; o arquivo original continua neste caminho.'});
          else if(entry.status!=='attention')await this.history.append({...entry,status:'attention',message:'Envio à Lixeira não confirmado. Confira a Lixeira do Windows e a origem; o aplicativo não repetirá a ação automaticamente.'});
          continue;
        }
        const from=await exists(entry.source).catch(()=>null),to=await exists(entry.destination).catch(()=>null);
        if(from===true&&to===false){await this.history.append({...entry,status:'failed',message:'Operação interrompida antes de concluir; a origem foi preservada.'});continue;}
        if(from===false&&to===true&&entry.hash&&this.transfer.supported){try{const actual=await this.transfer.inspect(entry.destination);if(actual.hash===entry.hash&&actual.size===entry.size){const stat=await fs.lstat(entry.destination);await this.history.append({...entry,status:'moved',completedAt:new Date().toISOString(),destinationMeta:actual,nodeIdentity:`${stat.dev}:${stat.ino}`,recovered:true,message:'Movimentação confirmada após reabrir o aplicativo.'});continue;}}catch{}}
        if(entry.status!=='attention')await this.history.append({...entry,status:'attention',message:'Operação interrompida: confira origem e destino. Nenhum arquivo foi apagado na recuperação.'});
      }
    }finally{this.recovering=false;this.onChanged();}
  }
}
module.exports={Organizer,eligible,candidateFor,uniqueDestination,safeParents,same,exists};

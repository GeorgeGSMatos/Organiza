'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {UserError}=require('./errors.cjs');
const {TYPES,normalizeRule}=require('./rules-config.cjs');
const {targetDirectory}=require('./rules-service.cjs');
const {revision,finalize,within,exclusionReason,targetSafety}=require('./preview.cjs');
const {same,safeParents}=require('./organizer.cjs');
const hints={'.psd':['Design','Formato usado pelo Photoshop.'],'.psb':['Design','Formato usado pelo Photoshop.'],'.ai':['Design','Formato usado em design vetorial.'],'.eps':['Design','Formato usado em gráficos vetoriais.'],'.blend':['Modelagem 3D','Formato de projeto do Blender.'],'.dwg':['Projetos CAD','Formato de desenho CAD.'],'.dxf':['Projetos CAD','Formato de intercâmbio de desenho CAD.'],'.fig':['Design','Extensão usada por ferramentas de design.'],'.log':['Logs','A extensão costuma identificar registros de programas.'],'.bak':['Backups','A extensão costuma identificar cópias de arquivos.']};
for(const extension of ['.json','.yaml','.yml','.xml','.toml','.ini','.cfg'])hints[extension]=['Dados','Sugestão baseada na extensão; o conteúdo não foi analisado.'];
for(const extension of ['.js','.ts','.tsx','.jsx','.py','.cs','.go','.rs','.java','.c','.cpp','.html','.css','.sql'])hints[extension]=['Código','Sugestão baseada na extensão de código.'];
const normalized=text=>text.normalize('NFC').toLocaleLowerCase('pt-BR');
const nameWords=text=>normalized(text).replace(/[_-]+/g,' ');
function extensionOf(name){return ['.tar.gz','.tar.bz2','.tar.xz'].find(ext=>name.toLowerCase().endsWith(ext))||path.extname(name).toLowerCase();}
function suggestion(extension,rows){
  if(!extension)return {name:'Sem extensão',reason:'O formato não pode ser identificado pela extensão. Escolha uma categoria.'};
  if(hints[extension])return {name:hints[extension][0],reason:hints[extension][1]};
  const type=Object.entries(TYPES).find(([,value])=>value.extensions.includes(extension));
  if(type){const label=['image','video'].includes(type[0])?'Imagens e vídeos':type[1].label;return {name:label,reason:`Sugestão baseada na extensão ${extension}.`};}
  return {name:'',reason:`Extensão ${extension} sem classificação conhecida. Escolha ou crie uma categoria.`};
}
const rowKey=row=>`${row.folderId}\0${row.relativePath}\0${row.size}\0${row.mtimeMs}\0${row.nodeIdentity||''}`;
const isUnmatched=row=>!row.ignoreReason&&row.status==='review'&&row.candidates.length===0;
class ReviewService{
  constructor(store,preview,rules,organizer){this.store=store;this.preview=preview;this.rules=rules;this.organizer=organizer;this.deferred=new Set();}
  snapshot(id){const result=this.preview.result;if(!result||result.id!==id||result.revision!==revision(this.store.snapshot()))throw new UserError('A prévia expirou. Analise os arquivos novamente.');return result;}
  rows(id,ids,{unmatchedOnly=true}={}){
    const snapshot=this.snapshot(id);
    if(!Array.isArray(ids)||!ids.length||ids.length>5000||ids.some(id=>typeof id!=='string'))throw new UserError('Escolha os arquivos que deseja revisar.');
    const selected=[...new Set(ids)].map(id=>snapshot.rows.find(row=>row.id===id));
    if(selected.some(row=>!row||(unmatchedOnly?!isUnmatched(row):row.ignoreReason||row.status==='ignored')))throw new UserError('A seleção contém itens indisponíveis para esta ação. Atualize a prévia.');
    if(new Set(selected.map(row=>row.folderId)).size!==1)throw new UserError('Revise uma pasta de origem por vez.');
    return selected;
  }
  async revalidate(row){
    const folder=this.store.snapshot().folders.find(f=>f.id===row.folderId);if(!folder||!within(folder.path,row.path)||row.path===folder.path)throw new UserError('O arquivo está fora da pasta cadastrada.');
    await safeParents(path.dirname(row.path));
    const stat=await fs.lstat(row.path).catch(()=>{throw new UserError('O arquivo não está mais disponível. Atualize a prévia.');});
    if(!stat.isFile()||stat.isSymbolicLink()||!same(row,stat)||exclusionReason({...row,size:stat.size,mtimeMs:stat.mtimeMs},folder.organization,Date.now()))throw new UserError('O arquivo mudou ou não está pronto. Atualize a prévia.');
    const relative=path.relative(folder.path,row.path);
    if(!folder.includeSubfolders&&relative.includes(path.sep))throw new UserError('Este arquivo está fora do escopo da pasta.');
    if(folder.organization.exclusions.subfolders.some(sub=>within(path.join(folder.path,...sub.split('/')),row.path)))throw new UserError('Este arquivo está em uma subpasta excluída.');
    if(this.store.snapshot().folders.some(other=>other.id!==folder.id&&within(folder.path,other.path)&&within(other.path,row.path)))throw new UserError('O arquivo pertence a outra pasta cadastrada.');
    return {folder,stat};
  }
  decorate(result){
    const data=structuredClone(result),groups=new Map(),categories={};let deferredCount=0;
    for(const folder of this.store.snapshot().folders)categories[folder.id]=folder.organization.rules.map(rule=>({id:rule.id,name:rule.name,destination:rule.destination,enabled:rule.enabled}));
    for(const row of data.rows){
      if(!isUnmatched(row))continue;
      row.reviewDeferred=this.deferred.has(rowKey(row));if(row.reviewDeferred){deferredCount++;continue;}
      const extension=extensionOf(row.name),id=createHash('sha256').update(row.folderId+'\0'+extension).digest('hex');
      if(!groups.has(id))groups.set(id,{id,folderId:row.folderId,folderName:row.folderName,extension,rowIds:[],files:[],suggestion:null,recommendedCategoryId:null});
      const group=groups.get(id);group.rowIds.push(row.id);group.files.push({id:row.id,name:row.name,relativePath:row.relativePath});
    }
    for(const group of groups.values()){
      group.suggestion=suggestion(group.extension,group.files);
      const label=normalized(group.suggestion.name);
      const choices=categories[group.folderId]||[];
      const byFormat=choices.find(category=>label&&normalized(category.name)===label);
      const byName=choices.filter(category=>nameWords(category.name).length>=4&&group.files.every(file=>nameWords(file.name).includes(nameWords(category.name)))).sort((a,b)=>b.name.length-a.name.length)[0];
      group.recommendedCategoryId=byFormat?.id||byName?.id||null;
      if(!byFormat&&byName)group.suggestion.reason+=` Pelos nomes, pode combinar com sua categoria ${byName.name}; confirme a escolha.`;
    }
    data.review={groups:[...groups.values()].sort((a,b)=>b.rowIds.length-a.rowIds.length),categories,deferredCount};return data;
  }
  async reload(scope){return this.preview.scan(scope);}
  async defer(id,ids){for(const row of this.rows(id,ids))this.deferred.add(rowKey(row));return this.decorate(this.snapshot(id));}
  resume(id){const result=this.snapshot(id);for(const row of result.rows)this.deferred.delete(rowKey(row));return this.decorate(result);}
  async keep(id,ids){
    const snapshot=this.snapshot(id),selected=this.rows(id,ids);for(const row of selected)await this.revalidate(row);
    const folderId=selected[0].folderId;
    await this.store.update(state=>{const folder=state.folders.find(f=>f.id===folderId);const files=new Set(folder.organization.exclusions.files||[]);for(const row of selected)files.add(path.relative(folder.path,row.path).split(path.sep).join('/'));if(files.size>10000)throw new UserError('O limite é de 10000 caminhos ignorados por pasta.');folder.organization.exclusions.files=[...files];});
    this.preview.invalidate();return this.decorate(await this.reload(snapshot.folderId));
  }
  async assign(id,ids,input){
    const old=this.snapshot(id),selected=this.rows(id,ids);for(const row of selected)await this.revalidate(row);
    if(!input||typeof input.saveForFuture!=='boolean'||!['existing','new'].includes(input.mode))throw new UserError('Escolha uma categoria e como aplicar a decisão.');
    const folder=this.store.snapshot().folders.find(f=>f.id===selected[0].folderId);
    const extensions=[...new Set(selected.map(row=>extensionOf(row.name)))];if(extensions.length!==1&&input.saveForFuture)throw new UserError('Para criar uma regra futura, selecione um formato de cada vez.');
    const extension=extensions[0];
    let name,destination;
    if(input.mode==='existing'){
      const category=folder.organization.rules.find(rule=>rule.id===input.categoryId);if(!category)throw new UserError('Esta categoria não está mais disponível.');name=category.name;destination=category.destination;
    }else{name=input.name;destination=input.destination;}
    const conditions=[];const withExtension=extensions.filter(Boolean);if(withExtension.length)conditions.push({field:'extension',value:withExtension});if(extensions.includes(''))conditions.push({field:'noExtension',value:true});
    const rule=normalizeRule({name,enabled:input.saveForFuture,match:conditions.length>1?'any':'all',scope:'inherit',action:'move',conditions,destination,presetId:null});
    const target=targetDirectory(folder,rule);if(target===folder.path)throw new UserError('Escolha um destino diferente da origem.');
    if(input.mode==='new'||input.saveForFuture){
      // A category used only once remains available with its future rule paused.
      const stored={...rule,name:input.mode==='existing'?`${name} · ${extension?extension.slice(1).toUpperCase():'sem extensão'}`.slice(0,80):name};
      await this.rules.save(folder.id,stored);this.preview.invalidate();await this.reload(old.folderId);
    }
    const snapshot=this.preview.result;let assigned=0;
    for(const original of selected){
      const row=snapshot.rows.find(row=>row.id===original.id);if(!row)continue;
      // Always revalidate after a refreshed scan. Ignore a file that changed or acquired other matches.
      if(row.size!==original.size||row.mtimeMs!==original.mtimeMs||row.nodeIdentity!==original.nodeIdentity)continue;
      if(input.saveForFuture){assigned++;continue;}
      const temporaryRule={...rule,id:'once:'+randomUUID(),enabled:true};
      const problem=await targetSafety(folder,temporaryRule,new AbortController().signal);let issue=problem?'unsafe':null,description=problem;
      const proposed=path.join(target,row.name);
      if(!description){try{await fs.lstat(proposed);description='Já existe um arquivo ou pasta com este nome no destino.';issue='occupied';}catch(error){if(error.code!=='ENOENT'){description='Não foi possível verificar o destino.';issue='unavailable';}}}
      row.assignmentRule=temporaryRule;row.selectedRuleId=null;row.candidates=[{ruleId:temporaryRule.id,ruleName:name,destination:proposed,action:'move',problem:description,issue}];row.reviewReason ||= 'Destino escolhido para esta seleção. Revise antes de mover.';assigned++;
    }
    finalize(snapshot);return {preview:this.decorate(snapshot),assigned,remaining:selected.length-assigned};
  }
}
module.exports={ReviewService,extensionOf,suggestion,isUnmatched};

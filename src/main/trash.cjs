'use strict';
const {randomUUID}=require('node:crypto');
const {UserError}=require('./errors.cjs');
const {revision}=require('./preview.cjs');
const {exists,same}=require('./organizer.cjs');
class TrashService{
  constructor(review,organizer,history,trashItem){this.review=review;this.organizer=organizer;this.history=history;this.trashItem=trashItem;this.plans=new Map();}
  async plan(previewId,ids){
    this.organizer.ensureIdle();this.organizer.assertSupported();
    const rows=this.review.rows(previewId,ids,{unmatchedOnly:false});for(const row of rows){await this.review.revalidate(row);if(this.organizer.protected(row.path))throw new UserError('Arquivos de sistema e do aplicativo são protegidos.');if(this.history.blockedSource(row.path))throw new UserError('Confira a operação interrompida deste arquivo no Histórico.');}
    const plan={id:randomUUID(),expires:Date.now()+300000,revision:revision(this.review.store.snapshot()),rows:structuredClone(rows)};
    this.plans.clear();this.plans.set(plan.id,plan);return {id:plan.id,entries:rows.map(row=>({name:row.name,path:row.path,size:row.size})),expires:plan.expires};
  }
  async execute(id){
    this.organizer.assertSupported();const plan=this.plans.get(id);this.plans.delete(id);
    if(!plan||plan.expires<Date.now()||plan.revision!==revision(this.review.store.snapshot()))throw new UserError('A confirmação de Lixeira expirou. Atualize a prévia.');
    return this.organizer.exclusive('trash',async()=>{
      const result={trashed:0,failed:0,cancelled:false,completedIds:[],failures:[]},batchId=randomUUID();
      for(let index=0;index<plan.rows.length;index++){
        if(this.organizer.stopRequested){result.cancelled=true;break;}
        const row=plan.rows[index];let entry,requested=false;
        this.organizer.progress({busy:true,kind:'trash',name:row.name,index,total:plan.rows.length});
        try{
          const {stat}=await this.review.revalidate(row);if(this.organizer.protected(row.path))throw new UserError('Este caminho está protegido.');
          const native=await this.organizer.transfer.inspect(row.path);
          if(!same(native,stat))throw new UserError('O arquivo mudou durante a conferência. Atualize a prévia.');
          // Inspect releases the native handle so the OS can recycle. Recheck identity directly before calling it.
          await this.review.revalidate(row);
          entry={version:2,id:randomUUID(),operation:'trash',status:'prepared',source:row.path,destination:null,folderId:row.folderId,folderName:row.folderName,batchId,mode:'manual',time:new Date().toISOString(),hash:native.hash,size:native.size,mtimeMs:native.mtimeMs,sourceIdentity:native.identity};
          await this.history.append(entry);
          if(this.organizer.stopRequested)throw new UserError('Envio cancelado antes de chamar a Lixeira.');
          await this.review.revalidate(row);requested=true;
          // There is deliberately no unlink/delete fallback if the OS refuses recycling.
          await this.trashItem(row.path);
          if(await exists(row.path))throw new UserError('O Windows não confirmou a retirada da origem. Confira a Lixeira.');
          await this.history.append({...entry,status:'trashed',completedAt:new Date().toISOString(),message:'Enviado à Lixeira. Para restaurar, use a Lixeira do Windows.'});result.trashed++;result.completedIds.push(row.id);
        }catch(error){
          result.failed++;result.failures.push({id:row.id,message:error.message});
          if(!this.history.error){
            let unchanged=!requested;
            if(requested){try{const current=await this.organizer.transfer.inspect(row.path);unchanged=entry&&current.hash===entry.hash&&current.identity===entry.sourceIdentity;}catch{unchanged=false;}}
            const base=entry||{version:2,id:randomUUID(),operation:'trash',source:row.path,destination:null,folderId:row.folderId,folderName:row.folderName,batchId,mode:'manual',time:new Date().toISOString()};
            await this.history.append({...base,status:unchanged?'failed':'attention',message:unchanged?`Não enviado à Lixeira: ${error.message}`:`Não foi possível confirmar o envio. Confira a Lixeira do Windows. ${error.message}`}).catch(()=>{});
          }
          if(this.history.error)break;
        }
        this.organizer.progress({busy:true,kind:'trash',name:row.name,index,total:plan.rows.length,completed:index+1});
      }
      this.organizer.preview.invalidate();this.organizer.onChanged();return result;
    });
  }
}
module.exports={TrashService};

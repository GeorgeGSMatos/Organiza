'use strict';
const fs=require('node:fs/promises');
const {randomUUID}=require('node:crypto');
const {UserError}=require('./errors.cjs');
const {PreviewService,revision,within}=require('./preview.cjs');
const {eligible,candidateFor,uniqueDestination}=require('./organizer.cjs');
class Monitor {
  constructor(store,organizer,history,options={}){
    this.store=store;this.organizer=organizer;this.history=history;this.active=new Set();this.observations=new Map();this.backoff=new Map();this.reviewed=new Map();this.lastResult=null;this.lastCheck=null;this.running=false;this.timer=null;this.interval=options.interval??30000;this.observationMs=options.observationMs??2000;this.changed=options.changed||(()=>{});this.analysis=new PreviewService(store);this.generation=0;
  }
  state(){return {activeIds:[...this.active],running:this.running,lastCheck:this.lastCheck,lastResult:this.lastResult,intervalSeconds:this.interval/1000};}
  review(preview){if(!preview || preview.revision!==revision(this.store.snapshot()) || preview.cancelled || preview.limited)return;const ids=preview.folderId?[preview.folderId]:this.store.snapshot().folders.map(f=>f.id);for(const id of ids)this.reviewed.set(id,JSON.stringify(this.store.snapshot().folders.find(f=>f.id===id)));}
  async activate(ids){
    this.organizer.ensureIdle();this.organizer.assertSupported();if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'))throw new UserError('Escolha ao menos uma pasta.');
    const folders=this.store.snapshot().folders;
    for(const id of new Set(ids)){
      const folder=folders.find(f=>f.id===id);if(!folder||!folder.organization.rules.some(r=>r.enabled&&r.action==='move'))throw new UserError('Cada pasta precisa de uma regra ativa de organização.');
      if(this.reviewed.get(id)!==JSON.stringify(folder))throw new UserError(`Analise e revise a prévia de ${folder.name} antes de ativar o monitoramento.`);
      const directory=await fs.opendir(folder.path).catch(()=>{throw new UserError(`A pasta ${folder.name} está indisponível.`);});await directory.close();
    }
    for(const id of ids)this.active.add(id);this.generation++;if(!this.timer)this.timer=setInterval(()=>this.tick().catch(error=>{this.lastResult={error:error.message};this.pauseAll();this.changed();}),this.interval);this.timer.unref?.();this.changed();return this.state();
  }
  pause(id){if(typeof id!=='string')throw new UserError('Pasta inválida.');this.active.delete(id);this.generation++;this.analysis.cancel();if(this.organizer.kind==='auto')this.organizer.stop();if(!this.active.size)this.clearTimer();this.changed();}
  pauseAll(){this.active.clear();this.generation++;this.analysis.cancel();if(this.organizer.kind==='auto')this.organizer.stop();this.clearTimer();this.changed();}
  clearTimer(){if(this.timer)clearInterval(this.timer);this.timer=null;}
  invalidate(id){if(id)this.pause(id);else this.pauseAll();this.reviewed.delete(id);this.observations.clear();}
  async tick(){
    if(this.running||this.organizer.busy||this.organizer.recovering||!this.active.size||this.history.error)return;
    this.running=true;const generation=this.generation;this.changed();
    try{
      for(const id of [...this.active]){
        if(generation!==this.generation||this.organizer.busy)break;
        const folder=this.store.snapshot().folders.find(f=>f.id===id);if(!folder){this.pause(id);continue;}
        const snapshot=await this.analysis.scan(id);this.lastCheck=new Date().toISOString();
        if(snapshot.cancelled||snapshot.limited||snapshot.warnings.length){this.lastResult={folderId:id,moved:0,waiting:snapshot.rows.length,warning:snapshot.warnings[0]||'Análise parcial. Organize manualmente uma seleção menor.'};continue;}
        const items=[],reserved=new Set();let waiting=0;
        for(const row of snapshot.rows){
          if(!eligible(row)||row.candidates.length!==1||row.reviewReason||candidateFor(row).action!=='move'){waiting++;continue;}
          const candidate=candidateFor(row),now=Date.now(),fingerprint=`${row.size}:${row.mtimeMs}:${row.nodeIdentity||''}`,old=this.observations.get(row.path);this.observations.set(row.path,{fingerprint,time:old?.fingerprint===fingerprint?old.time:now});
          if(this.backoff.get(row.path)>now){waiting++;continue;}
          if(!old||old.fingerprint!==fingerprint||now-old.time<this.observationMs){waiting++;continue;}
          if(this.history.blockedSource(row.path)){waiting++;continue;}
          const stat=await fs.lstat(row.path).catch(()=>null);if(!stat||this.history.managed(row.path,stat)){waiting++;continue;}
          // Avoid cycles between independently monitored roots. Receipts also protect manual moves and undo.
          if(this.store.snapshot().folders.some(other=>other.id!==id&&this.active.has(other.id)&&within(other.path,candidate.destination))){waiting++;continue;}
          const destination=await uniqueDestination(candidate.destination,reserved);items.push({row,destination,renamed:destination!==candidate.destination});if(items.length>=100)break;
        }
        if(this.observations.size>20000)this.observations.clear();
        if(items.length && generation===this.generation && this.active.has(id)){
          this.lastResult=await this.organizer.exclusive('auto',()=>this.organizer.batch(items,'auto',snapshot.revision,()=>this.active.has(id)&&generation===this.generation));this.lastResult.folderId=id;this.lastResult.waiting=waiting;for(const entry of this.lastResult.entries)if(entry.status==='failed')this.backoff.set(entry.source,Date.now()+300000);
        }else this.lastResult={folderId:id,moved:0,waiting};
      }
    }finally{this.running=false;this.changed();}
  }
}
module.exports={Monitor};

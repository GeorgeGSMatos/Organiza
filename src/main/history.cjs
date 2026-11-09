'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {UserError}=require('./errors.cjs');
const pathKey=file=>process.platform==='win32'?file.toLowerCase():file;
const statuses=new Set(['prepared','moved','failed','attention','trashed']);
function validateEntry(entry){
  if(!entry || ![1,2].includes(entry.version) || typeof entry.id!=='string' || !entry.id || !['move','undo','trash'].includes(entry.operation) || !statuses.has(entry.status) || typeof entry.source!=='string' || !path.isAbsolute(entry.source) || (entry.operation==='trash' ? entry.destination!==null : typeof entry.destination!=='string' || !path.isAbsolute(entry.destination)) || typeof entry.time!=='string' || (entry.hash!==undefined && !/^[a-f0-9]{64}$/.test(entry.hash)))throw new Error('Registro de histórico inválido.');
  if(entry.operation==='trash'&&(!['prepared','trashed','failed','attention'].includes(entry.status)||entry.version!==2))throw new Error('Versão inválida para Lixeira.');
  if(entry.status==='trashed'&&(entry.operation!=='trash'||!/^[a-f0-9]{64}$/.test(entry.hash||'')))throw new Error('Confirmação inválida de Lixeira.');
  if(!Number.isFinite(Date.parse(entry.time)) || entry.source===entry.destination)throw new Error('Metadados do histórico inválidos.');
  if(['prepared','moved'].includes(entry.status) && (!/^[a-f0-9]{64}$/.test(entry.hash||'') || !Number.isSafeInteger(entry.size) || entry.size<0 || !Number.isFinite(entry.mtimeMs)))throw new Error('Registro sem identificação de conteúdo.');
  if(entry.status==='moved' && (!entry.destinationMeta || entry.destinationMeta.hash!==entry.hash || entry.destinationMeta.size!==entry.size || !Number.isFinite(entry.destinationMeta.mtimeMs)))throw new Error('Confirmação inválida de movimentação.');
  if(entry.operation==='undo' && typeof entry.undoOf!=='string')throw new Error('Referência de reversão inválida.');
  return entry;
}
class History {
  constructor(file){this.file=file;this.records=new Map();this.order=[];this.queue=Promise.resolve();this.error=null;this.notice=null;this.receipts=new Map();this.blocked=new Map();this.cache=null;this.generation=0;}
  async load(){
    await fs.mkdir(path.dirname(this.file),{recursive:true});
    let buffer;try{buffer=await fs.readFile(this.file);}catch(error){if(error.code==='ENOENT')return;this.error='Não foi possível ler o histórico. Movimentações foram bloqueadas.';return;}
    let offset=0;
    while(offset<buffer.length){
      const newline=buffer.indexOf(10,offset),end=newline<0?buffer.length:newline,part=buffer.subarray(offset,end).toString('utf8');
      if(!part.trim()){offset=end+1;continue;}
      try{const entry=validateEntry(JSON.parse(part));this.apply(entry);}
      catch(error){
        if(newline<0){
          await fs.writeFile(this.file+'.interrompido-'+Date.now(),buffer);
          const handle=await fs.open(this.file,'r+');try{await handle.truncate(offset);await handle.sync();}finally{await handle.close();}
          this.notice='Uma gravação interrompida do histórico foi preservada para conferência.';return;
        }
        this.error='O histórico está danificado. Os arquivos foram preservados e novas movimentações estão bloqueadas.';return;
      }
      offset=end+1;
    }
    if(buffer.length && buffer[buffer.length-1]!==10){const handle=await fs.open(this.file,'a');try{await handle.writeFile('\n');await handle.sync();}finally{await handle.close();}}
  }
  apply(entry){
    this.generation++;const previous=this.records.get(entry.id);
    if(previous)for(const file of [previous.source,previous.destination].filter(Boolean)){const ids=this.blocked.get(pathKey(file));if(ids){ids.delete(entry.id);if(!ids.size)this.blocked.delete(pathKey(file));}}
    if(!previous)this.order.push(entry.id);this.records.set(entry.id,structuredClone(entry));this.cache=null;
    if(['prepared','attention'].includes(entry.status))for(const file of [entry.source,entry.destination].filter(Boolean)){if(!this.blocked.has(pathKey(file)))this.blocked.set(pathKey(file),new Set());this.blocked.get(pathKey(file)).add(entry.id);}
    if(entry.status==='moved')this.receipts.set(pathKey(entry.destination),structuredClone(entry));
  }
  append(entry){
    const operation=this.queue.then(async()=>{
      if(this.error)throw new UserError(this.error);let handle;
      try{validateEntry(entry);handle=await fs.open(this.file,'a',0o600);await handle.writeFile(JSON.stringify(entry)+'\n','utf8');await handle.sync();this.apply(entry);}
      catch(error){this.error='Não foi possível salvar o histórico. Confira operações interrompidas antes de continuar.';throw new UserError(this.error);}
      finally{if(handle)await handle.close();}
      return structuredClone(entry);
    });this.queue=operation.catch(()=>{});return operation;
  }
  all(){return this.order.map(id=>structuredClone(this.records.get(id)));}
  entries(){
    if(this.cache)return structuredClone(this.cache);
    const all=this.all(),byOriginal=new Map();for(const entry of all)if(entry.undoOf){if(!byOriginal.has(entry.undoOf))byOriginal.set(entry.undoOf,[]);byOriginal.get(entry.undoOf).push(entry);}
    this.cache=all.filter(entry=>entry.operation!=='undo').reverse().map(entry=>{
      const undos=byOriginal.get(entry.id)||[],last=undos[undos.length-1];
      return {...entry,effectiveStatus:undos.some(child=>child.status==='moved')?'undone':last && ['prepared','attention'].includes(last.status)?'attention':entry.status,lastUndoError:last?.status==='failed'?last.message:null};
    });return structuredClone(this.cache);
  }
  blockedSource(file){return this.blocked.has(pathKey(file));}
  managed(file,stat){const entry=this.receipts.get(pathKey(file));return !!entry && entry.destinationMeta && entry.destinationMeta.size===stat.size && Math.abs(entry.destinationMeta.mtimeMs-stat.mtimeMs)<=1 && (!entry.nodeIdentity || entry.nodeIdentity===`${stat.dev}:${stat.ino}`);}
  summary(){const entries=this.entries();return {generation:this.generation,error:this.error,notice:this.notice,total:entries.length,attention:entries.filter(e=>e.effectiveStatus==='attention'||e.effectiveStatus==='prepared').length};}
}
module.exports={History,validateEntry};

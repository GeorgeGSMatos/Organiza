'use strict';
// Only imported by test/electron-entry.cjs or tests, never by the production app.
// Exercises orchestration with real temporary files; does NOT simulate Windows sharing/attributes.
const fs=require('node:fs/promises');const {constants}=require('node:fs');const {createHash}=require('node:crypto');const path=require('node:path');
class TestTransfer {
  constructor(options={}){this.supported=true;this.pending=null;this.options=options;}
  async inspect(file){const stat=await fs.lstat(file);return {size:stat.size,mtimeMs:stat.mtimeMs,hash:createHash('sha256').update(await fs.readFile(file)).digest('hex'),identity:`${stat.dev}:${stat.ino}`};}
  async prepare(input){if(this.options.prepareError)throw this.options.prepareError;const actual=await this.inspect(input.source);if(actual.size!==input.size||Math.abs(actual.mtimeMs-input.mtimeMs)>1||(input.hash&&input.hash!==actual.hash))throw new Error('O arquivo mudou.');if(this.options.afterPrepare)await this.options.afterPrepare(input);this.pending={...input,actual};await fs.mkdir(path.dirname(input.destination),{recursive:true});return actual;}
  async commit(){const item=this.pending;if(!item)throw new Error('Sem preparação.');this.pending=null;if(this.options.beforeCommit)await this.options.beforeCommit(item);const actual=await this.inspect(item.source);if(actual.hash!==item.actual.hash)throw new Error('Conteúdo alterado.');
    if(this.options.copy){await fs.copyFile(item.source,item.destination,constants.COPYFILE_EXCL);const copied=await this.inspect(item.destination);if(copied.hash!==actual.hash)throw new Error('Falha de integridade.');await fs.utimes(item.destination,new Date(),new Date(actual.mtimeMs));}else try{await fs.link(item.source,item.destination);}catch(error){if(error.code==='EEXIST')error.code='collision';throw error;}
    if(this.options.interruptAfterPublish)throw new Error('Interrupção após gravar o destino.');await fs.unlink(item.source);return {...await this.inspect(item.destination),method:this.options.copy?'copy-verified':'rename'};}
  async abort(){this.pending=null;}
  close(){}
}
module.exports={TestTransfer};

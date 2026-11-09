'use strict';
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const path = require('node:path');
const { UserError } = require('./errors.cjs');
class WindowsTransfer {
  constructor(script) { this.script=script; this.child=null; this.starting=null; this.pending=new Map(); this.sequence=0; this.supported=process.platform==='win32'; }
  async start() {
    if (!this.supported) throw new UserError('A movimentação está disponível no aplicativo para Windows.');
    if (this.starting) return this.starting;
    this.starting = new Promise((resolve,reject) => {
      const executable=path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
      // Keep .NET 8 runtime DLLs in a self-contained WPF application's root out of
      // Windows PowerShell's Add-Type reference resolution (.NET Framework).
      const child=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',this.script],{cwd:path.dirname(this.script),windowsHide:true,stdio:['pipe','pipe','pipe']});
      this.child=child; const timer=setTimeout(()=>{child.kill(); reject(new UserError('O componente de segurança do Windows não iniciou. Confira se o PowerShell está disponível.'));},30000);
      const fail=error=>{clearTimeout(timer); this.child=null; this.starting=null; reject(error); for(const pending of this.pending.values()) pending.reject(error); this.pending.clear();};
      child.once('error',()=>fail(new UserError('Não foi possível iniciar a verificação nativa do Windows.')));
      child.once('exit',()=>fail(new UserError('O componente de movimentação foi interrompido. Confira o histórico antes de tentar novamente.')));
      child.stderr.on('data',()=>{});
      readline.createInterface({input:child.stdout}).on('line',line=>{
        let message;try{message=JSON.parse(line);}catch{return;}
        if(message.ready){clearTimeout(timer);resolve();return;}
        if(message.fatal){child.kill();fail(new UserError(message.error || 'Não foi possível carregar a proteção nativa.'));return;}
        const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);
        if(message.ok)pending.resolve(message.value);else{const error=new UserError(message.error);error.code=message.code;pending.reject(error);}
      });
    });
    return this.starting;
  }
  async request(op,input={}) { await this.start(); const id=++this.sequence; return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.child.stdin.write(JSON.stringify({id,op,...input})+'\n',error=>{if(error){this.pending.delete(id);reject(new UserError('A comunicação com a movimentação foi interrompida. Confira o histórico.'));}});}); }
  prepare(input){return this.request('prepare',input);}
  commit(){return this.request('commit');}
  abort(){return this.child ? this.request('abort').catch(()=>{}) : Promise.resolve();}
  inspect(file){return this.request('inspect',{path:file});}
  close(){if(this.child)this.child.kill();}
}
module.exports={WindowsTransfer};

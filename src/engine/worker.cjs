'use strict';
const readline = require('node:readline');
const path = require('node:path');
const { createEngine } = require('./server.cjs');
console.log = (...args) => console.error(...args);
const profile = process.argv[2], applicationRoot = process.argv[3];
if (!profile || !path.isAbsolute(profile) || !applicationRoot || !path.isAbsolute(applicationRoot)) process.exit(2);
const send = message => process.stdout.write(JSON.stringify(message) + '\n');
const pendingHost = new Map(); let hostId = 0, stopping = false;
const engineReady = createEngine({ profile, applicationRoot, emit: (event, value) => send({ event, value }),
  host: (method, value) => new Promise((resolve, reject) => { const id = ++hostId; pendingHost.set(id, { resolve, reject }); send({ hostId: id, method, value }); }) });
engineReady.then(async engine => { send({ ready: true }); await engine.recover(); }).catch(error => { send({ fatal: error.message }); process.exitCode = 1; process.stdin.destroy(); });
const reader = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
reader.on('line', async line => {
  let request;
  try {
    if (line.length > 8 * 1024 * 1024) throw Error('Pedido muito grande.');
    request = JSON.parse(line);
    if (request.hostReply) { const pending = pendingHost.get(request.hostReply); if (pending) { pendingHost.delete(request.hostReply); request.ok ? pending.resolve() : pending.reject(Error(request.error || 'A Lixeira recusou o arquivo.')); } return; }
    if (!Number.isSafeInteger(request.id) || typeof request.method !== 'string') throw Error('Pedido inválido.');
    const engine = await engineReady;
    if (request.method === 'shutdown') {
      stopping = true; await engine.shutdown(); send({ id: request.id, ok: true }); reader.close(); process.stdin.destroy(); return;
    }
    const value = await engine.call(request.method, request.args); send({ id: request.id, ok: true, value });
  } catch (error) { send({ id: request?.id, ok: false, error: error.message }); }
});
reader.on('close', async () => {
  for (const pending of pendingHost.values()) pending.reject(Error('A interface foi encerrada.'));
  pendingHost.clear();
  if (!stopping) await engineReady.then(engine => engine.shutdown()).catch(() => {});
});

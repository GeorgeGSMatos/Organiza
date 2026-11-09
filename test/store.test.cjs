'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Store, FolderService, normalizeFolderInput } = require('../src/main/store.cjs');
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'organiza-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'app', 'config.json');
  const store = new Store(file); await store.load();
  const folder = path.join(root, 'Minha pasta com espaços e acentuação'); await fs.mkdir(folder);
  return { root, file, store, folder, service: new FolderService(store) };
}
test('cadastro e preferências persistem entre aberturas sem alterar os arquivos da pasta', async t => {
  const f = await fixture(t);
  const original = path.join(f.folder, 'documento.txt'); await fs.writeFile(original, 'conteúdo original');
  await f.service.save({ path: f.folder, name: 'Trabalho', includeSubfolders: false });
  await f.store.update(s => { s.settings.compactView = true; });
  const reopened = new Store(f.file); const state = await reopened.load();
  assert.equal(state.folders.length, 1); assert.equal(state.folders[0].name, 'Trabalho');
  assert.equal(state.settings.compactView, true); assert.equal(state.settings.launchAtLogin, false);
  assert.equal(await fs.readFile(original, 'utf8'), 'conteúdo original');
  assert.deepEqual(await fs.readdir(f.folder), ['documento.txt']);
});
test('bloqueia caminhos repetidos, inclusive equivalentes e atalhos simbólicos', async t => {
  const f = await fixture(t); const input = { path: f.folder, name: '', includeSubfolders: false };
  await f.service.save(input);
  await assert.rejects(f.service.save({ ...input, path: path.join(f.folder, '.') }), /já está cadastrada/);
  const link = path.join(f.root, 'atalho'); await fs.symlink(f.folder, link, 'junction');
  await assert.rejects(f.service.save({ ...input, path: link }), /já está cadastrada/);
  assert.equal(f.store.snapshot().folders.length, 1);
});
test('edita e remove somente o cadastro, mantendo a pasta e seu conteúdo', async t => {
  const f = await fixture(t); await fs.writeFile(path.join(f.folder, 'manter.txt'), 'manter');
  await f.service.save({ path: f.folder, name: '', includeSubfolders: false });
  const { id, createdAt } = f.store.snapshot().folders[0];
  await f.service.save({ path: f.folder, name: 'Novo nome', includeSubfolders: true }, id);
  assert.equal(f.store.snapshot().folders[0].includeSubfolders, true);
  assert.equal(f.store.snapshot().folders[0].createdAt, createdAt);
  await f.service.remove(id);
  assert.deepEqual(f.store.snapshot().folders, []);
  assert.equal(await fs.readFile(path.join(f.folder, 'manter.txt'), 'utf8'), 'manter');
});
test('recusa arquivos, caminhos ausentes e entradas inválidas sem salvar cadastros parciais', async t => {
  const f = await fixture(t); const file = path.join(f.root, 'arquivo.txt'); await fs.writeFile(file, 'x');
  await assert.rejects(f.service.save({ path: file, includeSubfolders: false }), /é um arquivo/);
  await assert.rejects(f.service.save({ path: path.join(f.root, 'não-existe'), includeSubfolders: false }), /não encontrada/);
  for (const input of [{}, { path: 'relativo', includeSubfolders: false }, { path: f.folder, name: 123, includeSubfolders: false }, { path: f.folder, includeSubfolders: 'sim' }, { path: f.folder + '\0', includeSubfolders: false }]) assert.throws(() => normalizeFolderInput(input));
  assert.equal(f.store.snapshot().folders.length, 0);
});
test('serializa alterações concorrentes e continua funcionando após uma rejeição', async t => {
  const f = await fixture(t); const dirs = [f.folder, path.join(f.root, 'B'), path.join(f.root, 'C')];
  await Promise.all(dirs.slice(1).map(dir => fs.mkdir(dir)));
  await Promise.all(dirs.map(dir => f.service.save({ path: dir, includeSubfolders: false })));
  await assert.rejects(f.service.save({ path: f.folder, includeSubfolders: false }), /já está/);
  await f.store.update(s => { s.settings.confirmRemoval = false; });
  const reopened = new Store(f.file); const state = await reopened.load();
  assert.equal(state.folders.length, 3); assert.equal(state.settings.confirmRemoval, false);
});
test('recupera configurações anteriores de backup se o arquivo principal for corrompido', async t => {
  const f = await fixture(t); await f.service.save({ path: f.folder, name: 'Original', includeSubfolders: false });
  await f.store.update(s => { s.settings.compactView = true; });
  await fs.writeFile(f.file, '{interrompido');
  const reopened = new Store(f.file); const state = await reopened.load();
  assert.equal(state.folders[0].name, 'Original'); assert.equal(state.settings.compactView, false);
  assert.match(reopened.recoveryMessage, /recuperadas/);
  await reopened.update(s => { s.settings.confirmRemoval = false; });
  const reloaded = new Store(f.file); await reloaded.load(); assert.equal(reloaded.snapshot().folders.length, 1);
});
test('preserva configurações irrecuperáveis e recusa sobrescrevê-las silenciosamente', async t => {
  const f = await fixture(t); await fs.writeFile(f.file, '{danificado');
  const reopened = new Store(f.file); await assert.rejects(reopened.load(), /preservados/);
  assert.equal(await fs.readFile(f.file, 'utf8'), '{danificado');
});
test('unidade desconectada continua cadastrada e aparece indisponível', async t => {
  const f = await fixture(t); await f.service.save({ path: f.folder, includeSubfolders: false });
  assert.equal((await f.service.availability())[0].available, true);
  await fs.rm(f.folder, { recursive: true });
  assert.equal((await f.service.availability())[0].available, false);
  assert.equal(f.store.snapshot().folders.length, 1);
});

test('configuração anterior recebe retomada desligada sem alterar pastas ou regras', async t => {
  const f = await fixture(t);
  await f.service.save({ path: f.folder, name: 'Trabalho', includeSubfolders: false });
  const old = f.store.snapshot();
  delete old.settings.resumeMonitoring;
  delete old.settings.monitoringFolders;
  await fs.writeFile(f.file, JSON.stringify(old));
  const next = await new Store(f.file).load();
  assert.deepEqual(next.folders, old.folders);
  assert.equal(next.settings.resumeMonitoring, false);
  assert.deepEqual(next.settings.monitoringFolders, []);
});

test('preferência de retomada inválida não é convertida silenciosamente em autorização', async t => {
  const f = await fixture(t);
  await assert.rejects(f.store.update(state => { state.settings.resumeMonitoring = 'true'; }), /monitoramento inválida/);
  await assert.rejects(f.store.update(state => { state.settings.monitoringFolders = [{ id: 'x', signature: true }]; }), /monitoramento inválida/);
  assert.equal(f.store.snapshot().settings.resumeMonitoring, false);
});

test('migra a última sessão monitorada para modos por pasta e preserva a configuração original', async t => {
  const f = await fixture(t);
  await f.service.save({ path: f.folder, name: 'Automática', includeSubfolders: false });
  const other = path.join(f.root, 'Manual'); await fs.mkdir(other);
  await f.service.save({ path: other, name: 'Manual', includeSubfolders: false });
  const legacy = f.store.snapshot();
  for (const folder of legacy.folders) delete folder.organizationMode;
  legacy.settings.monitoringFolders = [{ id: legacy.folders[0].id, signature: 'previous-session' }];
  legacy.settings.resumeMonitoring = false;
  const original = JSON.stringify(legacy);
  await fs.writeFile(f.file, original);
  const reopened = await new Store(f.file).load();
  assert.equal(reopened.folders[0].organizationMode, 'automatic');
  assert.equal(reopened.folders[1].organizationMode, 'manual');
  assert.equal(await fs.readFile(f.file + '.before-folder-modes.bak', 'utf8'), original);
  assert.equal(JSON.parse(await fs.readFile(f.file)).folders[0].organizationMode, 'automatic');
});

test('editar uma pasta preserva o modo escolhido e rejeita modos inválidos', async t => {
  const f = await fixture(t);
  await f.service.save({ path: f.folder, name: 'Original', includeSubfolders: false });
  const id = f.store.snapshot().folders[0].id;
  await f.store.update(state => { state.folders[0].organizationMode = 'automatic'; });
  await f.service.save({ path: f.folder, name: 'Novo nome', includeSubfolders: true }, id);
  assert.equal(f.store.snapshot().folders[0].organizationMode, 'automatic');
  await assert.rejects(f.store.update(state => { state.folders[0].organizationMode = 'unknown'; }), /Modo de organização inválido/);
});

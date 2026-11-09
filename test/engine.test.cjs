'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createEngine } = require('../src/engine/server.cjs');
const { TestTransfer } = require('./transfer-test-adapter.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'organiza-wpf-'));
  const profile = path.join(root, 'profile'), folder = path.join(root, 'Downloads'); await fs.mkdir(folder);
  const recycled = path.join(root, 'recycled'); await fs.mkdir(recycled);
  const engine = await createEngine({ profile, transfer: new TestTransfer(), applicationRoot: path.join(root, 'application'), stabilityMs: 1, host: async (method, value) => { assert.equal(method, 'recycle'); await fs.rename(value.path, path.join(recycled, path.basename(value.path))); } });
  t.after(async () => { await engine.shutdown(); await fs.rm(root, { recursive: true, force: true }); });
  const call = (method, ...args) => engine.call(method, args);
  await call('folder:save', { path: folder, name: 'Downloads', includeSubfolders: false });
  const id = (await engine.state()).folders[0].id;
  async function file(name) { const target = path.join(folder, name); await fs.writeFile(target, 'conteúdo original'); const age = new Date(Date.now() - 600000); await fs.utimes(target, age, age); return target; }
  return { engine, call, root, folder, profile, id, file, recycled };
}
test('WPF engine preserves configuration format and rejects unknown commands', async t => {
  const f = await fixture(t); await f.call('settings:update', { compactView: true });
  const state = await f.call('state:get'); assert.equal(state.version, 3); assert.equal(state.settings.compactView, true); assert.equal(state.appVersion, '0.8.0');
  await assert.rejects(f.call('arbitrary:command'), /Comando inválido/);
  await assert.rejects(f.call('settings:update', { arbitrary: true }), /inválida/);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.profile, 'config.json'))).version, 3);
});
test('WPF engine previews, confirms, organizes and undoes through the same journal', async t => {
  const f = await fixture(t); const source = await f.file('nota.pdf'); await f.call('rule:presets', f.id);
  const preview = await f.call('preview:scan', f.id); const row = preview.rows.find(r => r.name === 'nota.pdf');
  assert.equal(row.status, 'ready'); const plan = await f.call('organize:plan', preview.id, [row.id]); await f.call('organize:execute', plan.id, false);
  const history = await f.call('history:list'); assert.equal(history.entries[0].effectiveStatus, 'moved');
  await f.call('history:undo', history.entries[0].id); assert.equal(await fs.readFile(source, 'utf8'), 'conteúdo original');
});
test('WPF JSON null identifiers create new folders and rules instead of editing missing entries', async t => {
  const f = await fixture(t);
  await f.call('rule:save', f.id, { name: 'Textos', enabled: true, match: 'all', scope: 'inherit', action: 'move', conditions: [{field:'extension',value:'txt'}], destination:{mode:'relative',value:'Textos'},presetId:null }, null);
  assert.equal((await f.engine.state()).folders[0].organization.rules[0].name, 'Textos');
  const other = path.join(f.root,'Outra');await fs.mkdir(other);
  await f.call('folder:save',{path:other,name:'Outra',includeSubfolders:false},null);
  assert.equal((await f.engine.state()).folders.length,2);
});
test('WPF engine keeps one-off decisions separate from future rules', async t => {
  const f = await fixture(t); await f.file('arte.psd'); const preview = await f.call('preview:scan', f.id); const group = preview.review.groups[0];
  assert.equal(group.suggestion.name, 'Design'); const response = await f.call('review:assign', preview.id, group.rowIds, { mode: 'new', name: 'Design', destination: { mode: 'relative', value: 'Design' }, saveForFuture: false });
  assert.equal(response.state.folders[0].organization.rules[0].enabled, false); assert.ok(response.preview.rows[0].destination.endsWith('arte.psd'));
  assert.equal(await fs.readFile(path.join(f.folder, 'arte.psd'), 'utf8'), 'conteúdo original');
});
test('WPF engine recycles only explicitly planned unmatched selections', async t => {
  const f = await fixture(t); await f.file('a.qzxyz'); await f.file('b.qzxyz'); const preview = await f.call('preview:scan', f.id);
  const row = preview.rows.find(r => r.name === 'a.qzxyz'); const plan = await f.call('trash:plan', preview.id, [row.id]); await f.call('trash:execute', plan.id);
  assert.equal(await fs.readFile(path.join(f.folder, 'b.qzxyz'), 'utf8'), 'conteúdo original'); assert.equal((await fs.readdir(f.recycled)).length, 1);
  assert.equal((await f.call('history:list')).entries[0].effectiveStatus, 'trashed');
});
test('WPF engine analyzes and activates automation in one request', async t => {
  const f = await fixture(t); await f.call('rule:presets', f.id); await f.call('monitor:activate', [f.id]);
  await f.call('preview:scan', f.id); await f.call('monitor:activate', [f.id]); assert.deepEqual((await f.engine.state()).monitor.activeIds, [f.id]);
  await f.call('monitor:pause-all'); assert.deepEqual((await f.engine.state()).monitor.activeIds, []);
});
test('WPF engine invalidates preview after configuration changes and closes safely', async t => {
  const f = await fixture(t); await f.file('nota.pdf'); await f.call('rule:presets', f.id); const preview = await f.call('preview:scan', f.id);
  await f.call('rule:toggle', f.id, (await f.engine.state()).folders[0].organization.rules[0].id);
  await assert.rejects(f.call('organize:plan', preview.id, [preview.rows[0].id]), /prévia|Analise/i);
  await f.engine.shutdown(); await assert.rejects(f.call('state:get'), /encerrando/);
});

async function reopenForMonitoring(f, t) {
  await f.engine.shutdown();
  const engine = await createEngine({ profile: f.profile, transfer: new TestTransfer(),
    applicationRoot: path.join(f.root, 'application'), stabilityMs: 1 });
  t.after(() => engine.shutdown());
  return engine;
}

test('automatic folders resume on restart without a global opt-in', async t => {
  const f = await fixture(t);
  await f.call('rule:presets', f.id);
  await f.call('preview:scan', f.id);
  await f.call('monitor:activate', [f.id]);
  const reopened = await reopenForMonitoring(f, t);
  await reopened.call('monitor:restore', []);
  assert.deepEqual((await reopened.state()).monitor.activeIds, [f.id]);
  assert.equal((await reopened.state()).folders[0].organizationMode, 'automatic');
});

test('saved automatic mode restores only authorized folders and restoration is idempotent', async t => {
  const f = await fixture(t);
  await f.call('rule:presets', f.id);
  await f.call('preview:scan', f.id);
  await f.call('monitor:activate', [f.id]);
  const reopened = await reopenForMonitoring(f, t);
  await reopened.call('monitor:restore', []);
  assert.deepEqual((await reopened.state()).monitor.activeIds, [f.id]);
  await reopened.call('monitor:pause-all', []);
  await reopened.call('monitor:restore', []);
  assert.deepEqual((await reopened.state()).monitor.activeIds, []);
});

test('an explicitly paused folder is not resumed on the next startup', async t => {
  const f = await fixture(t);
  await f.call('rule:presets', f.id);
  await f.call('preview:scan', f.id);
  await f.call('monitor:activate', [f.id]);
  await f.call('monitor:pause', f.id);
  const reopened = await reopenForMonitoring(f, t);
  await reopened.call('monitor:restore', []);
  assert.deepEqual((await reopened.state()).monitor.activeIds, []);
});

test('editing rules preserves automatic mode and revalidates monitoring', async t => {
  const f = await fixture(t);
  await f.call('rule:presets', f.id);
  await f.call('preview:scan', f.id);
  await f.call('monitor:activate', [f.id]);
  const rule = (await f.engine.state()).folders[0].organization.rules[0];
  await f.call('rule:toggle', f.id, rule.id);
  const reopened = await reopenForMonitoring(f, t);
  await reopened.call('monitor:restore', []);
  assert.deepEqual((await reopened.state()).monitor.activeIds, [f.id]);
});

test('offline folders are reported and remain paused when resumption fails', async t => {
  const f = await fixture(t);
  await f.call('rule:presets', f.id);
  await f.call('preview:scan', f.id);
  await f.call('monitor:activate', [f.id]);
  const reopened = await reopenForMonitoring(f, t);
  await fs.rename(f.folder, f.folder + '-offline');
  await reopened.call('monitor:restore', []);
  assert.ok((await reopened.state()).monitor.issues[f.id]);
  assert.equal((await reopened.state()).folders[0].organizationMode, 'automatic');
  assert.deepEqual((await reopened.state()).monitor.activeIds, []);
});

test('manual folders remain manual when the application is reopened', async t => {
  const f = await fixture(t);
  await f.call('rule:presets', f.id);
  const reopened = await reopenForMonitoring(f, t);
  await reopened.call('monitor:restore', []);
  assert.deepEqual((await reopened.state()).monitor.activeIds, []);
  assert.equal((await reopened.state()).folders[0].organizationMode, 'manual');
});

test('a manual operation temporarily suspends automation without changing the saved mode', async t => {
  const f = await fixture(t);
  await f.file('nota.pdf');
  await f.call('rule:presets', f.id);
  await f.call('monitor:activate', [f.id]);
  const preview = await f.call('preview:scan', f.id);
  const row = preview.rows.find(row => row.name === 'nota.pdf');
  const plan = await f.call('organize:plan', preview.id, [row.id]);
  assert.deepEqual((await f.engine.state()).monitor.activeIds, []);
  assert.equal((await f.engine.state()).folders[0].organizationMode, 'automatic');
  await f.call('organize:execute', plan.id, false);
  assert.deepEqual((await f.engine.state()).monitor.activeIds, [f.id]);
});

test('cancelling a manual confirmation can resume the saved automatic mode', async t => {
  const f = await fixture(t);
  await f.file('nota.pdf'); await f.call('rule:presets', f.id);
  await f.call('monitor:activate', [f.id]);
  const preview = await f.call('preview:scan', f.id);
  await f.call('organize:plan', preview.id, [preview.rows.find(row => row.name === 'nota.pdf').id]);
  await f.call('monitor:reconcile');
  assert.deepEqual((await f.engine.state()).monitor.activeIds, [f.id]);
});

test('failed activation leaves a previously manual folder in manual mode', async t => {
  const f = await fixture(t);
  await assert.rejects(f.call('monitor:activate', [f.id]), /regra ativa/);
  assert.equal((await f.engine.state()).folders[0].organizationMode, 'manual');
  assert.deepEqual((await f.engine.state()).monitor.activeIds, []);
});

test('changing only the folder mode preserves an existing reviewed file preview', async t => {
  const f = await fixture(t);
  await f.file('nota.pdf'); await f.call('rule:presets', f.id);
  const preview = await f.call('preview:scan', f.id);
  await f.call('monitor:activate', [f.id]);
  const row = preview.rows.find(row => row.name === 'nota.pdf');
  const plan = await f.call('organize:plan', preview.id, [row.id]);
  assert.equal(plan.entries.length, 1);
});

test('removing all active rules keeps automatic intent but reports the activation issue', async t => {
  const f = await fixture(t);
  await f.call('rule:presets', f.id); await f.call('monitor:activate', [f.id]);
  for (const rule of (await f.engine.state()).folders[0].organization.rules)
    await f.call('rule:toggle', f.id, rule.id);
  const state = await f.engine.state();
  assert.equal(state.folders[0].organizationMode, 'automatic');
  assert.deepEqual(state.monitor.activeIds, []);
  assert.match(state.monitor.issues[f.id], /regra ativa/);
});

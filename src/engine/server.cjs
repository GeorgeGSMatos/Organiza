'use strict';
// Headless engine for the native WPF client. No Electron or network endpoint.
const path = require('node:path');
const { version: appVersion } = require('../../package.json');
const { Store, FolderService, UserError } = require('../main/store.cjs');
const { RulesService } = require('../main/rules-service.cjs');
const { PreviewService, revision } = require('../main/preview.cjs');
const { TYPES } = require('../main/rules-config.cjs');
const { History } = require('../main/history.cjs');
const { Organizer } = require('../main/organizer.cjs');
const { MonitoringSession } = require('./monitoring-session.cjs');
const { Monitor } = require('../main/monitor.cjs');
const { WindowsTransfer } = require('../main/windows-transfer.cjs');
const { ReviewService } = require('../main/review.cjs');
const { TrashService } = require('../main/trash.cjs');

async function createEngine(options) {
  const { profile, emit = () => {}, host = async () => { throw new UserError('Recurso do Windows indisponível.'); } } = options;
  const store = new Store(path.join(profile, 'config.json')); await store.load();
  const folders = new FolderService(store), rules = new RulesService(store);
  const preview = new PreviewService(store, value => emit('preview:progress', value));
  const history = new History(path.join(profile, 'history.jsonl')); await history.load();
  const transfer = options.transfer || new WindowsTransfer(path.join(__dirname, '../native/worker.ps1'));
  const changed = () => emit('organizer:changed', null);
  const organizer = new Organizer(store, preview, history, transfer, {
    stabilityMs: options.stabilityMs ?? 1000,
    protectedRoots: [profile, options.applicationRoot || path.resolve(__dirname, '../..'), process.env.SystemRoot, process.env.ProgramFiles, process.env['ProgramFiles(x86)']],
    progress: value => emit('organizer:progress', value), onChanged: changed
  });
  const monitor = new Monitor(store, organizer, history, { changed, ...options.monitorOptions });
  const session = new MonitoringSession(store, monitor, preview, history, organizer);
  const review = new ReviewService(store, preview, rules, organizer);
  const trash = new TrashService(review, organizer, history, file => host('recycle', { path: path.resolve(file) }));
  let closing = false, recovering = Promise.resolve();
  const state = async () => {
    const availability = await folders.availability();
    return { ...store.snapshot(), availability, recoveryMessage: store.recoveryMessage,
      capabilities: { organize: organizer.supported(), trash: organizer.supported() },
      monitor: { ...monitor.state(), ...session.state() }, operation: { busy: organizer.busy && organizer.kind !== 'configuration', kind: organizer.kind, recovering: organizer.recovering },
      history: history.summary(), appVersion, fileTypes: TYPES };
  };
  async function change(id, action) {
    await organizer.mutate(async () => { await action(); session.suspend(id); preview.invalidate(); }); await session.reconcile(); return state();
  }
  async function reviewAction(id, ids, action) {
    const result = await organizer.mutate(async () => {
      const source = ids ? review.rows(id, ids)[0].folderId : null;
      const before = revision(store.snapshot()), value = await action();
      if (before !== revision(store.snapshot())) { session.suspend(source); }
      return value;
    });
    await session.reconcile();
    return { ...result, state: await state() };
  }
  const methods = {
    'state:get': state,
    'folder:save': (input, id) => change(id, () => folders.save(input, id ?? undefined)),
    'folder:remove': id => change(id, () => folders.remove(id)),
    'folder:availability': () => folders.availability(),
    'folder:path': async id => {
      const folder = store.snapshot().folders.find(f => f.id === id);
      if (!folder) throw new UserError('Pasta não cadastrada.');
      const stat = await require('node:fs/promises').stat(folder.path).catch(() => null);
      if (!stat?.isDirectory()) throw new UserError('A pasta está indisponível.'); return folder.path;
    },
    'rule:save': (id, input, ruleId) => change(id, () => rules.save(id, input, ruleId ?? undefined)),
    'rule:toggle': (id, ruleId) => change(id, () => rules.toggle(id, ruleId)),
    'rule:remove': (id, ruleId) => change(id, () => rules.remove(id, ruleId)),
    'rule:presets': id => change(id, () => rules.presets(id)),
    'policy:save': (id, input) => change(id, () => rules.policy(id, input)),
    'preview:scan': async id => { const result = await preview.scan(id || undefined); monitor.review(result); return review.decorate(result); },
    'preview:cancel': () => preview.cancel(),
    'preview:resolve': async (...args) => review.decorate(await preview.resolve(...args)),
    'review:assign': (id, ids, input) => reviewAction(id, ids, () => review.assign(id, ids, input)),
    'review:keep': (id, ids) => reviewAction(id, ids, async () => ({ preview: await review.keep(id, ids) })),
    'review:defer': (id, ids) => reviewAction(id, ids, async () => ({ preview: await review.defer(id, ids) })),
    'review:resume': id => reviewAction(id, null, async () => ({ preview: review.resume(id) })),
    'organize:plan': async (id, ids) => { organizer.ensureIdle(); session.suspend(); return organizer.plan(id, ids); },
    'organize:execute': async (id, approved) => { try { return await organizer.execute(id, approved); } finally { await session.reconcile(); } },
    'organize:cancel': () => organizer.stop(),
    'trash:plan': async (id, ids) => { organizer.ensureIdle(); session.suspend(); return trash.plan(id, ids); },
    'trash:execute': async id => { try { return await trash.execute(id); } finally { await session.reconcile(); } },
    'history:list': () => ({ entries: history.entries(), ...history.summary() }),
    'history:undo': async id => { session.suspend(); try { return await organizer.undo(id); } finally { await session.reconcile(); } },
    'history:recover': async () => { organizer.ensureIdle(); await organizer.recover(); return { entries: history.entries(), ...history.summary() }; },
    'history:path': (id, side) => { const entry = history.entries().find(e => e.id === id); if (!entry || !['source', 'destination'].includes(side) || !entry[side]) throw new UserError('Caminho indisponível.'); return entry[side]; },
    'monitor:activate': ids => session.activate(ids),
    'monitor:pause': id => session.pause(id),
    'monitor:pause-all': () => session.pauseAll(),
    'monitor:suspend': () => { session.suspend(); return monitor.state(); },
    'monitor:reconcile': () => session.reconcile(),
    'monitor:restore': async () => { await recovering; return session.restore(); },
    'settings:update': async patch => {
      if (!patch || Array.isArray(patch) || !Object.keys(patch).length || Object.entries(patch).some(([k, v]) => !['launchAtLogin', 'confirmRemoval', 'compactView'].includes(k) || typeof v !== 'boolean')) throw new UserError('Preferência inválida.');
      await store.update(next => Object.assign(next.settings, patch));
      return state();
    }
  };
  async function shutdown() {
    closing = true; session.cancelRestoration(); preview.cancel(); monitor.pauseAll(); organizer.stop();
    await organizer.idle; await recovering;
    // Monitor may be finishing its metadata scan; generation prevents starting a new move.
    await session.queue; await store.queue; await history.queue; transfer.close();
  }
  return {
    state, shutdown,
    recover: () => (recovering = organizer.recover().finally(changed)),
    async call(method, args) {
      if (closing) throw new UserError('O aplicativo está encerrando.');
      if (!Object.hasOwn(methods, method) || !Array.isArray(args) || args.length > 5) throw new UserError('Comando inválido.');
      return methods[method](...args);
    }
  };
}
module.exports = { createEngine };

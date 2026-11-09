'use strict';
const { UserError } = require('../main/errors.cjs');
const { PreviewService } = require('../main/preview.cjs');

// A folder's saved mode is independent of temporary pauses for editing or manual operations.
class MonitoringSession {
  constructor(store, monitor, preview, history, organizer) {
    Object.assign(this, { store, monitor, history, organizer });
    this.analysis = new PreviewService(store);
    this.restored = false;
    this.cancelled = false;
    this.held = false;
    this.issues = {};
    this.queue = Promise.resolve();
    this.requests = new Map();
  }
  state() { return { issues: { ...this.issues } }; }
  cancelRestoration() { this.cancelled = true; this.analysis.cancel(); }
  automaticIds() { return this.store.snapshot().folders.filter(folder => folder.organizationMode === 'automatic').map(folder => folder.id); }
  requestVersion(id) { return this.requests.get(id) || 0; }
  invalidateRequest(id) { this.requests.set(id, this.requestVersion(id) + 1); }
  async setModes(ids, mode, versions) {
    await this.store.update(state => {
      if (versions && ids.some(id => this.requestVersion(id) !== versions.get(id))) throw new UserError('Ativação interrompida.');
      for (const folder of state.folders) if (ids.includes(folder.id)) folder.organizationMode = mode;
      // Maintain the legacy migration hint for older local clients, without a global opt-in.
      state.settings.monitoringFolders = state.folders.filter(folder => folder.organizationMode === 'automatic')
        .map(folder => ({ id: folder.id, signature: JSON.stringify(folder) }));
    });
  }
  serialize(action) {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }
  async inspect(id) {
    const scan = await this.analysis.scan(id);
    if (this.cancelled || this.held || scan.cancelled) throw new UserError('Ativação interrompida.');
    if (scan.limited || scan.warnings.length) throw new UserError(scan.warnings[0] || 'A análise está incompleta. Confira a pasta.');
    this.monitor.review(scan);
  }
  activate(ids) {
    return this.serialize(async () => {
      this.organizer.ensureIdle();
      if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string')) throw new UserError('Escolha ao menos uma pasta.');
      const folders = this.store.snapshot().folders;
      for (const id of ids) {
        const folder = folders.find(folder => folder.id === id);
        if (!folder?.organization.rules.some(rule => rule.enabled && rule.action === 'move'))
          throw new UserError('Cada pasta precisa de uma regra ativa de organização.');
      }
      this.held = false;
      const versions = new Map(ids.map(id => [id, this.requestVersion(id)]));
      const previouslyActive = new Set(this.monitor.state().activeIds);
      try {
        for (const id of ids) await this.inspect(id);
        if (ids.some(id => this.requestVersion(id) !== versions.get(id))) throw new UserError('Ativação interrompida.');
        await this.monitor.activate(ids);
        if (this.cancelled || this.held) throw new UserError('Ativação interrompida.');
        await this.setModes(ids, 'automatic', versions);
        for (const id of ids) delete this.issues[id];
      } catch (error) {
        for (const id of ids) if (!previouslyActive.has(id) || this.requestVersion(id) !== versions.get(id)) this.monitor.pause(id);
        throw error;
      }
      return this.monitor.state();
    });
  }
  async pause(id) {
    if (!this.store.snapshot().folders.some(folder => folder.id === id)) throw new UserError('Pasta não cadastrada.');
    this.invalidateRequest(id);
    this.monitor.pause(id);
    await this.setModes([id], 'manual');
    delete this.issues[id];
    return this.monitor.state();
  }
  async pauseAll() {
    this.held = true;
    for (const folder of this.store.snapshot().folders) this.invalidateRequest(folder.id);
    this.analysis.cancel();
    this.monitor.pauseAll();
    await this.setModes(this.store.snapshot().folders.map(folder => folder.id), 'manual');
    this.issues = {};
    return this.monitor.state();
  }
  suspend(id) {
    this.held = true;
    this.analysis.cancel();
    this.monitor.invalidate(id);
    if (id) delete this.issues[id];
    else this.issues = {};
  }
  reconcile() {
    return this.serialize(async () => {
      if (this.cancelled) return this.monitor.state();
      this.held = false;
      const active = new Set(this.monitor.state().activeIds);
      for (const id of this.automaticIds()) {
        if (this.cancelled || this.held) break;
        if (active.has(id)) continue;
        try {
          if (this.history.error || this.history.summary().attention || this.organizer.recovering)
            throw new UserError('Confira o Histórico antes de retomar a organização automática.');
          this.organizer.ensureIdle();
          await this.inspect(id);
          if (this.store.snapshot().folders.find(folder => folder.id === id)?.organizationMode !== 'automatic') continue;
          await this.monitor.activate([id]);
          if (this.held || this.cancelled || this.store.snapshot().folders.find(folder => folder.id === id)?.organizationMode !== 'automatic') { this.monitor.pause(id); continue; }
          delete this.issues[id];
        } catch (error) { this.issues[id] = error.message; }
      }
      return this.monitor.state();
    });
  }
  async restore() {
    if (this.restored) return this.monitor.state();
    this.restored = true;
    return this.reconcile();
  }
}
module.exports = { MonitoringSession };

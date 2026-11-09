'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { UserError } = require('./errors.cjs');
const { defaultOrganization, validateOrganization } = require('./rules-config.cjs');
const defaults = () => ({ version: 3, folders: [], settings: { launchAtLogin: false, confirmRemoval: true, compactView: false, resumeMonitoring: false, monitoringFolders: [] } });
function validateState(value) {
  if (!value || ![1,2,3].includes(value.version) || !Array.isArray(value.folders) || !value.settings || value.folders.length > 500) throw new Error('Formato de configuração inválido ou versão incompatível.');
  const ids = new Set();
  for (const folder of value.folders) {
    if (!folder || typeof folder.id !== 'string' || !folder.id || ids.has(folder.id) || typeof folder.path !== 'string' || !folder.path || typeof folder.name !== 'string' || !folder.name.trim() || typeof folder.includeSubfolders !== 'boolean' || typeof folder.createdAt !== 'string') throw new Error('Cadastro de pasta inválido.');
    ids.add(folder.id);
    if (value.version >= 2) validateOrganization(folder.organization);
    if (!Object.hasOwn(folder, 'organizationMode'))
      folder.organizationMode = (Array.isArray(value.settings.monitoringFolders) && value.settings.monitoringFolders.some(entry => entry.id === folder.id)) ? 'automatic' : 'manual';
    if (!['automatic', 'manual'].includes(folder.organizationMode)) throw new Error('Modo de organização inválido.');
  }
  for (const key of ['launchAtLogin', 'confirmRemoval', 'compactView']) if (typeof value.settings[key] !== 'boolean') throw new Error('Preferência inválida.');
  if (!Object.hasOwn(value.settings, 'resumeMonitoring')) value.settings.resumeMonitoring = false;
  if (!Object.hasOwn(value.settings, 'monitoringFolders')) value.settings.monitoringFolders = [];
  if (typeof value.settings.resumeMonitoring !== 'boolean' || !Array.isArray(value.settings.monitoringFolders) ||
      value.settings.monitoringFolders.length > 500 || value.settings.monitoringFolders.some(folder =>
        !folder || typeof folder.id !== 'string' || typeof folder.signature !== 'string')) throw new Error('Preferência de monitoramento inválida.');
  if (value.version === 1) { value.folders = value.folders.map(folder => ({ ...folder, organization: defaultOrganization() })); }
  value.version = 3;
  return value;
}
const clone = value => structuredClone(value);
class Store {
  constructor(file) { this.file = file; this.state = null; this.queue = Promise.resolve(); this.recoveryMessage = null; }
  async load() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    let firstError, legacySource = 0, modeMigration = false;
    try { const parsed = JSON.parse(await fs.readFile(this.file, 'utf8')); const legacy = parsed.version < 3 ? parsed.version : 0; modeMigration = Array.isArray(parsed.folders) && parsed.folders.some(folder => folder && !Object.hasOwn(folder, 'organizationMode')); this.state = validateState(parsed); legacySource = legacy; }
    catch (error) {
      firstError = error;
      try {
        this.state = validateState(JSON.parse(await fs.readFile(this.file + '.bak', 'utf8')));
        this.recoveryMessage = 'As configurações foram recuperadas da cópia local de segurança.';
        await fs.copyFile(this.file, this.file + '.danificado-' + Date.now()).catch(() => {});
      } catch (backupError) {
        if (firstError.code === 'ENOENT' && backupError.code === 'ENOENT') this.state = defaults();
        else throw new UserError('Não foi possível ler suas configurações. Os arquivos foram preservados. Consulte o guia para recuperar a cópia local.');
      }
    }
    if (legacySource) {
      try { await fs.copyFile(this.file, this.file + '.v' + legacySource + '.bak', require('node:fs').constants.COPYFILE_EXCL); }
      catch (error) { if (error.code !== 'EEXIST') throw new UserError('Não foi possível preservar uma cópia do cadastro anterior. Confira a permissão da pasta de configurações.'); }
    }
    if (modeMigration && !this.recoveryMessage) {
      try { await fs.copyFile(this.file, this.file + '.before-folder-modes.bak', require('node:fs').constants.COPYFILE_EXCL); }
      catch (error) { if (error.code !== 'EEXIST') throw new UserError('Não foi possível preservar a configuração anterior dos modos de organização.'); }
      await this.update(() => {});
    }
    return clone(this.state);
  }
  snapshot() { if (!this.state) throw new Error('Store não inicializado.'); return clone(this.state); }
  update(change) {
    const operation = this.queue.then(async () => {
      const next = clone(this.state);
      await change(next);
      validateState(next);
      const temporary = this.file + '.' + randomUUID() + '.tmp';
      try {
        const handle = await fs.open(temporary, 'wx', 0o600);
        try { await handle.writeFile(JSON.stringify(next, null, 2), 'utf8'); await handle.sync(); } finally { await handle.close(); }
        await fs.writeFile(this.file + '.bak', JSON.stringify(this.state, null, 2), { mode: 0o600 });
        await fs.rename(temporary, this.file);
        this.state = next;
      } catch (error) { await fs.unlink(temporary).catch(() => {}); throw error; }
      return clone(this.state);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
function normalizeFolderInput(input) {
  if (!input || typeof input !== 'object' || typeof input.path !== 'string') throw new UserError('Escolha uma pasta ou informe um caminho completo.');
  const raw = input.path.trim();
  if (!raw || raw.length > 32760 || raw.includes('\0') || !path.isAbsolute(raw)) throw new UserError('Informe um caminho absoluto, como C:\\Users\\SeuNome\\Documentos.');
  if (process.platform === 'win32' && (/^\\\\[?.]\\/.test(raw) || raw.split(/[\\/]/).some(part => /[<>"|*?]/.test(part)))) throw new UserError('Este caminho contém caracteres não permitidos.');
  const requestedName = input.name === undefined ? '' : input.name;
  if (typeof requestedName !== 'string' || requestedName.length > 80) throw new UserError('Use um nome de até 80 caracteres.');
  if (typeof input.includeSubfolders !== 'boolean') throw new UserError('Escolha se deseja incluir subpastas.');
  return { path: path.resolve(raw), name: requestedName.trim(), includeSubfolders: input.includeSubfolders };
}
const pathKey = p => process.platform === 'win32' ? p.toLowerCase() : p;
class FolderService {
  constructor(store) { this.store = store; }
  async save(input, id) {
    const clean = normalizeFolderInput(input);
    let canonical;
    try {
      const stat = await fs.stat(clean.path);
      if (!stat.isDirectory()) throw new UserError('O caminho escolhido é um arquivo. Escolha uma pasta.');
      await fs.access(clean.path, require('node:fs').constants.R_OK);
      const dir = await fs.opendir(clean.path); await dir.close();
      canonical = await fs.realpath(clean.path);
    } catch (error) {
      if (error instanceof UserError) throw error;
      if (error.code === 'ENOENT') throw new UserError('Pasta não encontrada. Confira o caminho ou conecte a unidade.');
      throw new UserError('Não foi possível acessar esta pasta. Confira a conexão e as permissões.');
    }
    return this.store.update(state => {
      if (id && !state.folders.some(folder => folder.id === id)) throw new UserError('Esta pasta já foi removida. Atualize a tela.');
      if (state.folders.some(folder => folder.id !== id && pathKey(folder.path) === pathKey(canonical))) throw new UserError('Esta pasta já está cadastrada no Organiza.');
      if (!id && state.folders.length >= 500) throw new UserError('Você atingiu o limite de 500 pastas cadastradas.');
      const folder = { id: id || randomUUID(), path: canonical, name: clean.name || path.basename(canonical) || canonical, includeSubfolders: clean.includeSubfolders, organizationMode: id ? state.folders.find(folder => folder.id === id).organizationMode : 'manual', organization: id ? state.folders.find(folder => folder.id === id).organization : defaultOrganization(), createdAt: id ? state.folders.find(folder => folder.id === id).createdAt : new Date().toISOString() };
      if (id) state.folders[state.folders.findIndex(folder => folder.id === id)] = folder;
      else state.folders.push(folder);
    });
  }
  async remove(id) { return this.store.update(state => { if (!state.folders.some(folder => folder.id === id)) throw new UserError('Pasta não encontrada no cadastro.'); state.folders = state.folders.filter(folder => folder.id !== id); }); }
  async availability() {
    return Promise.all(this.store.snapshot().folders.map(async folder => {
      let timer;
      try {
        const check = (async () => { const dir = await fs.opendir(folder.path); await dir.close(); })();
        await Promise.race([check, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 2500); })]);
        return { id: folder.id, available: true };
      } catch { return { id: folder.id, available: false }; }
      finally { clearTimeout(timer); }
    }));
  }
}
module.exports = { Store, FolderService, UserError, defaults, validateState, normalizeFolderInput };

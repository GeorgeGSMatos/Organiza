'use strict';
const { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Store, FolderService, UserError } = require('./store.cjs');
const { RulesService } = require('./rules-service.cjs');
const { PreviewService } = require('./preview.cjs');
const { TYPES } = require('./rules-config.cjs');
const { History } = require('./history.cjs');
const { Organizer } = require('./organizer.cjs');
const { Monitor } = require('./monitor.cjs');
const { WindowsTransfer } = require('./windows-transfer.cjs');
const { ReviewService } = require('./review.cjs');
const { TrashService } = require('./trash.cjs');
const { revision } = require('./preview.cjs');
const metadata = require('../../package.json');
app.setName(metadata.productName);
let window, store, folders, rules, preview, history, organizer, monitor, transfer, review, trash;
const entry = path.join(__dirname, '../renderer/index.html');
const allowedURL = pathToFileURL(entry).href;
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => { console.error(error); dialog.showErrorBox('Não foi possível abrir o Organiza', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== allowedURL) return { ok: false, error: 'Acesso não permitido.' };
    try { return { ok: true, value: await action(...args) }; }
    catch (error) { console.error(channel, error); return { ok: false, error: error instanceof UserError ? error.message : 'Não foi possível concluir. Confira o acesso à pasta e tente novamente.' }; }
  });
}
async function state() {
  const availability = await folders.availability();
  const data = store.snapshot();
  if (process.platform === 'win32' && app.isPackaged) data.settings.launchAtLogin = app.getLoginItemSettings().openAtLogin;
  return { ...data, availability, recoveryMessage: store.recoveryMessage, capabilities: { launchAtLogin: process.platform === 'win32' && app.isPackaged, organize: organizer.supported(), trash: organizer.supported(), recycleBin: process.platform === 'win32' }, monitor: monitor.state(), operation: { busy: organizer.busy && organizer.kind !== 'configuration', kind: organizer.kind, recovering: organizer.recovering }, history: history.summary(), appVersion: metadata.version, fileTypes: TYPES };
}
async function changeConfiguration(folderId, action) {
  await organizer.mutate(async () => { await action(); monitor.invalidate(folderId); preview.invalidate(); });
  return state();
}
async function reviewAction(id, ids, action) {
  const result = await organizer.mutate(async () => {
    const source = ids ? review.rows(id, ids)[0].folderId : null;
    const before = revision(store.snapshot());
    const value = await action();
    if (before !== revision(store.snapshot())) monitor.invalidate(source);
    return value;
  });
  return { ...result, state: await state() };
}
async function start() {
  app.setAppUserModelId('br.organiza.desktop'); nativeTheme.themeSource = 'dark';
  store = new Store(path.join(app.getPath('userData'), 'config.json'));
  await store.load(); folders = new FolderService(store); rules = new RulesService(store);
  preview = new PreviewService(store, progress => { if (window && !window.isDestroyed()) window.webContents.send('preview:progress', progress); });
  history = new History(path.join(app.getPath('userData'), 'history.jsonl')); await history.load();
  const nativeScript = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked/src/native/worker.ps1') : path.join(__dirname, '../native/worker.ps1');
  const testingFactory = !app.isPackaged && global[Symbol.for('organiza.test.transfer')];
  transfer = testingFactory ? testingFactory() : new WindowsTransfer(nativeScript);
  const changed = () => { if (window && !window.isDestroyed()) window.webContents.send('organizer:changed'); };
  organizer = new Organizer(store, preview, history, transfer, { stabilityMs: testingFactory ? 5 : 1000, protectedRoots: [app.getPath('userData'), path.dirname(process.execPath), process.env.SystemRoot, process.env.ProgramFiles, process.env['ProgramFiles(x86)']], progress: progress => { if (window && !window.isDestroyed()) window.webContents.send('organizer:progress', progress); }, onChanged: changed });
  monitor = new Monitor(store, organizer, history, { changed, ...(testingFactory ? { interval: 250, observationMs: 0 } : {}) });
  review = new ReviewService(store, preview, rules, organizer);
  const trashFactory = !app.isPackaged && global[Symbol.for('organiza.test.trash')];
  trash = new TrashService(review, organizer, history, trashFactory ? trashFactory() : file => shell.trashItem(path.resolve(file)));
  Menu.setApplicationMenu(null);
  window = new BrowserWindow({
    width: 1480, height: 960, minWidth: 1000, minHeight: 700, show: false,
    backgroundColor: '#202127', title: 'Organiza', frame: false,
    icon: path.join(__dirname, '../renderer/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('file://') && !details.url.startsWith('data:') }));
  for (const name of ['maximize', 'unmaximize']) window.on(name, () => window.webContents.send('window:maximized', window.isMaximized()));
  handle('state:get', state);
  handle('folder:pick', async () => {
    const result = await dialog.showOpenDialog(window, { title: 'Escolha uma pasta para o Organiza', buttonLabel: 'Selecionar pasta', properties: ['openDirectory', 'dontAddToRecent'] });
    return result.canceled ? null : result.filePaths[0];
  });
  handle('folder:save', (input, id) => changeConfiguration(id, () => folders.save(input, id)));
  handle('folder:remove', id => changeConfiguration(id, () => folders.remove(id)));
  handle('rule:save', (folderId, input, ruleId) => changeConfiguration(folderId, () => rules.save(folderId, input, ruleId)));
  handle('rule:toggle', (folderId, ruleId) => changeConfiguration(folderId, () => rules.toggle(folderId, ruleId)));
  handle('rule:remove', (folderId, ruleId) => changeConfiguration(folderId, () => rules.remove(folderId, ruleId)));
  handle('rule:presets', (folderId) => changeConfiguration(folderId, () => rules.presets(folderId)));
  handle('policy:save', (folderId, input) => changeConfiguration(folderId, () => rules.policy(folderId, input)));
  handle('preview:scan', async folderId => { const result = await preview.scan(folderId); monitor.review(result); return review.decorate(result); });
  handle('preview:cancel', () => preview.cancel());
  handle('preview:resolve', async (previewId, rowId, ruleId) => review.decorate(await preview.resolve(previewId, rowId, ruleId)));
  handle('review:assign', (id, ids, input) => reviewAction(id, ids, () => review.assign(id, ids, input)));
  handle('review:keep', (id, ids) => reviewAction(id, ids, async () => ({preview:await review.keep(id, ids)})));
  handle('review:defer', (id, ids) => reviewAction(id, ids, async () => ({preview:await review.defer(id, ids)})));
  handle('review:resume', id => reviewAction(id, null, async () => ({preview:review.resume(id)})));
  handle('trash:plan', (id, ids) => { organizer.ensureIdle(); monitor.pauseAll(); return trash.plan(id, ids); });
  handle('trash:execute', id => trash.execute(id));
  handle('system:recycle-bin', () => {
    if (process.platform !== 'win32') throw new UserError('Abra a Lixeira no Windows.');
    return new Promise((resolve,reject) => { const child = require('node:child_process').spawn(path.join(process.env.SystemRoot || 'C:\\Windows','explorer.exe'), ['shell:RecycleBinFolder'], {detached:true,stdio:'ignore'}); child.once('error',()=>reject(new UserError('Não foi possível abrir a Lixeira.'))); child.once('spawn',()=>{child.unref();resolve();}); });
  });
  handle('organize:plan', (previewId, ids) => { organizer.ensureIdle(); monitor.pauseAll(); return organizer.plan(previewId, ids); });
  handle('organize:execute', (planId, approveReview) => organizer.execute(planId, approveReview));
  handle('organize:cancel', () => organizer.stop());
  handle('history:list', () => ({ entries: history.entries(), ...history.summary() }));
  handle('history:undo', id => { monitor.pauseAll(); return organizer.undo(id); });
  handle('history:recover', async () => { organizer.ensureIdle(); await organizer.recover(); return { entries: history.entries(), ...history.summary() }; });
  handle('history:reveal', async (id, side) => { const entry = history.entries().find(item => item.id === id); if (!entry || !['source','destination'].includes(side)) throw new UserError('Registro inválido.'); if (!entry[side]) throw new UserError('O destino é gerenciado pela Lixeira do Windows.'); shell.showItemInFolder(entry[side]); });
  handle('monitor:activate', ids => monitor.activate(ids));
  handle('monitor:pause', id => monitor.pause(id));
  handle('monitor:pause-all', () => monitor.pauseAll());
  handle('folder:availability', () => folders.availability());
  handle('folder:open', async id => {
    const folder = store.snapshot().folders.find(item => item.id === id);
    if (!folder) throw new UserError('Esta pasta não está mais cadastrada.');
    try { const stat = await require('node:fs/promises').stat(folder.path); if (!stat.isDirectory()) throw new Error(); } catch { throw new UserError('A pasta não está disponível. Confira se a unidade está conectada.'); }
    const result = await shell.openPath(folder.path); if (result) throw new UserError('Não foi possível abrir a pasta. Confira se a unidade está conectada.');
  });
  handle('settings:update', async patch => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length || Object.entries(patch).some(([key, value]) => !['launchAtLogin', 'confirmRemoval', 'compactView'].includes(key) || typeof value !== 'boolean')) throw new UserError('Preferência inválida.');
    const loginChanged = Object.hasOwn(patch, 'launchAtLogin'); let oldLogin;
    if (loginChanged) {
      if (process.platform !== 'win32' || !app.isPackaged) throw new UserError('Esta opção está disponível no aplicativo empacotado para Windows.');
      oldLogin = app.getLoginItemSettings().openAtLogin; app.setLoginItemSettings({ openAtLogin: patch.launchAtLogin, path: process.execPath });
      if (app.getLoginItemSettings().openAtLogin !== patch.launchAtLogin) throw new UserError('O Windows não permitiu alterar a inicialização.');
    }
    try { await store.update(next => Object.assign(next.settings, patch)); }
    catch (error) { if (loginChanged) app.setLoginItemSettings({ openAtLogin: oldLogin, path: process.execPath }); throw error; }
    return state();
  });
  handle('window:action', action => {
    if (action === 'minimize') window.minimize(); else if (action === 'maximize') { if (window.isMaximized()) window.unmaximize(); else window.maximize(); }
    else if (action === 'close') window.close(); else throw new UserError('Ação não permitida.');
  });
  let closePending = false;
  window.on('close', event => {
    if (organizer.busy) { event.preventDefault(); if (!closePending) { closePending = true; monitor.pauseAll(); organizer.stop(); organizer.idle.then(() => { if (!window.isDestroyed()) window.close(); }); } }
  });
  window.on('closed', () => { preview.cancel(); monitor.pauseAll(); transfer.close(); });
  window.once('ready-to-show', () => window.show()); await window.loadFile(entry);
  organizer.recover().catch(error => { console.error(error); }).finally(changed);
}

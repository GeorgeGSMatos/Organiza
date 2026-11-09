'use strict';
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const drawings = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  'folder-line': '<path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h7a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 8h18"/>',
  rules: '<path d="M6 3v2m0 4v12M12 3v12m0 4v2M18 3v6m0 4v8"/><circle cx="6" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><circle cx="18" cy="11" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
  settings: '<path d="m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  pause: '<circle cx="12" cy="12" r="9"/><path d="M10 8v8m4-8v8"/>',
  play: '<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.7 6.5A8 8 0 0 1 19 6l1 6M4 12l1 6a8 8 0 0 0 13.3-.5"/>',
  file: '<path d="M6 3h8l5 5v13H6Z"/><path d="M14 3v6h5M9 13h7M9 16h7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  more: '<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 4 5 5-11 11H4v-5Z"/><path d="m12 7 5 5"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9M10 5H5v15h15v-5"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4M8 21h8"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M9 10h12"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
};
const icon = (name, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${extra}">${drawings[name] || drawings.file}</svg>`;
let model = null;
let page = 'overview';
let search = '';
let editId;
let removeId;
let saving = false;
let checking = false;
let toastTimer;
let previousFocus;
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
async function call(method, ...args) {
  if (!window.organiza || typeof window.organiza[method] !== 'function') throw new Error('Abra o Organiza pelo aplicativo para Windows.');
  const result = await window.organiza[method](...args);
  if (!result?.ok) throw new Error(result?.error || 'Não foi possível concluir. Tente novamente.');
  return result.value;
}
function toast(message, error = false) {
  clearTimeout(toastTimer); const el = $('#toast'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, error ? 7000 : 4200);
}
function applyState(value) { if (model && JSON.stringify(model.folders) !== JSON.stringify(value.folders)) clearPreview(); model = value; if (rulesState.scope && !model.folders.some(folder => folder.id === rulesState.scope)) rulesState.scope = ''; render(); }
function header(title, subtitle, action = '') {
  return `<header class="page-header"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="header-actions">${action}</div></header>`;
}
const addButton = () => `<button class="button primary" data-action="add-folder">${icon('plus')}Adicionar pasta</button>`;
function folderArt() { return icon('folder-line', 'folder-art'); }
function card(folder) {
  const escapedId = escapeHTML(folder.id);
  const available = model.availability?.find(item => item.id === folder.id)?.available;
  const name = escapeHTML(folder.name), fullPath = escapeHTML(folder.path);
  return `<article class="folder-card" data-folder-id="${escapedId}">
    <button class="icon-button folder-menu-button" data-action="folder-menu" data-id="${escapedId}" aria-label="Opções de ${name}" aria-haspopup="true" aria-expanded="false">${icon('more')}</button>
    <div class="folder-top">${folderArt(folder)}<div class="folder-copy"><h3 title="${name}">${name}</h3><span class="connection ${available ? '' : 'unavailable'}">${available ? 'Disponível' : 'Indisponível'}</span><p class="folder-path" title="${fullPath}">${fullPath}</p></div></div>
    <button class="folder-bottom" data-action="folder-rules" data-id="${escapedId}">${icon('file')}<span>${folder.includeSubfolders ? 'Inclui subpastas' : 'Somente esta pasta'} · ${model.monitor?.activeIds.includes(folder.id) ? 'Automático' : 'Modo manual'}</span>${icon('chevron', 'chevron')}</button>
    <div class="folder-menu" id="menu-${escapedId}" hidden><button data-action="folder-rules" data-id="${escapedId}">${icon('rules')}Configurar regras</button><button data-action="folder-monitor" data-id="${escapedId}">${icon(model.monitor?.activeIds.includes(folder.id) ? 'pause' : 'play')}${model.monitor?.activeIds.includes(folder.id) ? 'Pausar automação' : 'Ativar automação'}</button><button data-action="edit-folder" data-id="${escapedId}">${icon('edit')}Editar pasta</button><button data-action="open-folder" data-id="${escapedId}">${icon('open')}Abrir no Explorador</button><button class="destructive" data-action="remove-folder" data-id="${escapedId}">${icon('trash')}Remover do Organiza</button></div>
  </article>`;
}
function emptyFolders() {
  return `<div class="empty-folders"><div class="empty-folder-copy">${icon('folder-line', 'folder-art')}<div><h2>Um lugar para cada arquivo.</h2><p>Adicione sua primeira pasta. Pode ser Downloads, My Drive ou qualquer outra pasta do seu Windows.</p></div></div><button class="button primary" data-action="add-folder">${icon('plus')}Escolher primeira pasta</button></div>`;
}
function overview() {
  return header('Visão geral', 'Tudo em ordem, no seu ritmo.', monitorHeader()) +
    `<div class="section-heading"><h2>Suas pastas${model.folders.length ? ` · ${model.folders.length}` : ''}</h2><button class="text-button" data-action="add-folder">${icon('plus')}Adicionar pasta</button></div><section class="folders-grid" aria-label="Pastas cadastradas">${model.folders.length ? model.folders.map(card).join('') : emptyFolders()}</section>
    ${previewPanel()}`;
}
function foldersPage() {
  return header('Pastas', 'Escolha os espaços que você quer organizar.', addButton()) +
  `<div class="folders-toolbar"><label class="search-input">${icon('search')}<input id="folder-search" type="text" aria-label="Buscar pastas" placeholder="Buscar por nome ou caminho" value="${escapeHTML(search)}"></label><span class="folder-summary">${model.folders.length} ${model.folders.length === 1 ? 'pasta cadastrada' : 'pastas cadastradas'}</span></div><section class="folders-grid" id="folder-results" aria-label="Pastas cadastradas">${folderResults()}</section>`;
}
function folderResults() {
  if (!model.folders.length) return emptyFolders();
  const filtered = model.folders.filter(folder => `${folder.name} ${folder.path}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return filtered.length ? filtered.map(card).join('') : '<div class="no-search">Nenhuma pasta corresponde à sua busca.</div>';
}
function switchRow(key, title, description, symbol, disabled = false) {
  return `<div class="setting-row"><div class="setting-description">${icon(symbol)}<div><strong>${title}</strong><p>${description}</p></div></div><button type="button" class="switch" role="switch" aria-checked="${model.settings[key]}" aria-label="${title}" data-setting="${key}" ${disabled ? 'disabled' : ''}></button></div>`;
}
function settings() {
  return header('Configurações', 'Deixe o Organiza do seu jeito.') +
    `<section class="settings-group"><h2>Aparência</h2><div class="settings-panel"><div class="setting-row"><div class="setting-description">${icon('moon')}<div><strong>Tema escuro</strong><p>Grafite, azul suave e controles no estilo ShadeFlow.</p></div></div><span class="theme-label">${icon('check')}Escuro</span></div>${switchRow('compactView', 'Visualização compacta', 'Reduz o espaço entre os elementos para mostrar mais pastas.', 'layout')}</div></section>
    <section class="settings-group"><h2>Preferências</h2><div class="settings-panel">${switchRow('launchAtLogin', 'Iniciar com o Windows', model.capabilities.launchAtLogin ? 'Abre o Organiza quando você entrar no Windows.' : 'Disponível ao abrir a versão empacotada para Windows.', 'monitor', !model.capabilities.launchAtLogin)}${switchRow('confirmRemoval', 'Confirmar ao remover pastas', 'Pede confirmação antes de remover uma pasta do cadastro.', 'shield')}</div></section>
    <section class="settings-group"><h2>Sobre o aplicativo</h2><div class="settings-panel about-panel"><img src="icon.svg" alt=""><div><h3>Organiza · ${escapeHTML(model.appVersion)}</h3><p>Organização de arquivos, monitoramento e histórico.<br>As configurações são salvas automaticamente neste computador.</p></div></div></section>`;
}
function render() {
  const previousVisualState = uiMotion.capture($('#main'));
  const openMenuId = $('.folder-menu:not([hidden])')?.id;
  document.body.classList.toggle('compact', model.settings.compactView);
  const views = { overview, folders: foldersPage, settings, rules: rulesPage, history: historyPage };
  $('#main').innerHTML = operationBanner() + (model.recoveryMessage ? `<div class="recovery-banner" role="status">${escapeHTML(model.recoveryMessage)}</div>` : '') + views[page]();
  document.querySelectorAll('.nav-item').forEach(el => { const selected = el.dataset.page === page; el.classList.toggle('selected', selected); if (selected) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  $('#folder-count').textContent = model.folders.length; $('#folder-count').hidden = !model.folders.length;
  $('#version').textContent = model.appVersion;
  const openMenu = openMenuId && document.getElementById(openMenuId);
  if (openMenu) {
    openMenu.hidden = false;
    openMenu.closest('.folder-card').querySelector('.folder-menu-button').setAttribute('aria-expanded', 'true');
  }
  uiMotion.rendered($('#main'), page, previousVisualState);
}
function navigate(next) { if (!['overview', 'folders', 'settings', 'rules', 'history'].includes(next)) return; page = next; search = ''; render(); $('#main').focus(); }
function showFolderDialog(id) {
  if (saving) return;
  const folder = model.folders.find(item => item.id === id);
  editId = folder?.id; previousFocus = document.activeElement;
  $('#folder-dialog-title').textContent = folder ? 'Editar pasta' : 'Adicionar pasta';
  $('#save-folder').textContent = folder ? 'Salvar alterações' : 'Adicionar pasta';
  $('#folder-path').value = folder?.path || ''; $('#folder-name').value = folder?.name || ''; $('#folder-recursive').checked = folder?.includeSubfolders || false;
  $('#folder-error').hidden = true; $('#folder-path').removeAttribute('aria-invalid');
  closeMenus(); $('#folder-dialog').showModal(); $('#folder-path').focus();
}
function closeFolderDialog() { if (!saving) { $('#folder-dialog').close(); previousFocus?.focus(); } }
function closeMenus() { document.querySelectorAll('.folder-menu').forEach(el => { el.hidden = true; }); document.querySelectorAll('.folder-menu-button').forEach(el => el.setAttribute('aria-expanded', 'false')); }
async function removeFolder(id) {
  const folder = model.folders.find(item => item.id === id); if (!folder) return;
  closeMenus(); removeId = id;
  if (!model.settings.confirmRemoval) return performRemove();
  $('#remove-description').textContent = `${folder.name} — ${folder.path}`;
  $('#remove-dialog').showModal();
}
async function performRemove() {
  const button = $('[data-action="confirm-remove"]'); button.disabled = true;
  try { applyState(await call('removeFolder', removeId)); $('#remove-dialog').close(); toast('Pasta removida do cadastro. Seus arquivos foram preservados.'); }
  catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}
async function refreshAvailability() {
  if (checking || !model || document.hidden || document.querySelector('dialog[open]') || rulesState.scanning || opsState.busy) return;
  checking = true;
  try {
    const availability = await call('availability');
    if (JSON.stringify(model.availability) !== JSON.stringify(availability)) { model.availability = availability; render(); }
  } catch (error) { console.warn(error.message); }
  finally { checking = false; }
}
async function action(name, button) {
  const id = button.dataset.id;
  if (name?.startsWith('window-')) return call('windowAction', name.slice(7));
  switch (name) {
    case 'add-folder': return showFolderDialog();
    case 'edit-folder': return showFolderDialog(id);
    case 'close-dialog': return closeFolderDialog();
    case 'pick-folder': {
      button.disabled = true;
      try { const selected = await call('pickFolder'); if (selected) { $('#folder-path').value = selected; $('#folder-error').hidden = true; $('#folder-path').removeAttribute('aria-invalid'); } }
      finally { button.disabled = false; } return;
    }
    case 'folder-menu': {
      const menu = document.getElementById(`menu-${id}`); const wasHidden = menu.hidden; closeMenus(); menu.hidden = !wasHidden; button.setAttribute('aria-expanded', String(wasHidden)); if (wasHidden) { uiMotion.animate(menu, [{ opacity: .65, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'translateY(0)' }], 150); menu.querySelector('button').focus(); } return;
    }
    case 'open-folder': closeMenus(); return call('openFolder', id);
    case 'remove-folder': return removeFolder(id);
    case 'cancel-remove': return $('#remove-dialog').close();
    case 'confirm-remove': return performRemove();
    case 'retry-start': return boot();
    default: if (isReviewAction(name)) return reviewAction(name, button); if (isOperationAction(name)) return operationsAction(name, button); return rulesAction(name, button);
  }
}
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!event.target.closest('.folder-menu,.folder-menu-button')) closeMenus();
  if (!button || button.disabled) return;
  try {
    if (button.dataset.page && model) return navigate(button.dataset.page);
    if (button.dataset.setting && model) {
      button.disabled = true; const key = button.dataset.setting;
      try { applyState(await call('updateSettings', { [key]: !model.settings[key] })); toast('Preferência salva.'); $(`[data-setting="${key}"]`)?.focus(); }
      catch (error) { button.disabled = false; throw error; } return;
    }
    await action(button.dataset.action, button);
  } catch (error) { toast(error.message, true); }
});
document.addEventListener('input', event => { if (event.target.id === 'folder-search') { search = event.target.value; $('#folder-results').innerHTML = folderResults(); } });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenus();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n' && model && !document.querySelector('dialog[open]')) { event.preventDefault(); showFolderDialog(); }
});
$('#folder-form').addEventListener('submit', async event => {
  event.preventDefault(); if (saving) return;
  if (!$('#folder-path').value.trim()) { $('#folder-error').textContent = 'Escolha uma pasta ou informe um caminho completo.'; $('#folder-error').hidden = false; $('#folder-path').setAttribute('aria-invalid', 'true'); $('#folder-path').focus(); return; }
  saving = true; const editing = Boolean(editId); const fieldset = [...$('#folder-form').querySelectorAll('button,input')]; fieldset.forEach(el => { el.disabled = true; }); $('#save-folder').textContent = 'Salvando…';
  try {
    const value = await call('saveFolder', { path: $('#folder-path').value, name: $('#folder-name').value, includeSubfolders: $('#folder-recursive').checked }, editId);
    applyState(value); $('#folder-dialog').close(); toast(editing ? 'Alterações salvas.' : 'Pasta adicionada. O cadastro foi salvo neste computador.');
  } catch (error) { $('#folder-error').textContent = error.message; $('#folder-error').hidden = false; $('#folder-path').setAttribute('aria-invalid', 'true'); }
  finally { saving = false; fieldset.forEach(el => { el.disabled = false; }); $('#save-folder').textContent = editing ? 'Salvar alterações' : 'Adicionar pasta'; if ($('#folder-dialog').open) $('#folder-path').focus(); }
});
$('#folder-dialog').addEventListener('cancel', event => { if (saving) event.preventDefault(); });
async function boot() {
  try { applyState(await call('getState')); }
  catch (error) { $('#main').innerHTML = `<section class="boot-error"><h1>Vamos tentar novamente?</h1><p>${escapeHTML(error.message)}</p><button class="button secondary" data-action="retry-start">Tentar novamente</button></section>`; }
}
hydrateIcons();
window.organiza?.onMaximized(value => { $('#maximize').setAttribute('aria-label', value ? 'Restaurar' : 'Maximizar'); $('#maximize').title = value ? 'Restaurar' : 'Maximizar'; });
window.addEventListener('focus', refreshAvailability);
setInterval(refreshAvailability, 30000);
window.addEventListener('DOMContentLoaded', boot);

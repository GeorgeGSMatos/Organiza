'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('organiza', Object.freeze({
  assignReview: (id, ids, input) => call('review:assign', id, ids, input),
  keepReview: (id, ids) => call('review:keep', id, ids),
  deferReview: (id, ids) => call('review:defer', id, ids),
  resumeReview: id => call('review:resume', id),
  planTrash: (id, ids) => call('trash:plan', id, ids), executeTrash: id => call('trash:execute', id),
  openRecycleBin: () => call('system:recycle-bin'),
  planMoves: (previewId, ids) => call('organize:plan', previewId, ids),
  executeMoves: (planId, approveReview) => call('organize:execute', planId, approveReview),
  cancelMoves: () => call('organize:cancel'),
  listHistory: () => call('history:list'), undoMove: id => call('history:undo', id),
  recoverHistory: () => call('history:recover'), revealHistory: (id, side) => call('history:reveal', id, side),
  activateMonitor: ids => call('monitor:activate', ids), pauseMonitor: id => call('monitor:pause', id), pauseAllMonitor: () => call('monitor:pause-all'),
  onOrganizerChanged: callback => { const listener = () => callback(); ipcRenderer.on('organizer:changed', listener); return () => ipcRenderer.removeListener('organizer:changed', listener); },
  onOperationProgress: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('organizer:progress', listener); return () => ipcRenderer.removeListener('organizer:progress', listener); },
  saveRule: (folderId, input, ruleId) => call('rule:save', folderId, input, ruleId),
  toggleRule: (folderId, ruleId) => call('rule:toggle', folderId, ruleId),
  removeRule: (folderId, ruleId) => call('rule:remove', folderId, ruleId),
  addPresets: folderId => call('rule:presets', folderId),
  savePolicy: (folderId, input) => call('policy:save', folderId, input),
  scan: folderId => call('preview:scan', folderId), cancelScan: () => call('preview:cancel'),
  resolvePreview: (previewId, rowId, ruleId) => call('preview:resolve', previewId, rowId, ruleId),
  onProgress: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('preview:progress', listener); return () => ipcRenderer.removeListener('preview:progress', listener); },
  getState: () => call('state:get'), pickFolder: () => call('folder:pick'),
  saveFolder: (input, id) => call('folder:save', input, id), removeFolder: id => call('folder:remove', id),
  openFolder: id => call('folder:open', id), availability: () => call('folder:availability'),
  updateSettings: patch => call('settings:update', patch), windowAction: action => call('window:action', action),
  onMaximized: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('window:maximized', listener); return () => ipcRenderer.removeListener('window:maximized', listener); }
}));

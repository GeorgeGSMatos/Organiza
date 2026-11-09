'use strict';
const path = require('node:path');
const { UserError } = require('./errors.cjs');
const TYPES = Object.freeze({
  document: { label: 'Documentos', extensions: ['.pdf','.doc','.docx','.docm','.odt','.rtf','.txt','.md','.ppt','.pptx','.odp','.epub'] },
  spreadsheet: { label: 'Planilhas', extensions: ['.xls','.xlsx','.xlsm','.ods','.csv','.tsv'] },
  image: { label: 'Imagens', extensions: ['.jpg','.jpeg','.png','.gif','.bmp','.webp','.svg','.tif','.tiff','.heic','.avif','.ico'] },
  video: { label: 'Vídeos', extensions: ['.mp4','.mov','.avi','.mkv','.wmv','.webm','.m4v','.mpeg'] },
  audio: { label: 'Áudio', extensions: ['.mp3','.wav','.m4a','.aac','.flac','.ogg','.wma','.aiff'] },
  archive: { label: 'Compactados', extensions: ['.zip','.rar','.7z','.tar','.gz','.bz2','.xz'] },
  installer: { label: 'Instaladores', extensions: ['.exe','.msi','.msix','.appx','.iso'] },
});
const PRESETS = [
  { id: 'documents', name: 'Documentos', types: ['document'] },
  { id: 'spreadsheets', name: 'Planilhas', types: ['spreadsheet'] },
  { id: 'media', name: 'Imagens e vídeos', types: ['image','video'] },
  { id: 'audio', name: 'Áudio', types: ['audio'] },
  { id: 'archives', name: 'Compactados', types: ['archive'] },
  { id: 'installers', name: 'Instaladores', types: ['installer'] },
];
const defaultOrganization = () => ({ rules: [], exclusions: { names: [], extensions: [], subfolders: [], files: [] }, reviewAboveMB: 500, reviewUnknown: true, minAgeSeconds: 90 });
function requiredText(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) throw new UserError(`${label}: preencha um texto válido de até ${max} caracteres.`);
  return value.trim().normalize('NFC');
}
function relativePath(value, max = 1024) {
  const clean = requiredText(value, 'Subpasta', max);
  if (path.win32.isAbsolute(clean) || path.posix.isAbsolute(clean)) throw new UserError('Informe uma subpasta relativa ou escolha a opção de caminho completo.');
  const parts = clean.split(/[\\/]/);
  if (parts.some(part => !part || part === '.' || part === '..' || /[<>:"|?*]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || part.length > 255)) throw new UserError('Use um caminho de subpasta válido, sem .., caracteres especiais ou nomes reservados do Windows.');
  return parts.join('/');
}
function absolutePath(value) {
  const clean = requiredText(value, 'Destino', 32760);
  if (!path.isAbsolute(clean) || (process.platform === 'win32' && (/^\\\\[?.]\\/.test(clean) || /[<>"|?*]/.test(clean)))) throw new UserError('Informe um caminho absoluto válido para o destino.');
  return path.resolve(clean);
}
function extensions(value) {
  const list = typeof value === 'string' ? value.split(/[,;\s]+/).filter(Boolean) : value;
  if (!Array.isArray(list) || !list.length || list.length > 128) throw new UserError('Informe uma ou mais extensões, como pdf, docx ou tar.gz.');
  return [...new Set(list.map(ext => {
    const text = requiredText(ext, 'Extensão', 40).toLowerCase().replace(/^\./, '');
    if (!/^[a-z0-9][a-z0-9+_-]*(?:\.[a-z0-9][a-z0-9+_-]*)*$/.test(text)) throw new UserError('Use extensões sem curingas, como pdf, jpg ou tar.gz.');
    return '.' + text;
  }))];
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new UserError('Escolha uma data válida.');
  const [y,m,d] = value.split('-').map(Number), date = new Date(y,m-1,d);
  if (y < 1970 || y > 2200 || date.getFullYear() !== y || date.getMonth() !== m-1 || date.getDate() !== d) throw new UserError('Escolha uma data entre 1970 e 2200.');
  return value;
}
function normalizeCondition(input) {
  if (!input || typeof input !== 'object') throw new UserError('Condição inválida.');
  const { field, value } = input;
  if (field === 'noExtension') { if (value !== true) throw new UserError('A condição sem extensão deve estar ativa.'); return { field, value: true }; }
  if (field === 'extension') return { field, value: extensions(value) };
  if (field === 'type') {
    if (typeof value !== 'string' || !Object.hasOwn(TYPES, value)) throw new UserError('Escolha um tipo de arquivo válido.');
    return { field, value };
  }
  if (['nameContains','nameStarts','nameEnds'].includes(field)) return { field, value: requiredText(value, 'Nome do arquivo') };
  if (['sizeMin','sizeMax'].includes(field)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000000) throw new UserError('Informe um tamanho válido em MB.');
    return { field, value };
  }
  if (['modifiedBefore','modifiedAfter'].includes(field)) return { field, value: validDate(value) };
  throw new UserError('Escolha uma condição válida.');
}
function normalizeRule(input) {
  if (!input || typeof input !== 'object') throw new UserError('Regra inválida.');
  const name = requiredText(input.name, 'Categoria', 80);
  if (typeof input.enabled !== 'boolean' || !['all','any'].includes(input.match) || !['inherit','root'].includes(input.scope) || !['move','suggest'].includes(input.action)) throw new UserError('Confira o estado, a combinação, o escopo e a ação da regra.');
  if (!Array.isArray(input.conditions) || !input.conditions.length || input.conditions.length > 12) throw new UserError('Adicione entre 1 e 12 condições.');
  const conditions = input.conditions.map(normalizeCondition);
  if (!input.destination || !['relative','absolute'].includes(input.destination.mode)) throw new UserError('Escolha um tipo de destino.');
  const destination = { mode: input.destination.mode, value: input.destination.mode === 'relative' ? relativePath(input.destination.value) : absolutePath(input.destination.value) };
  const presetId = input.presetId ?? null;
  if (presetId !== null && !PRESETS.some(p => p.id === presetId)) throw new UserError('Categoria sugerida inválida.');
  return { name, enabled: input.enabled, match: input.match, scope: input.scope, action: input.action, conditions, destination, presetId };
}
function normalizePolicy(input) {
  if (!input || typeof input !== 'object' || !input.exclusions) throw new UserError('Preferências de análise inválidas.');
  if (typeof input.reviewAboveMB !== 'number' || !Number.isFinite(input.reviewAboveMB) || input.reviewAboveMB < 1 || input.reviewAboveMB > 100000000) throw new UserError('O limite para arquivos grandes deve ser de pelo menos 1 MB.');
  if (typeof input.minAgeSeconds !== 'number' || !Number.isInteger(input.minAgeSeconds) || input.minAgeSeconds < 30 || input.minAgeSeconds > 86400) throw new UserError('A espera deve ser de 30 a 86400 segundos.');
  if (typeof input.reviewUnknown !== 'boolean') throw new UserError('Escolha como revisar formatos incomuns.');
  const lists = {};
  for (const key of ['names','extensions','subfolders']) {
    const list = input.exclusions[key];
    if (!Array.isArray(list) || list.length > 100) throw new UserError('Cada lista de exceções aceita até 100 itens.');
    lists[key] = key === 'extensions' ? (list.length ? extensions(list) : []) : [...new Set(list.map(item => key === 'subfolders' ? relativePath(item) : requiredText(item, 'Nome a ignorar')))];
  }
  const files = input.exclusions.files ?? [];
  if (!Array.isArray(files) || files.length > 10000) throw new UserError('A lista de caminhos ignorados aceita até 10000 itens.');
  lists.files = [...new Set(files.map(file => relativePath(file, 32760)))];
  return { exclusions: lists, reviewAboveMB: input.reviewAboveMB, reviewUnknown: input.reviewUnknown, minAgeSeconds: input.minAgeSeconds };
}
function validateOrganization(value) {
  if (!value || !Array.isArray(value.rules) || value.rules.length > 100) throw new Error('Cadastro de regras inválido.');
  Object.assign(value, normalizePolicy(value));
  const ids = new Set();
  for (const rule of value.rules) {
    if (!rule || typeof rule.id !== 'string' || !rule.id || ids.has(rule.id)) throw new Error('Identificador de regra inválido.');
    ids.add(rule.id); Object.assign(rule, normalizeRule(rule));
  }
}
module.exports = { TYPES, PRESETS, defaultOrganization, requiredText, relativePath, absolutePath, extensions, normalizeRule, normalizePolicy, validateOrganization };

'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { UserError } = require('./errors.cjs');
const { TYPES } = require('./rules-config.cjs');
const { targetDirectory } = require('./rules-service.cjs');
const MB = 1024 * 1024;
const LIMITS = { entries: 20000, rows: 5000, directories: 2000, depth: 32, duration: 60000 };
const fold = text => text.normalize('NFC').toLocaleLowerCase('pt-BR');
const key = text => process.platform === 'win32' ? text.toLowerCase() : text;
const within = (parent, child) => { const rel = path.relative(parent, child); return !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep); };
const revision = state => createHash('sha256').update(JSON.stringify(state.folders.map(({ organizationMode, ...configuration }) => configuration))).digest('hex');
function typeOf(name) { const ext = path.extname(name).toLowerCase(); return Object.keys(TYPES).find(type => TYPES[type].extensions.includes(ext)) || 'other'; }
function matchesCondition(condition, file) {
  const name = fold(file.name);
  switch (condition.field) {
    case 'noExtension': return path.extname(file.name) === '';
    case 'extension': return condition.value.some(ext => name.endsWith(ext));
    case 'type': return file.type === condition.value;
    case 'nameContains': return name.includes(fold(condition.value));
    case 'nameStarts': return name.startsWith(fold(condition.value));
    case 'nameEnds': return name.endsWith(fold(condition.value));
    case 'sizeMin': return file.size >= condition.value * MB;
    case 'sizeMax': return file.size <= condition.value * MB;
    case 'modifiedBefore': { const [y,m,d] = condition.value.split('-').map(Number); return file.mtimeMs < new Date(y,m-1,d+1).getTime(); }
    case 'modifiedAfter': { const [y,m,d] = condition.value.split('-').map(Number); return file.mtimeMs >= new Date(y,m-1,d).getTime(); }
    default: return false;
  }
}
function matchesRule(rule, file) {
  if (!rule.enabled || (rule.scope === 'root' && file.relativePath.includes(path.sep))) return false;
  return rule.match === 'all' ? rule.conditions.every(c => matchesCondition(c, file)) : rule.conditions.some(c => matchesCondition(c, file));
}
function exclusionReason(file, policy, now) {
  const name = fold(file.name);
  const relative = (file.relativePath || file.name).split(path.sep).join('/').normalize('NFC');
  if ((policy.exclusions.files || []).some(item => process.platform === 'win32' ? fold(item) === fold(relative) : item === relative)) return 'Você escolheu manter este caminho fora da organização.';
  if (/^(~\$|\.~lock\.)/.test(name) || /\.(crdownload|part|partial|tmp|temp|download)$/.test(name)) return 'Arquivo temporário ou download em andamento.';
  if (policy.exclusions.names.some(text => name.includes(fold(text)))) return 'Nome incluído nas exceções desta pasta.';
  if (policy.exclusions.extensions.some(ext => name.endsWith(ext))) return 'Extensão incluída nas exceções desta pasta.';
  if (now - file.mtimeMs < policy.minAgeSeconds * 1000) return `Alterado recentemente; aguarde ${policy.minAgeSeconds} segundos sem alterações.`;
  return null;
}
async function timed(promise, signal, milliseconds = 2500) {
  if (signal.aborted) throw new UserError('Análise cancelada.');
  let timer, abort;
  try {
    return await Promise.race([promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Tempo de acesso esgotado.')), milliseconds); }),
      new Promise((_, reject) => { abort = () => reject(new UserError('Análise cancelada.')); signal.addEventListener('abort', abort, { once: true }); }),
    ]);
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
async function openDirectory(directory, signal) {
  let abandoned = false;
  const pending = fs.opendir(directory).then(handle => { if (abandoned || signal.aborted) { handle.close().catch(() => {}); throw new Error('Acesso interrompido.'); } return handle; });
  try { return await timed(pending, signal); } catch (error) { abandoned = true; throw error; }
}
async function targetSafety(folder, rule, signal) {
  const target = targetDirectory(folder, rule);
  // A relative target must remain within its chosen root even through a junction/symlink.
  let parent = target;
  for (let depth = 0; depth < 128; depth++) {
    try {
      const canonical = await timed(fs.realpath(parent), signal);
      const stat = await timed(fs.stat(parent), signal);
      if (!stat.isDirectory()) return 'Uma parte do caminho de destino é um arquivo.';
      if (rule.destination.mode === 'relative' && !within(folder.path, canonical)) return 'O destino passa por um atalho para fora da pasta escolhida.';
      return null;
    } catch (error) {
      if (signal.aborted) throw error;
      if (error.code !== 'ENOENT') return 'Não foi possível verificar o acesso ao destino.';
      const next = path.dirname(parent); if (next === parent) return 'Destino indisponível.'; parent = next;
    }
  }
  return 'Caminho de destino muito profundo.';
}
function baseClassification(row) {
  row.destination = null; row.ruleId = null; row.ruleName = null; row.collisionOnly = false;
  if (row.ignoreReason) { row.status = 'ignored'; row.reason = row.ignoreReason; return; }
  if (!row.candidates.length) { row.status = 'review'; row.reason = 'Nenhuma regra ativa corresponde a este arquivo.'; return; }
  const candidate = row.selectedRuleId ? row.candidates.find(c => c.ruleId === row.selectedRuleId) : (row.candidates.length === 1 ? row.candidates[0] : null);
  if (!candidate) { row.status = 'conflict'; row.reason = 'Mais de uma regra corresponde. Escolha qual aplicar nesta prévia.'; return; }
  row.destination = candidate.destination; row.ruleId = candidate.ruleId; row.ruleName = candidate.ruleName;
  if (key(row.path) === key(candidate.destination)) { row.status = 'ignored'; row.reason = 'O arquivo já está no destino proposto.'; return; }
  if (candidate.problem) { row.collisionOnly = candidate.issue === 'occupied'; row.status = 'conflict'; row.reason = candidate.problem; return; }
  if (row.reviewReason || candidate.action === 'suggest') { row.status = 'review'; row.reason = row.reviewReason || 'A regra pede apenas uma sugestão, com revisão manual.'; return; }
  row.status = 'ready'; row.reason = row.selectedRuleId ? 'Regra escolhida por você nesta prévia.' : 'Regra única e destino sem conflito.';
}
function finalize(result) {
  result.rows.forEach(baseClassification);
  const groups = new Map();
  for (const row of result.rows) {
    if (!row.destination || row.status === 'ignored') continue;
    const target = key(row.destination);
    if (!groups.has(target)) groups.set(target, []); groups.get(target).push(row);
  }
  for (const group of groups.values()) if (group.length > 1) for (const row of group) { row.collisionOnly = !row.candidates.some(c => c.problem && c.issue !== 'occupied'); row.status = 'conflict'; row.reason = 'Mais de um arquivo receberia o mesmo destino. Ajuste as regras ou o destino.'; }
  result.summary = { ready: 0, review: 0, conflict: 0, ignored: 0 };
  for (const row of result.rows) result.summary[row.status]++;
  return result;
}
class PreviewService {
  constructor(store, progress = () => {}, limits = LIMITS) { this.store = store; this.progress = progress; this.limits = { ...LIMITS, ...limits }; this.controller = null; this.result = null; }
  invalidate() { this.result = null; this.controller?.abort(); }
  cancel() { this.controller?.abort(); }
  async scan(folderId = null) {
    if (this.controller) throw new UserError('Uma análise já está em andamento. Aguarde ou cancele.');
    const state = this.store.snapshot();
    const folders = folderId === null ? state.folders : state.folders.filter(folder => folder.id === folderId);
    if (!folders.length) throw new UserError('Adicione ou escolha uma pasta para analisar.');
    const controller = new AbortController(); this.controller = controller; const { signal } = controller;
    const result = { id: randomUUID(), revision: revision(state), createdAt: new Date().toISOString(), rows: [], warnings: [], cancelled: false, limited: false, visited: 0, skippedDirectories: 0, directories: 0, folderId };
    const started = Date.now(), destinations = new Map(), safety = new Map(), pending = [];
    let phase = 'discovering';
    const warn = text => { if (result.warnings.length < 100 && !result.warnings.includes(text)) result.warnings.push(text); };
    let lastProgress = 0;
    const stop = () => {
      if (signal.aborted) { result.cancelled = true; return true; }
      if (Date.now() - started > this.limits.duration || (phase === 'discovering' && (result.visited >= this.limits.entries || pending.length >= this.limits.rows))) { result.limited = true; return true; }
      return false;
    };
    const report = force => { if (force || Date.now() - lastProgress > 150) { lastProgress = Date.now(); this.progress({ phase, visited: result.visited, rows: result.rows.length, total: phase === 'analyzing' ? pending.length : null, completed: result.rows.length, partial: result.limited || result.cancelled }); } };
    report(true);
    try {
      for (const folder of folders) {
        if (stop()) break;
        const policy = folder.organization;
        const targets = policy.rules.map(rule => targetDirectory(folder, rule)); destinations.set(folder.id, targets);
        for (const rule of policy.rules.filter(r => r.enabled)) { if (stop()) break; safety.set(rule.id, await targetSafety(folder, rule, signal)); }
        const stack = [{ directory: folder.path, depth: 0 }];
        while (stack.length && !stop()) {
          const { directory, depth } = stack.pop();
          let handle;
          try {
            // Avoid traversing symlinks/junctions introduced after registration.
            if (result.directories >= this.limits.directories) { result.limited = true; break; }
            const stat = await timed(fs.lstat(directory), signal);
            if (depth === 0 && key(await timed(fs.realpath(directory), signal)) !== key(directory)) { warn(`O caminho da pasta foi alterado por um atalho: ${directory}`); continue; }
            if (stat.isSymbolicLink()) { result.skippedDirectories++; warn(`Atalho de pasta ignorado: ${directory}`); continue; }
            handle = await openDirectory(directory, signal); result.directories++;
            while (!stop()) {
              const entry = await timed(handle.read(), signal); if (!entry) break;
              result.visited++; report(false);
              const full = path.join(directory, entry.name), relative = path.relative(folder.path, full);
              if (entry.isDirectory()) {
                const excluded = policy.exclusions.subfolders.some(sub => within(path.join(folder.path, ...sub.split('/')), full));
                const managed = state.folders.some(other => other.id !== folder.id && key(other.path) === key(full));
                const output = targets.some(target => within(folder.path, target) && within(target, full));
                if (!folder.includeSubfolders || excluded || managed || output || ['.git','node_modules','$recycle.bin','system volume information'].includes(entry.name.toLowerCase())) { result.skippedDirectories++; continue; }
                if (depth >= this.limits.depth) { result.skippedDirectories++; result.limited = true; warn('Há subpastas além do limite de profundidade da prévia.'); continue; }
                stack.push({ directory: full, depth: depth + 1 }); continue;
              }
              if (!entry.isFile() && !entry.isSymbolicLink()) continue;
              const row = { id: createHash('sha256').update(folder.id + '\0' + relative).digest('hex'), folderId: folder.id, folderName: folder.name, path: full, relativePath: relative, name: entry.name, type: typeOf(entry.name), size: 0, mtimeMs: 0, candidates: [], selectedRuleId: null, ignoreReason: null, reviewReason: null };
              pending.push({ row, symbolic: entry.isSymbolicLink(), folder });
            }
          } catch (error) { if (signal.aborted) result.cancelled = true; else warn(`Não foi possível ler: ${directory}`); }
          finally { if (handle) await handle.close().catch(() => {}); }
        }
      }
      phase = 'analyzing'; report(true);
      for (const { row, symbolic, folder } of pending) {
              if (stop()) break;
              const policy = folder.organization, full = row.path;
              if (symbolic) row.ignoreReason = 'Atalho simbólico ignorado.';
              else {
                try {
                  const stat = await timed(fs.lstat(full), signal);
                  if (!stat.isFile() || stat.isSymbolicLink()) row.ignoreReason = 'O arquivo mudou durante a análise; atualize a prévia.';
                  row.size = stat.size; row.mtimeMs = stat.mtimeMs; row.nodeIdentity = `${stat.dev}:${stat.ino}`;
                  row.ignoreReason ||= exclusionReason(row, policy, Date.now());
                  if (!row.ignoreReason) {
                    if (row.size > policy.reviewAboveMB * MB) row.reviewReason = `Arquivo acima de ${policy.reviewAboveMB} MB; revisão necessária.`;
                    else if (policy.reviewUnknown && row.type === 'other') row.reviewReason = 'Formato incomum; revisão necessária.';
                    for (const rule of policy.rules.filter(rule => matchesRule(rule, row))) {
                      const destination = path.join(targetDirectory(folder, rule), row.name);
                      let problem = safety.get(rule.id) || null, issue = problem ? 'unsafe' : null;
                      if (!problem && key(destination) !== key(full)) {
                        try { await timed(fs.lstat(destination), signal); problem = 'Já existe um arquivo ou pasta com este nome no destino.'; issue = 'occupied'; }
                        catch (error) { if (signal.aborted) throw error; if (error.code !== 'ENOENT') { problem = 'Não foi possível verificar se o destino está livre.'; issue = 'unavailable'; } }
                      }
                      row.candidates.push({ ruleId: rule.id, ruleName: rule.name, destination, action: rule.action, problem, issue });
                    }
                  }
                } catch (error) {
                  if (signal.aborted) { result.cancelled = true; break; }
                  row.ignoreReason = 'Arquivo inacessível ou removido durante a análise.';
                }
              }
              result.rows.push(row);
              report(false);
      }
      if (revision(this.store.snapshot()) !== result.revision) throw new UserError('As regras ou pastas mudaram durante a análise. Atualize a prévia.');
      if (result.limited) warn('Prévia parcial: limite de tempo, quantidade ou profundidade atingido. Analise uma pasta menor para ver os demais itens.');
      result.cancelled ||= signal.aborted; finalize(result); this.result = result; report(true);
      return structuredClone(result);
    } catch (error) {
      if (signal.aborted && revision(this.store.snapshot()) === result.revision) { result.cancelled = true; finalize(result); this.result = result; return structuredClone(result); }
      throw error;
    } finally { this.controller = null; }
  }
  async resolve(previewId, rowId, ruleId) {
    const result = this.result;
    if (!result || result.id !== previewId || revision(this.store.snapshot()) !== result.revision) throw new UserError('Esta prévia expirou. Atualize a análise.');
    const row = result.rows.find(row => row.id === rowId);
    if (!row || !row.candidates.some(c => c.ruleId === ruleId)) throw new UserError('Escolha uma das regras correspondentes a este arquivo.');
    row.selectedRuleId = ruleId; finalize(result); return structuredClone(result);
  }
}
module.exports = { PreviewService, typeOf, matchesCondition, matchesRule, exclusionReason, finalize, revision, within, LIMITS, targetSafety };

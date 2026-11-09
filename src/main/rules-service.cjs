'use strict';
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { UserError } = require('./errors.cjs');
const { PRESETS, normalizeRule, normalizePolicy } = require('./rules-config.cjs');
function getFolder(state, id) { const folder = state.folders.find(f => f.id === id); if (!folder) throw new UserError('Escolha uma pasta cadastrada.'); return folder; }
function targetDirectory(folder, rule) { return rule.destination.mode === 'absolute' ? rule.destination.value : path.join(folder.path, ...rule.destination.value.split('/')); }
function checkTarget(folder, rule) {
  const target = targetDirectory(folder, rule);
  const equal = process.platform === 'win32' ? target.toLowerCase() === folder.path.toLowerCase() : target === folder.path;
  if (equal) throw new UserError('Escolha um destino diferente da pasta de origem.');
}
class RulesService {
  constructor(store) { this.store = store; }
  async save(folderId, input, ruleId) {
    const rule = normalizeRule(input);
    return this.store.update(state => {
      const folder = getFolder(state, folderId); checkTarget(folder, rule);
      const index = folder.organization.rules.findIndex(r => r.id === ruleId);
      if (ruleId !== undefined && index < 0) throw new UserError('Esta regra já foi removida.');
      if (index < 0 && folder.organization.rules.length >= 100) throw new UserError('Cada pasta aceita até 100 regras.');
      const saved = { ...rule, id: index < 0 ? randomUUID() : ruleId };
      if (index < 0) folder.organization.rules.push(saved); else folder.organization.rules[index] = saved;
    });
  }
  async toggle(folderId, ruleId) { return this.store.update(state => { const rule = getFolder(state, folderId).organization.rules.find(r => r.id === ruleId); if (!rule) throw new UserError('Regra não encontrada.'); rule.enabled = !rule.enabled; }); }
  async remove(folderId, ruleId) { return this.store.update(state => { const folder = getFolder(state, folderId); if (!folder.organization.rules.some(r => r.id === ruleId)) throw new UserError('Regra não encontrada.'); folder.organization.rules = folder.organization.rules.filter(r => r.id !== ruleId); }); }
  async presets(folderId) {
    return this.store.update(state => {
      const folder = getFolder(state, folderId);
      for (const preset of PRESETS) {
        if (folder.organization.rules.some(rule => rule.presetId === preset.id)) continue;
        if (folder.organization.rules.length >= 100) throw new UserError('Não há espaço para mais categorias nesta pasta.');
        folder.organization.rules.push({ id: randomUUID(), name: preset.name, enabled: true, match: 'any', scope: 'inherit', action: 'move', conditions: preset.types.map(type => ({ field: 'type', value: type })), destination: { mode: 'relative', value: preset.name }, presetId: preset.id });
      }
    });
  }
  async policy(folderId, input) { return this.store.update(state => { const folder = getFolder(state, folderId); const clean = normalizePolicy({ ...input, exclusions: { ...input?.exclusions, files: input?.exclusions?.files ?? folder.organization.exclusions.files ?? [] } }); Object.assign(folder.organization, clean); }); }
}
module.exports = { RulesService, getFolder, targetDirectory };

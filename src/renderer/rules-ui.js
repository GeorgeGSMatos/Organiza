'use strict';
const rulesState = { folderId: '', preview: null, scanning: false, scope: '', filter: 'all', query: '', page: 1, selected: new Set(), ruleDraft: null, editingId: undefined, editorFolderId: '', policyFolderId: '', removingId: '', saving: false, policySaving: false };
const conditionFields = { noExtension: 'Sem extensão', extension: 'Extensão é', type: 'Tipo é', nameContains: 'Nome contém', nameStarts: 'Nome começa com', nameEnds: 'Nome termina com', sizeMin: 'Tamanho a partir de (MB)', sizeMax: 'Tamanho até (MB)', modifiedBefore: 'Modificado até a data', modifiedAfter: 'Modificado a partir da data' };
const typeNames = { document: 'Documento', spreadsheet: 'Planilha', image: 'Imagem', video: 'Vídeo', audio: 'Áudio', archive: 'Compactado', installer: 'Instalador', other: 'Outro' };
const statusNames = { ready: 'Pronto', review: 'Revisar', conflict: 'Conflito', ignored: 'Ignorado' };
function currentRulesFolder() { return model.folders.find(f => f.id === rulesState.folderId) || model.folders[0]; }
function clearPreview() { rulesState.preview = null; rulesState.selected.clear(); rulesState.page = 1; }
function folderOptions(selected, all = false) { return (all ? `<option value="">Todas as pastas</option>` : '') + model.folders.map(folder => `<option value="${escapeHTML(folder.id)}" ${folder.id === selected ? 'selected' : ''}>${escapeHTML(folder.name)}</option>`).join(''); }
function conditionText(condition) {
  if (condition.field === 'noExtension') return 'Arquivo sem extensão';
  const value = condition.field === 'type' ? typeNames[condition.value] : Array.isArray(condition.value) ? condition.value.join(', ') : condition.value;
  return `${conditionFields[condition.field]} ${value}`;
}
function rulesPage() {
  const folder = currentRulesFolder();
  if (!folder) return header('Regras', 'Sua organização começa com escolhas simples.') + emptyFolders();
  rulesState.folderId = folder.id;
  const org = folder.organization;
  const active = org.rules.filter(r => r.enabled).length;
  return header('Regras', 'Uma organização diferente para cada pasta.', `<button class="button secondary" data-action="edit-policy">${icon('shield')}Exceções e revisão</button><button class="button primary" data-action="new-rule">${icon('plus')}Nova categoria</button>`) +
    `<div class="rules-folder-bar"><div><label for="rules-folder">Configurar pasta</label><select id="rules-folder">${folderOptions(folder.id)}</select></div><span class="scope-description">${escapeHTML(folder.path)}<small>${folder.includeSubfolders ? 'Inclui subpastas' : 'Somente a pasta principal'}</small></span><button class="button secondary" data-action="preview-folder">${icon('search')}Ver prévia</button></div>
    <section class="suggestions"><div><h2>${org.rules.length ? 'Categorias prontas para usar' : 'Comece com categorias sugeridas'}</h2><p>Documentos, Planilhas, Imagens e vídeos, Áudio, Compactados e Instaladores.</p></div><button class="button ${org.rules.length ? 'secondary' : 'primary'}" data-action="add-presets">${icon('plus')}${org.rules.length ? 'Adicionar sugestões' : 'Usar categorias sugeridas'}</button></section>
    <div class="section-heading"><h2>${active} de ${org.rules.length} regras ativas</h2><span class="rules-hint">Se duas regras corresponderem, você decide na prévia.</span></div>
    <section class="rules-list" aria-label="Regras desta pasta">${org.rules.length ? org.rules.map(rule => `<article class="rule-card ${rule.enabled ? '' : 'paused'}"><div class="rule-category-icon">${icon('folder-line')}</div><div class="rule-description"><h3>${escapeHTML(rule.name)}<span class="rule-state">${rule.enabled ? 'Ativa' : 'Pausada'}</span></h3><p>${rule.conditions.map(c => escapeHTML(conditionText(c))).join(`<span class="condition-join"> ${rule.match === 'all' ? 'E' : 'OU'} </span>`)}</p><div class="rule-destination">${icon('folder-line')}<span title="${escapeHTML(rule.destination.value)}">${escapeHTML(rule.destination.value)}</span><small>${rule.action === 'suggest' ? 'Somente sugerir' : 'Organizar após confirmação'}${rule.scope === 'root' ? ' · Só pasta principal' : ''}</small></div></div><div class="rule-card-actions"><button type="button" class="switch" role="switch" aria-checked="${rule.enabled}" aria-label="${escapeHTML(rule.name)} ativa" data-action="toggle-rule" data-rule-id="${escapeHTML(rule.id)}"></button><button class="icon-button" data-action="edit-rule" data-rule-id="${escapeHTML(rule.id)}" aria-label="Editar ${escapeHTML(rule.name)}">${icon('edit')}</button><button class="icon-button" data-action="delete-rule" data-rule-id="${escapeHTML(rule.id)}" aria-label="Remover ${escapeHTML(rule.name)}">${icon('trash')}</button></div></article>`).join('') : '<div class="no-search">Use as sugestões acima ou crie sua primeira categoria.</div>'}</section>`;
}
function formatSize(size) { if (size >= 1024 ** 3) return (size / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' GB'; if (size >= 1024 ** 2) return (size / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB'; if (size >= 1024) return (size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' KB'; return size + ' B'; }
function previewRows() {
  return (rulesState.preview?.rows || []).filter(row => (rulesState.filter === 'all' || row.status === rulesState.filter) && `${row.name} ${row.relativePath} ${row.folderName}`.toLocaleLowerCase('pt-BR').includes(rulesState.query.toLocaleLowerCase('pt-BR')));
}
function previewPanel() {
  const result = rulesState.preview;
  return `<section class="panel preview-panel" aria-label="Prévia de organização"><div class="preview-header"><div><h2>Prévia de organização</h2><p class="panel-subtitle">Confira as regras e os destinos antes de organizar seus arquivos.</p></div><span class="preview-meta">${icon(result ? 'clock' : 'pause')}${result ? `Atualizada às ${new Date(result.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando análise'}</span></div>
    <div class="preview-toolbar"><label class="preview-scope">Pasta<select id="preview-scope" ${rulesState.scanning ? 'disabled' : ''}>${folderOptions(rulesState.scope, true)}</select></label><span id="scan-progress" class="scan-progress" aria-live="polite">${rulesState.scanning ? 'Lendo arquivos…' : 'Somente leitura · Nenhum arquivo é movido'}</span>${rulesState.scanning ? `<button class="button secondary" data-action="cancel-scan">Cancelar análise</button>` : `<button class="button secondary" data-action="run-preview" ${model.folders.length ? '' : 'disabled'}>${icon('refresh')}${result ? 'Atualizar prévia' : 'Analisar arquivos'}</button>`}</div>
    ${reviewCenter()}
    ${result ? `<div class="preview-filters" aria-label="Filtrar prévia">${[['all','Todos',result.rows.length],...Object.entries(statusNames).map(([status,label]) => [status,label,result.summary[status]])].map(([status,label,count]) => `<button class="filter-chip ${rulesState.filter === status ? 'active' : ''}" data-action="preview-filter" data-filter="${status}">${label}<span>${count}</span></button>`).join('')}</div><div class="preview-search"><label class="search-input">${icon('search')}<input type="text" id="preview-search" aria-label="Buscar na prévia" placeholder="Buscar arquivo ou pasta" value="${escapeHTML(rulesState.query)}"></label>${result.cancelled || result.limited ? '<span class="partial-tag">Prévia parcial</span>' : ''}</div>${result.warnings.length || result.cancelled ? `<div class="analysis-warnings" role="status">${result.cancelled ? '<p>Análise cancelada. Os itens abaixo representam apenas a parte analisada.</p>' : ''}${result.warnings.slice(0,4).map(warning => `<p>${escapeHTML(warning)}</p>`).join('')}${result.warnings.length > 4 ? `<p>Mais ${result.warnings.length - 4} aviso(s) de acesso.</p>` : ''}</div>` : ''}<div id="preview-results">${previewTable()}</div>` : `<div class="preview-table"><div class="table-head"><span>ARQUIVO</span><span>TIPO</span><span>DESTINO</span></div><div class="preview-empty"><span class="empty-mini-icon">${icon('rules')}</span><div><h3>Confira sua organização, sem alterar nada</h3><p>Configure as regras de cada pasta e clique em Analisar arquivos. A prévia mostrará os destinos e os itens que precisam de revisão.</p></div></div></div></div>`}
    <footer class="preview-footer"><span class="preview-note">${icon('info')}Selecione os arquivos e confira os destinos antes de confirmar.</span><div class="footer-buttons"><button class="button secondary" data-page="rules">Revisar regras</button><button class="button primary" data-action="prepare-move" ${!rulesState.selected.size || opsState.busy || !model.capabilities.organize ? 'disabled' : ''}>${icon('play')}Organizar selecionados</button></div></footer></section>`;
}
function previewTable() {
  const rows = previewRows(), pages = Math.max(1, Math.ceil(rows.length / 50)); rulesState.page = Math.min(rulesState.page, pages);
  const visible = rows.slice((rulesState.page - 1) * 50, rulesState.page * 50);
  const ready = rows.filter(row => row.status === 'ready'), allSelected = ready.length && ready.every(row => rulesState.selected.has(row.id));
  return `<div class="selection-line"><label><input type="checkbox" id="select-ready" ${allSelected ? 'checked' : ''} ${ready.length ? '' : 'disabled'}>Selecionar prontos</label><span>${rulesState.selected.size} selecionado(s) · ${rows.length} item(ns) neste filtro</span></div><div class="preview-data-wrap"><table class="preview-data"><thead><tr><th>ARQUIVO</th><th>TIPO</th><th>REGRA E DESTINO</th></tr></thead><tbody>${visible.length ? visible.map(row => `<tr data-row-id="${escapeHTML(row.id)}"><td><div class="file-cell"><input type="checkbox" aria-label="Selecionar ${escapeHTML(row.name)}" data-select-row="${escapeHTML(row.id)}" ${rulesState.selected.has(row.id) ? 'checked' : ''} ${selectableRow(row) ? '' : 'disabled'}><span class="file-symbol type-${row.type}">${icon('file')}</span><div><strong title="${escapeHTML(row.name)}">${escapeHTML(row.name)}</strong><small title="${escapeHTML(row.path)}">${escapeHTML(row.folderName)} · ${escapeHTML(row.relativePath)}</small><span class="status-tag ${row.status}">${statusNames[row.status]}</span></div></div></td><td>${typeNames[row.type]}<small>${formatSize(row.size)}</small></td><td><strong>${escapeHTML(row.ruleName || (row.candidates.length > 1 ? `${row.candidates.length} regras correspondentes` : 'Sem regra aplicada'))}</strong>${row.destination ? `<small class="destination-path" title="${escapeHTML(row.destination)}">${escapeHTML(row.destination)}</small>` : ''}<small class="row-reason">${escapeHTML(row.reason)}</small>${!row.ignoreReason && row.candidates.length === 0 && row.status === 'review' ? (row.reviewDeferred ? '<small>Sugestões adiadas nesta sessão.</small>' : `<button class="text-button row-review-button" data-action="review-row" data-row-id="${escapeHTML(row.id)}">Ver sugestões</button>`) : ''}${row.candidates.length > 1 ? `<label class="resolve-label">Regra para esta prévia<select aria-label="Escolher regra para ${escapeHTML(row.name)}" data-resolve-row="${escapeHTML(row.id)}"><option value="">Escolha uma regra…</option>${row.candidates.map(candidate => `<option value="${escapeHTML(candidate.ruleId)}" ${row.selectedRuleId === candidate.ruleId ? 'selected' : ''}>${escapeHTML(candidate.ruleName)}</option>`).join('')}</select></label>` : ''}</td></tr>`).join('') : '<tr><td colspan="3" class="empty-table">Nenhum arquivo neste filtro.</td></tr>'}</tbody></table></div><div class="pagination"><span>Página ${rulesState.page} de ${pages}${rulesState.preview.skippedDirectories ? ` · ${rulesState.preview.skippedDirectories} subpasta(s) fora da análise` : ''}</span><div><button class="button secondary" data-action="previous-preview" ${rulesState.page <= 1 ? 'disabled' : ''}>Anterior</button><button class="button secondary" data-action="next-preview" ${rulesState.page >= pages ? 'disabled' : ''}>Próxima</button></div></div>`;
}
function updatePreviewTable() { updateMoveButton(); if ($('#preview-results')) $('#preview-results').innerHTML = previewTable(); }
function showRuleEditor(id) {
  const folder = currentRulesFolder(); if (!folder) return;
  const rule = folder.organization.rules.find(rule => rule.id === id);
  rulesState.editorFolderId = folder.id; rulesState.editingId = rule?.id;
  rulesState.ruleDraft = rule ? structuredClone(rule) : { name: '', enabled: true, match: 'all', scope: 'inherit', action: 'move', conditions: [{ field: 'extension', value: '' }], destination: { mode: 'relative', value: '' }, presetId: null };
  const draft = rulesState.ruleDraft; draft.advanced = draft.conditions.length !== 1 || draft.conditions[0].field !== 'extension' || draft.scope !== 'inherit' || draft.action !== 'move';
  $('#rule-dialog-title').textContent = rule ? 'Editar categoria' : 'Nova categoria'; $('#rule-folder-caption').textContent = `Regras de ${folder.name}. Confira os destinos na prévia antes de organizar.`;
  $('#rule-name').value = draft.name; $('#rule-extensions').value = draft.conditions[0].field === 'extension' ? (Array.isArray(draft.conditions[0].value) ? draft.conditions[0].value.join(', ') : draft.conditions[0].value) : '';
  $('#rule-match').value = draft.match; $('#rule-scope').value = draft.scope; $('#rule-action').value = draft.action; $('#rule-destination-mode').value = draft.destination.mode; $('#rule-destination').value = draft.destination.value; $('#rule-enabled').checked = draft.enabled;
  $('#rule-error').hidden = true; renderConditions(); syncRuleMode(); syncDestinationMode(); $('#rule-dialog').showModal(); $('#rule-name').focus();
}
function syncRuleMode() {
  $('#simple-rule-fields').hidden = rulesState.ruleDraft.advanced; $('#advanced-rule-fields').hidden = !rulesState.ruleDraft.advanced;
  $('[data-action="rule-advanced"]').textContent = rulesState.ruleDraft.advanced ? 'Voltar ao modo simples' : 'Opções avançadas';
}
function syncDestinationMode() {
  const absolute = $('#rule-destination-mode').value === 'absolute'; $('[data-action="pick-destination"]').hidden = !absolute;
  $('#rule-destination').placeholder = absolute ? 'C:\\Destino\\Documentos' : 'Ex.: Documentos/Notas fiscais';
}
function renderConditions() {
  $('#condition-list').innerHTML = rulesState.ruleDraft.conditions.map((condition, index) => {
    const text = Array.isArray(condition.value) ? condition.value.join(', ') : condition.value;
    const field = condition.field;
    const control = field === 'noExtension' ? '<span class="condition-fixed">Arquivo sem extensão</span>' : field === 'type' ? `<select data-condition-value="${index}" aria-label="Valor da condição ${index+1}">${Object.entries(typeNames).filter(([type]) => type !== 'other').map(([type,label]) => `<option value="${type}" ${condition.value === type ? 'selected' : ''}>${label}</option>`).join('')}</select>` : `<input data-condition-value="${index}" aria-label="Valor da condição ${index+1}" type="${field.startsWith('size') ? 'number' : field.startsWith('modified') ? 'date' : 'text'}" value="${escapeHTML(text)}" ${field.startsWith('size') ? 'min="0" step="any"' : ''} placeholder="${field === 'extension' ? 'pdf, docx' : 'Valor'}">`;
    return `<div class="condition-row"><select data-condition-field="${index}" aria-label="Condição ${index+1}">${Object.entries(conditionFields).map(([key,label]) => `<option value="${key}" ${field === key ? 'selected' : ''}>${label}</option>`).join('')}</select>${control}<button type="button" class="icon-button" data-action="remove-condition" data-index="${index}" aria-label="Remover condição ${index+1}" ${rulesState.ruleDraft.conditions.length === 1 ? 'disabled' : ''}>${icon('close')}</button></div>`;
  }).join('');
}
function showPolicy() {
  const folder = currentRulesFolder(); if (!folder) return; rulesState.policyFolderId = folder.id;
  const org = folder.organization; $('#policy-caption').textContent = `Preferências somente para ${folder.name}.`;
  $('#exclude-files').value = (org.exclusions.files || []).join('\n'); $('#exclude-names').value = org.exclusions.names.join('\n'); $('#exclude-extensions').value = org.exclusions.extensions.join(', '); $('#exclude-subfolders').value = org.exclusions.subfolders.join('\n');
  $('#review-above').value = org.reviewAboveMB; $('#min-age').value = org.minAgeSeconds; $('#review-unknown').checked = org.reviewUnknown; $('#policy-error').hidden = true; $('#policy-dialog').showModal();
}
async function runPreview() {
  if (rulesState.scanning) return;
  rulesState.scanning = true; clearPreview(); render();
  try {
    rulesState.preview = await call('scan', rulesState.scope || null); rulesState.filter = 'all'; rulesState.query = ''; rulesState.page = 1;
    toast(rulesState.preview.cancelled ? 'Análise cancelada. A prévia é parcial.' : `${rulesState.preview.rows.length} arquivo(s) na prévia. Nenhum arquivo foi movido.`);
  } catch (error) { toast(error.message, true); }
  finally { rulesState.scanning = false; render(); }
}
async function rulesAction(name, button) {
  const folder = currentRulesFolder(), ruleId = button.dataset.ruleId;
  switch (name) {
    case 'folder-rules': rulesState.folderId = button.dataset.id; closeMenus(); return navigate('rules');
    case 'new-rule': return showRuleEditor();
    case 'edit-rule': return showRuleEditor(ruleId);
    case 'close-rule': if (!rulesState.saving) $('#rule-dialog').close(); return;
    case 'rule-advanced': {
      const draft = rulesState.ruleDraft;
      if (draft.advanced && (draft.conditions.length !== 1 || draft.conditions[0].field !== 'extension' || $('#rule-scope').value !== 'inherit' || $('#rule-action').value !== 'move')) return toast('Esta regra usa condições avançadas. Mantenha esse modo para editá-la.');
      if (!draft.advanced) { draft.conditions = [{ field: 'extension', value: $('#rule-extensions').value }]; renderConditions(); }
      else $('#rule-extensions').value = Array.isArray(draft.conditions[0].value) ? draft.conditions[0].value.join(', ') : draft.conditions[0].value;
      draft.advanced = !draft.advanced; syncRuleMode(); return;
    }
    case 'add-condition': if (rulesState.ruleDraft.conditions.length >= 12) return toast('Cada regra aceita até 12 condições.'); rulesState.ruleDraft.conditions.push({ field: 'nameContains', value: '' }); return renderConditions();
    case 'remove-condition': if (rulesState.ruleDraft.conditions.length > 1) rulesState.ruleDraft.conditions.splice(Number(button.dataset.index),1); return renderConditions();
    case 'pick-destination': { button.disabled = true; try { const selected = await call('pickFolder'); if (selected) $('#rule-destination').value = selected; } finally { button.disabled = false; } return; }
    case 'add-presets': button.disabled = true; try { applyState(await call('addPresets', folder.id)); toast('Categorias sugeridas adicionadas. Você pode editar ou pausar cada uma.'); } catch (error) { button.disabled = false; throw error; } return;
    case 'toggle-rule': button.disabled = true; try { applyState(await call('toggleRule', folder.id, ruleId)); } catch (error) { button.disabled = false; throw error; } return;
    case 'delete-rule': { const rule = folder.organization.rules.find(rule => rule.id === ruleId); rulesState.removingId = ruleId; rulesState.editorFolderId = folder.id; $('#delete-rule-description').textContent = `Remover a regra ${rule.name} de ${folder.name}?`; $('#delete-rule-dialog').showModal(); return; }
    case 'cancel-delete-rule': return $('#delete-rule-dialog').close();
    case 'confirm-delete-rule': button.disabled = true; try { applyState(await call('removeRule', rulesState.editorFolderId, rulesState.removingId)); $('#delete-rule-dialog').close(); toast('Categoria removida do cadastro.'); } finally { button.disabled = false; } return;
    case 'edit-policy': return showPolicy();
    case 'close-policy': if (!rulesState.policySaving) $('#policy-dialog').close(); return;
    case 'preview-folder': rulesState.scope = folder.id; navigate('overview'); return runPreview();
    case 'run-preview': return runPreview();
    case 'cancel-scan': button.disabled = true; return call('cancelScan');
    case 'preview-filter': rulesState.filter = button.dataset.filter; rulesState.page = 1; render(); return;
    case 'previous-preview': rulesState.page = Math.max(1, rulesState.page - 1); return updatePreviewTable();
    case 'next-preview': rulesState.page++; return updatePreviewTable();
  }
}
document.addEventListener('change', async event => {
  const target = event.target;
  try {
    if (target.id === 'rules-folder') { rulesState.folderId = target.value; return render(); }
    if (target.id === 'preview-scope') { rulesState.scope = target.value; clearPreview(); return render(); }
    if (target.id === 'rule-destination-mode') return syncDestinationMode();
    if (target.hasAttribute('data-condition-field')) {
      const field = target.value, index = Number(target.dataset.conditionField);
      rulesState.ruleDraft.conditions[index] = { field, value: field === 'noExtension' ? true : field === 'type' ? 'document' : field.startsWith('size') ? 0 : field.startsWith('modified') ? [new Date().getFullYear(), String(new Date().getMonth()+1).padStart(2,'0'), String(new Date().getDate()).padStart(2,'0')].join('-') : '' }; return renderConditions();
    }
    if (target.hasAttribute('data-condition-value')) { const condition = rulesState.ruleDraft.conditions[Number(target.dataset.conditionValue)]; condition.value = condition.field.startsWith('size') && target.value !== '' ? Number(target.value) : target.value; }
    if (target.id === 'select-ready') { previewRows().filter(row => row.status === 'ready').forEach(row => { if (target.checked) rulesState.selected.add(row.id); else rulesState.selected.delete(row.id); }); return updatePreviewTable(); }
    if (target.hasAttribute('data-select-row')) { if (target.checked) rulesState.selected.add(target.dataset.selectRow); else rulesState.selected.delete(target.dataset.selectRow); return updatePreviewTable(); }
    if (target.hasAttribute('data-resolve-row') && target.value) {
      target.disabled = true; const result = await call('resolvePreview', rulesState.preview.id, target.dataset.resolveRow, target.value); rulesState.preview = result;
      rulesState.selected = new Set([...rulesState.selected].filter(id => result.rows.some(row => row.id === id && row.status === 'ready'))); render(); toast('Escolha aplicada apenas a esta prévia.');
    }
  } catch (error) { toast(error.message, true); target.disabled = false; }
});
document.addEventListener('input', event => {
  if (event.target.id === 'preview-search') { rulesState.query = event.target.value; rulesState.page = 1; updatePreviewTable(); }
  if (event.target.id === 'rule-name') { const draft = rulesState.ruleDraft; if ($('#rule-destination-mode').value === 'relative' && (!$('#rule-destination').value || $('#rule-destination').value === draft.name)) $('#rule-destination').value = event.target.value; draft.name = event.target.value; }
  if (event.target.hasAttribute('data-condition-value')) { const condition = rulesState.ruleDraft.conditions[Number(event.target.dataset.conditionValue)]; condition.value = condition.field.startsWith('size') && event.target.value !== '' ? Number(event.target.value) : event.target.value; }
});
$('#rule-form').addEventListener('submit', async event => {
  event.preventDefault(); if (rulesState.saving) return; rulesState.saving = true;
  const draft = rulesState.ruleDraft;
  const input = { name: $('#rule-name').value, enabled: $('#rule-enabled').checked, match: draft.advanced ? $('#rule-match').value : 'all', scope: draft.advanced ? $('#rule-scope').value : 'inherit', action: draft.advanced ? $('#rule-action').value : 'move', conditions: draft.advanced ? draft.conditions : [{ field: 'extension', value: $('#rule-extensions').value }], destination: { mode: $('#rule-destination-mode').value, value: $('#rule-destination').value }, presetId: draft.presetId };
  const controls = [...$('#rule-form').querySelectorAll('input,button,select')]; controls.forEach(el => { el.disabled = true; });
  try { applyState(await call('saveRule', rulesState.editorFolderId, input, rulesState.editingId)); $('#rule-dialog').close(); toast('Regra salva. Atualize a prévia para ver os destinos.'); }
  catch (error) { $('#rule-error').textContent = error.message; $('#rule-error').hidden = false; }
  finally { rulesState.saving = false; controls.forEach(el => { el.disabled = false; }); if ($('#rule-dialog').open) renderConditions(); }
});
$('#policy-form').addEventListener('submit', async event => {
  event.preventDefault(); if (rulesState.policySaving) return; rulesState.policySaving = true;
  const lines = id => $(id).value.split(/\r?\n/).map(text => text.trim()).filter(Boolean);
  const input = { exclusions: { files: lines('#exclude-files'), names: lines('#exclude-names'), extensions: $('#exclude-extensions').value.split(/[,;\s]+/).filter(Boolean), subfolders: lines('#exclude-subfolders') }, reviewAboveMB: Number($('#review-above').value), minAgeSeconds: Number($('#min-age').value), reviewUnknown: $('#review-unknown').checked };
  const controls = [...$('#policy-form').querySelectorAll('input,textarea,button')]; controls.forEach(el => { el.disabled = true; });
  try { applyState(await call('savePolicy', rulesState.policyFolderId, input)); $('#policy-dialog').close(); toast('Exceções e preferências salvas para esta pasta.'); }
  catch (error) { $('#policy-error').textContent = error.message; $('#policy-error').hidden = false; }
  finally { rulesState.policySaving = false; controls.forEach(el => { el.disabled = false; }); }
});
$('#rule-dialog').addEventListener('cancel', event => { if (rulesState.saving) event.preventDefault(); });
$('#policy-dialog').addEventListener('cancel', event => { if (rulesState.policySaving) event.preventDefault(); });
window.organiza?.onProgress(progress => { if ($('#scan-progress') && rulesState.scanning) $('#scan-progress').textContent = `${progress.visited} item(ns) verificado(s) · ${progress.rows} arquivo(s)`; });
hydrateIcons($('#rule-dialog')); hydrateIcons($('#policy-dialog'));

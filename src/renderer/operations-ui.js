'use strict';
const opsState={busy:false,plan:null,history:null,loadingHistory:false,historyError:null,query:'',filter:'all',page:1,undoId:null,progress:null,refreshing:false};
const operationActions=new Set(['prepare-move','close-move','confirm-move','cancel-moves','open-monitor','folder-monitor','close-monitor','confirm-monitor','pause-all','open-undo','close-undo','confirm-undo','history-refresh','history-previous','history-next','history-reveal-source','history-reveal-destination','open-recycle-bin']);
function isOperationAction(name){return operationActions.has(name);}
function selectableRow(row){const candidate=row.candidates.find(c=>c.ruleId===(row.selectedRuleId||row.ruleId))||(row.candidates.length===1?row.candidates[0]:null);return row.status!=='ignored'&&!row.ignoreReason&&!!candidate&&(!candidate.problem||candidate.issue==='occupied');}
function updateMoveButton(){const button=$('[data-action="prepare-move"]');if(button)button.disabled=!rulesState.selected.size||opsState.busy||!model.capabilities.organize;}
function monitorHeader(){
  const count=model.monitor?.activeIds.length||0;
  return `<span class="status-pill ${count?'monitor-on':''}">${icon(count?'check':'pause')}${count?`${count} pasta(s) em monitoramento`:'Monitoramento pausado'}</span>${count?`<button class="button secondary" data-action="pause-all">${icon('pause')}Pausar monitoramento</button>`:`<button class="button primary" data-action="open-monitor" ${!model.folders.length||!model.capabilities.organize||opsState.busy?'disabled':''}>${icon('play')}Ativar organização automática</button>`}`;
}
function operationBanner(){
  const problem=model.history?.error,attention=model.history?.attention;
  let html=problem?`<div class="operation-warning" role="alert">${escapeHTML(problem)}</div>`:attention?`<div class="operation-warning" role="status">Há ${attention} operação(ões) interrompida(s) para conferir no Histórico.</div>`:'';
  if(model.monitor?.lastResult?.warning||model.monitor?.lastResult?.error)html+=`<div class="operation-warning">Monitoramento: ${escapeHTML(model.monitor.lastResult.warning||model.monitor.lastResult.error)}</div>`;
  if(model.operation?.recovering)html+='<div class="operation-warning">Conferindo operações interrompidas. Aguarde antes de organizar.</div>';
  if(opsState.busy||model.operation?.busy)html+=`<div class="operation-progress" role="status"><span class="spinner"></span><span id="operation-progress-label">${escapeHTML(opsState.progress?.name?`Conferindo ${opsState.progress.name}…`:'Concluindo operação…')}</span><button class="text-button" data-action="cancel-moves">Parar após este arquivo</button></div>`;
  return html;
}
function historyPage(){
  if(!opsState.history&&!opsState.loadingHistory){opsState.loadingHistory=true;queueMicrotask(()=>loadHistory());}
  const all=opsState.history||[],labels={moved:'Organizado',undone:'Desfeito',failed:'Não concluído',trashed:'Na Lixeira',prepared:'Interrompido',attention:'Conferir'};
  const rows=all.filter(entry=>(opsState.filter==='all'||entry.effectiveStatus===opsState.filter)&&`${entry.source} ${entry.destination} ${entry.folderName||''} ${entry.ruleName||''}`.toLocaleLowerCase('pt-BR').includes(opsState.query.toLocaleLowerCase('pt-BR')));
  const pages=Math.max(1,Math.ceil(rows.length/50));opsState.page=Math.min(opsState.page,pages);
  return header('Histórico','Cada movimentação, com transparência.',`<button class="button secondary" data-action="history-refresh" ${opsState.busy?'disabled':''}>${icon('refresh')}Conferir e atualizar</button>`)+
    `<div class="history-toolbar"><label class="search-input">${icon('search')}<input type="text" id="history-search" aria-label="Buscar no histórico" placeholder="Buscar arquivo, pasta ou regra" value="${escapeHTML(opsState.query)}"></label><select id="history-filter" aria-label="Filtrar histórico"><option value="all">Todas as situações</option>${Object.entries(labels).map(([value,label])=>`<option value="${value}" ${opsState.filter===value?'selected':''}>${label}</option>`).join('')}</select></div>`+
    (opsState.historyError?`<div class="operation-warning">${escapeHTML(opsState.historyError)}</div>`:'')+
    (!all.length?`<section class="panel future-panel"><span class="future-icon">${icon('clock')}</span><h2>Seu histórico começa aqui</h2><p>${opsState.loadingHistory?'Carregando movimentações…':'Quando você organizar arquivos, verá aqui as origens, os destinos e a opção de desfazer.'}</p></section>`:
    `<section class="history-list">${rows.slice((opsState.page-1)*50,opsState.page*50).map(entry=>`<article class="history-card"><div class="history-item-top"><div><strong>${escapeHTML(entry.source.split(/[\\/]/).pop())}</strong><span class="status-tag ${entry.effectiveStatus==='moved'?'ready':['undone','trashed'].includes(entry.effectiveStatus)?'ignored':entry.effectiveStatus==='failed'?'review':'conflict'}">${labels[entry.effectiveStatus]||'Conferir'}</span><small>${new Date(entry.completedAt||entry.time).toLocaleString('pt-BR')} · ${entry.mode==='auto'?'Automático':'Manual'}${entry.ruleName?' · '+escapeHTML(entry.ruleName):''}</small></div>${entry.operation==='trash'?`<button class="button secondary" data-action="open-recycle-bin" ${model.capabilities.recycleBin?'':'disabled'}>${icon('trash')}Abrir Lixeira</button>`:`<button class="button secondary" data-action="open-undo" data-entry-id="${escapeHTML(entry.id)}" ${entry.operation!=='trash'&&entry.effectiveStatus==='moved'&&!opsState.busy&&model.capabilities.organize?'':'disabled'}>${icon('clock')}Desfazer</button>`}</div><div class="history-path"><span>Origem</span><code>${escapeHTML(entry.source)}</code><button class="icon-button" data-action="history-reveal-source" data-entry-id="${escapeHTML(entry.id)}" aria-label="Mostrar origem de ${escapeHTML(entry.source.split(/[\\/]/).pop())}">${icon('open')}</button></div><div class="history-path"><span>Destino</span><code>${entry.operation==='trash'?'Lixeira do Windows — restaure por lá':escapeHTML(entry.destination)}</code><button class="icon-button" ${entry.operation==='trash'?'hidden':''} data-action="history-reveal-destination" data-entry-id="${escapeHTML(entry.id)}" aria-label="Mostrar destino de ${escapeHTML(entry.source.split(/[\\/]/).pop())}">${icon('open')}</button></div><p>${escapeHTML(entry.lastUndoError||entry.message||'Movimentação registrada.')}${entry.recovered?' Registro recuperado ao reabrir.':''}</p></article>`).join('')||'<div class="no-search">Nenhuma movimentação neste filtro.</div>'}</section><div class="pagination"><span>${rows.length} registro(s) · Página ${opsState.page} de ${pages}</span><div><button class="button secondary" data-action="history-previous" ${opsState.page<=1?'disabled':''}>Anterior</button><button class="button secondary" data-action="history-next" ${opsState.page>=pages?'disabled':''}>Próxima</button></div></div>`);
}
async function loadHistory(){
  try{const result=await call('listHistory');opsState.history=result.entries;opsState.historyError=result.error;}
  catch(error){opsState.historyError=error.message;opsState.history=[];}
  finally{opsState.loadingHistory=false;if(page==='history')render();}
}
async function refreshOperationState(){
  if(opsState.refreshing||!model)return;opsState.refreshing=true;
  try{
    const next=await call('getState');if(next.history?.generation!==model.history?.generation){clearPreview();opsState.history=null;}
    opsState.busy=next.operation.busy;applyState(next);
  }catch(error){toast(error.message,true);}finally{opsState.refreshing=false;}
}
function showMonitor(folderId){
  $('#monitor-error').hidden=true;
  $('#monitor-folders').innerHTML=model.folders.map(folder=>`<label class="monitor-folder-option"><input type="checkbox" name="monitor-folder" value="${escapeHTML(folder.id)}" ${folder.id===folderId?'checked':''}><span><strong>${escapeHTML(folder.name)}</strong><small>${escapeHTML(folder.path)}</small><small>${folder.organization.rules.filter(r=>r.enabled&&r.action==='move').length} regra(s) ativa(s) de organização · Revise a prévia antes de ativar</small></span></label>`).join('');
  $('#monitor-dialog').showModal();
}
async function operationsAction(name,button){
  switch(name){
    case 'prepare-move':{
      if(opsState.busy)return;button.disabled=true;
      try{opsState.plan=await call('planMoves',rulesState.preview.id,[...rulesState.selected]);$('#move-caption').textContent=`${opsState.plan.entries.length} arquivo(s). O monitoramento foi pausado para esta revisão.`;$('#move-targets').innerHTML=opsState.plan.entries.map(entry=>`<div class="move-target"><strong>${escapeHTML(entry.name)}${entry.renamed?'<span>Nome ajustado</span>':''}${entry.requiresReview?'<span>Revisão necessária</span>':''}</strong><small>${escapeHTML(entry.source)}</small><code>${escapeHTML(entry.destination)}</code></div>`).join('');$('#approve-review-row').hidden=!opsState.plan.reviewCount;$('#approve-review').checked=false;$('#move-error').hidden=true;$('#move-dialog').showModal();}
      finally{updateMoveButton();}return;
    }
    case 'close-move':return $('#move-dialog').close();
    case 'confirm-move':{
      if(opsState.busy)return;
      if(opsState.plan.reviewCount&&!$('#approve-review').checked){$('#move-error').textContent='Confirme que revisou os arquivos marcados.';$('#move-error').hidden=false;return;}
      opsState.busy=true;button.disabled=true;$('#move-dialog').close();render();
      try{const result=await call('executeMoves',opsState.plan.id,$('#approve-review').checked);clearPreview();opsState.history=null;toast(`${result.moved} arquivo(s) organizado(s). ${result.failed} sem movimentação.${result.cancelled?' Fila interrompida.':''}`);}
      catch(error){toast(error.message,true);}
      finally{opsState.busy=false;button.disabled=false;await refreshOperationState();page='history';render();}return;
    }
    case 'cancel-moves':await call('cancelMoves');button.disabled=true;button.textContent='Concluindo arquivo atual…';return;
    case 'open-monitor':return showMonitor();
    case 'folder-monitor':closeMenus();if(model.monitor.activeIds.includes(button.dataset.id)){await call('pauseMonitor',button.dataset.id);await refreshOperationState();toast('Monitoramento desta pasta pausado.');}else showMonitor(button.dataset.id);return;
    case 'close-monitor':return $('#monitor-dialog').close();
    case 'confirm-monitor':{
      const ids=[...document.querySelectorAll('input[name="monitor-folder"]:checked')].map(input=>input.value);button.disabled=true;
      try{await call('activateMonitor',ids);$('#monitor-dialog').close();await refreshOperationState();toast('Monitoramento ativado. A primeira rodada observa a estabilidade dos arquivos.');}
      catch(error){$('#monitor-error').textContent=error.message;$('#monitor-error').hidden=false;}finally{button.disabled=false;}return;
    }
    case 'pause-all':await call('pauseAllMonitor');await refreshOperationState();toast('Monitoramento pausado.');return;
    case 'open-undo':opsState.undoId=button.dataset.entryId;$('#undo-caption').textContent=opsState.history.find(entry=>entry.id===opsState.undoId)?.source||'';$('#undo-error').hidden=true;$('#undo-dialog').showModal();return;
    case 'close-undo':if(!opsState.busy)$('#undo-dialog').close();return;
    case 'confirm-undo':{
      if(opsState.busy)return;opsState.busy=true;button.disabled=true;render();
      try{await call('undoMove',opsState.undoId);$('#undo-dialog').close();clearPreview();opsState.history=null;toast('Arquivo restaurado ao local original.');}
      catch(error){$('#undo-error').textContent=error.message;$('#undo-error').hidden=false;}
      finally{opsState.busy=false;button.disabled=false;await refreshOperationState();if(page==='history')await loadHistory();}return;
    }
    case 'history-refresh':button.disabled=true;try{const result=await call('recoverHistory');opsState.history=result.entries;opsState.historyError=result.error;await refreshOperationState();if(!opsState.history)await loadHistory();else render();}finally{button.disabled=false;}return;
    case 'history-previous':opsState.page--;return render();
    case 'history-next':opsState.page++;return render();
    case 'open-recycle-bin':return call('openRecycleBin');
    case 'history-reveal-source':return call('revealHistory',button.dataset.entryId,'source');
    case 'history-reveal-destination':return call('revealHistory',button.dataset.entryId,'destination');
  }
}
document.addEventListener('input',event=>{
  if(event.target.id==='history-search'){opsState.query=event.target.value;opsState.page=1;const value=event.target.value,position=event.target.selectionStart;render();$('#history-search').focus();$('#history-search').setSelectionRange(position,position);$('#history-search').value=value;}
});
document.addEventListener('change',event=>{if(event.target.id==='history-filter'){opsState.filter=event.target.value;opsState.page=1;render();}});
window.organiza?.onOrganizerChanged(refreshOperationState);
window.organiza?.onOperationProgress(progress=>{const changed=opsState.busy!==progress.busy;opsState.busy=progress.busy;opsState.progress=progress;if(changed&&model&&!document.querySelector('dialog[open]'))render();const label=$('#operation-progress-label');if(label&&progress.name)label.textContent=`${progress.index+1} de ${progress.total}: ${progress.name}`;if(!progress.busy)refreshOperationState();});
$('#undo-dialog').addEventListener('cancel',event=>{if(opsState.busy)event.preventDefault();});
hydrateIcons($('#move-dialog'));

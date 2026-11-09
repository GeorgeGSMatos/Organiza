'use strict';
const reviewState={group:null,selected:new Set(),busy:false,trashing:false,visibleGroups:6,lastName:''};
const reviewActions=new Set(['review-selection-keep','review-selection-trash','review-new','review-existing','review-row','review-close','review-pick-destination','review-keep-open','review-keep-close','review-defer','review-keep','review-resume','review-more','review-trash-open','review-trash-close','review-trash-confirm']);
function isReviewAction(name){return reviewActions.has(name);}
function reviewCenter(){
  const summary=rulesState.preview?.review;if(!summary||!['all','review'].includes(rulesState.filter)||(!summary.groups.length&&!summary.deferredCount))return '';
  return `<section class="review-center" aria-label="Sugestões para arquivos sem regra"><div class="review-center-header"><div><h3>Arquivos sem regra</h3><p>Escolha um destino, crie uma regra ou decida manter os arquivos onde estão.</p></div><span class="review-count">${summary.groups.reduce((count,group)=>count+group.rowIds.length,0)} para decidir</span></div><div class="review-groups">${summary.groups.slice(0,reviewState.visibleGroups).map(group=>`<article class="review-group"><div class="review-group-title"><span class="review-format">${escapeHTML(group.extension?group.extension.slice(1).toUpperCase():'?')}</span><div><h4>${group.rowIds.length} arquivo(s) ${escapeHTML(group.extension||'sem extensão')}</h4><small>${escapeHTML(group.folderName)}</small></div></div><p class="review-group-files" title="${escapeHTML(group.files.map(file=>file.relativePath).join(', '))}">${group.files.slice(0,2).map(file=>escapeHTML(file.name)).join(' · ')}${group.files.length>2?` · +${group.files.length-2}`:''}</p><p class="review-suggestion">${group.suggestion.name?`Sugestão: <strong>${escapeHTML(group.suggestion.name)}</strong>`:'Escolha uma categoria para estes arquivos.'}<small>${escapeHTML(group.suggestion.reason)}</small></p><div class="review-group-actions"><button class="button ${group.recommendedCategoryId?'secondary':'primary'}" data-action="review-new" data-group-id="${group.id}">${icon('plus')}Criar categoria</button><button class="button ${group.recommendedCategoryId?'primary':'secondary'}" data-action="review-existing" data-group-id="${group.id}" ${(summary.categories[group.folderId]||[]).length?'':'disabled'}>Usar categoria</button><button class="text-button" data-action="review-keep-open" data-group-id="${group.id}">Manter onde está</button><button class="icon-button trash-choice" data-action="review-trash-open" data-group-id="${group.id}" aria-label="Enviar ${escapeHTML(group.extension||'arquivos sem extensão')} à Lixeira" title="Enviar para a Lixeira" ${model.capabilities.trash?'':'disabled'}>${icon('trash')}</button></div></article>`).join('')}</div><div class="review-center-footer">${summary.groups.length>reviewState.visibleGroups?'<button class="text-button" data-action="review-more">Mostrar mais formatos</button>':'<span></span>'}${summary.deferredCount?`<span>${summary.deferredCount} adiado(s) nesta sessão <button class="text-button" data-action="review-resume">Retomar adiados</button></span>`:''}</div></section>`;
}
function getReviewGroup(button){
  if(button.dataset.rowId){const row=rulesState.preview.rows.find(row=>row.id===button.dataset.rowId);const group=rulesState.preview.review.groups.find(group=>group.rowIds.includes(row?.id));if(!group)throw new Error('Atualize a prévia para rever as sugestões.');return {...group,rowIds:[row.id],files:group.files.filter(file=>file.id===row.id)};}
  const group=rulesState.preview.review.groups.find(group=>group.id===button.dataset.groupId);if(!group)throw new Error('Esta sugestão não está mais disponível.');return group;
}
function reviewFileChoices(group,trash=false){return group.files.map(file=>`<label class="review-file-option"><input type="checkbox" ${trash?'data-trash-file':'data-review-file'}="${escapeHTML(file.id)}" checked><span><strong>${escapeHTML(file.name)}</strong><small>${escapeHTML(file.relativePath)}</small></span></label>`).join('');}
function openReview(group,mode){
  reviewState.group=group;reviewState.selected=new Set(group.rowIds);reviewState.lastName=group.suggestion.name;
  $('#review-caption').textContent=`${group.folderName} · ${group.rowIds.length} arquivo(s) ${group.extension||'sem extensão'}. A decisão prepara os destinos; os arquivos continuam no lugar até você organizar.`;
  $('#review-file-choices').innerHTML=reviewFileChoices(group);$('#review-mode').value=mode;
  const categories=rulesState.preview.review.categories[group.folderId]||[];
  $('#review-mode').querySelector('[value="existing"]').disabled=!categories.length;
  $('#review-category').innerHTML=categories.map(category=>`<option value="${escapeHTML(category.id)}">${escapeHTML(category.name)}${category.enabled?'':' (regra pausada)'}</option>`).join('');
  if(group.recommendedCategoryId)$('#review-category').value=group.recommendedCategoryId;
  $('#review-category-name').value=group.suggestion.name;$('#review-destination-mode').value='relative';$('#review-destination').value=group.suggestion.name;$('#review-future').checked=false;
  $('#review-future-label').textContent=`Criar regra também para os próximos arquivos ${group.extension||'sem extensão'}`;
  $('#review-error').hidden=true;syncReviewMode();$('#review-dialog').showModal();(mode==='new'?$('#review-category-name'):$('#review-category')).focus();
}
function syncReviewMode(){
  const existing=$('#review-mode').value==='existing';$('#review-existing-fields').hidden=!existing;$('#review-new-fields').hidden=existing;
  if(existing){const category=(rulesState.preview.review.categories[reviewState.group.folderId]||[]).find(category=>category.id===$('#review-category').value);if(category){$('#review-destination-mode').value=category.destination.mode;$('#review-destination').value=category.destination.value;}}
  else {$('#review-destination-mode').value='relative';$('#review-destination').value=$('#review-category-name').value;}
  $('#review-destination-mode').disabled=existing;$('#review-destination').readOnly=existing;
  $('[data-action="review-pick-destination"]').hidden=existing||$('#review-destination-mode').value!=='absolute';
}
function applyReviewResponse(response){
  applyState(response.state);if(reviewState.group)rulesState.folderId=reviewState.group.folderId;rulesState.preview=response.preview;rulesState.selected.clear();rulesState.filter='review';rulesState.query='';rulesState.page=1;render();
}
function showReviewKeep(group){reviewState.group=group;$('#review-keep-caption').textContent=`${group.rowIds.length} arquivo(s) ${group.extension||'sem extensão'} em ${group.folderName}.`;$('#review-keep-error').hidden=true;$('#review-keep-dialog').showModal();}
function showReviewTrash(group){reviewState.group=group;$('#trash-file-choices').innerHTML=reviewFileChoices(group,true);$('#review-trash-error').hidden=true;$('#review-trash-dialog').showModal();}
async function reviewAction(name,button){
  switch(name){
    case 'review-selection-keep':case 'review-selection-trash':{
      const ids=[...document.querySelectorAll('[data-review-file]:checked')].map(input=>input.dataset.reviewFile);
      if(!ids.length){$('#review-error').textContent='Selecione ao menos um arquivo.';$('#review-error').hidden=false;return;}
      const group={...reviewState.group,rowIds:ids,files:reviewState.group.files.filter(file=>ids.includes(file.id))};
      $('#review-dialog').close();return name==='review-selection-keep'?showReviewKeep(group):showReviewTrash(group);
    }
    case 'review-new':return openReview(getReviewGroup(button),'new');
    case 'review-existing':return openReview(getReviewGroup(button),'existing');
    case 'review-row':{const group=getReviewGroup(button);return openReview(group,group.recommendedCategoryId?'existing':'new');}
    case 'review-close':if(!reviewState.busy)$('#review-dialog').close();return;
    case 'review-pick-destination':button.disabled=true;try{const selected=await call('pickFolder');if(selected)$('#review-destination').value=selected;}finally{button.disabled=false;}return;
    case 'review-keep-open':return showReviewKeep(getReviewGroup(button));
    case 'review-keep-close':if(!reviewState.busy)$('#review-keep-dialog').close();return;
    case 'review-defer':case 'review-keep':{
      if(reviewState.busy)return;reviewState.busy=true;const buttons=[...$('#review-keep-dialog').querySelectorAll('button')];buttons.forEach(item=>item.disabled=true);
      try{const response=await call(name==='review-defer'?'deferReview':'keepReview',rulesState.preview.id,reviewState.group.rowIds);$('#review-keep-dialog').close();applyReviewResponse(response);toast(name==='review-defer'?'Sugestões adiadas somente nesta sessão.':'Caminhos adicionados às exceções. Os arquivos continuam no lugar.');}
      catch(error){$('#review-keep-error').textContent=error.message;$('#review-keep-error').hidden=false;}finally{reviewState.busy=false;buttons.forEach(item=>item.disabled=false);}return;
    }
    case 'review-resume':button.disabled=true;try{applyReviewResponse(await call('resumeReview',rulesState.preview.id));}finally{button.disabled=false;}return;
    case 'review-more':reviewState.visibleGroups+=6;return render();
    case 'review-trash-open':return showReviewTrash(getReviewGroup(button));
    case 'review-trash-close':if(reviewState.trashing){await call('cancelMoves');button.textContent='Parando após o arquivo atual…';button.disabled=true;}else if(!reviewState.busy)$('#review-trash-dialog').close();return;
    case 'review-trash-confirm':{
      if(reviewState.busy)return;const ids=[...document.querySelectorAll('[data-trash-file]:checked')].map(input=>input.dataset.trashFile);
      if(!ids.length){$('#review-trash-error').textContent='Selecione ao menos um arquivo.';$('#review-trash-error').hidden=false;return;}
      reviewState.busy=true;button.disabled=true;
      try{
        const plan=await call('planTrash',rulesState.preview.id,ids);reviewState.trashing=true;button.textContent='Enviando à Lixeira…';$('#review-trash-dialog [data-action="review-trash-close"]').textContent='Parar após este arquivo';
        const result=await call('executeTrash',plan.id);$('#review-trash-dialog').close();clearPreview();opsState.history=null;await refreshOperationState();navigate('history');toast(`${result.trashed} enviado(s) à Lixeira. ${result.failed} sem envio confirmado.${result.cancelled?' Fila interrompida.':''}`);
      }catch(error){$('#review-trash-error').textContent=error.message;$('#review-trash-error').hidden=false;}
      finally{reviewState.busy=false;reviewState.trashing=false;button.disabled=false;button.textContent='Confirmar envio para a Lixeira';const cancel=$('#review-trash-dialog [data-action="review-trash-close"]');cancel.textContent='Cancelar';cancel.disabled=false;}return;
    }
  }
}
$('#review-form').addEventListener('submit',async event=>{
  event.preventDefault();if(reviewState.busy)return;
  const ids=[...document.querySelectorAll('[data-review-file]:checked')].map(input=>input.dataset.reviewFile);
  if(!ids.length){$('#review-error').textContent='Selecione ao menos um arquivo.';$('#review-error').hidden=false;return;}
  const input={mode:$('#review-mode').value,categoryId:$('#review-category').value,name:$('#review-category-name').value,destination:{mode:$('#review-destination-mode').value,value:$('#review-destination').value},saveForFuture:$('#review-future').checked};
  reviewState.busy=true;const controls=[...$('#review-form').querySelectorAll('input,button,select')];controls.forEach(control=>control.disabled=true);
  try{const response=await call('assignReview',rulesState.preview.id,ids,input);$('#review-dialog').close();applyReviewResponse(response);toast(`${response.assigned} arquivo(s) preparado(s) na prévia.${response.remaining?` ${response.remaining} mudou(ram); analise novamente.`:''} ${input.saveForFuture?'Regra para próximos arquivos salva.':'A decisão não ativa organização dos próximos arquivos.'}`);}
  catch(error){$('#review-error').textContent=error.message;$('#review-error').hidden=false;}
  finally{reviewState.busy=false;controls.forEach(control=>control.disabled=false);if($('#review-dialog').open)syncReviewMode();}
});
document.addEventListener('change',event=>{
  if(['review-mode','review-category'].includes(event.target.id))syncReviewMode();
  if(event.target.id==='review-destination-mode')$('[data-action="review-pick-destination"]').hidden=$('#review-mode').value==='existing'||event.target.value!=='absolute';
});
document.addEventListener('input',event=>{if(event.target.id==='review-category-name'){if($('#review-destination-mode').value==='relative'&&(!$('#review-destination').value||$('#review-destination').value===reviewState.lastName))$('#review-destination').value=event.target.value;reviewState.lastName=event.target.value;}});
for(const id of ['review-dialog','review-keep-dialog','review-trash-dialog'])$('#'+id).addEventListener('cancel',event=>{if(reviewState.busy)event.preventDefault();});
hydrateIcons($('#review-dialog'));hydrateIcons($('#review-trash-dialog'));

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Store, FolderService, defaults } = require('../src/main/store.cjs');
const { RulesService } = require('../src/main/rules-service.cjs');
const { PreviewService, matchesCondition } = require('../src/main/preview.cjs');
const { normalizeRule, normalizePolicy, defaultOrganization } = require('../src/main/rules-config.cjs');
async function fixture(t, recursive = false) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'organiza-rules-'))); t.after(() => fs.rm(root,{ recursive:true,force:true }));
  const directory = path.join(root,'Origem'); await fs.mkdir(directory);
  const store = new Store(path.join(root,'app','config.json')); await store.load();
  await new FolderService(store).save({ path:directory,name:'Origem',includeSubfolders:recursive });
  const folderId = store.snapshot().folders[0].id, rules = new RulesService(store), preview = new PreviewService(store);
  const write = async (relative, content = 'conteúdo', recent = false) => { const file = path.join(directory,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content);if(!recent) await fs.utimes(file,new Date(Date.now()-600000),new Date(Date.now()-600000));return file; };
  const rule = (overrides={}) => ({ name:'PDFs',enabled:true,match:'all',scope:'inherit',action:'move',conditions:[{field:'extension',value:'pdf'}],destination:{mode:'relative',value:'Documentos'},...overrides });
  return { root,directory,store,folderId,rules,preview,write,rule };
}
test('migra o cadastro v1 sem perder pastas e salva regras e preferências após reabrir', async t => {
  const f=await fixture(t);const legacy=f.store.snapshot();legacy.version=1;delete legacy.folders[0].organization;await fs.writeFile(f.store.file,JSON.stringify(legacy));
  const store=new Store(f.store.file);const migrated=await store.load();assert.equal(migrated.version,3);assert.equal(migrated.folders[0].path,f.directory);assert.deepEqual(migrated.folders[0].organization.rules,[]);assert.equal(JSON.parse(await fs.readFile(f.store.file+'.v1.bak','utf8')).version,1);
  await new RulesService(store).presets(f.folderId);await new RulesService(store).policy(f.folderId,{...defaultOrganization(),reviewAboveMB:50,exclusions:{names:['rascunho'],extensions:['bak'],subfolders:['Backup']}});
  const reopened=new Store(f.store.file);await reopened.load();assert.equal(reopened.snapshot().folders[0].organization.rules.length,6);assert.equal(reopened.snapshot().folders[0].organization.reviewAboveMB,50);
});
test('categorias sugeridas são independentes por pasta e não duplicam nem sobrescrevem edições', async t => {
  const f=await fixture(t);await f.rules.presets(f.folderId);const rules=f.store.snapshot().folders[0].organization.rules;
  await f.rules.save(f.folderId,f.rule({...rules[0],name:'Meus documentos',enabled:false}),rules[0].id);await f.rules.presets(f.folderId);
  const org=f.store.snapshot().folders[0].organization;assert.equal(org.rules.length,6);assert.equal(org.rules[0].name,'Meus documentos');assert.equal(org.rules[0].enabled,false);
  await new FolderService(f.store).save({path:f.directory,name:'Renomeada',includeSubfolders:true},f.folderId);assert.equal(f.store.snapshot().folders[0].organization.rules.length,6);
  const other=path.join(f.root,'Outra');await fs.mkdir(other);await new FolderService(f.store).save({path:other,includeSubfolders:false});assert.equal(f.store.snapshot().folders[1].organization.rules.length,0);
});
test('valida extensões, destinos relativos e condições sem aceitar caminhos que escapam da origem', async t => {
  const f=await fixture(t);assert.deepEqual(normalizeRule(f.rule({conditions:[{field:'extension',value:'PDF, .docx;tar.gz'}]})).conditions[0].value,['.pdf','.docx','.tar.gz']);
  for(const target of ['../fora','Documentos/../../fora','C:\\Windows','CON','foo/NUL.txt','foo/..','foo/','foo?','/absoluto']) assert.throws(()=>normalizeRule(f.rule({destination:{mode:'relative',value:target}})),undefined,target);
  for(const condition of [{field:'extension',value:'*.pdf'},{field:'type',value:'__proto__'},{field:'modifiedBefore',value:'2026-02-30'},{field:'sizeMin',value:-1}])assert.throws(()=>normalizeRule(f.rule({conditions:[condition]})));
  await assert.rejects(f.rules.save(f.folderId,f.rule({destination:{mode:'absolute',value:f.directory}})),/diferente/);
  assert.throws(()=>normalizePolicy({...defaultOrganization(),minAgeSeconds:0}));
});
test('prévia aplica tipos sugeridos, marca arquivos sem regra e preserva todo o conteúdo', async t => {
  const f=await fixture(t);await f.rules.presets(f.folderId);await f.write('CONTRATO.PDF','pdf original');await f.write('contas.xlsx','planilha original');await f.write('desconhecido.xyz','outro');
  const before=await fs.readdir(f.directory);const result=await f.preview.scan();assert.equal(result.summary.ready,2);assert.equal(result.summary.review,1);
  const pdf=result.rows.find(r=>r.name==='CONTRATO.PDF');assert.equal(pdf.ruleName,'Documentos');assert.equal(pdf.destination,path.join(f.directory,'Documentos','CONTRATO.PDF'));
  assert.deepEqual(await fs.readdir(f.directory),before);assert.equal(await fs.readFile(path.join(f.directory,'CONTRATO.PDF'),'utf8'),'pdf original');assert.equal(await fs.readFile(path.join(f.directory,'contas.xlsx'),'utf8'),'planilha original');
});
test('combina condições com E/OU, ignora regras pausadas e respeita escopo', async t => {
  const f=await fixture(t,true);await f.write('nota.pdf');await f.write('carta.pdf');await f.write('nota.txt');await f.write('Sub/nota.pdf');
  await f.rules.save(f.folderId,f.rule({scope:'root',conditions:[{field:'extension',value:'pdf'},{field:'nameStarts',value:'NOTA'}]}));
  let result=await f.preview.scan();assert.equal(result.summary.ready,1);assert.equal(result.rows.find(r=>r.relativePath===path.join('Sub','nota.pdf')).status,'review');
  const id=f.store.snapshot().folders[0].organization.rules[0].id;await f.rules.save(f.folderId,f.rule({match:'any',conditions:[{field:'extension',value:'pdf'},{field:'nameContains',value:'nota'}]}),id);
  result=await f.preview.scan();assert.equal(result.rows.filter(r=>r.candidates.length===1).length,4);assert.equal(result.summary.ready,2);assert.equal(result.summary.conflict,2);
  await f.rules.toggle(f.folderId,id);result=await f.preview.scan();assert.equal(result.summary.ready,0);
});
test('apresenta múltiplas regras sem escolher silenciosamente e resolve só na prévia atual', async t => {
  const f=await fixture(t);await f.write('nota.pdf');await f.rules.save(f.folderId,f.rule());await f.rules.save(f.folderId,f.rule({name:'Notas',conditions:[{field:'nameContains',value:'nota'}],destination:{mode:'relative',value:'Notas'}}));
  let result=await f.preview.scan();const row=result.rows[0];assert.equal(row.status,'conflict');assert.equal(row.destination,null);assert.equal(row.candidates.length,2);
  result=await f.preview.resolve(result.id,row.id,row.candidates[1].ruleId);assert.equal(result.rows[0].status,'ready');assert.equal(result.rows[0].ruleName,'Notas');
  assert.equal(f.store.snapshot().folders[0].organization.rules.length,2);result=await f.preview.scan();assert.equal(result.rows[0].status,'conflict');
  await f.rules.toggle(f.folderId,row.candidates[0].ruleId);await assert.rejects(f.preview.resolve(result.id,row.id,row.candidates[1].ruleId),/expirou/);
});
test('marca colisões existentes e entre arquivos, sem sobrescrever ou criar destinos', async t => {
  const f=await fixture(t,true);await f.rules.save(f.folderId,f.rule());await f.write('a/igual.pdf','a');await f.write('b/igual.pdf','b');await f.write('ocupado.pdf','novo');await f.write('Documentos/ocupado.pdf','antigo');
  const result=await f.preview.scan();assert.equal(result.rows.length,3);assert.equal(result.summary.conflict,3);assert.match(result.rows.find(r=>r.name==='ocupado.pdf').reason,/Já existe/);assert.equal(await fs.readFile(path.join(f.directory,'Documentos/ocupado.pdf'),'utf8'),'antigo');
  assert.deepEqual(await fs.readdir(path.join(f.directory,'Documentos')),['ocupado.pdf']);
});
test('exceções por nome, extensão e subpasta, temporários e recentes são respeitados', async t => {
  const f=await fixture(t,true);await f.rules.presets(f.folderId);await f.rules.policy(f.folderId,{...defaultOrganization(),exclusions:{names:['RASCUNHO'],extensions:['pdf'],subfolders:['Backup']}});
  for(const name of ['rascunho.txt','nota.pdf','download.part','antigo.txt','Backup/nao-ler.txt'])await f.write(name);await f.write('recente.txt','recente',true);
  const result=await f.preview.scan();assert.equal(result.rows.length,5);assert.equal(result.summary.ignored,4);assert.equal(result.summary.ready,1);assert.equal(result.skippedDirectories,1);
});
test('arquivos grandes, incomuns e regras de sugestão exigem revisão', async t => {
  const f=await fixture(t);await f.rules.save(f.folderId,f.rule({conditions:[{field:'nameContains',value:'.'}]}));await f.rules.policy(f.folderId,{...defaultOrganization(),reviewAboveMB:1});
  await f.write('grande.pdf',Buffer.alloc(1024*1024+1));await f.write('modelo.blend');let result=await f.preview.scan();assert.equal(result.summary.review,2);assert.match(result.rows.find(r=>r.name==='grande.pdf').reason,/acima/);
  await f.rules.policy(f.folderId,{...defaultOrganization(),reviewUnknown:false});result=await f.preview.scan();assert.equal(result.summary.ready,2);
  const rule=f.store.snapshot().folders[0].organization.rules[0];await f.rules.save(f.folderId,{...rule,action:'suggest'},rule.id);result=await f.preview.scan();assert.equal(result.summary.review,2);
});
test('não percorre junctions, nem permite que um destino relativo escape por um atalho', async t => {
  const f=await fixture(t,true);const outside=path.join(f.root,'Fora');await fs.mkdir(outside);await fs.writeFile(path.join(outside,'privado.pdf'),'fora');
  await fs.symlink(outside,path.join(f.directory,'Documentos'),'junction');
  await f.write('nota.pdf');await f.rules.save(f.folderId,f.rule());const result=await f.preview.scan();assert.equal(result.rows.length,2);assert.equal(result.summary.ignored,1);assert.match(result.rows.find(r=>r.name==='nota.pdf').reason,/atalho/);
  assert.equal(result.rows.some(r=>r.path.includes('privado')),false);
});
test('não segue links simbólicos de arquivos', async t => {
  const f = await fixture(t, true);
  const outside = path.join(f.root, 'privado.pdf');
  await fs.writeFile(outside, 'fora');
  try {
    await fs.symlink(outside, path.join(f.directory, 'atalho.pdf'));
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') {
      t.skip('A conta Windows não tem permissão de criar symlinks de arquivos; a mesma regressão é obrigatória no job Linux.');
      return;
    }
    throw error;
  }
  await f.rules.save(f.folderId, f.rule());
  const result = await f.preview.scan();
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].status, 'ignored');
  assert.equal(result.rows.some(row => row.path === outside), false);
});
test('pastas cadastradas dentro de outras usam só suas próprias regras', async t => {
  const f=await fixture(t,true);const nested=path.join(f.directory,'Sub');await fs.mkdir(nested);await f.write('Sub/arquivo.pdf');await f.write('raiz.pdf');
  await new FolderService(f.store).save({path:nested,includeSubfolders:false,name:'Sub'});await f.rules.save(f.folderId,f.rule());
  const other=f.store.snapshot().folders[1];await f.rules.presets(other.id);const result=await f.preview.scan();assert.equal(result.rows.length,2);assert.equal(result.rows.find(r=>r.name==='arquivo.pdf').folderId,other.id);
});
test('informa limites e cancelamento, e sinaliza pastas inacessíveis', async t => {
  const f=await fixture(t);await f.rules.presets(f.folderId);for(let i=0;i<8;i++)await f.write(i+'.pdf');
  const limited=await new PreviewService(f.store,()=>{},{rows:3}).scan();assert.equal(limited.rows.length,3);assert.equal(limited.limited,true);assert.match(limited.warnings[0],/parcial/);
  let service;service=new PreviewService(f.store,()=>service.cancel());const cancelled=await service.scan();assert.equal(cancelled.cancelled,true);
  await fs.rename(f.directory,f.directory+'-offline');const offline=await f.preview.scan();assert.equal(offline.rows.length,0);assert.match(offline.warnings[0],/Não foi possível ler/);
});
test('tamanhos e datas usam limites inclusivos e data local', () => {
  const date=new Date(2026,9,26,23,59,59).getTime();const file={name:'nota.pdf',type:'document',size:1048576,mtimeMs:date};
  assert.equal(matchesCondition({field:'sizeMin',value:1},file),true);assert.equal(matchesCondition({field:'sizeMax',value:1},file),true);
  assert.equal(matchesCondition({field:'modifiedBefore',value:'2026-10-26'},file),true);assert.equal(matchesCondition({field:'modifiedAfter',value:'2026-10-26'},file),true);assert.equal(matchesCondition({field:'modifiedAfter',value:'2026-10-27'},file),false);
});

test('um destino externo inexistente é só proposto e não é criado durante a análise', async t => {
  const f=await fixture(t);await f.write('nota.pdf');const target=path.join(f.root,'Outro disco','Financeiro');await f.rules.save(f.folderId,f.rule({destination:{mode:'absolute',value:target}}));
  const result=await f.preview.scan();assert.equal(result.rows[0].destination,path.join(target,'nota.pdf'));assert.equal(result.rows[0].status,'ready');await assert.rejects(fs.stat(target),{code:'ENOENT'});
});
test('não segue uma origem cujo ancestral foi substituído por atalho', async t => {
  const f=await fixture(t);await f.rules.presets(f.folderId);const outside=path.join(f.root,'Outra origem');await fs.mkdir(outside);await fs.writeFile(path.join(outside,'privado.pdf'),'não ler');
  await fs.rename(f.directory,f.directory+'-antiga');await fs.symlink(outside,f.directory,'junction');const result=await f.preview.scan();assert.equal(result.rows.length,0);assert.ok(result.warnings.length);
});
test('edição de exceções invalida a resolução e uma escolha de regra desconhecida é recusada', async t => {
  const f=await fixture(t);await f.write('nota.pdf');await f.rules.presets(f.folderId);const result=await f.preview.scan();await assert.rejects(f.preview.resolve(result.id,result.rows[0].id,'id-desconhecido'),/Escolha/);
  await f.rules.policy(f.folderId,{...defaultOrganization(),reviewAboveMB:250});await assert.rejects(f.preview.resolve(result.id,result.rows[0].id,result.rows[0].candidates[0].ruleId),/expirou/);
});

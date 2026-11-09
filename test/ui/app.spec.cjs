'use strict';
const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
let app, page, root, dataDir, downloads, drive;
async function launch() {
  app = await electron.launch({ args: [path.resolve(__dirname, '../electron-entry.cjs'), '--no-sandbox', '--disable-gpu', ...(process.env.ORGANIZA_HEADLESS ? ['--ozone-platform=headless'] : [])], env: { ...process.env, ORGANIZA_TEST_USER_DATA: dataDir, XDG_CACHE_HOME: path.join(root, 'cache') } });
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 0, y: 0, width: 1480, height: 960 }));
  page.on('pageerror', error => { throw error; });
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
}
async function addFolder(name, folderPath, picker = false) {
  await page.getByRole('button', { name: 'Adicionar pasta', exact: true }).first().click();
  if (picker) {
    await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, folderPath);
    await page.getByRole('button', { name: 'Escolher…', exact: true }).click();
    await expect(page.getByLabel('Caminho da pasta', { exact: false })).toHaveValue(folderPath);
  } else await page.getByLabel('Caminho da pasta', { exact: false }).fill(folderPath);
  await page.getByLabel('Nome no Organiza', { exact: false }).fill(name);
  await page.locator('#save-folder').click();
  await expect(page.locator('#folder-dialog')).not.toBeVisible();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
test.beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'organiza-ui-')); dataDir = path.join(root, 'settings');
  downloads = path.join(root, 'Downloads'); drive = path.join(root, 'Meu Drive');
  await fs.mkdir(downloads); await fs.mkdir(drive);
  await fs.writeFile(path.join(downloads, 'documento-original.txt'), 'preservar conteúdo');
  await launch();
});
test.afterEach(async () => { if (app) await app.close(); await fs.rm(root, { recursive: true, force: true }); });
test('cadastro nativo, duplicidade, edição, busca, preferências, reabertura e remoção', async () => {
  await expect(page.getByRole('button', { name: 'Escolher primeira pasta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ativar organização automática' })).toBeDisabled();
  await addFolder('Downloads', downloads, true);
  await addFolder('My Drive', drive);
  await expect(page.locator('#toast')).toBeHidden({ timeout: 7000 });
  await page.screenshot({ path: path.resolve('test-results/visao-geral.png') });
  await page.getByRole('button', { name: 'Adicionar pasta', exact: true }).first().click();
  await page.getByLabel('Caminho da pasta', { exact: false }).fill(downloads);
  await page.locator('#save-folder').click();
  await expect(page.getByRole('alert')).toContainText('já está cadastrada');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Opções de Downloads' }).click();
  await page.getByRole('button', { name: 'Editar pasta', exact: true }).click();
  await page.getByLabel('Nome no Organiza', { exact: false }).fill('Meu trabalho');
  await page.getByLabel('Incluir subpastas', { exact: false }).check();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('heading', { name: 'Meu trabalho', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pastas', exact: false }).filter({ has: page.locator('span') }).first().click();
  await page.getByRole('textbox', { name: 'Buscar pastas' }).fill('drive');
  await expect(page.locator('.folder-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Buscar pastas' }).fill('nenhuma');
  await expect(page.getByText('Nenhuma pasta corresponde à sua busca.')).toBeVisible();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.screenshot({ path: path.resolve('test-results/configuracoes.png') });
  await page.getByRole('switch', { name: 'Visualização compacta' }).click();
  await expect(page.getByRole('switch', { name: 'Visualização compacta' })).toHaveAttribute('aria-checked', 'true');
  await app.close(); app = null; await launch();
  await expect(page.getByRole('heading', { name: 'Meu trabalho', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveClass('compact');
  await page.getByRole('button', { name: 'Opções de Meu trabalho' }).click();
  await page.getByRole('button', { name: 'Remover do Organiza' }).click();
  await expect(page.getByRole('heading', { name: 'Remover pasta do Organiza?' })).toBeVisible();
  await page.getByRole('button', { name: 'Remover pasta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meu trabalho', exact: true })).toHaveCount(0);
  expect(await fs.readFile(path.join(downloads, 'documento-original.txt'), 'utf8')).toBe('preservar conteúdo');
});
test('identidade ShadeFlow mantém marca, navegação e formulários acessíveis com ampliação', async () => {
  test.setTimeout(60000);
  await addFolder('Trabalho com nome longo para conferir a apresentação', downloads);
  const brand = await page.locator('.titlebar-brand').boundingBox();
  expect(brand.x).toBe(18);
  await expect(page.locator('.titlebar-brand')).toHaveText('Organiza');
  await expect(page.locator('.titlebar-brand img')).toHaveAttribute('width', '22');
  await expect(page.locator('.sidebar .brand')).toHaveCount(0);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 700));
  for (const zoom of [1, 1.25, 1.5]) {
    await app.evaluate(({ BrowserWindow }, factor) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(factor), zoom);
    for (const name of ['Visão geral', 'Pastas', 'Regras', 'Histórico', 'Configurações']) {
      await page.locator('nav').getByRole('button', { name: new RegExp('^' + name) }).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      const layout = await page.evaluate(() => {
        const main = document.querySelector('main');
        return { viewport: innerWidth, document: document.documentElement.scrollWidth, main: main.clientWidth, content: main.scrollWidth };
      });
      expect(layout.document, `${name}, zoom ${zoom}`).toBeLessThanOrEqual(layout.viewport + 1);
      expect(layout.content, `${name}, zoom ${zoom}`).toBeLessThanOrEqual(layout.main + 1);
    }
    await page.locator('nav').getByRole('button', { name: 'Pastas', exact: false }).click();
    await page.getByRole('button', { name: 'Adicionar pasta', exact: true }).first().click();
    await page.locator('#save-folder').scrollIntoViewIfNeeded();
    const save = await page.locator('#save-folder').boundingBox();
    expect(save.x).toBeGreaterThanOrEqual(0);
    expect(save.x + save.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    await page.keyboard.press('Escape');
    await expect(page.locator('#folder-dialog')).not.toBeVisible();
  }
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]; window.webContents.setZoomFactor(1); window.setSize(1480, 960);
  });
  await page.locator('nav').getByRole('button', { name: 'Configurações', exact: true }).click();
  const compact = page.getByRole('switch', { name: 'Visualização compacta' });
  await compact.focus(); await page.keyboard.press('Space');
  await expect(compact).toHaveAttribute('aria-checked', 'true');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  await expect(page.getByRole('switch', { name: 'Visualização compacta' })).toBeVisible();
});

test('transições acompanham navegação e switches sem repetir em atualizações de estado', async () => {
  await addFolder('Downloads', downloads);
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))); });
  const enter = await page.evaluate(() => {
    document.querySelector('[data-page="settings"]').click();
    return document.querySelector('main').getAnimations().map(a => a.effect.getTiming().duration);
  });
  expect(enter).toEqual([200]);
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))); });
  const refresh = await page.evaluate(async () => {
    applyState(await call('getState'));
    return document.querySelector('main').getAnimations({ subtree: true }).length;
  });
  expect(refresh).toBe(0);
  await page.getByRole('switch', { name: 'Visualização compacta' }).click();
  await expect(page.getByRole('switch', { name: 'Visualização compacta' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: 'Visualização compacta' })).toHaveClass(/motion-switch-on/);
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))); });
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('redução de movimento cancela efeitos e preserva navegação e confirmação', async () => {
  await page.evaluate(() => document.querySelector('[data-page="settings"]').click());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => document.querySelector('main').getAnimations().length)).toBe(0);
  await page.locator('nav').getByRole('button', { name: 'Pastas', exact: false }).click();
  expect(await page.evaluate(() => document.querySelector('main').getAnimations().length)).toBe(0);
  await page.getByRole('button', { name: 'Adicionar pasta', exact: true }).first().click();
  await expect(page.locator('#folder-dialog')).toBeVisible();
  expect(await page.locator('#folder-dialog').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  await page.keyboard.press('Escape');
  await expect(page.locator('#folder-dialog')).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' });
  await page.locator('nav').getByRole('button', { name: 'Histórico', exact: true }).click();
  expect(await page.evaluate(() => document.querySelector('main').getAnimations().length)).toBe(0);
});

test('caminhos inválidos, cancelamento do seletor e isolamento da janela', async () => {
  await page.getByRole('button', { name: 'Escolher primeira pasta' }).click();
  await page.locator('#save-folder').click(); await expect(page.getByRole('alert')).toContainText('Escolha uma pasta');
  await page.getByLabel('Caminho da pasta', { exact: false }).fill(path.join(root, 'não-existe'));
  await page.locator('#save-folder').click(); await expect(page.getByRole('alert')).toContainText('não encontrada');
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
  await page.getByRole('button', { name: 'Escolher…', exact: true }).click();
  await expect(page.getByLabel('Caminho da pasta', { exact: false })).toHaveValue(path.join(root, 'não-existe'));
  await page.keyboard.press('Escape'); await expect(page.locator('#folder-dialog')).not.toBeVisible();
  expect(await page.evaluate(() => typeof require)).toBe('undefined');
  expect(await page.evaluate(() => typeof process)).toBe('undefined');
  const unknown = await app.evaluate(async ({ BrowserWindow }) => {
    const target = BrowserWindow.getAllWindows()[0];
    return target.webContents.getLastWebPreferences().sandbox;
  }); expect(unknown).toBe(true);
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu histórico começa aqui' })).toBeVisible();
});
test('pasta desconectada é sinalizada sem apagar o cadastro e layout funciona na janela mínima', async () => {
  await addFolder('Downloads', downloads);
  await fs.rename(downloads, downloads + '-offline'); await page.reload();
  await expect(page.getByText('Indisponível', { exact: true })).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setSize(1000, 700); });
  await expect(page.getByRole('heading', { name: 'Downloads', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

async function oldFile(directory, name, content = 'conteúdo preservado') {
  const file = path.join(directory, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); const old = new Date(Date.now()-600000); await fs.utimes(file, old, old); return file;
}
async function openRules() { await page.getByRole('button', { name: 'Regras', exact: true }).click(); }

test('categorias sugeridas, regra avançada, conflito e escolha por arquivo sem movimentação', async () => {
  await oldFile(downloads,'nota.pdf'); await oldFile(downloads,'contrato.pdf'); await oldFile(downloads,'foto.jpg'); await oldFile(downloads,'planilha.xlsx');
  await addFolder('Downloads',downloads); await openRules();
  await page.getByRole('button', { name:'Usar categorias sugeridas',exact:true }).click();
  await expect(page.locator('.rule-card')).toHaveCount(6);
  await page.getByRole('button',{name:'Editar Documentos',exact:true}).click();
  await page.locator('#rule-name').fill('Papéis'); await expect(page.getByRole('textbox',{name:'Caminho de destino'})).toHaveValue('Papéis'); await page.locator('#save-rule').click();
  await expect(page.getByRole('heading',{name:'Papéis Ativa'})).toBeVisible();
  await page.getByRole('switch',{name:'Instaladores ativa',exact:true}).click();
  await expect(page.getByRole('switch',{name:'Instaladores ativa',exact:true})).toHaveAttribute('aria-checked','false');
  await page.getByRole('button',{name:'Nova categoria',exact:true}).click();
  await page.locator('#rule-name').fill('Notas fiscais'); await page.locator('#rule-extensions').fill('pdf');
  await page.getByRole('button',{name:'Opções avançadas',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar condição',exact:true}).click();
  await page.getByRole('textbox',{name:'Valor da condição 2',exact:true}).fill('nota');
  await page.getByRole('textbox',{name:'Caminho de destino',exact:true}).fill('Fiscal/Notas');
  await page.locator('#save-rule').click(); await expect(page.locator('#rule-dialog')).not.toBeVisible();
  await expect(page.locator('.rule-card')).toHaveCount(7);
  await expect(page.locator('#toast')).toBeHidden({timeout:7000});
  await page.screenshot({path:path.resolve('test-results/regras.png')});
  await page.getByRole('button',{name:'Ver prévia',exact:true}).click();
  const nota = page.locator('.preview-data tbody tr').filter({hasText:'nota.pdf'});
  await expect(nota).toContainText('Conflito'); await expect(nota).toContainText('2 regras correspondentes');
  await page.getByRole('combobox',{name:'Escolher regra para nota.pdf',exact:true}).selectOption({label:'Notas fiscais'});
  await expect(nota).toContainText('Pronto'); await expect(nota).toContainText(path.join('Fiscal','Notas','nota.pdf'));
  await expect(page.getByRole('button',{name:'Organizar selecionados',exact:true})).toBeDisabled();
  await page.getByRole('checkbox',{name:'Selecionar nota.pdf',exact:true}).check();
  await expect(page.locator('.selection-line')).toContainText('1 selecionado(s)');
  await page.getByRole('button',{name:/^Ignorado/}).click(); await expect(page.locator('.preview-data')).toContainText('documento-original.txt');
  await page.getByRole('button',{name:/^Todos/}).click();
  await expect(page.locator('#toast')).toBeHidden({timeout:7000}); await page.locator('.preview-panel').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.resolve('test-results/previa.png')});
  expect(await fs.readFile(path.join(downloads,'nota.pdf'),'utf8')).toBe('conteúdo preservado');
  expect((await fs.readdir(downloads)).sort()).toEqual(['contrato.pdf','documento-original.txt','foto.jpg','nota.pdf','planilha.xlsx'].sort());
  await app.close(); app=null; await launch(); await openRules();
  await expect(page.locator('.rule-card')).toHaveCount(7);await expect(page.getByRole('switch',{name:'Instaladores ativa',exact:true})).toHaveAttribute('aria-checked','false');
});

test('exceções por pasta persistem, caminhos inválidos são rejeitados e destinos externos são apenas propostos', async () => {
  await oldFile(downloads,'arquivo.pdf'); const external=path.join(root,'Destino externo');await fs.mkdir(external);await oldFile(external,'arquivo.pdf','arquivo já existente');
  await addFolder('Downloads',downloads);await openRules();await page.getByRole('button',{name:'Nova categoria',exact:true}).click();
  await page.locator('#rule-name').fill('PDFs');await page.locator('#rule-extensions').fill('pdf');await page.getByRole('textbox',{name:'Caminho de destino',exact:true}).fill('../Fora');await page.locator('#save-rule').click();
  await expect(page.locator('#rule-error')).toContainText('subpasta válido');
  await page.locator('#rule-destination-mode').selectOption('absolute');
  await app.evaluate(({dialog},selected)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[selected]});},external);
  await page.getByRole('button',{name:'Escolher…',exact:true}).click();await expect(page.getByRole('textbox',{name:'Caminho de destino',exact:true})).toHaveValue(external);await page.locator('#save-rule').click();
  await page.getByRole('button',{name:'Exceções e revisão',exact:true}).click();
  await page.locator('#exclude-names').fill('rascunho\nprivado');await page.locator('#exclude-extensions').fill('bak, log');await page.locator('#exclude-subfolders').fill('Backup\nProjetos/Internos');await page.locator('#review-above').fill('0');
  await page.locator('#save-policy').click();await expect(page.locator('#policy-error')).toContainText('pelo menos 1 MB');
  await page.locator('#review-above').fill('100');await page.locator('#save-policy').click();await expect(page.locator('#policy-dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'Ver prévia',exact:true}).click();
  await expect(page.locator('.preview-data tbody tr').filter({hasText:'arquivo.pdf'})).toContainText('Já existe');
  expect(await fs.readFile(path.join(external,'arquivo.pdf'),'utf8')).toBe('arquivo já existente');
  await openRules();await page.getByRole('button',{name:'Exceções e revisão',exact:true}).click();await expect(page.locator('#review-above')).toHaveValue('100');await expect(page.locator('#exclude-subfolders')).toHaveValue('Backup\nProjetos/Internos');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Remover PDFs',exact:true}).click();await page.getByRole('button',{name:'Remover categoria',exact:true}).click();await expect(page.locator('.rule-card')).toHaveCount(0);
  expect(await fs.readFile(path.join(downloads,'arquivo.pdf'),'utf8')).toBe('conteúdo preservado');
});

test('prévia tem paginação e busca, edição invalida resultados e layout cabe na janela mínima', async () => {
  for(let i=0;i<56;i++)await oldFile(downloads,`documento-${String(i).padStart(2,'0')}.pdf`);
  await addFolder('Downloads',downloads);await openRules();await page.getByRole('button',{name:'Usar categorias sugeridas',exact:true}).click();await page.getByRole('button',{name:'Ver prévia',exact:true}).click();
  await expect(page.locator('.pagination')).toContainText('Página 1 de 2');await page.getByRole('button',{name:'Próxima',exact:true}).click();await expect(page.locator('.pagination')).toContainText('Página 2 de 2');
  await page.getByRole('textbox',{name:'Buscar na prévia',exact:true}).fill('documento-55');await expect(page.locator('.preview-data tbody tr')).toHaveCount(1);
  await openRules();await page.getByRole('switch',{name:'Documentos ativa',exact:true}).click();await page.getByRole('button',{name:'Visão geral',exact:true}).click();await expect(page.locator('.preview-data')).toHaveCount(0);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1000,700));await openRules();await page.getByRole('button',{name:'Nova categoria',exact:true}).click();await page.getByRole('button',{name:'Opções avançadas',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(page.locator('#save-rule')).toBeVisible();
});

async function configureAndPreview(){await openRules();await page.getByRole('button',{name:'Usar categorias sugeridas',exact:true}).click();await page.getByRole('button',{name:'Ver prévia',exact:true}).click();await expect(page.locator('.preview-data')).toBeVisible();}
async function organizeFile(name){await page.getByRole('checkbox',{name:'Selecionar '+name,exact:true}).check();await page.getByRole('button',{name:'Organizar selecionados',exact:true}).click();await expect(page.locator('#move-dialog')).toBeVisible();await page.getByRole('button',{name:'Confirmar e organizar',exact:true}).click();await expect(page.getByRole('heading',{name:'Histórico',exact:true})).toBeVisible();await expect(page.locator('.history-card')).toHaveCount(1);}

test('organização confirmada preserva nomes existentes, persiste histórico e permite desfazer após reabrir',async()=>{
  await oldFile(downloads,'nota.pdf','MEU ARQUIVO');await oldFile(downloads,'Documentos/nota.pdf','ARQUIVO EXISTENTE');await addFolder('Downloads',downloads);await configureAndPreview();
  await page.getByRole('checkbox',{name:'Selecionar nota.pdf',exact:true}).check();await page.getByRole('button',{name:'Organizar selecionados',exact:true}).click();await expect(page.locator('#move-targets')).toContainText('nota (2).pdf');await expect(page.locator('#move-targets')).toContainText('Nome ajustado');
  await page.screenshot({path:path.resolve('test-results/confirmacao.png')});await page.getByRole('button',{name:'Confirmar e organizar',exact:true}).click();await expect(page.getByRole('heading',{name:'Histórico',exact:true})).toBeVisible();await expect(page.locator('.history-card')).toHaveCount(1);await expect(page.locator('.history-card')).toContainText('Organizado');
  expect(await fs.readFile(path.join(downloads,'Documentos/nota.pdf'),'utf8')).toBe('ARQUIVO EXISTENTE');expect(await fs.readFile(path.join(downloads,'Documentos/nota (2).pdf'),'utf8')).toBe('MEU ARQUIVO');await expect.poll(async()=>{try{await fs.stat(path.join(downloads,'nota.pdf'));return true;}catch{return false;}}).toBe(false);
  await expect(page.locator('#toast')).toBeHidden({timeout:7000});await page.screenshot({path:path.resolve('test-results/historico.png')});
  await app.close();app=null;await launch();await page.getByRole('button',{name:'Histórico',exact:true}).click();await expect(page.locator('.history-card')).toHaveCount(1);await page.getByRole('button',{name:'Desfazer',exact:true}).click();await page.locator('#undo-dialog').getByRole('button',{name:'Desfazer',exact:true}).click();await expect(page.locator('#undo-dialog')).not.toBeVisible();await expect(page.locator('.history-card')).toContainText('Desfeito');expect(await fs.readFile(path.join(downloads,'nota.pdf'),'utf8')).toBe('MEU ARQUIVO');expect(await fs.readFile(path.join(downloads,'Documentos/nota.pdf'),'utf8')).toBe('ARQUIVO EXISTENTE');
});
test('itens para revisão só são movidos depois de aprovação explícita na confirmação',async()=>{
  await oldFile(downloads,'nota.pdf');await addFolder('Downloads',downloads);await openRules();await page.getByRole('button',{name:'Nova categoria',exact:true}).click();await page.locator('#rule-name').fill('Revisar PDFs');await page.locator('#rule-extensions').fill('pdf');await page.getByRole('button',{name:'Opções avançadas',exact:true}).click();await page.locator('#rule-action').selectOption('suggest');await page.locator('#save-rule').click();await page.getByRole('button',{name:'Ver prévia',exact:true}).click();await expect(page.locator('.preview-data')).toContainText('Revisar');await page.getByRole('checkbox',{name:'Selecionar nota.pdf',exact:true}).check();await page.getByRole('button',{name:'Organizar selecionados',exact:true}).click();await page.getByRole('button',{name:'Confirmar e organizar',exact:true}).click();await expect(page.locator('#move-error')).toContainText('Confirme');expect(await fs.readFile(path.join(downloads,'nota.pdf'),'utf8')).toBe('conteúdo preservado');await page.locator('#approve-review').check();await page.getByRole('button',{name:'Confirmar e organizar',exact:true}).click();await expect(page.getByRole('heading',{name:'Histórico',exact:true})).toBeVisible();expect(await fs.readFile(path.join(downloads,'Revisar PDFs/nota.pdf'),'utf8')).toBe('conteúdo preservado');
});
test('monitoramento exige prévia, organiza automaticamente, pausa por pasta e reabre pausado',async()=>{
  await oldFile(downloads,'nota.pdf','AUTOMÁTICO');await addFolder('Downloads',downloads);await openRules();await page.getByRole('button',{name:'Usar categorias sugeridas',exact:true}).click();await page.getByRole('button',{name:'Visão geral',exact:true}).click();await page.getByRole('button',{name:'Ativar organização automática',exact:true}).click();await page.locator('input[name="monitor-folder"]').check();await page.getByRole('button',{name:'Ativar pastas selecionadas',exact:true}).click();await expect(page.locator('#monitor-error')).toContainText('revise a prévia');await page.locator('#monitor-dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Analisar arquivos',exact:true}).click();await expect(page.locator('.preview-data')).toBeVisible();await page.getByRole('button',{name:'Ativar organização automática',exact:true}).click();await page.locator('input[name="monitor-folder"]').check();await page.getByRole('button',{name:'Ativar pastas selecionadas',exact:true}).click();await expect(page.locator('#monitor-dialog')).not.toBeVisible();await expect(page.locator('.status-pill')).toContainText('1 pasta(s) em monitoramento');
  await expect.poll(async()=>{try{return await fs.readFile(path.join(downloads,'Documentos/nota.pdf'),'utf8');}catch{return '';}}).toBe('AUTOMÁTICO');await page.getByRole('button',{name:'Opções de Downloads',exact:true}).click();await page.getByRole('button',{name:'Pausar automação',exact:true}).click();await expect(page.locator('.status-pill')).toContainText('Monitoramento pausado');await oldFile(downloads,'novo.pdf','PAUSADO');await new Promise(resolve=>setTimeout(resolve,650));expect(await fs.readFile(path.join(downloads,'novo.pdf'),'utf8')).toBe('PAUSADO');await app.close();app=null;await launch();await expect(page.locator('.status-pill')).toContainText('Monitoramento pausado');
});
test('desfazer pela interface recusa substituir o arquivo que chegou ao local original',async()=>{
  await oldFile(downloads,'nota.pdf','ORIGINAL');await addFolder('Downloads',downloads);await configureAndPreview();await organizeFile('nota.pdf');await fs.writeFile(path.join(downloads,'nota.pdf'),'OUTRO');await page.getByRole('button',{name:'Desfazer',exact:true}).click();await page.locator('#undo-dialog').getByRole('button',{name:'Desfazer',exact:true}).click();await expect(page.locator('#undo-error')).toContainText('ocupado');expect(await fs.readFile(path.join(downloads,'nota.pdf'),'utf8')).toBe('OUTRO');expect(await fs.readFile(path.join(downloads,'Documentos/nota.pdf'),'utf8')).toBe('ORIGINAL');
});

async function previewWithoutRules(expectSuggestions=true){await page.getByRole('button',{name:'Visão geral',exact:true}).click();await page.getByRole('button',{name:/^(Analisar arquivos|Atualizar prévia)$/}).click();if(expectSuggestions)await expect(page.locator('.review-center')).toBeVisible();else await expect(page.locator('.preview-data')).toBeVisible();}
const psdGroup=()=>page.locator('.review-group').filter({has:page.locator('.review-format',{hasText:/^PSD$/})});

test('sugere Design, prepara somente a seleção e organiza sem ativar regra futura',async()=>{
  await oldFile(downloads,'arte.psd','ARTE');await oldFile(downloads,'outra.psd','OUTRA');await oldFile(downloads,'arquivo.qzxyz','DESCONHECIDO');await addFolder('Downloads',downloads);await previewWithoutRules();
  await expect(psdGroup()).toContainText('Design');await expect(page.locator('.review-group').filter({hasText:'QZXYZ'})).toContainText('sem classificação conhecida');await expect(page.locator('#toast')).toBeHidden({timeout:7000});await page.locator('.review-center').scrollIntoViewIfNeeded();await page.screenshot({path:path.resolve('test-results/sugestoes.png')});
  await psdGroup().getByRole('button',{name:'Criar categoria',exact:true}).click();await expect(page.locator('#review-category-name')).toHaveValue('Design');await expect(page.locator('#review-future')).not.toBeChecked();await page.locator('#review-file-choices .review-file-option').filter({hasText:'outra.psd'}).getByRole('checkbox').uncheck();await page.getByRole('button',{name:'Preparar na prévia',exact:true}).click();await expect(page.locator('#review-dialog')).not.toBeVisible();
  const row=page.locator('.preview-data tbody tr').filter({hasText:'arte.psd'});await expect(row).toContainText('Design');await expect(row).toContainText('Revisar');expect(await fs.readFile(path.join(downloads,'arte.psd'),'utf8')).toBe('ARTE');
  await page.getByRole('checkbox',{name:'Selecionar arte.psd',exact:true}).check();await page.getByRole('button',{name:'Organizar selecionados',exact:true}).click();await page.locator('#approve-review').check();await page.getByRole('button',{name:'Confirmar e organizar',exact:true}).click();await expect(page.getByRole('heading',{name:'Histórico',exact:true})).toBeVisible();expect(await fs.readFile(path.join(downloads,'Design/arte.psd'),'utf8')).toBe('ARTE');expect(await fs.readFile(path.join(downloads,'outra.psd'),'utf8')).toBe('OUTRA');await openRules();await expect(page.getByRole('switch',{name:'Design ativa',exact:true})).toHaveAttribute('aria-checked','false');
});
test('categoria existente pode receber nova regra sem substituir a regra anterior',async()=>{
  await oldFile(downloads,'arte.psd');await addFolder('Downloads',downloads);await openRules();await page.getByRole('button',{name:'Nova categoria',exact:true}).click();await page.locator('#rule-name').fill('Design');await page.locator('#rule-extensions').fill('ai');await page.locator('#save-rule').click();await previewWithoutRules();await psdGroup().getByRole('button',{name:'Usar categoria',exact:true}).click();await expect(page.locator('#review-mode')).toHaveValue('existing');await expect(page.locator('#review-destination')).toHaveValue('Design');await page.locator('#review-future').check();await page.getByRole('button',{name:'Preparar na prévia',exact:true}).click();await expect(page.locator('#review-dialog')).not.toBeVisible();await openRules();await expect(page.locator('.rule-card')).toHaveCount(2);await expect(page.locator('.rule-card').filter({hasText:'Extensão é .ai'})).toHaveCount(1);await expect(page.locator('.rule-card').filter({hasText:'Extensão é .psd'})).toHaveCount(1);
  await oldFile(downloads,'nova.psd');await previewWithoutRules(false);await expect(page.locator('.preview-data tbody tr').filter({hasText:'nova.psd'})).toContainText('Design');await expect(psdGroup()).toHaveCount(0);
});
test('adiar pode ser retomado e manter um único arquivo cria exceção exata persistida',async()=>{
  await oldFile(downloads,'arte.psd');await oldFile(downloads,'minha-arte.psd');await addFolder('Downloads',downloads);await previewWithoutRules();await psdGroup().getByRole('button',{name:'Manter onde está',exact:true}).click();await page.getByRole('button',{name:'Deixar para depois nesta sessão',exact:true}).click();await expect(page.getByRole('button',{name:'Retomar adiados',exact:true})).toBeVisible();expect(await fs.readFile(path.join(downloads,'arte.psd'),'utf8')).toBe('conteúdo preservado');await page.getByRole('button',{name:'Retomar adiados',exact:true}).click();await expect(psdGroup()).toBeVisible();
  await page.locator('.preview-data tbody tr').filter({has:page.locator('strong',{hasText:/^arte\.psd$/})}).getByRole('button',{name:'Ver sugestões',exact:true}).click();await page.getByRole('button',{name:'Manter seleção onde está',exact:true}).click();await page.getByRole('button',{name:'Não sugerir novamente estes caminhos',exact:true}).click();await expect(psdGroup()).toContainText('minha-arte.psd');await openRules();await page.getByRole('button',{name:'Exceções e revisão',exact:true}).click();await expect(page.locator('#exclude-files')).toHaveValue('arte.psd');await page.keyboard.press('Escape');await app.close();app=null;await launch();await previewWithoutRules();await expect(psdGroup()).toContainText('1 arquivo(s)');await expect(psdGroup()).toContainText('minha-arte.psd');
});
test('Lixeira confirma seleção, permite cancelar e registra somente o arquivo escolhido',async()=>{
  await oldFile(downloads,'a.qzxyz','A');await oldFile(downloads,'b.qzxyz','B');await addFolder('Downloads',downloads);await previewWithoutRules();const group=page.locator('.review-group').filter({has:page.locator('.review-format',{hasText:/^QZXYZ$/})});await group.getByRole('button',{name:'Enviar .qzxyz à Lixeira',exact:true}).click();await page.locator('#review-trash-dialog').getByRole('button',{name:'Cancelar',exact:true}).click();expect(await fs.readFile(path.join(downloads,'a.qzxyz'),'utf8')).toBe('A');await group.getByRole('button',{name:'Enviar .qzxyz à Lixeira',exact:true}).click();await page.locator('#trash-file-choices .review-file-option').filter({hasText:'b.qzxyz'}).getByRole('checkbox').uncheck();await page.screenshot({path:path.resolve('test-results/lixeira-confirmacao.png')});await page.getByRole('button',{name:'Confirmar envio para a Lixeira',exact:true}).click();await expect(page.getByRole('heading',{name:'Histórico',exact:true})).toBeVisible();await expect(page.locator('.history-card')).toContainText('Na Lixeira');await expect(page.locator('.history-card')).toContainText('Lixeira do Windows');await expect(page.getByRole('button',{name:'Desfazer',exact:true})).toHaveCount(0);expect(await fs.readFile(path.join(downloads,'b.qzxyz'),'utf8')).toBe('B');const recycled=await fs.readdir(path.join(dataDir,'lixeira-de-teste'));expect(recycled.length).toBe(1);expect(await fs.readFile(path.join(dataDir,'lixeira-de-teste',recycled[0]),'utf8')).toBe('A');await expect(page.locator('#toast')).toBeHidden({timeout:7000});await page.screenshot({path:path.resolve('test-results/lixeira-historico.png')});
});
test('formatos sem extensão recebem regra própria e podem ser editados',async()=>{
  await oldFile(downloads,'LEIAME');await addFolder('Downloads',downloads);await previewWithoutRules();const group=page.locator('.review-group').filter({hasText:'arquivo(s) sem extensão'});await group.getByRole('button',{name:'Criar categoria',exact:true}).click();await page.locator('#review-future').check();await page.getByRole('button',{name:'Preparar na prévia',exact:true}).click();await openRules();await expect(page.locator('.rule-card')).toContainText('Arquivo sem extensão');await page.getByRole('button',{name:'Editar Sem extensão',exact:true}).click();await expect(page.locator('.condition-fixed')).toContainText('Arquivo sem extensão');await page.locator('#save-rule').click();await expect(page.locator('#rule-dialog')).not.toBeVisible();
});

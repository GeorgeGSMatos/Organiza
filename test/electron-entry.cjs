const { app } = require('electron');
if (!process.env.ORGANIZA_TEST_USER_DATA) throw new Error('Use um diretório isolado para os testes.');
app.setPath('userData', process.env.ORGANIZA_TEST_USER_DATA);
global[Symbol.for('organiza.test.transfer')] = () => new (require('./transfer-test-adapter.cjs').TestTransfer)();
global[Symbol.for('organiza.test.trash')] = () => async file => { const fs = require('node:fs/promises'), path = require('node:path'); const directory = path.join(process.env.ORGANIZA_TEST_USER_DATA, 'lixeira-de-teste'); await fs.mkdir(directory, {recursive:true}); await fs.rename(file, path.join(directory, require('node:crypto').randomUUID() + '-' + path.basename(file))); };
require('../src/main/main.cjs');

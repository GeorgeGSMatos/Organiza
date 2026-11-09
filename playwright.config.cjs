const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './test/ui', timeout: 30000, fullyParallel: false, workers: 1, reporter: 'list', use: { viewport: { width: 1480, height: 960 }, headless: true } });

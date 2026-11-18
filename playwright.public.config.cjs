const {defineConfig} = require('@playwright/test');
const base = require('./playwright.config.cjs');
const {labsSpecs} = require('./playwright.suites.cjs');

module.exports = defineConfig(base, {testIgnore: labsSpecs});

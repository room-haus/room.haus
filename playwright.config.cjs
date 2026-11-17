const {defineConfig, devices} = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'e2e',
  timeout: 70000,
  expect: {timeout: 18000},
  workers: 2,
  reporter: 'list',
  use: {reducedMotion: 'reduce'},
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'android', use: {...devices['Pixel 7'], browserName: 'chromium'}},
    {name: 'mobile-webkit', use: {...devices['iPhone 13'], browserName: 'webkit'}},
  ],
  webServer: {command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:4173/', reuseExistingServer: !process.env.CI},
});

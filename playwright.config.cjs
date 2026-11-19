const {defineConfig, devices} = require('@playwright/test');

const baseURL = process.env.ROOM_TEST_ORIGIN || 'http://127.0.0.1:4173';

module.exports = defineConfig({
  testDir: 'e2e',
  timeout: 70000,
  expect: {timeout: 18000},
  // Hosted browsers share the runner's software GPU and audio device.
  workers: process.env.CI ? 1 : 2,
  reporter: 'list',
  use: {baseURL, reducedMotion: 'reduce'},
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'android', use: {...devices['Pixel 7'], browserName: 'chromium'}},
    {name: 'mobile-webkit', use: {...devices['iPhone 13'], browserName: 'webkit'}},
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: baseURL + '/',
    env: {PORT: new URL(baseURL).port || '4173', ROOM_TAKE_FIXTURE: process.env.ROOM_TAKE_SOURCE_DIR ? '0' : '1'},
    reuseExistingServer: !process.env.CI,
  },
});

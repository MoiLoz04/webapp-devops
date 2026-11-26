
require('dotenv').config();

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',

  fullyParallel: false,
  workers: 1,
  retries: 0,

  timeout: 60000,

  expect: {
    timeout: 15000
  },

  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never'
    }],
    ['json', {
      outputFile: 'test-results/resultados.json'
    }]
  ],

  outputDir: 'test-results/evidencias',

  use: {
    baseURL: 'http://localhost:8080',
    headless: true,

    screenshot: 'on',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 15000,
    navigationTimeout: 30000
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],

  webServer: {
    command: 'npm start',
    url: 'http://localhost:8080/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  }
});

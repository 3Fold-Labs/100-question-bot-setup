import {defineConfig, devices} from '@playwright/test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const PORT = Number(process.env.E2E_PORT || 4178);
// PW_CHROMIUM_PATH points at a Chromium executable already on this machine. CI uses the browser Playwright installs.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  testMatch: /\.spec\.mjs$/,
  outputDir: join(tmpdir(), 'ai-agent-rules-e2e'),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    acceptDownloads: true,
    launchOptions: {executablePath}
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome'], launchOptions: {executablePath}}}],
  webServer: {
    command: `node e2e/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI
  }
});

import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: /native-hosts\.spec\.mjs$/,
  timeout: 30000,
})

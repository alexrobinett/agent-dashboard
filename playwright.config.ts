import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for agent-dashboard E2E tests
 * Sprint 3.1: Multi-viewport testing setup
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e/tests',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  
  /* 30 second timeout per test */
  timeout: 30 * 1000,
  
  /* Reporter to use */
  reporter: [
    ['html'],
    ['github'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers and viewports */
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    
    {
      name: 'tablet-webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 768, height: 1024 },
      },
    },
    
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // Use dev server in all environments to avoid Nitro preview build artifact requirements.
    command: 'pnpm dev --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      VITE_CONVEX_URL: process.env.VITE_CONVEX_URL || 'https://tacit-bulldog-295.convex.cloud',
    },
  },
})

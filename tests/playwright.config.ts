import { defineConfig, devices } from "@playwright/test";

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: "./e2e",

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ["html", { outputFolder: "../playwright-report" }],
    ["json", { outputFile: "../test-results.json" }],
    ["list"],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: "http://localhost:4321",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Record video on failure
    video: "retain-on-failure",

    // Take screenshot on failure
    screenshot: "only-on-failure",

    // Global test timeout
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // Uncomment to add more browsers when needed
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Mobile testing (uncomment when needed)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Global setup and teardown
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",

  // Run your local dev server before starting the tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Test match patterns
  testMatch: [
    "**/tests/e2e/**/*.{test,spec}.{js,ts}",
    "**/*.e2e.{test,spec}.{js,ts}",
  ],

  // Test ignore patterns
  testIgnore: [
    "**/node_modules/**",
    "**/tests/unit/**",
    "**/*.unit.{test,spec}.{js,ts}",
  ],

  // Output directory
  outputDir: "test-results/",

  // Timeout settings
  timeout: 30000,
  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 5000,

    // Threshold for screenshot comparisons
    threshold: 0.2,
  },
});

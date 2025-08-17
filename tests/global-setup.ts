/**
 * Playwright global setup
 * This file runs once before all E2E tests
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🎭 Starting Playwright global setup...');
  
  // Optional: Authenticate and save state
  // This is useful for tests that require login
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the app
    await page.goto(config.projects[0].use.baseURL || 'http://localhost:4321');
    
    // Wait for the app to be ready
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Application is ready for testing');
    
    // Optional: Perform authentication setup here
    // Example:
    // await page.goto('/login');
    // await page.fill('[data-testid="email"]', 'test@example.com');
    // await page.fill('[data-testid="password"]', 'password');
    // await page.click('[data-testid="login-button"]');
    // await page.waitForURL('/dashboard');
    // await context.storageState({ path: 'tests/auth.json' });
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('🎭 Playwright global setup completed');
}

export default globalSetup;

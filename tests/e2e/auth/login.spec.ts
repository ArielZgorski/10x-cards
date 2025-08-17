/**
 * E2E tests for login functionality
 */

import { test, expect } from '@playwright/test';
import { PageObjectFactory } from '../../utils/page-objects';

test.describe('Login Flow', () => {
  let pageFactory: PageObjectFactory;

  test.beforeEach(async ({ page }) => {
    pageFactory = new PageObjectFactory(page);
  });

  test('should display login form', async ({ page }) => {
    const loginPage = pageFactory.loginPage();
    
    await loginPage.navigate();
    await loginPage.assertLoginFormVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    const loginPage = pageFactory.loginPage();
    
    await loginPage.navigate();
    await loginPage.clickLogin();
    
    // Should show validation errors
    await loginPage.assertFieldError('email', 'Email is required');
    await loginPage.assertFieldError('password', 'Password is required');
  });

  test('should show error for invalid email format', async ({ page }) => {
    const loginPage = pageFactory.loginPage();
    
    await loginPage.navigate();
    await loginPage.fillEmail('invalid-email');
    await loginPage.fillPassword('password123');
    await loginPage.clickLogin();
    
    await loginPage.assertFieldError('email', 'Invalid email format');
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const loginPage = pageFactory.loginPage();
    const dashboardPage = pageFactory.dashboardPage();
    
    await loginPage.navigate();
    await loginPage.login('demo@10xcards.com', 'demo123');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/ai/generations');
    await dashboardPage.assertUserLoggedIn();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = pageFactory.loginPage();
    
    await loginPage.navigate();
    await loginPage.login('wrong@email.com', 'wrongpassword');
    
    await loginPage.assertErrorMessage('Invalid credentials');
  });
});

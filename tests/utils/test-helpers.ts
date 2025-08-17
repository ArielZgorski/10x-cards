/**
 * Test utilities and helpers for Playwright E2E tests
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * Common test utilities
 */
export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  /**
   * Wait for and click an element
   */
  async clickElement(selector: string) {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    await element.click();
  }

  /**
   * Fill form field with validation
   */
  async fillField(selector: string, value: string) {
    const field = this.page.locator(selector);
    await field.waitFor({ state: 'visible' });
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }

  /**
   * Assert element contains text
   */
  async assertElementContainsText(selector: string, text: string) {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    await expect(element).toContainText(text);
  }

  /**
   * Wait for API response
   */
  async waitForAPIResponse(urlPattern: string | RegExp) {
    return await this.page.waitForResponse(urlPattern);
  }

  /**
   * Mock API response
   */
  async mockAPIResponse(urlPattern: string | RegExp, response: any) {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Assert URL contains path
   */
  async assertURLContains(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector: string, timeout = 5000) {
    await this.page.locator(selector).waitFor({ 
      state: 'visible', 
      timeout 
    });
  }

  /**
   * Scroll element into view
   */
  async scrollToElement(selector: string) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Check if element is visible
   */
  async isElementVisible(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ 
        state: 'visible', 
        timeout: 1000 
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Authentication helpers
 */
export class AuthHelpers {
  constructor(private page: Page) {}

  /**
   * Login with credentials
   */
  async login(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Logout user
   */
  async logout() {
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('/login');
  }

  /**
   * Assert user is logged in
   */
  async assertLoggedIn() {
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  /**
   * Assert user is logged out
   */
  async assertLoggedOut() {
    await expect(this.page.locator('[data-testid="login-form"]')).toBeVisible();
  }
}

/**
 * Data test ID helpers
 */
export const testIds = {
  // Auth
  loginForm: '[data-testid="login-form"]',
  emailField: '[data-testid="email"]',
  passwordField: '[data-testid="password"]',
  loginButton: '[data-testid="login-button"]',
  logoutButton: '[data-testid="logout-button"]',
  userMenu: '[data-testid="user-menu"]',
  
  // AI Generation
  generationForm: '[data-testid="generation-form"]',
  sourceTextArea: '[data-testid="source-text"]',
  generateButton: '[data-testid="generate-button"]',
  statusBanner: '[data-testid="status-banner"]',
  suggestionsList: '[data-testid="suggestions-list"]',
  
  // Navigation
  breadcrumbs: '[data-testid="breadcrumbs"]',
  navMenu: '[data-testid="nav-menu"]',
  
  // Common
  loadingSpinner: '[data-testid="loading-spinner"]',
  errorMessage: '[data-testid="error-message"]',
  successMessage: '[data-testid="success-message"]',
} as const;

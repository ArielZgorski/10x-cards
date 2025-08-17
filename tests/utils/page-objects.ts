/**
 * Page Object Models for Playwright E2E tests
 * Following the Page Object Model pattern for maintainable tests
 */

import { Page, Locator, expect } from '@playwright/test';
import { TestHelpers, testIds } from './test-helpers';

/**
 * Base Page Object
 */
export abstract class BasePage {
  protected helpers: TestHelpers;

  constructor(protected page: Page) {
    this.helpers = new TestHelpers(page);
  }

  async goto(url: string) {
    await this.page.goto(url);
    await this.helpers.waitForPageLoad();
  }

  async takeScreenshot(name: string) {
    await this.helpers.screenshot(name);
  }
}

/**
 * Login Page Object
 */
export class LoginPage extends BasePage {
  // Locators
  get form(): Locator {
    return this.page.locator(testIds.loginForm);
  }

  get emailField(): Locator {
    return this.page.locator(testIds.emailField);
  }

  get passwordField(): Locator {
    return this.page.locator(testIds.passwordField);
  }

  get loginButton(): Locator {
    return this.page.locator(testIds.loginButton);
  }

  get errorMessage(): Locator {
    return this.page.locator(testIds.errorMessage);
  }

  // Actions
  async navigate() {
    await this.goto('/login');
  }

  async fillEmail(email: string) {
    await this.emailField.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordField.fill(password);
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  // Assertions
  async assertLoginFormVisible() {
    await expect(this.form).toBeVisible();
  }

  async assertErrorMessage(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }

  async assertFieldError(field: 'email' | 'password', message: string) {
    const fieldLocator = field === 'email' ? this.emailField : this.passwordField;
    const errorLocator = fieldLocator.locator('~ .error-message');
    await expect(errorLocator).toContainText(message);
  }
}

/**
 * AI Generation Page Object
 */
export class GenerationPage extends BasePage {
  // Locators
  get breadcrumbs(): Locator {
    return this.page.locator(testIds.breadcrumbs);
  }

  get statusBanner(): Locator {
    return this.page.locator(testIds.statusBanner);
  }

  get metaPanel(): Locator {
    return this.page.locator('[data-testid="meta-panel"]');
  }

  get toolbar(): Locator {
    return this.page.locator('[data-testid="suggestions-toolbar"]');
  }

  get statusFilter(): Locator {
    return this.page.locator('[data-testid="status-filter"]');
  }

  get selectedCountBadge(): Locator {
    return this.page.locator('[data-testid="selected-count"]');
  }

  get acceptSelectedButton(): Locator {
    return this.page.locator('[data-testid="accept-selected"]');
  }

  get rejectSelectedButton(): Locator {
    return this.page.locator('[data-testid="reject-selected"]');
  }

  get suggestionsList(): Locator {
    return this.page.locator(testIds.suggestionsList);
  }

  get suggestions(): Locator {
    return this.page.locator('[data-testid="suggestion-item"]');
  }

  // Actions
  async navigate(generationId: string) {
    await this.goto(`/ai/generations/${generationId}`);
  }

  async selectStatusFilter(status: string) {
    await this.statusFilter.click();
    await this.page.locator(`[data-value="${status}"]`).click();
  }

  async selectSuggestion(index: number) {
    const suggestion = this.suggestions.nth(index);
    const checkbox = suggestion.locator('[data-testid="suggestion-checkbox"]');
    await checkbox.check();
  }

  async selectAllVisibleSuggestions() {
    const checkboxes = this.page.locator('[data-testid="suggestion-checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
  }

  async clickAcceptSelected() {
    await this.acceptSelectedButton.click();
  }

  async clickRejectSelected() {
    await this.rejectSelectedButton.click();
  }

  async acceptSuggestion(index: number) {
    const suggestion = this.suggestions.nth(index);
    const acceptButton = suggestion.locator('[data-testid="accept-button"]');
    await acceptButton.click();
  }

  async editSuggestion(index: number) {
    const suggestion = this.suggestions.nth(index);
    const editButton = suggestion.locator('[data-testid="edit-button"]');
    await editButton.click();
  }

  // Assertions
  async assertBreadcrumbsContain(text: string) {
    await expect(this.breadcrumbs).toContainText(text);
  }

  async assertStatus(status: string) {
    await expect(this.statusBanner).toContainText(status);
  }

  async assertSuggestionCount(count: number) {
    await expect(this.suggestions).toHaveCount(count);
  }

  async assertSelectedCount(count: number) {
    await expect(this.selectedCountBadge).toContainText(count.toString());
  }

  async assertSuggestionStatus(index: number, status: string) {
    const suggestion = this.suggestions.nth(index);
    const statusBadge = suggestion.locator('[data-testid="status-badge"]');
    await expect(statusBadge).toContainText(status);
  }

  async assertButtonsEnabled(enabled: boolean) {
    if (enabled) {
      await expect(this.acceptSelectedButton).toBeEnabled();
      await expect(this.rejectSelectedButton).toBeEnabled();
    } else {
      await expect(this.acceptSelectedButton).toBeDisabled();
      await expect(this.rejectSelectedButton).toBeDisabled();
    }
  }
}

/**
 * Dashboard/Home Page Object
 */
export class DashboardPage extends BasePage {
  // Locators
  get navMenu(): Locator {
    return this.page.locator(testIds.navMenu);
  }

  get userMenu(): Locator {
    return this.page.locator(testIds.userMenu);
  }

  get generationsLink(): Locator {
    return this.page.locator('[data-testid="generations-link"]');
  }

  get decksLink(): Locator {
    return this.page.locator('[data-testid="decks-link"]');
  }

  get studyLink(): Locator {
    return this.page.locator('[data-testid="study-link"]');
  }

  // Actions
  async navigate() {
    await this.goto('/');
  }

  async navigateToGenerations() {
    await this.generationsLink.click();
  }

  async navigateToDecks() {
    await this.decksLink.click();
  }

  async navigateToStudy() {
    await this.studyLink.click();
  }

  async openUserMenu() {
    await this.userMenu.click();
  }

  // Assertions
  async assertUserLoggedIn() {
    await expect(this.userMenu).toBeVisible();
  }

  async assertNavigationVisible() {
    await expect(this.navMenu).toBeVisible();
  }
}

/**
 * Page Object Factory
 */
export class PageObjectFactory {
  constructor(private page: Page) {}

  loginPage(): LoginPage {
    return new LoginPage(this.page);
  }

  generationPage(): GenerationPage {
    return new GenerationPage(this.page);
  }

  dashboardPage(): DashboardPage {
    return new DashboardPage(this.page);
  }
}

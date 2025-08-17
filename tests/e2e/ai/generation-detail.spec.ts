/**
 * E2E tests for AI generation detail page
 */

import { test, expect } from '@playwright/test';
import { PageObjectFactory } from '../../utils/page-objects';
import { testIds } from '../../utils/test-helpers';

test.describe('Generation Detail Page', () => {
  let pageFactory: PageObjectFactory;

  test.beforeEach(async ({ page }) => {
    pageFactory = new PageObjectFactory(page);
    
    // Login before each test
    const loginPage = pageFactory.loginPage();
    await loginPage.navigate();
    await loginPage.login('demo@10xcards.com', 'demo123');
  });

  test('should display generation details correctly', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    await generationPage.navigate('test-generation-1');
    
    // Check basic page elements
    await generationPage.assertBreadcrumbsContain('Generacja #test-gen');
    await generationPage.assertStatus('succeeded');
    await expect(generationPage.metaPanel).toBeVisible();
    await expect(generationPage.suggestionsList).toBeVisible();
  });

  test('should filter suggestions by status', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    await generationPage.navigate('test-generation-1');
    
    // Test filtering by "Zaakceptowane"
    await generationPage.selectStatusFilter('accepted');
    await generationPage.assertSuggestionCount(1);
    
    // Test filtering by "Zaproponowane"
    await generationPage.selectStatusFilter('suggested');
    await generationPage.assertSuggestionCount(3);
    
    // Test showing all
    await generationPage.selectStatusFilter('all');
    await generationPage.assertSuggestionCount(6);
  });

  test('should handle suggestion selection', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    await generationPage.navigate('test-generation-1');
    
    // Initially no suggestions selected
    await generationPage.assertSelectedCount(0);
    await generationPage.assertButtonsEnabled(false);
    
    // Select one suggestion
    await generationPage.selectSuggestion(0);
    await generationPage.assertSelectedCount(1);
    await generationPage.assertButtonsEnabled(true);
    
    // Select another suggestion
    await generationPage.selectSuggestion(1);
    await generationPage.assertSelectedCount(2);
  });

  test('should handle bulk actions', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    await generationPage.navigate('test-generation-1');
    
    // Filter to show only suggested items
    await generationPage.selectStatusFilter('suggested');
    
    // Select all visible suggestions
    await generationPage.selectAllVisibleSuggestions();
    await generationPage.assertSelectedCount(3);
    
    // Test accept selected (should log to console)
    await generationPage.clickAcceptSelected();
    
    // Test reject selected (should log to console)
    await generationPage.clickRejectSelected();
  });

  test('should handle individual suggestion actions', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    await generationPage.navigate('test-generation-1');
    
    // Test accepting individual suggestion
    await generationPage.acceptSuggestion(0);
    
    // Test editing suggestion
    await generationPage.editSuggestion(1);
  });

  test('should display correct status badges', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    await generationPage.navigate('test-generation-1');
    
    // Check that different suggestions have different status badges
    await generationPage.assertSuggestionStatus(0, 'Zaproponowane');
    await generationPage.assertSuggestionStatus(4, 'Zaakceptowane');
    await generationPage.assertSuggestionStatus(5, 'Odrzucone');
  });

  test('should show loading state for running generation', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    await generationPage.navigate('test-generation-running');
    
    await generationPage.assertStatus('running');
    await expect(page.locator(testIds.loadingSpinner)).toBeVisible();
  });

  test('should show error state for failed generation', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    await generationPage.navigate('test-generation-failed');
    
    await generationPage.assertStatus('failed');
    await expect(page.locator(testIds.errorMessage)).toContainText('API rate limit exceeded');
  });

  test('should be responsive on mobile', async ({ page }) => {
    const generationPage = pageFactory.generationPage();
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await generationPage.navigate('test-generation-1');
    
    // Should still display all main elements
    await expect(generationPage.breadcrumbs).toBeVisible();
    await expect(generationPage.statusBanner).toBeVisible();
    await expect(generationPage.toolbar).toBeVisible();
    await expect(generationPage.suggestionsList).toBeVisible();
  });
});

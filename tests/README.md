# Testing Guide for 10x Cards

This directory contains all testing infrastructure for the 10x Cards application, including unit tests, E2E tests, and testing utilities.

## 📁 Directory Structure

```
tests/
├── unit/                 # Unit tests for components and services
├── e2e/                  # End-to-end tests with Playwright
│   ├── auth/            # Authentication flow tests
│   ├── ai/              # AI generation feature tests
│   ├── decks/           # Deck management tests
│   └── study/           # Study session tests
├── fixtures/            # Test data and fixtures
├── utils/               # Test utilities and helpers
│   ├── test-helpers.ts  # Common test utilities
│   └── page-objects.ts  # Page Object Models for E2E tests
├── setup.ts             # Vitest setup file
├── global-setup.ts      # Playwright global setup
└── global-teardown.ts   # Playwright global teardown
```

## 🧪 Unit Testing with Vitest

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit:watch

# Run tests with UI
npm run test:unit:ui

# Run with coverage
npm run test:unit:coverage
```

### Writing Unit Tests

Unit tests are located in `tests/unit/` and follow the pattern `*.test.{ts,tsx}`.

Example unit test:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../../src/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
```

### Key Features

- **TypeScript Support**: Full type checking in tests
- **JSdom Environment**: DOM testing for React components
- **Vi Mocking**: Powerful mocking system
- **Coverage Reports**: HTML and JSON coverage reports
- **Fast Execution**: Optimized for development workflow

## 🎭 E2E Testing with Playwright

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report

# Generate test code
npm run test:e2e:codegen
```

### Writing E2E Tests

E2E tests are located in `tests/e2e/` and follow the pattern `*.spec.ts`.

Example E2E test using Page Object Model:

```typescript
import { test, expect } from '@playwright/test';
import { PageObjectFactory } from '../utils/page-objects';

test.describe('Login Flow', () => {
  test('should login successfully', async ({ page }) => {
    const pageFactory = new PageObjectFactory(page);
    const loginPage = pageFactory.loginPage();
    
    await loginPage.navigate();
    await loginPage.login('demo@10xcards.com', 'demo123');
    
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### Key Features

- **Chromium Only**: Focused on Desktop Chrome testing
- **Page Object Model**: Maintainable test structure
- **Visual Testing**: Screenshot comparisons
- **API Testing**: Backend validation
- **Trace Viewer**: Debugging test failures
- **Parallel Execution**: Fast test runs

## 🛠️ Test Utilities

### Test Helpers

The `TestHelpers` class provides common utilities:

- `waitForPageLoad()` - Wait for complete page loading
- `screenshot(name)` - Take named screenshots
- `clickElement(selector)` - Safe element clicking
- `fillField(selector, value)` - Form field filling with validation
- `mockAPIResponse(pattern, response)` - API response mocking

### Page Object Models

Page objects encapsulate page interactions:

- `LoginPage` - Authentication flows
- `GenerationPage` - AI generation features
- `DashboardPage` - Main navigation and overview

### Test Data

Test fixtures and data are stored in `tests/fixtures/`:

- Mock API responses
- Test user data
- Sample content for generation

## ⚙️ Configuration

### Vitest Configuration (`vitest.config.ts`)

- Environment: jsdom
- Setup files: `tests/setup.ts`
- Coverage thresholds: 80% statements, 70% branches
- TypeScript support enabled
- Path aliases configured

### Playwright Configuration (`playwright.config.ts`)

- Browser: Chromium only
- Base URL: `http://localhost:4321`
- Global setup/teardown
- HTML and JSON reporters
- Trace on retry
- Screenshot on failure

## 🎯 Testing Strategies

### Unit Testing Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on component contracts
   - Test user interactions
   - Avoid testing internal state

2. **Use Proper Mocking**
   - Mock external dependencies
   - Use `vi.mock()` for modules
   - Preserve type safety in mocks

3. **Keep Tests Simple**
   - One concept per test
   - Clear arrange-act-assert pattern
   - Descriptive test names

### E2E Testing Best Practices

1. **Page Object Model**
   - Encapsulate page interactions
   - Reuse common actions
   - Maintain clean separation

2. **Test User Journeys**
   - Focus on critical paths
   - Test complete workflows
   - Include error scenarios

3. **Performance Considerations**
   - Run tests in parallel
   - Use selective test execution
   - Optimize for CI/CD pipeline

## 🚀 CI/CD Integration

### GitHub Actions

Tests can be integrated into CI/CD pipelines:

```yaml
- name: Run Unit Tests
  run: npm run test:unit

- name: Run E2E Tests
  run: npm run test:e2e
```

### Test Reports

- Unit test coverage: `coverage/index.html`
- E2E test report: `playwright-report/index.html`
- Test results: `test-results.json`

## 🐛 Debugging Tests

### Unit Tests

- Use `test.only()` to run specific tests
- Add `console.log()` for debugging
- Use VS Code debugging with breakpoints

### E2E Tests

- Use `test:e2e:debug` for step-by-step debugging
- Check trace viewer for failed tests
- Use `page.pause()` to inspect state

### Common Issues

1. **Timing Issues**: Use proper waits and assertions
2. **Flaky Tests**: Improve selectors and waits
3. **Environment Issues**: Check setup files and config

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [Project Testing Guidelines](../rules/playwright-vitest.mdc)

## 🆘 Getting Help

- Check existing tests for examples
- Review configuration files for setup
- Consult project documentation in `.ai/README.md`
- Use test utilities for common patterns

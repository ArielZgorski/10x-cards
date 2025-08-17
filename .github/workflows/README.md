# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the 10x-cards project.

## Workflows

### pull-request.yml

**Trigger**: Pull requests to the `master` branch

**Purpose**: Comprehensive quality checks for pull requests including linting, testing, and automated feedback.

#### Job Flow

1. **Lint** (runs first)
   - ESLint code quality checks
   - Prettier formatting validation
   - Must pass before other jobs proceed

2. **Unit Tests** (runs after lint, parallel with e2e)
   - Runs Vitest unit tests with coverage
   - Uploads coverage reports as artifacts
   - Uses `npm run test:unit:coverage`

3. **E2E Tests** (runs after lint, parallel with unit tests)
   - Runs Playwright E2E tests
   - Installs Chromium browser (as per playwright.config.ts)
   - Sets environment to "integration"
   - Uploads test results and reports as artifacts
   - Uses `npm run test:e2e`

4. **Status Comment** (runs only if all previous jobs succeed)
   - Downloads coverage and test result artifacts
   - Generates success comment with test results summary
   - Posts comment to the pull request

5. **Failure Notification** (runs only if any job fails)
   - Generates failure comment identifying which jobs failed
   - Posts comment to the pull request with guidance

#### Environment Variables

The E2E tests job requires the following secrets to be configured in your GitHub repository:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `OPENROUTER_API_KEY`: OpenRouter API key
- `DEFAULT_OPENROUTER_MODEL`: Default AI model for OpenRouter
- `APP_REFERER`: Application referer URL
- `APP_TITLE`: Application title

#### Artifacts

- **Unit Test Coverage**: Coverage reports stored for 30 days
- **E2E Test Results**: Test results, screenshots, and videos stored for 30 days
- **E2E Test Results JSON**: Structured test results for status comments

#### Node.js Version

Uses Node.js version `22.14.0` as specified in `.nvmrc`.

#### Dependencies

- `npm ci` for fast, reliable dependency installation
- Caching enabled for faster subsequent runs
- Latest versions of GitHub Actions:
  - `actions/checkout@v5`
  - `actions/setup-node@v4`
  - `actions/upload-artifact@v4`
  - `actions/download-artifact@v5`
  - `actions/github-script@v7`

## Setup

1. Ensure all required secrets are configured in your GitHub repository settings
2. The workflow will automatically run on pull requests to the `master` branch
3. Coverage reports and test results are automatically uploaded as artifacts
4. Status comments are automatically posted to pull requests

## Troubleshooting

- Check workflow logs for detailed error information
- Verify all required secrets are properly configured
- Ensure your `.nvmrc` file contains the correct Node.js version
- Check that all npm scripts referenced in the workflow exist in `package.json`

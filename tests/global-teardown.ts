/**
 * Playwright global teardown
 * This file runs once after all E2E tests complete
 */

import { FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  console.log("🧹 Starting Playwright global teardown...");

  try {
    // Cleanup operations can go here
    // Example: Clean up test data, close connections, etc.

    console.log("✅ Global teardown completed successfully");
  } catch (error) {
    console.error("❌ Global teardown failed:", error);
    // Don't throw here to avoid masking test failures
  }
}

export default globalTeardown;

/**
 * Tests for AI Generation Service
 * 
 * Note: These are unit tests focused on business logic validation.
 * For integration tests, ensure proper test environment setup with Supabase and OpenRouter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the imports
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

// Mock OpenRouterService
vi.mock('../openrouter.service', () => ({
  createOpenRouterService: vi.fn(),
  OpenRouterService: vi.fn(),
}));

// Import the service after mocking
import { enqueueGeneration } from '../generation.service';

describe('AI Generation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  describe('enqueueGeneration', () => {
    it('should enqueue a generation job without throwing', async () => {
      const payload = {
        generationId: 'test-gen-id',
        userId: 'test-user-id',
        model: 'gpt-3.5-turbo',
        promptVersion: 'v1',
      };

      // Should not throw
      await expect(enqueueGeneration(payload)).resolves.toBeUndefined();
    });

    it('should log the generation request', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const payload = {
        generationId: 'test-gen-id',
        userId: 'test-user-id',
      };

      await enqueueGeneration(payload);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Enqueuing AI generation:',
        expect.objectContaining({
          generationId: 'test-gen-id',
          userId: 'test-user-id',
          timestamp: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });

    it('should handle optional parameters', async () => {
      const payload = {
        generationId: 'test-gen-id',
        userId: 'test-user-id',
        // No model or promptVersion
      };

      await expect(enqueueGeneration(payload)).resolves.toBeUndefined();
    });
  });
});

// Export test utilities for integration tests
export const testUtils = {
  createMockGenerationPayload: (overrides = {}) => ({
    generationId: 'test-gen-' + Math.random().toString(36).substr(2, 9),
    userId: 'test-user-' + Math.random().toString(36).substr(2, 9),
    model: 'openai/gpt-3.5-turbo',
    promptVersion: 'v1',
    ...overrides,
  }),

  createMockOpenRouterServiceResponse: (overrides = {}) => ({
    json: [
      { front: 'Test question 1?', back: 'Test answer 1' },
      { front: 'Test question 2?', back: 'Test answer 2' },
    ],
    raw: JSON.stringify([
      { front: 'Test question 1?', back: 'Test answer 1' },
      { front: 'Test question 2?', back: 'Test answer 2' },
    ]),
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
    model: 'openai/gpt-3.5-turbo',
    ...overrides,
  }),

  createMockSuggestions: () => [
    { front: 'What is TypeScript?', back: 'A superset of JavaScript that adds static typing' },
    { front: 'What is Astro?', back: 'A modern web framework for building fast, content-focused websites' },
  ],
};

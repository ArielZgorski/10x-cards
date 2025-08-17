/**
 * Unit tests for OpenRouterService
 * 
 * Tests core functionality without complex timing issues
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterService, type OpenRouterConfig, type ChatMessage, type JsonSchema } from '../openrouter.service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenRouterService', () => {
  let service: OpenRouterService;
  let config: OpenRouterConfig;

  beforeEach(() => {
    config = {
      apiKey: 'test-api-key',
      appReferer: 'https://test-app.com',
      appTitle: 'Test App',
      defaultModel: 'openai/gpt-3.5-turbo',
      defaultParams: {
        temperature: 0.7,
        max_tokens: 2000,
      },
    };
    service = new OpenRouterService(config);
    mockFetch.mockClear();
  });

  describe('Constructor', () => {
    it('should create service with valid config', () => {
      expect(service).toBeInstanceOf(OpenRouterService);
    });

    it('should throw error when API key is missing', () => {
      expect(() => new OpenRouterService({ ...config, apiKey: '' })).toThrow('OpenRouter API key is required');
    });

    it('should throw error when app referer is missing', () => {
      expect(() => new OpenRouterService({ ...config, appReferer: '' })).toThrow('App referer is required');
    });

    it('should throw error when app title is missing', () => {
      expect(() => new OpenRouterService({ ...config, appTitle: '' })).toThrow('App title is required');
    });
  });

  describe('buildSystemMessage', () => {
    it('should return v1 prompt by default', () => {
      const message = service.buildSystemMessage('v1');
      expect(message).toContain('expert flashcard creator');
      expect(message).toContain('CORE PRINCIPLES');
    });

    it('should return v2 prompt when specified', () => {
      const message = service.buildSystemMessage('v2');
      expect(message).toContain('educational content creator');
      expect(message).toContain('LEARNING SCIENCE PRINCIPLES');
    });

    it('should return v1 prompt for unknown version', () => {
      const message = service.buildSystemMessage('unknown');
      expect(message).toContain('expert flashcard creator');
    });
  });

  describe('chat', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'system', content: 'You are a test assistant' },
      { role: 'user', content: 'Hello world' },
    ];

    const mockSuccessResponse = {
      choices: [
        {
          message: {
            content: 'Hello! How can I help you?',
          },
        },
      ],
      model: 'openai/gpt-3.5-turbo',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    };

    it('should make successful API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const result = await service.chat(mockMessages);

      expect(result).toEqual({
        content: 'Hello! How can I help you?',
        model: 'openai/gpt-3.5-turbo',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://test-app.com',
            'X-Title': 'Test App',
          },
          body: expect.stringContaining('"model":"openai/gpt-3.5-turbo"'),
        })
      );
    });

    it('should use custom options when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await service.chat(mockMessages, {
        model: 'custom-model',
        params: { temperature: 0.5, max_tokens: 1000 },
      });

      const [, requestInit] = mockFetch.mock.calls[0];
      const body = JSON.parse(requestInit.body as string);

      expect(body.model).toBe('custom-model');
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(1000);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(service.chat(mockMessages)).rejects.toThrow('OpenRouter error 401: Unauthorized');
    });

    it('should throw error when no content in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      });

      await expect(service.chat(mockMessages)).rejects.toThrow('No content in OpenRouter response');
    });
  });

  describe('chatJson', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'system', content: 'Return JSON' },
      { role: 'user', content: 'Generate data' },
    ];

    const mockJsonSchema: JsonSchema = {
      name: 'test_schema',
      schema: {
        type: 'array',
        items: { type: 'string' },
      },
    };

    it('should make successful JSON API call', async () => {
      const jsonContent = '["item1", "item2", "item3"]';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: jsonContent } }],
          model: 'openai/gpt-3.5-turbo',
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      });

      const result = await service.chatJson(mockMessages, mockJsonSchema);

      expect(result).toEqual({
        json: ['item1', 'item2', 'item3'],
        raw: jsonContent,
        model: 'openai/gpt-3.5-turbo',
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      });

      const [, requestInit] = mockFetch.mock.calls[0];
      const body = JSON.parse(requestInit.body as string);
      expect(body.response_format).toEqual({
        type: 'json_schema',
        json_schema: {
          name: 'test_schema',
          strict: true,
          schema: mockJsonSchema.schema,
        },
      });
    });

    it('should parse JSON from content with extra text', async () => {
      const content = 'Here is the JSON: ["item1", "item2"] and some extra text';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content } }],
        }),
      });

      const result = await service.chatJson(mockMessages, mockJsonSchema);

      expect(result.json).toEqual(['item1', 'item2']);
      expect(result.raw).toBe(content);
    });

    it('should throw error when JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'invalid json content' } }],
        }),
      });

      await expect(service.chatJson(mockMessages, mockJsonSchema)).rejects.toThrow('Failed to locate JSON in content');
    });
  });

  describe('Error handling', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'user', content: 'test' },
    ];

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.chat(mockMessages)).rejects.toThrow();
    });

    it('should handle malformed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(service.chat(mockMessages)).rejects.toThrow('Invalid JSON');
    });
  });
});

// Simple integration test for createOpenRouterService
describe('createOpenRouterService', () => {
  // This test validates that the function can be called successfully
  // In a real environment with proper env vars, it would work correctly
  it('should be callable', async () => {
    // We just test that the function exists and is callable
    // The actual env var dependency makes this hard to test in isolation
    const { createOpenRouterService } = await import('../openrouter.service');
    expect(typeof createOpenRouterService).toBe('function');
  });
});
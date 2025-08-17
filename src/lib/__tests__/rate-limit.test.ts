/**
 * Tests for Rate Limiting Helper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureRateLimit, getRateLimitStatus } from '../rate-limit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the rate limit store by calling ensureRateLimit with future timestamp
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ensureRateLimit', () => {
    it('should allow first request', async () => {
      const result = await ensureRateLimit('user1', 'ai_generation');
      
      expect(result.ok).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should track multiple requests', async () => {
      const userId = 'user2';
      
      // First request
      const result1 = await ensureRateLimit(userId, 'ai_generation');
      expect(result1.ok).toBe(true);
      expect(result1.remaining).toBe(4);
      
      // Second request
      const result2 = await ensureRateLimit(userId, 'ai_generation');
      expect(result2.ok).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it('should enforce rate limits', async () => {
      const userId = 'user3';
      
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        const result = await ensureRateLimit(userId, 'ai_generation');
        expect(result.ok).toBe(true);
      }
      
      // 6th request should be blocked
      const blockedResult = await ensureRateLimit(userId, 'ai_generation');
      expect(blockedResult.ok).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });

    it('should reset after time window', async () => {
      const userId = 'user4';
      
      // Make limit requests
      for (let i = 0; i < 5; i++) {
        await ensureRateLimit(userId, 'ai_generation');
      }
      
      // Should be blocked
      const blockedResult = await ensureRateLimit(userId, 'ai_generation');
      expect(blockedResult.ok).toBe(false);
      
      // Advance time past the window (5 minutes + 1 second)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
      
      // Should be allowed again
      const allowedResult = await ensureRateLimit(userId, 'ai_generation');
      expect(allowedResult.ok).toBe(true);
      expect(allowedResult.remaining).toBe(4);
    });

    it('should handle different rate limit types', async () => {
      const userId = 'user5';
      
      // AI generation limit (5 per 5 minutes)
      const aiResult = await ensureRateLimit(userId, 'ai_generation');
      expect(aiResult.limit).toBe(5);
      
      // Default limit (60 per minute)
      const defaultResult = await ensureRateLimit(userId, 'default');
      expect(defaultResult.limit).toBe(60);
    });

    it('should isolate limits per user', async () => {
      // User1 makes requests
      for (let i = 0; i < 5; i++) {
        await ensureRateLimit('user1', 'ai_generation');
      }
      const user1Blocked = await ensureRateLimit('user1', 'ai_generation');
      expect(user1Blocked.ok).toBe(false);
      
      // User2 should still be allowed
      const user2Allowed = await ensureRateLimit('user2', 'ai_generation');
      expect(user2Allowed.ok).toBe(true);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status without consuming requests', async () => {
      const userId = 'user6';
      
      // Check initial status
      const initialStatus = await getRateLimitStatus(userId, 'ai_generation');
      expect(initialStatus.ok).toBe(true);
      expect(initialStatus.remaining).toBe(5);
      
      // Check again - should be the same
      const secondStatus = await getRateLimitStatus(userId, 'ai_generation');
      expect(secondStatus.remaining).toBe(5);
      
      // Actually consume a request
      await ensureRateLimit(userId, 'ai_generation');
      
      // Status should now show one less
      const afterConsumption = await getRateLimitStatus(userId, 'ai_generation');
      expect(afterConsumption.remaining).toBe(4);
    });
  });
});

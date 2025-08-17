/**
 * Rate limiting helper for API endpoints
 *
 * For MVP: in-memory rate limiting (per-instance, non-distributed)
 * TODO: Replace with durable solution (Redis, Upstash KV, or rate_limits table) for production
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configurations
const RATE_LIMITS = {
  ai_generation: {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
  default: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

type RateLimitType = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Check and enforce rate limit for a user and operation type
 *
 * @param userId - User ID from auth
 * @param type - Type of operation for rate limiting
 * @returns Rate limit status and metadata
 */
export async function ensureRateLimit(
  userId: string,
  type: RateLimitType = "default",
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type];
  const key = `${userId}:${type}`;
  const now = Date.now();

  // Clean up expired entries periodically to prevent memory leaks
  cleanupExpiredEntries(now);

  const existing = rateLimitStore.get(key);

  if (!existing || now >= existing.resetTime) {
    // First request or window has reset
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });

    return {
      ok: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  if (existing.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      ok: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: existing.resetTime,
    };
  }

  // Increment counter
  existing.count++;
  rateLimitStore.set(key, existing);

  return {
    ok: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - existing.count,
    resetTime: existing.resetTime,
  };
}

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries(now: number): void {
  // Only clean up occasionally to avoid performance impact
  if (Math.random() > 0.01) return; // 1% chance

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get current rate limit status without consuming a request
 */
export async function getRateLimitStatus(
  userId: string,
  type: RateLimitType = "default",
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type];
  const key = `${userId}:${type}`;
  const now = Date.now();

  const existing = rateLimitStore.get(key);

  if (!existing || now >= existing.resetTime) {
    return {
      ok: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }

  return {
    ok: existing.count < config.maxRequests,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - existing.count),
    resetTime: existing.resetTime,
  };
}

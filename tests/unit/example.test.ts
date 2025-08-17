/**
 * Example unit test to demonstrate the testing setup
 */

import { describe, it, expect, vi } from 'vitest';

// Example function to test
function calculateSum(a: number, b: number): number {
  return a + b;
}

function asyncOperation(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve('completed'), 100);
  });
}

describe('Example Tests', () => {
  it('should calculate sum correctly', () => {
    expect(calculateSum(2, 3)).toBe(5);
    expect(calculateSum(-1, 1)).toBe(0);
    expect(calculateSum(0, 0)).toBe(0);
  });

  it('should handle async operations', async () => {
    const result = await asyncOperation();
    expect(result).toBe('completed');
  });

  it('should work with fake timers', () => {
    vi.useFakeTimers();
    
    const callback = vi.fn();
    setTimeout(callback, 1000);
    
    expect(callback).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
    
    vi.useRealTimers();
  });

  it('should work with mocks', () => {
    const mockFn = vi.fn((x: number) => x * 2);
    
    const result = mockFn(5);
    
    expect(result).toBe(10);
    expect(mockFn).toHaveBeenCalledWith(5);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

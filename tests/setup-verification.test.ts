/**
 * Setup verification test
 * This test ensures that the testing environment is properly configured
 */

import { describe, it, expect, vi } from "vitest";

describe("Testing Environment Setup", () => {
  it("should have vitest globals available", () => {
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
    expect(vi).toBeDefined();
  });

  it("should have DOM environment available", () => {
    expect(window).toBeDefined();
    expect(document).toBeDefined();
    expect(localStorage).toBeDefined();
  });

  it("should have mocked functions working", () => {
    const mockFn = vi.fn();
    mockFn("test");

    expect(mockFn).toHaveBeenCalledWith("test");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should have fake timers working", () => {
    vi.useFakeTimers();

    const callback = vi.fn();
    setTimeout(callback, 1000);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("should have environment variables mocked", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.SUPABASE_URL).toBe("https://test.supabase.co");
  });

  it("should have localStorage mocked", () => {
    localStorage.setItem("test", "value");
    expect(localStorage.getItem("test")).toBe("value");

    localStorage.clear();
    expect(localStorage.getItem("test")).toBeNull();
  });
});

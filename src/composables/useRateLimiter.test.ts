/**
 * Tests for useRateLimiter composable.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useRateLimiter } from './useRateLimiter'
import type { RateLimitError } from './useRateLimiter'

describe('useRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows operations within rate limits', () => {
    const limiter = useRateLimiter()
    
    expect(() => limiter.checkLimit('createNode')).not.toThrow()
    expect(() => limiter.checkLimit('createNode')).not.toThrow()
    expect(() => limiter.checkLimit('createNode')).not.toThrow()
  })

  it('throws when burst limit exceeded', () => {
    const limiter = useRateLimiter({ maxBurst: 5 })
    
    // First operation doesn't count toward burst
    limiter.checkLimit('createNode')
    
    // Simulate rapid-fire operations (4 more within 50ms each - still under limit)
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(10) // 10ms between operations (< 50ms threshold)
      limiter.checkLimit('createNode')
    }

    // 6th operation should exceed burst limit (burstCount reaches 5)
    vi.advanceTimersByTime(10)
    expect(() => limiter.checkLimit('createNode')).toThrow()
    
    try {
      limiter.checkLimit('createNode')
    } catch (err) {
      const error = err as RateLimitError
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(error.limitType).toBe('burst')
      expect(error.message).toContain('burst')
    }
  })

  it('resets burst counter after sufficient delay', () => {
    const limiter = useRateLimiter({ maxBurst: 3 })
    
    // Rapid operations (1st init, then 2 burst operations)
    limiter.checkLimit('createNode')
    vi.advanceTimersByTime(10)
    limiter.checkLimit('createNode')
    vi.advanceTimersByTime(10)
    limiter.checkLimit('createNode')

    // Wait more than 50ms (burst threshold)
    vi.advanceTimersByTime(100)
    
    // Should not throw - burst counter reset
    expect(() => limiter.checkLimit('createNode')).not.toThrow()
  })

  it('throws when per-second limit exceeded', () => {
    const limiter = useRateLimiter({ maxPerSecond: 5 })
    
    // Make 5 operations in 1 second
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(150) // Spread out to avoid burst detection
      limiter.checkLimit('createNode')
    }

    // 6th operation in same second should throw
    vi.advanceTimersByTime(150)
    expect(() => limiter.checkLimit('createNode')).toThrow()
    
    try {
      limiter.checkLimit('createNode')
    } catch (err) {
      const error = err as RateLimitError
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(error.limitType).toBe('second')
    }
  })

  it('allows operations after second window passes', () => {
    const limiter = useRateLimiter({ maxPerSecond: 5 })
    
    // Fill up the second limit
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(150)
      limiter.checkLimit('createNode')
    }

    // Advance past 1 second window
    vi.advanceTimersByTime(1200)
    
    // Should not throw - old operations expired
    expect(() => limiter.checkLimit('createNode')).not.toThrow()
  })

  it('throws when per-minute limit exceeded', () => {
    const limiter = useRateLimiter({ maxPerMinute: 10, maxPerSecond: 100 })
    
    // Make 10 operations spread across 10 seconds
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1100) // Just over 1 second each
      limiter.checkLimit('createNode')
    }

    // 11th operation should exceed minute limit
    vi.advanceTimersByTime(1100)
    expect(() => limiter.checkLimit('createNode')).toThrow()
    
    try {
      limiter.checkLimit('createNode')
    } catch (err) {
      const error = err as RateLimitError
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(error.limitType).toBe('minute')
    }
  })

  it('allows operations after minute window passes', () => {
    const limiter = useRateLimiter({ maxPerMinute: 10, maxPerSecond: 100 })
    
    // Fill up minute limit
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1100)
      limiter.checkLimit('createNode')
    }

    // Advance past 1 minute
    vi.advanceTimersByTime(61000)
    
    // Should not throw - old operations expired
    expect(() => limiter.checkLimit('createNode')).not.toThrow()
  })

  it('rateLimit wrapper prevents function execution on limit exceeded', async () => {
    const limiter = useRateLimiter({ maxBurst: 2 })
    const mockFn = vi.fn().mockResolvedValue('result')
    
    const limited = limiter.rateLimit('testOp', mockFn)
    
    // First call initializes, second is within burst limit
    await limited('arg1')
    vi.advanceTimersByTime(10)
    await limited('arg2')
    
    expect(mockFn).toHaveBeenCalledTimes(2)

    // Third rapid call should throw (burstCount reaches 2)
    vi.advanceTimersByTime(10)
    await expect(limited('arg3')).rejects.toThrow()
    expect(mockFn).toHaveBeenCalledTimes(2) // Still only 2 calls
  })

  it('reset clears all counters', () => {
    const limiter = useRateLimiter({ maxBurst: 2 })
    
    // Trigger burst limit (1st init, 2nd burst increment to 1, 3rd exceeds)
    limiter.checkLimit('op')
    vi.advanceTimersByTime(10)
    limiter.checkLimit('op')
    vi.advanceTimersByTime(10)
    
    expect(() => limiter.checkLimit('op')).toThrow()

    // Reset should clear
    limiter.reset()
    
    // Should work again
    expect(() => limiter.checkLimit('op')).not.toThrow()
  })

  it('getStats returns accurate operation counts', () => {
    const limiter = useRateLimiter({ maxPerSecond: 10, maxPerMinute: 50, maxBurst: 5 })
    
    // Make 3 operations
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(200)
      limiter.checkLimit('createNode')
    }

    const stats = limiter.getStats()
    expect(stats.lastSecond).toBe(3)
    expect(stats.lastMinute).toBe(3)
    expect(stats.limits.maxPerSecond).toBe(10)
    expect(stats.limits.maxPerMinute).toBe(50)
    expect(stats.limits.maxBurst).toBe(5)
  })

  it('tracks different operation types separately in logs', () => {
    const limiter = useRateLimiter()
    
    vi.advanceTimersByTime(100)
    limiter.checkLimit('createNode')
    vi.advanceTimersByTime(100)
    limiter.checkLimit('createGoal')
    vi.advanceTimersByTime(100)
    limiter.checkLimit('deleteNode')

    const stats = limiter.getStats()
    expect(stats.lastMinute).toBe(3) // All operations counted
  })

  it('uses default config when no config provided', () => {
    const limiter = useRateLimiter()
    const stats = limiter.getStats()
    
    expect(stats.limits.maxPerSecond).toBe(100)
    expect(stats.limits.maxPerMinute).toBe(500)
    expect(stats.limits.maxBurst).toBe(20)
  })

  it('allows partial config override', () => {
    const limiter = useRateLimiter({ maxPerSecond: 50 })
    const stats = limiter.getStats()
    
    expect(stats.limits.maxPerSecond).toBe(50)
    expect(stats.limits.maxPerMinute).toBe(500) // Default
    expect(stats.limits.maxBurst).toBe(20) // Default
  })
})

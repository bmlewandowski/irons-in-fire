/**
 * useRateLimiter - prevents excessive operation rates
 * 
 * Provides rate limiting for store operations to prevent:
 * - Accidental infinite loops
 * - Performance degradation from rapid-fire operations
 * - Resource exhaustion from malicious or buggy code
 * 
 * Usage:
 *   const limiter = useRateLimiter({ maxPerSecond: 100, maxPerMinute: 500 })
 *   await limiter.checkLimit('createNode')
 */

import { ref } from 'vue'

export interface RateLimitConfig {
  /** Maximum operations per second (default: 100) */
  maxPerSecond?: number
  /** Maximum operations per minute (default: 500) */
  maxPerMinute?: number
  /** Maximum burst size before throttling (default: 20) */
  maxBurst?: number
}

export interface RateLimitError extends Error {
  code: 'RATE_LIMIT_EXCEEDED'
  limitType: 'second' | 'minute' | 'burst'
  operationType: string
}

interface OperationLog {
  timestamp: number
  operationType: string
}

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  maxPerSecond: 100,
  maxPerMinute: 500,
  maxBurst: 20,
}

export function useRateLimiter(config: RateLimitConfig = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  // Log of recent operations with timestamps
  const operationLog = ref<OperationLog[]>([])
  
  // Track consecutive operations without delay (burst detection)
  let burstCount = 0
  let lastOperationTime = 0

  /**
   * Check if an operation is within rate limits.
   * Throws RateLimitError if limit exceeded.
   */
  function checkLimit(operationType: string): void {
    const now = Date.now()
    
    // Cleanup old entries (older than 1 minute)
    operationLog.value = operationLog.value.filter(
      (log) => now - log.timestamp < 60000
    )

    // Check burst detection (rapid consecutive operations)
    if (lastOperationTime > 0 && now - lastOperationTime < 50) { 
      // Less than 50ms between operations
      burstCount++
      if (burstCount >= cfg.maxBurst) {
        const error = new Error(
          `Rate limit exceeded: too many rapid operations (burst). Limit: ${cfg.maxBurst} ops with <50ms gap.`
        ) as RateLimitError
        error.code = 'RATE_LIMIT_EXCEEDED'
        error.limitType = 'burst'
        error.operationType = operationType
        throw error
      }
    } else {
      burstCount = 0
    }
    lastOperationTime = now

    // Count operations in the last second
    const lastSecond = operationLog.value.filter(
      (log) => now - log.timestamp < 1000
    )
    if (lastSecond.length >= cfg.maxPerSecond) {
      const error = new Error(
        `Rate limit exceeded: ${lastSecond.length} operations in last second. Limit: ${cfg.maxPerSecond}/sec.`
      ) as RateLimitError
      error.code = 'RATE_LIMIT_EXCEEDED'
      error.limitType = 'second'
      error.operationType = operationType
      throw error
    }

    // Count operations in the last minute
    if (operationLog.value.length >= cfg.maxPerMinute) {
      const error = new Error(
        `Rate limit exceeded: ${operationLog.value.length} operations in last minute. Limit: ${cfg.maxPerMinute}/min.`
      ) as RateLimitError
      error.code = 'RATE_LIMIT_EXCEEDED'
      error.limitType = 'minute'
      error.operationType = operationType
      throw error
    }

    // Log this operation
    operationLog.value.push({ timestamp: now, operationType })
  }

  /**
   * Wrap an async function with rate limiting.
   * Returns a rate-limited version that throws on limit exceeded.
   */
  function rateLimit<T extends (...args: any[]) => Promise<any>>(
    operationType: string,
    fn: T
  ): T {
    return (async (...args: Parameters<T>) => {
      checkLimit(operationType)
      return await fn(...args)
    }) as T
  }

  /**
   * Reset all rate limit counters (useful for testing or after user confirmation).
   */
  function reset(): void {
    operationLog.value = []
    burstCount = 0
    lastOperationTime = 0
  }

  /**
   * Get current operation counts for monitoring.
   */
  function getStats() {
    const now = Date.now()
    const lastSecond = operationLog.value.filter(
      (log) => now - log.timestamp < 1000
    ).length
    const lastMinute = operationLog.value.length

    return {
      lastSecond,
      lastMinute,
      burstCount,
      limits: {
        maxPerSecond: cfg.maxPerSecond,
        maxPerMinute: cfg.maxPerMinute,
        maxBurst: cfg.maxBurst,
      },
    }
  }

  return {
    checkLimit,
    rateLimit,
    reset,
    getStats,
  }
}

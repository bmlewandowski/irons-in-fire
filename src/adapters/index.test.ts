import { describe, it, expect, afterEach, vi } from 'vitest'
import { createAdapter, ConfigurationError } from './index'
import { LocalStorageAdapter } from './LocalStorageAdapter'
import { ApiAdapter } from './ApiAdapter'

describe('createAdapter factory', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a LocalStorageAdapter when VITE_PERSISTENCE_ADAPTER is "local"', () => {
    vi.stubEnv('VITE_PERSISTENCE_ADAPTER', 'local')
    expect(createAdapter()).toBeInstanceOf(LocalStorageAdapter)
  })

  it('returns an ApiAdapter when VITE_PERSISTENCE_ADAPTER is "api"', () => {
    vi.stubEnv('VITE_PERSISTENCE_ADAPTER', 'api')
    vi.stubEnv('VITE_API_URL', 'https://api.test')
    expect(createAdapter()).toBeInstanceOf(ApiAdapter)
  })

  it('throws ConfigurationError for an unrecognised adapter name', () => {
    vi.stubEnv('VITE_PERSISTENCE_ADAPTER', 'redis')
    expect(() => createAdapter()).toThrow(ConfigurationError)
  })

  it('throws ConfigurationError when the env var is an empty string', () => {
    vi.stubEnv('VITE_PERSISTENCE_ADAPTER', '')
    expect(() => createAdapter()).toThrow(ConfigurationError)
  })

  it('ConfigurationError has code CONFIGURATION_ERROR and extends Error', () => {
    vi.stubEnv('VITE_PERSISTENCE_ADAPTER', 'unknown')
    let caught: unknown
    try {
      createAdapter()
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ConfigurationError)
    expect(caught).toBeInstanceOf(Error)
    expect((caught as ConfigurationError).code).toBe('CONFIGURATION_ERROR')
  })

  it('ConfigurationError message includes the offending value', () => {
    vi.stubEnv('VITE_PERSISTENCE_ADAPTER', 'sqlite')
    let caught: unknown
    try {
      createAdapter()
    } catch (e) {
      caught = e
    }
    expect((caught as ConfigurationError).message).toContain('sqlite')
  })
})

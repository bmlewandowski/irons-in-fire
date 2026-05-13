import { ApiAdapter } from './ApiAdapter'
import { LocalStorageAdapter } from './LocalStorageAdapter'
import type { PersistenceAdapter } from './PersistenceAdapter'

// Re-export everything consumers need.
export type { PersistenceAdapter }
export { AdapterError } from './PersistenceAdapter'
export { MockAdapter } from './MockAdapter'
export { LocalStorageAdapter } from './LocalStorageAdapter'
export { ApiAdapter } from './ApiAdapter'

/**
 * Error thrown when the adapter environment variable is absent or contains
 * an unrecognized value.
 *
 * Requirements: 7.6
 */
export class ConfigurationError extends Error {
  readonly code = 'CONFIGURATION_ERROR' as const

  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
    // Maintain proper prototype chain in transpiled ES5 output.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Factory that reads `VITE_PERSISTENCE_ADAPTER` from the environment and
 * returns the appropriate PersistenceAdapter instance.
 *
 * - `"local"` → LocalStorageAdapter
 * - `"api"`   → ApiAdapter (uses VITE_API_URL)
 * - anything else → throws ConfigurationError
 *
 * Requirements: 7.5, 7.6
 */
export function createAdapter(): PersistenceAdapter {
  const value = import.meta.env.VITE_PERSISTENCE_ADAPTER
  if (value === 'local') return new LocalStorageAdapter()
  if (value === 'api') return new ApiAdapter(import.meta.env.VITE_API_URL as string)
  throw new ConfigurationError(
    `VITE_PERSISTENCE_ADAPTER is "${value}" — expected "local" or "api"`,
  )
}



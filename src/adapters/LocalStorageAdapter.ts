import type { Goal } from '@/models/Goal'
import type { OrgNode } from '@/models/OrgNode'
import { AdapterError } from './PersistenceAdapter'
import type { PersistenceAdapter } from './PersistenceAdapter'

const NODES_KEY = 'irons-in-fire:nodes'
const GOALS_KEY = 'irons-in-fire:goals'

/**
 * Checks whether a DOMException represents a storage quota error.
 */
function isQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 // legacy numeric code for QuotaExceededError
  )
}

/**
 * Minimal IndexedDB helper used as a fallback when localStorage quota is
 * exceeded.  Only the operations needed by LocalStorageAdapter are exposed.
 */
class IdbFallback {
  private static readonly DB_NAME = 'irons-in-fire'
  private static readonly STORE_NAME = 'kv'
  private static readonly DB_VERSION = 1

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IdbFallback.DB_NAME, IdbFallback.DB_VERSION)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IdbFallback.STORE_NAME)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async get(key: string): Promise<string | null> {
    const db = await this.openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IdbFallback.STORE_NAME, 'readonly')
      const req = tx.objectStore(IdbFallback.STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IdbFallback.STORE_NAME, 'readwrite')
      const req = tx.objectStore(IdbFallback.STORE_NAME).put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

/**
 * PersistenceAdapter backed by localStorage (with IndexedDB fallback when
 * the localStorage quota is exceeded).
 *
 * All data is stored as JSON arrays under two keys:
 *   - 'irons-in-fire:nodes'
 *   - 'irons-in-fire:goals'
 *
 * Instance-level caching prevents redundant JSON parsing on every read.
 * Cache is invalidated on any write operation.
 *
 * Requirements: 7.2
 */
export class LocalStorageAdapter implements PersistenceAdapter {
  private readonly idb = new IdbFallback()
  
  // Instance-level cache to avoid re-parsing JSON on every read
  private cache: Map<string, unknown[]> = new Map()

  // -------------------------------------------------------------------------
  // Low-level read / write helpers
  // -------------------------------------------------------------------------

  /**
   * Reads a JSON array from localStorage (or IndexedDB if the key was
   * previously migrated there).  Returns an empty array on any parse failure
   * or when the key is absent.
   * 
   * Uses instance-level cache to avoid redundant JSON parsing.
   */
  private async readArray<T>(key: string): Promise<T[]> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as T[]
    }
    
    // Cache miss - read from storage
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) as T[]
    }
    
    // Cache miss - read from storage
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) {
        const empty: T[] = []
        this.cache.set(key, empty)
        return empty
      }
      const parsed = JSON.parse(raw) as T[]
      this.cache.set(key, parsed)
      return parsed
    } catch {
      // localStorage unavailable or parse error — try IndexedDB
      try {
        const raw = await this.idb.get(key)
        if (raw === null) {
          const empty: T[] = []
          this.cache.set(key, empty)
          return empty
        }
        const parsed = JSON.parse(raw) as T[]
        this.cache.set(key, parsed)
        return parsed
      } catch {
        const empty: T[] = []
        this.cache.set(key, empty)
        return empty
      }
    }
  }

  /**
   * Writes a JSON array to localStorage.  Falls back to IndexedDB when a
   * quota error is thrown.
   * 
   * Invalidates the cache for this key to ensure subsequent reads get fresh data.
   */
  private async writeArray<T>(key: string, data: T[]): Promise<void> {
    // Invalidate cache before writing
    this.cache.delete(key)
    const serialized = JSON.stringify(data)
    try {
      localStorage.setItem(key, serialized)
    } catch (err) {
      if (isQuotaError(err)) {
        try {
          await this.idb.set(key, serialized)
        } catch (idbErr) {
          throw new AdapterError(
            `Failed to write to IndexedDB fallback: ${String(idbErr)}`,
          )
        }
      } else {
        throw new AdapterError(`Failed to write to localStorage: ${String(err)}`)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Nodes
  // -------------------------------------------------------------------------

  async readAllNodes(): Promise<OrgNode[]> {
    try {
      return await this.readArray<OrgNode>(NODES_KEY)
    } catch (err) {
      throw new AdapterError(`readAllNodes failed: ${String(err)}`)
    }
  }

  async readNodeById(id: string): Promise<OrgNode | null> {
    try {
      const nodes = await this.readArray<OrgNode>(NODES_KEY)
      return nodes.find((n) => n.id === id) ?? null
    } catch (err) {
      throw new AdapterError(`readNodeById failed: ${String(err)}`)
    }
  }

  async createNode(node: OrgNode): Promise<OrgNode> {
    try {
      const nodes = await this.readArray<OrgNode>(NODES_KEY)
      nodes.push(node)
      await this.writeArray(NODES_KEY, nodes)
      return { ...node }
    } catch (err) {
      if (err instanceof AdapterError) throw err
      throw new AdapterError(`createNode failed: ${String(err)}`)
    }
  }

  async updateNode(id: string, patch: Partial<OrgNode>): Promise<OrgNode> {
    try {
      const nodes = await this.readArray<OrgNode>(NODES_KEY)
      const index = nodes.findIndex((n) => n.id === id)
      if (index === -1) {
        throw new AdapterError('Not found')
      }
      const updated: OrgNode = Object.assign({}, nodes[index], patch)
      nodes[index] = updated
      await this.writeArray(NODES_KEY, nodes)
      return { ...updated }
    } catch (err) {
      if (err instanceof AdapterError) throw err
      throw new AdapterError(`updateNode failed: ${String(err)}`)
    }
  }

  async deleteNode(id: string): Promise<void> {
    try {
      const nodes = await this.readArray<OrgNode>(NODES_KEY)
      const index = nodes.findIndex((n) => n.id === id)
      if (index === -1) {
        throw new AdapterError('Not found')
      }
      nodes.splice(index, 1)
      await this.writeArray(NODES_KEY, nodes)
    } catch (err) {
      if (err instanceof AdapterError) throw err
      throw new AdapterError(`deleteNode failed: ${String(err)}`)
    }
  }

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------

  async readAllGoals(): Promise<Goal[]> {
    try {
      return await this.readArray<Goal>(GOALS_KEY)
    } catch (err) {
      throw new AdapterError(`readAllGoals failed: ${String(err)}`)
    }
  }

  async readGoalById(id: string): Promise<Goal | null> {
    try {
      const goals = await this.readArray<Goal>(GOALS_KEY)
      return goals.find((g) => g.id === id) ?? null
    } catch (err) {
      throw new AdapterError(`readGoalById failed: ${String(err)}`)
    }
  }

  async createGoal(goal: Goal): Promise<Goal> {
    try {
      const goals = await this.readArray<Goal>(GOALS_KEY)
      goals.push(goal)
      await this.writeArray(GOALS_KEY, goals)
      return { ...goal }
    } catch (err) {
      if (err instanceof AdapterError) throw err
      throw new AdapterError(`createGoal failed: ${String(err)}`)
    }
  }

  async updateGoal(id: string, patch: Partial<Goal>): Promise<Goal> {
    try {
      const goals = await this.readArray<Goal>(GOALS_KEY)
      const index = goals.findIndex((g) => g.id === id)
      if (index === -1) {
        throw new AdapterError('Not found')
      }
      const updated: Goal = Object.assign({}, goals[index], patch)
      goals[index] = updated
      await this.writeArray(GOALS_KEY, goals)
      return { ...updated }
    } catch (err) {
      if (err instanceof AdapterError) throw err
      throw new AdapterError(`updateGoal failed: ${String(err)}`)
    }
  }

  async deleteGoal(id: string): Promise<void> {
    try {
      const goals = await this.readArray<Goal>(GOALS_KEY)
      const index = goals.findIndex((g) => g.id === id)
      if (index === -1) {
        throw new AdapterError('Not found')
      }
      goals.splice(index, 1)
      await this.writeArray(GOALS_KEY, goals)
    } catch (err) {
      if (err instanceof AdapterError) throw err
      throw new AdapterError(`deleteGoal failed: ${String(err)}`)
    }
  }
}

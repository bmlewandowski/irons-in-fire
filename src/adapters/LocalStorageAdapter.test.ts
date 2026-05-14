import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LocalStorageAdapter } from './LocalStorageAdapter'
import { AdapterError } from './PersistenceAdapter'
import type { OrgNode } from '@/models/OrgNode'
import type { Goal } from '@/models/Goal'

const NODES_KEY = 'irons-in-fire:nodes'
const GOALS_KEY = 'irons-in-fire:goals'

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    id: 'n1',
    parentId: null,
    title: 'Engineering',
    ownerName: 'Alice',
    roleLevel: 'Director',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    nodeId: 'n1',
    type: 'Root',
    description: 'Increase revenue by 20%',
    weight: 1,
    status: 'Active',
    progress: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ── IDB mocks ──────────────────────────────────────────────────────────────

/**
 * Returns a minimal in-memory IndexedDB stand-in for the get/set pattern
 * used exclusively by IdbFallback (get + put inside a single-store KV DB).
 * All event callbacks are fired via Promise.resolve() so they schedule
 * after the synchronous property assignments in IdbFallback.
 */
function makeWorkingIdb() {
  const kv = new Map<string, string>()

  function makeReq<T>(work: () => T): IDBRequest {
    const req: Record<string, unknown> = {}
    Promise.resolve().then(() => {
      req.result = work()
      if (typeof req.onsuccess === 'function') (req.onsuccess as () => void)()
    })
    return req as unknown as IDBRequest
  }

  const db = {
    createObjectStore: () => ({}),
    transaction: () => ({
      objectStore: () => ({
        get: (key: string) => makeReq(() => kv.get(key) ?? null),
        put: (value: string, key: string) => makeReq(() => { kv.set(key, value) }),
      }),
    }),
  }

  return {
    open: (): IDBOpenDBRequest => {
      const req: Record<string, unknown> = { result: db }
      Promise.resolve().then(() => {
        if (typeof req.onupgradeneeded === 'function') (req.onupgradeneeded as () => void)()
        Promise.resolve().then(() => {
          if (typeof req.onsuccess === 'function') (req.onsuccess as () => void)()
        })
      })
      return req as unknown as IDBOpenDBRequest
    },
  }
}

/** IDB mock whose open() immediately fires onerror. */
function makeFailingIdb() {
  return {
    open: (): IDBOpenDBRequest => {
      const req: Record<string, unknown> = {
        error: new DOMException('IDB unavailable', 'UnknownError'),
      }
      Promise.resolve().then(() => {
        if (typeof req.onerror === 'function') (req.onerror as () => void)()
      })
      return req as unknown as IDBOpenDBRequest
    },
  }
}

// ── In-memory localStorage stub ────────────────────────────────────────────
// Node.js 22+ exposes a built-in `localStorage` global (node:internal/webstorage)
// that lacks Storage methods. We replace it per-test with this implementation.
class MemoryStorage {
  private store: Record<string, string> = {}
  get length(): number { return Object.keys(this.store).length }
  key(n: number): string | null { return Object.keys(this.store)[n] ?? null }
  getItem(key: string): string | null { return key in this.store ? this.store[key] : null }
  setItem(key: string, value: string): void { this.store[String(key)] = String(value) }
  removeItem(key: string): void { delete this.store[key] }
  clear(): void { this.store = {} }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter

  beforeEach(() => {
    // Node.js 22+ has a built-in localStorage stub without Storage methods.
    // Stub with a fresh in-memory implementation for each test.
    vi.stubGlobal('localStorage', new MemoryStorage())
    adapter = new LocalStorageAdapter()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ── AdapterError class ─────────────────────────────────────────────────

  it('AdapterError has code ADAPTER_ERROR and extends Error', () => {
    const err = new AdapterError('something failed')
    expect(err.code).toBe('ADAPTER_ERROR')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AdapterError)
    expect(err.message).toBe('something failed')
    expect(err.name).toBe('AdapterError')
  })

  // ── readAllNodes ────────────────────────────────────────────────────────

  describe('readAllNodes', () => {
    it('returns [] when storage is empty', async () => {
      expect(await adapter.readAllNodes()).toEqual([])
    })

    it('returns all persisted nodes', async () => {
      const n1 = makeNode({ id: 'n1' })
      const n2 = makeNode({ id: 'n2', title: 'HR' })
      localStorage.setItem(NODES_KEY, JSON.stringify([n1, n2]))
      expect(await adapter.readAllNodes()).toEqual([n1, n2])
    })

    it('returns [] when localStorage contains corrupt JSON', async () => {
      localStorage.setItem(NODES_KEY, '{ not valid json }')
      expect(await adapter.readAllNodes()).toEqual([])
    })
  })

  // ── readNodeById ────────────────────────────────────────────────────────

  describe('readNodeById', () => {
    it('returns the matching node', async () => {
      const node = makeNode()
      localStorage.setItem(NODES_KEY, JSON.stringify([node]))
      expect(await adapter.readNodeById('n1')).toEqual(node)
    })

    it('returns null when not found', async () => {
      await adapter.createNode(makeNode({ id: 'n1' }))
      expect(await adapter.readNodeById('missing')).toBeNull()
    })
  })

  // ── createNode ──────────────────────────────────────────────────────────

  describe('createNode', () => {
    it('persists the node and returns a shallow copy', async () => {
      const node = makeNode()
      const result = await adapter.createNode(node)
      expect(result).toEqual(node)
      expect(result).not.toBe(node)
    })

    it('appends to existing nodes', async () => {
      await adapter.createNode(makeNode({ id: 'n1' }))
      await adapter.createNode(makeNode({ id: 'n2', title: 'HR' }))
      const all = await adapter.readAllNodes()
      expect(all).toHaveLength(2)
      expect(all.map((n) => n.id)).toContain('n1')
      expect(all.map((n) => n.id)).toContain('n2')
    })

    it('persists to localStorage under the nodes key', async () => {
      const node = makeNode()
      await adapter.createNode(node)
      const stored = JSON.parse(localStorage.getItem(NODES_KEY)!)
      expect(stored).toHaveLength(1)
      expect(stored[0]).toEqual(node)
    })
  })

  // ── updateNode ──────────────────────────────────────────────────────────

  describe('updateNode', () => {
    it('applies patch fields and returns the updated node', async () => {
      await adapter.createNode(makeNode())
      const updated = await adapter.updateNode('n1', { title: 'Platform', ownerName: 'Bob' })
      expect(updated.title).toBe('Platform')
      expect(updated.ownerName).toBe('Bob')
      expect(updated.id).toBe('n1')
    })

    it('persists the updated fields', async () => {
      await adapter.createNode(makeNode())
      await adapter.updateNode('n1', { title: 'Updated' })
      const fetched = await adapter.readNodeById('n1')
      expect(fetched?.title).toBe('Updated')
    })

    it('does not overwrite unmentioned fields', async () => {
      const node = makeNode()
      await adapter.createNode(node)
      const updated = await adapter.updateNode('n1', { title: 'New Title' })
      expect(updated.ownerName).toBe(node.ownerName)
      expect(updated.roleLevel).toBe(node.roleLevel)
    })

    it('returns a copy, not the stored reference', async () => {
      await adapter.createNode(makeNode())
      const a = await adapter.updateNode('n1', { title: 'A' })
      const b = await adapter.readNodeById('n1')
      expect(a).not.toBe(b)
    })

    it('throws AdapterError when the id is not found', async () => {
      await expect(adapter.updateNode('ghost', { title: 'x' }))
        .rejects.toBeInstanceOf(AdapterError)
    })
  })

  // ── deleteNode ──────────────────────────────────────────────────────────

  describe('deleteNode', () => {
    it('removes the node from storage', async () => {
      await adapter.createNode(makeNode())
      await adapter.deleteNode('n1')
      expect(await adapter.readAllNodes()).toEqual([])
    })

    it('does not remove sibling nodes', async () => {
      await adapter.createNode(makeNode({ id: 'n1' }))
      await adapter.createNode(makeNode({ id: 'n2', title: 'HR' }))
      await adapter.deleteNode('n1')
      const remaining = await adapter.readAllNodes()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('n2')
    })

    it('throws AdapterError when the id is not found', async () => {
      await expect(adapter.deleteNode('ghost')).rejects.toBeInstanceOf(AdapterError)
    })
  })

  // ── readAllGoals ────────────────────────────────────────────────────────

  describe('readAllGoals', () => {
    it('returns [] when storage is empty', async () => {
      expect(await adapter.readAllGoals()).toEqual([])
    })

    it('returns all persisted goals', async () => {
      const g = makeGoal()
      localStorage.setItem(GOALS_KEY, JSON.stringify([g]))
      expect(await adapter.readAllGoals()).toEqual([g])
    })

    it('returns [] when localStorage contains corrupt JSON', async () => {
      localStorage.setItem(GOALS_KEY, 'NOT_JSON')
      expect(await adapter.readAllGoals()).toEqual([])
    })
  })

  // ── readGoalById ────────────────────────────────────────────────────────

  describe('readGoalById', () => {
    it('returns the matching goal', async () => {
      const goal = makeGoal()
      localStorage.setItem(GOALS_KEY, JSON.stringify([goal]))
      expect(await adapter.readGoalById('g1')).toEqual(goal)
    })

    it('returns null when not found', async () => {
      await adapter.createGoal(makeGoal())
      expect(await adapter.readGoalById('missing')).toBeNull()
    })
  })

  // ── createGoal ──────────────────────────────────────────────────────────

  describe('createGoal', () => {
    it('persists the goal and returns a shallow copy', async () => {
      const goal = makeGoal()
      const result = await adapter.createGoal(goal)
      expect(result).toEqual(goal)
      expect(result).not.toBe(goal)
    })

    it('persists to localStorage under the goals key', async () => {
      await adapter.createGoal(makeGoal())
      const stored = JSON.parse(localStorage.getItem(GOALS_KEY)!)
      expect(stored).toHaveLength(1)
    })
  })

  // ── updateGoal ──────────────────────────────────────────────────────────

  describe('updateGoal', () => {
    it('applies patch and returns the updated goal', async () => {
      await adapter.createGoal(makeGoal())
      const updated = await adapter.updateGoal('g1', { progress: 75, status: 'Complete' })
      expect(updated.progress).toBe(75)
      expect(updated.status).toBe('Complete')
    })

    it('persists the updated fields', async () => {
      await adapter.createGoal(makeGoal())
      await adapter.updateGoal('g1', { progress: 50 })
      const fetched = await adapter.readGoalById('g1')
      expect(fetched?.progress).toBe(50)
    })

    it('throws AdapterError when the id is not found', async () => {
      await expect(adapter.updateGoal('ghost', { progress: 0 }))
        .rejects.toBeInstanceOf(AdapterError)
    })
  })

  // ── deleteGoal ──────────────────────────────────────────────────────────

  describe('deleteGoal', () => {
    it('removes the goal from storage', async () => {
      await adapter.createGoal(makeGoal())
      await adapter.deleteGoal('g1')
      expect(await adapter.readAllGoals()).toEqual([])
    })

    it('does not remove sibling goals', async () => {
      await adapter.createGoal(makeGoal({ id: 'g1' }))
      await adapter.createGoal(makeGoal({ id: 'g2', description: 'Cut costs' }))
      await adapter.deleteGoal('g1')
      const remaining = await adapter.readAllGoals()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('g2')
    })

    it('throws AdapterError when the id is not found', async () => {
      await expect(adapter.deleteGoal('ghost')).rejects.toBeInstanceOf(AdapterError)
    })
  })

  // ── Storage key isolation ───────────────────────────────────────────────

  it('nodes and goals are stored under separate localStorage keys', async () => {
    await adapter.createNode(makeNode({ id: 'n1' }))
    await adapter.createGoal(makeGoal({ id: 'g1', nodeId: 'n1' }))
    expect(JSON.parse(localStorage.getItem(NODES_KEY)!)).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(GOALS_KEY)!)).toHaveLength(1)
  })

  it('creating goals does not affect the nodes key', async () => {
    await adapter.createNode(makeNode())
    await adapter.createGoal(makeGoal())
    const nodes = await adapter.readAllNodes()
    expect(nodes).toHaveLength(1)
  })

  // ── IDB fallback ────────────────────────────────────────────────────────

  describe('IDB fallback', () => {
    function spyQuotaError() {
      const err = new DOMException('QuotaExceededError', 'QuotaExceededError')
      vi.spyOn(localStorage as unknown as MemoryStorage, 'setItem').mockImplementation(() => {
        throw err
      })
    }

    it('silently falls back to IDB when setItem throws QuotaExceededError', async () => {
      vi.stubGlobal('indexedDB', makeWorkingIdb())
      spyQuotaError()
      const node = makeNode({ id: 'idb-write-node' })
      await expect(adapter.createNode(node)).resolves.toEqual(node)
    })

    it('can read back data written to IDB when localStorage.getItem also throws', async () => {
      const idb = makeWorkingIdb()
      vi.stubGlobal('indexedDB', idb)

      // Write via IDB fallback path
      spyQuotaError()
      const node = makeNode({ id: 'idb-read-node' })
      await adapter.createNode(node)

      // Restore setItem, break getItem so reads fall back to IDB
      vi.restoreAllMocks()
      vi.spyOn(localStorage as unknown as MemoryStorage, 'getItem').mockImplementation(() => {
        throw new Error('storage unavailable')
      })

      const results = await adapter.readAllNodes()
      expect(results).toEqual([node])
    })

    it('throws AdapterError when IDB also fails after a quota error', async () => {
      vi.stubGlobal('indexedDB', makeFailingIdb())
      spyQuotaError()
      await expect(adapter.createNode(makeNode())).rejects.toBeInstanceOf(AdapterError)
    })

    it('throws AdapterError when setItem throws a non-quota error', async () => {
      vi.spyOn(localStorage as unknown as MemoryStorage, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError — not a quota error')
      })
      await expect(adapter.createNode(makeNode())).rejects.toBeInstanceOf(AdapterError)
    })

    it('returns [] gracefully when both localStorage and IDB fail on reads', async () => {
      vi.stubGlobal('indexedDB', makeFailingIdb())
      vi.spyOn(localStorage as unknown as MemoryStorage, 'getItem').mockImplementation(() => {
        throw new Error('storage unavailable')
      })
      expect(await adapter.readAllNodes()).toEqual([])
    })
  })
})


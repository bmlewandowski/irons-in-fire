import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ApiAdapter } from './ApiAdapter'
import { AdapterError } from './PersistenceAdapter'
import type { OrgNode } from '@/models/OrgNode'
import type { Goal } from '@/models/Goal'

const BASE = 'https://api.test'

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

// ── Response helpers ───────────────────────────────────────────────────────

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
  } as Response
}

function makeDeleteResponse(): Response {
  return {
    ok: true,
    status: 204,
    statusText: 'No Content',
    json: () => Promise.resolve(null),
  } as Response
}

function makeNetworkError(message = 'Failed to fetch'): Promise<never> {
  return Promise.reject(new Error(message))
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('ApiAdapter', () => {
  let adapter: ApiAdapter
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    adapter = new ApiAdapter(BASE)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Nodes — readAllNodes ────────────────────────────────────────────────

  describe('readAllNodes', () => {
    it('returns the deserialized array from the response', async () => {
      const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2', title: 'HR' })]
      fetchMock.mockResolvedValueOnce(makeResponse(nodes))
      expect(await adapter.readAllNodes()).toEqual(nodes)
    })

    it('sends a GET request to {baseUrl}/nodes', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse([]))
      await adapter.readAllNodes()
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/nodes`,
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('returns [] when the server response body is null', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null))
      expect(await adapter.readAllNodes()).toEqual([])
    })
  })

  // ── Nodes — readNodeById ────────────────────────────────────────────────

  describe('readNodeById', () => {
    it('returns the node from the response', async () => {
      const node = makeNode()
      fetchMock.mockResolvedValueOnce(makeResponse(node))
      expect(await adapter.readNodeById('n1')).toEqual(node)
    })

    it('sends a GET request to {baseUrl}/nodes/{id}', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(makeNode()))
      await adapter.readNodeById('n1')
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/nodes/n1`,
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('returns null on a 404 response', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null, 404))
      expect(await adapter.readNodeById('missing')).toBeNull()
    })
  })

  // ── Nodes — createNode ──────────────────────────────────────────────────

  describe('createNode', () => {
    it('returns the node from the response', async () => {
      const node = makeNode()
      fetchMock.mockResolvedValueOnce(makeResponse(node))
      expect(await adapter.createNode(node)).toEqual(node)
    })

    it('sends a POST request to {baseUrl}/nodes', async () => {
      const node = makeNode()
      fetchMock.mockResolvedValueOnce(makeResponse(node))
      await adapter.createNode(node)
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/nodes`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(node),
        }),
      )
    })

    it('throws AdapterError when the server returns a null body', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null))
      await expect(adapter.createNode(makeNode())).rejects.toBeInstanceOf(AdapterError)
    })
  })

  // ── Nodes — updateNode ──────────────────────────────────────────────────

  describe('updateNode', () => {
    it('returns the updated node from the response', async () => {
      const node = makeNode({ title: 'Updated' })
      fetchMock.mockResolvedValueOnce(makeResponse(node))
      expect(await adapter.updateNode('n1', { title: 'Updated' })).toEqual(node)
    })

    it('sends a PATCH request to {baseUrl}/nodes/{id}', async () => {
      const patch = { title: 'New Title' }
      fetchMock.mockResolvedValueOnce(makeResponse(makeNode(patch)))
      await adapter.updateNode('n1', patch)
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/nodes/n1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
      )
    })

    it('throws AdapterError when the server returns a null body', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null))
      await expect(adapter.updateNode('n1', { title: 'x' })).rejects.toBeInstanceOf(AdapterError)
    })
  })

  // ── Nodes — deleteNode ──────────────────────────────────────────────────

  describe('deleteNode', () => {
    it('resolves without a value on a 204 response', async () => {
      fetchMock.mockResolvedValueOnce(makeDeleteResponse())
      await expect(adapter.deleteNode('n1')).resolves.toBeUndefined()
    })

    it('sends a DELETE request to {baseUrl}/nodes/{id}', async () => {
      fetchMock.mockResolvedValueOnce(makeDeleteResponse())
      await adapter.deleteNode('n1')
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/nodes/n1`,
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  // ── Goals — readAllGoals ────────────────────────────────────────────────

  describe('readAllGoals', () => {
    it('returns the deserialized array from the response', async () => {
      const goals = [makeGoal()]
      fetchMock.mockResolvedValueOnce(makeResponse(goals))
      expect(await adapter.readAllGoals()).toEqual(goals)
    })

    it('sends a GET request to {baseUrl}/goals', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse([]))
      await adapter.readAllGoals()
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/goals`,
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('returns [] when the server response body is null', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null))
      expect(await adapter.readAllGoals()).toEqual([])
    })
  })

  // ── Goals — readGoalById ────────────────────────────────────────────────

  describe('readGoalById', () => {
    it('returns the goal from the response', async () => {
      const goal = makeGoal()
      fetchMock.mockResolvedValueOnce(makeResponse(goal))
      expect(await adapter.readGoalById('g1')).toEqual(goal)
    })

    it('returns null on a 404 response', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null, 404))
      expect(await adapter.readGoalById('missing')).toBeNull()
    })
  })

  // ── Goals — createGoal ──────────────────────────────────────────────────

  describe('createGoal', () => {
    it('returns the goal from the response', async () => {
      const goal = makeGoal()
      fetchMock.mockResolvedValueOnce(makeResponse(goal))
      expect(await adapter.createGoal(goal)).toEqual(goal)
    })

    it('sends a POST request to {baseUrl}/goals', async () => {
      const goal = makeGoal()
      fetchMock.mockResolvedValueOnce(makeResponse(goal))
      await adapter.createGoal(goal)
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/goals`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(goal),
        }),
      )
    })

    it('throws AdapterError when the server returns a null body', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null))
      await expect(adapter.createGoal(makeGoal())).rejects.toBeInstanceOf(AdapterError)
    })
  })

  // ── Goals — updateGoal ──────────────────────────────────────────────────

  describe('updateGoal', () => {
    it('returns the updated goal from the response', async () => {
      const goal = makeGoal({ progress: 50 })
      fetchMock.mockResolvedValueOnce(makeResponse(goal))
      expect(await adapter.updateGoal('g1', { progress: 50 })).toEqual(goal)
    })

    it('sends a PATCH request to {baseUrl}/goals/{id}', async () => {
      const patch = { progress: 100 }
      fetchMock.mockResolvedValueOnce(makeResponse(makeGoal(patch)))
      await adapter.updateGoal('g1', patch)
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/goals/g1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
      )
    })

    it('throws AdapterError when the server returns a null body', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null))
      await expect(adapter.updateGoal('g1', { progress: 0 })).rejects.toBeInstanceOf(AdapterError)
    })
  })

  // ── Goals — deleteGoal ──────────────────────────────────────────────────

  describe('deleteGoal', () => {
    it('resolves without a value on a 204 response', async () => {
      fetchMock.mockResolvedValueOnce(makeDeleteResponse())
      await expect(adapter.deleteGoal('g1')).resolves.toBeUndefined()
    })

    it('sends a DELETE request to {baseUrl}/goals/{id}', async () => {
      fetchMock.mockResolvedValueOnce(makeDeleteResponse())
      await adapter.deleteGoal('g1')
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/goals/g1`,
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  // ── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws AdapterError on a network failure (fetch rejects)', async () => {
      fetchMock.mockImplementationOnce(() => makeNetworkError('Failed to fetch'))
      await expect(adapter.readAllNodes()).rejects.toBeInstanceOf(AdapterError)
    })

    it('wraps the network error message in AdapterError', async () => {
      fetchMock.mockImplementationOnce(() => makeNetworkError('Connection refused'))
      const err = await adapter.readAllNodes().catch((e) => e)
      expect(err).toBeInstanceOf(AdapterError)
      expect(err.message).toContain('Connection refused')
    })

    it('throws AdapterError on a 500 response', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ error: 'Internal error' }, 500))
      await expect(adapter.readAllNodes()).rejects.toBeInstanceOf(AdapterError)
    })

    it('includes the HTTP status in the AdapterError message for non-2xx responses', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({}, 503))
      const err = await adapter.readAllNodes().catch((e) => e)
      expect(err).toBeInstanceOf(AdapterError)
      expect(err.message).toContain('503')
    })

    it('throws AdapterError on a 403 response', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ error: 'Forbidden' }, 403))
      await expect(adapter.createNode(makeNode())).rejects.toBeInstanceOf(AdapterError)
    })

    it('throws AdapterError when the response body is not valid JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: '200',
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as Response)
      await expect(adapter.readAllNodes()).rejects.toBeInstanceOf(AdapterError)
    })

    it('does not throw on a non-2xx 404 when allowNull is true (readNodeById)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null, 404))
      await expect(adapter.readNodeById('any')).resolves.toBeNull()
    })

    it('does not throw on a non-2xx 404 when allowNull is true (readGoalById)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(null, 404))
      await expect(adapter.readGoalById('any')).resolves.toBeNull()
    })
  })
})

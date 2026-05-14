import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNodeStore } from './nodeStore'
import type { OrgNode } from '@/models'

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

describe('nodeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no nodes', () => {
    expect(Object.keys(useNodeStore().nodes)).toHaveLength(0)
  })
  it('selectedNodeId starts as null', () => {
    expect(useNodeStore().selectedNodeId).toBeNull()
  })
  it('selectNode updates selectedNodeId', () => {
    const store = useNodeStore()
    store.selectNode('n1')
    expect(store.selectedNodeId).toBe('n1')
  })
  it('selectNode accepts null to deselect', () => {
    const store = useNodeStore()
    store.selectNode('n1')
    store.selectNode(null)
    expect(store.selectedNodeId).toBeNull()
  })

  // ── rootNodes ────────────────────────────────────────────────────────────

  describe('rootNodes', () => {
    it('returns [] when there are no nodes', () => {
      expect(useNodeStore().rootNodes).toEqual([])
    })
    it('returns nodes with null parentId', () => {
      const store = useNodeStore()
      const root = makeNode({ id: 'r1', parentId: null })
      const child = makeNode({ id: 'c1', parentId: 'r1' })
      store.$patch({ nodes: { r1: root, c1: child } })
      expect(store.rootNodes).toEqual([root])
    })
    it('returns multiple root nodes', () => {
      const store = useNodeStore()
      store.$patch({
        nodes: {
          r1: makeNode({ id: 'r1', parentId: null }),
          r2: makeNode({ id: 'r2', parentId: null, title: 'Sales' }),
        },
      })
      expect(store.rootNodes).toHaveLength(2)
    })
    it('updates reactively when a node is added', () => {
      const store = useNodeStore()
      expect(store.rootNodes).toHaveLength(0)
      store.$patch({ nodes: { r1: makeNode({ id: 'r1' }) } })
      expect(store.rootNodes).toHaveLength(1)
    })
  })

  // ── childrenOf ───────────────────────────────────────────────────────────

  describe('childrenOf', () => {
    it('returns [] when the node has no children', () => {
      const store = useNodeStore()
      store.$patch({ nodes: { r1: makeNode({ id: 'r1' }) } })
      expect(store.childrenOf('r1')).toEqual([])
    })
    it('returns [] for an unknown nodeId', () => {
      expect(useNodeStore().childrenOf('ghost')).toEqual([])
    })
    it('returns only direct children, not grandchildren', () => {
      const store = useNodeStore()
      const root = makeNode({ id: 'r1' })
      const child = makeNode({ id: 'c1', parentId: 'r1' })
      const grandchild = makeNode({ id: 'g1', parentId: 'c1' })
      store.$patch({ nodes: { r1: root, c1: child, g1: grandchild } })
      expect(store.childrenOf('r1')).toEqual([child])
    })
    it('returns multiple children', () => {
      const store = useNodeStore()
      const root = makeNode({ id: 'r1' })
      const c1 = makeNode({ id: 'c1', parentId: 'r1' })
      const c2 = makeNode({ id: 'c2', parentId: 'r1', title: 'HR' })
      store.$patch({ nodes: { r1: root, c1, c2 } })
      expect(store.childrenOf('r1')).toHaveLength(2)
    })
  })

  // ── subtreeOf ────────────────────────────────────────────────────────────

  describe('subtreeOf', () => {
    it('returns [] for an unknown nodeId', () => {
      expect(useNodeStore().subtreeOf('ghost')).toEqual([])
    })
    it('returns just the node itself when it has no children', () => {
      const store = useNodeStore()
      const n = makeNode({ id: 'n1' })
      store.$patch({ nodes: { n1: n } })
      expect(store.subtreeOf('n1')).toEqual([n])
    })
    it('includes the node and all descendants', () => {
      const store = useNodeStore()
      const root = makeNode({ id: 'r1' })
      const child = makeNode({ id: 'c1', parentId: 'r1' })
      const grandchild = makeNode({ id: 'g1', parentId: 'c1' })
      store.$patch({ nodes: { r1: root, c1: child, g1: grandchild } })
      const ids = store.subtreeOf('r1').map((n) => n.id)
      expect(ids).toContain('r1')
      expect(ids).toContain('c1')
      expect(ids).toContain('g1')
      expect(ids).toHaveLength(3)
    })
    it('does not include nodes outside the subtree', () => {
      const store = useNodeStore()
      const r1 = makeNode({ id: 'r1' })
      const r2 = makeNode({ id: 'r2', title: 'Sales' })
      const c1 = makeNode({ id: 'c1', parentId: 'r1' })
      store.$patch({ nodes: { r1, r2, c1 } })
      const ids = store.subtreeOf('r1').map((n) => n.id)
      expect(ids).not.toContain('r2')
    })
    it('handles a deep chain of descendants', () => {
      const store = useNodeStore()
      store.$patch({
        nodes: {
          a: makeNode({ id: 'a' }),
          b: makeNode({ id: 'b', parentId: 'a' }),
          c: makeNode({ id: 'c', parentId: 'b' }),
          d: makeNode({ id: 'd', parentId: 'c' }),
        },
      })
      expect(store.subtreeOf('a')).toHaveLength(4)
    })
  })
})

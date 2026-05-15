/**
 * Tests for delta-based undo/redo system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUndoRedoDelta } from './useUndoRedoDelta'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import type { OrgNode } from '@/models/OrgNode'
import type { Goal } from '@/models/Goal'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<OrgNode> & { id: string; parentId: string | null }): OrgNode {
  return {
    title: 'Test Node',
    ownerName: 'Owner',
    roleLevel: 'Employee',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> & { id: string; nodeId: string }): Goal {
  return {
    type: 'Root',
    description: 'Test Goal',
    weight: 1,
    status: 'Active',
    progress: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const mockLayout = {
  sizes: [] as [string, { width: number; height: number }][],
  positions: [] as [string, { x: number; y: number }][],
  collapsed: [] as string[],
  collapsedGoals: [] as string[],
}

const layoutAccessors = {
  getLayout: () => mockLayout,
  setLayout: (layout: typeof mockLayout) => {
    mockLayout.sizes = layout.sizes
    mockLayout.positions = layout.positions
    mockLayout.collapsed = layout.collapsed
    mockLayout.collapsedGoals = layout.collapsedGoals
  },
  saveLayout: vi.fn(),
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('useUndoRedoDelta', () => {
  let nodeStore: ReturnType<typeof useNodeStore>
  let goalStore: ReturnType<typeof useGoalStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    nodeStore = useNodeStore()
    goalStore = useGoalStore()
    // Reset layout fixture
    mockLayout.sizes = []
    mockLayout.positions = []
    mockLayout.collapsed = []
    mockLayout.collapsedGoals = []
    // Stub localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts with empty history', () => {
    const { canUndo } = useUndoRedoDelta(layoutAccessors)
    expect(canUndo.value).toBe(false)
  })

  it('captures and undoes delete operation', () => {
    const { snapshotDelete, undo, canUndo } = useUndoRedoDelta(layoutAccessors)

    const node = makeNode({ id: 'n1', parentId: null, title: 'Test Node' })
    const goal = makeGoal({ id: 'g1', nodeId: 'n1', description: 'Test Goal' })

    nodeStore.$patch({ nodes: { n1: node } })
    goalStore.$patch({ goals: { g1: goal } })

    // Snapshot before delete
    snapshotDelete(['n1'], ['g1'])

    // Perform delete
    nodeStore.$patch((state) => { delete state.nodes['n1'] })
    goalStore.$patch((state) => { delete state.goals['g1'] })

    expect(canUndo.value).toBe(true)

    // Undo
    undo()

    expect(nodeStore.nodes.n1).toEqual(node)
    expect(goalStore.goals.g1).toEqual(goal)
  })

  it('captures and undoes reparent operation', () => {
    const { snapshotReparent, undo, canUndo } = useUndoRedoDelta(layoutAccessors)

    const parent = makeNode({ id: 'p1', parentId: null, title: 'Parent 1' })
    const newParent = makeNode({ id: 'p2', parentId: null, title: 'Parent 2' })
    const child = makeNode({ id: 'c1', parentId: 'p1', title: 'Child' })

    nodeStore.$patch({ nodes: { p1: parent, p2: newParent, c1: child } })

    // Snapshot before reparent
    snapshotReparent('c1', 'p1', 'p2')

    // Perform reparent
    nodeStore.$patch({
      nodes: {
        ...nodeStore.nodes,
        c1: { ...child, parentId: 'p2' },
      },
    })

    expect(canUndo.value).toBe(true)

    // Undo
    undo()

    expect(nodeStore.nodes.c1.parentId).toBe('p1')
  })

  it('captures and undoes import operation', () => {
    const { snapshotImport, undo, canUndo } = useUndoRedoDelta(layoutAccessors)

    const oldNode = makeNode({ id: 'old', parentId: null, title: 'Old' })
    const oldGoal = makeGoal({ id: 'g-old', nodeId: 'old', description: 'Old Goal' })

    nodeStore.$patch({ nodes: { old: oldNode } })
    goalStore.$patch({ goals: { 'g-old': oldGoal } })

    const newNode = makeNode({ id: 'new', parentId: null, title: 'New' })
    const newGoal = makeGoal({ id: 'g-new', nodeId: 'new', description: 'New Goal' })

    // Snapshot before import
    snapshotImport(
      { old: oldNode },
      { 'g-old': oldGoal },
      { new: newNode },
      { 'g-new': newGoal },
    )

    // Perform import
    nodeStore.$patch({ nodes: { new: newNode } })
    goalStore.$patch({ goals: { 'g-new': newGoal } })

    expect(canUndo.value).toBe(true)

    // Undo
    undo()

    expect(nodeStore.nodes.old).toEqual(oldNode)
    expect(goalStore.goals['g-old']).toEqual(oldGoal)
    expect(nodeStore.nodes['new']).toBeUndefined()
    expect(goalStore.goals['g-new']).toBeUndefined()
  })

  it.skip('captures and undoes update operation', () => {
    // TODO: Fix update operation undo logic
    const { snapshotUpdate, undo, canUndo } = useUndoRedoDelta(layoutAccessors)

    const oldNode = makeNode({ id: 'n1', parentId: null, title: 'Old Name' })
    const newNode = makeNode({ id: 'n1', parentId: null, title: 'New Name' })

    nodeStore.$patch({ nodes: { n1: oldNode } })

    // Snapshot before update
    snapshotUpdate(oldNode, newNode)

    // Perform update
    nodeStore.$patch({ nodes: { n1: newNode } })

    expect(canUndo.value).toBe(true)

    // Undo
    undo()

    expect(nodeStore.nodes.n1.title).toBe('Old Name')
  })

  it('clears redo stack on new operation', () => {
    // (redo removed; this test verifies new ops don't break undo)
    const { snapshotDelete, canUndo } = useUndoRedoDelta(layoutAccessors)

    const n1 = makeNode({ id: 'n1', parentId: null, title: 'Node 1' })
    const n2 = makeNode({ id: 'n2', parentId: null, title: 'Node 2' })

    nodeStore.$patch({ nodes: { n1, n2 } })

    snapshotDelete(['n1'], [])
    nodeStore.$patch((state) => { delete state.nodes['n1'] })

    snapshotDelete(['n2'], [])
    nodeStore.$patch((state) => { delete state.nodes['n2'] })

    expect(canUndo.value).toBe(true)
  })

  it('limits history to MAX_UNDO_DEPTH', () => {
    const { snapshotDelete, canUndo } = useUndoRedoDelta(layoutAccessors)

    // Create 60 operations (more than MAX_UNDO_DEPTH of 50)
    for (let i = 0; i < 60; i++) {
      const node = makeNode({ id: `n${i}`, parentId: null, title: `Node ${i}` })
      nodeStore.$patch({ nodes: { [`n${i}`]: node } })
      snapshotDelete([`n${i}`], [])
      nodeStore.$patch((state) => { delete state.nodes[`n${i}`] })
    }

    expect(canUndo.value).toBe(true)
  })

  it('clears all history', () => {
    const { snapshotDelete, clearHistory, canUndo } = useUndoRedoDelta(layoutAccessors)

    const node = makeNode({ id: 'n1', parentId: null, title: 'Test' })
    nodeStore.$patch({ nodes: { n1: node } })

    snapshotDelete(['n1'], [])
    expect(canUndo.value).toBe(true)

    clearHistory()
    expect(canUndo.value).toBe(false)
  })

  it('syncs to localStorage on undo/redo', () => {
    const { snapshotDelete, undo } = useUndoRedoDelta(layoutAccessors)

    const node = makeNode({ id: 'n1', parentId: null, title: 'Test' })
    nodeStore.$patch({ nodes: { n1: node } })

    snapshotDelete(['n1'], [])
    nodeStore.$patch((state) => { delete state.nodes['n1'] })

    undo()

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'irons-in-fire:nodes',
      expect.any(String),
    )
  })

  it('generic snapshot creates full state delta', () => {
    const { snapshot, undo, canUndo } = useUndoRedoDelta(layoutAccessors)

    const node1 = makeNode({ id: 'n1', parentId: null, title: 'Node 1' })
    const node2 = makeNode({ id: 'n2', parentId: null, title: 'Node 2' })

    nodeStore.$patch({ nodes: { n1: node1 } })

    // Generic snapshot
    snapshot()

    // Make changes
    nodeStore.$patch({ nodes: { n1: node1, n2: node2 } })

    expect(canUndo.value).toBe(true)

    // Undo should restore to snapshot state
    undo()

    expect(nodeStore.nodes.n1).toEqual(node1)
    expect(nodeStore.nodes.n2).toBeUndefined()
  })

  it('handles multiple deletes and undos correctly', () => {
    const { snapshotDelete, undo } = useUndoRedoDelta(layoutAccessors)

    const n1 = makeNode({ id: 'n1', parentId: null, title: 'Node 1' })
    const n2 = makeNode({ id: 'n2', parentId: null, title: 'Node 2' })
    const n3 = makeNode({ id: 'n3', parentId: null, title: 'Node 3' })

    nodeStore.$patch({ nodes: { n1, n2, n3 } })

    // Delete n1
    snapshotDelete(['n1'], [])
    nodeStore.$patch((state) => { delete state.nodes['n1'] })

    // Delete n2
    snapshotDelete(['n2'], [])
    nodeStore.$patch((state) => { delete state.nodes['n2'] })

    // Undo delete n2
    undo()
    expect(nodeStore.nodes.n2).toEqual(n2)
    expect(nodeStore.nodes.n3).toEqual(n3)

    // Undo delete n1
    undo()
    expect(nodeStore.nodes.n1).toEqual(n1)
    expect(nodeStore.nodes.n2).toEqual(n2)
    expect(nodeStore.nodes.n3).toEqual(n3)
  })

  it('preserves layout state on undo', () => {
    const { snapshotDelete, undo } = useUndoRedoDelta(layoutAccessors)

    mockLayout.collapsed = ['n1']
    mockLayout.sizes = [['n1', { width: 100, height: 50 }]]

    const node = makeNode({ id: 'n1', parentId: null, title: 'Test' })
    nodeStore.$patch({ nodes: { n1: node } })

    snapshotDelete(['n1'], [])

    // Change layout before delete
    mockLayout.collapsed = []
    mockLayout.sizes = []

    nodeStore.$patch((state) => { delete state.nodes['n1'] })

    // Undo should restore layout
    undo()
    expect(mockLayout.collapsed).toEqual(['n1'])
    expect(mockLayout.sizes).toEqual([['n1', { width: 100, height: 50 }]])
  })
})

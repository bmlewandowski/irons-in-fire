import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDashboardStore } from './dashboardStore'
import { useGoalStore } from './goalStore'
import { useNodeStore } from './nodeStore'
import type { Goal } from '@/models'
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

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    nodeId: 'n1',
    type: 'Root',
    description: 'Increase revenue',
    weight: 1,
    status: 'Active',
    progress: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('dashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── rootGoals ────────────────────────────────────────────────────────────

  describe('rootGoals', () => {
    it('returns [] when there are no goals', () => {
      expect(useDashboardStore().rootGoals).toEqual([])
    })
    it('returns Root goals owned by root nodes', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      const dashStore = useDashboardStore()
      nodeStore.$patch({ nodes: { r1: makeNode({ id: 'r1', parentId: null }) } })
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'r1', type: 'Root' }) } })
      expect(dashStore.rootGoals).toHaveLength(1)
      expect(dashStore.rootGoals[0].id).toBe('g1')
    })
    it('excludes Refined goals on root nodes', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      nodeStore.$patch({ nodes: { r1: makeNode({ id: 'r1', parentId: null }) } })
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'r1', type: 'Refined' }) } })
      expect(useDashboardStore().rootGoals).toEqual([])
    })
    it('excludes Sub_Task goals on root nodes', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      nodeStore.$patch({ nodes: { r1: makeNode({ id: 'r1', parentId: null }) } })
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'r1', type: 'Sub_Task' }) } })
      expect(useDashboardStore().rootGoals).toEqual([])
    })
    it('excludes Root goals owned by child nodes', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      nodeStore.$patch({
        nodes: {
          r1: makeNode({ id: 'r1', parentId: null }),
          c1: makeNode({ id: 'c1', parentId: 'r1' }),
        },
      })
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'c1', type: 'Root' }) } })
      expect(useDashboardStore().rootGoals).toEqual([])
    })
    it('excludes goals whose owning node does not exist in the store', () => {
      const goalStore = useGoalStore()
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'missing', type: 'Root' }) } })
      expect(useDashboardStore().rootGoals).toEqual([])
    })
    it('reacts to store changes reactively', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      const dashStore = useDashboardStore()
      expect(dashStore.rootGoals).toHaveLength(0)
      nodeStore.$patch({ nodes: { r1: makeNode({ id: 'r1', parentId: null }) } })
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'r1' }) } })
      expect(dashStore.rootGoals).toHaveLength(1)
    })
  })

  // ── goalsForScope ────────────────────────────────────────────────────────

  describe('goalsForScope', () => {
    it('delegates to rootGoals when nodeId is null', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      const dashStore = useDashboardStore()
      nodeStore.$patch({ nodes: { r1: makeNode({ id: 'r1', parentId: null }) } })
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'r1' }) } })
      expect(dashStore.goalsForScope(null)).toEqual(dashStore.rootGoals)
    })
    it('returns Root goals in the subtree of nodeId', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      const dashStore = useDashboardStore()
      const r1 = makeNode({ id: 'r1', parentId: null })
      const c1 = makeNode({ id: 'c1', parentId: 'r1' })
      const r2 = makeNode({ id: 'r2', parentId: null, title: 'Sales' })
      const g_c1 = makeGoal({ id: 'g1', nodeId: 'c1', type: 'Root' })
      const g_r2 = makeGoal({ id: 'g2', nodeId: 'r2', type: 'Root' })
      nodeStore.$patch({ nodes: { r1, c1, r2 } })
      goalStore.$patch({ goals: { g1: g_c1, g2: g_r2 } })
      const scope = dashStore.goalsForScope('r1')
      expect(scope).toHaveLength(1)
      expect(scope[0].id).toBe('g1')
    })
    it('returns [] for a scope that has no Root goals', () => {
      const nodeStore = useNodeStore()
      const dashStore = useDashboardStore()
      nodeStore.$patch({ nodes: { r1: makeNode({ id: 'r1' }) } })
      expect(dashStore.goalsForScope('r1')).toEqual([])
    })
    it('excludes non-Root goals from the scope', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      const dashStore = useDashboardStore()
      nodeStore.$patch({ nodes: { r1: makeNode({ id: 'r1' }) } })
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'r1', type: 'Refined' }) } })
      expect(dashStore.goalsForScope('r1')).toEqual([])
    })
    it('includes goals from deep descendants', () => {
      const nodeStore = useNodeStore()
      const goalStore = useGoalStore()
      const dashStore = useDashboardStore()
      const r1 = makeNode({ id: 'r1' })
      const c1 = makeNode({ id: 'c1', parentId: 'r1' })
      const gc1 = makeNode({ id: 'gc1', parentId: 'c1' })
      nodeStore.$patch({ nodes: { r1, c1, gc1 } })
      goalStore.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'gc1', type: 'Root' }) } })
      expect(dashStore.goalsForScope('r1')).toHaveLength(1)
    })
  })
})

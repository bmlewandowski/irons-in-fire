import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGoalStore } from './goalStore'
import type { Goal } from '@/models'

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

describe('goalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no goals', () => {
    const store = useGoalStore()
    expect(Object.keys(store.goals)).toHaveLength(0)
  })

  // ── goalsForNode ─────────────────────────────────────────────────────────

  describe('goalsForNode', () => {
    it('returns [] when no goals exist', () => {
      expect(useGoalStore().goalsForNode('n1')).toEqual([])
    })
    it('returns [] for a node with no goals', () => {
      const store = useGoalStore()
      store.$patch({ goals: { g1: makeGoal({ id: 'g1', nodeId: 'n2' }) } })
      expect(store.goalsForNode('n1')).toEqual([])
    })
    it('returns only goals for the given node', () => {
      const store = useGoalStore()
      const g1 = makeGoal({ id: 'g1', nodeId: 'n1' })
      const g2 = makeGoal({ id: 'g2', nodeId: 'n2' })
      store.$patch({ goals: { g1, g2 } })
      expect(store.goalsForNode('n1')).toEqual([g1])
    })
    it('returns multiple goals for the same node', () => {
      const store = useGoalStore()
      const g1 = makeGoal({ id: 'g1', nodeId: 'n1' })
      const g2 = makeGoal({ id: 'g2', nodeId: 'n1', description: 'Cut costs' })
      store.$patch({ goals: { g1, g2 } })
      expect(store.goalsForNode('n1')).toHaveLength(2)
    })
  })

  // ── goalById ─────────────────────────────────────────────────────────────

  describe('goalById', () => {
    it('returns undefined when not found', () => {
      expect(useGoalStore().goalById('missing')).toBeUndefined()
    })
    it('returns the matching goal', () => {
      const store = useGoalStore()
      const g = makeGoal({ id: 'g1' })
      store.$patch({ goals: { g1: g } })
      expect(store.goalById('g1')).toEqual(g)
    })
    it('returns undefined after the goal is removed', () => {
      const store = useGoalStore()
      store.$patch({ goals: { g1: makeGoal({ id: 'g1' }) } })
      store.$patch((state) => { delete state.goals['g1'] })
      expect(store.goalById('g1')).toBeUndefined()
    })
  })
})

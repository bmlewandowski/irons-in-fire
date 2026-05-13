import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ProgressService } from './ProgressService'
import { useGoalStore } from '@/stores/goalStore'
import type { Goal } from '@/models/Goal'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g-1',
    nodeId: 'n-1',
    type: 'Root',
    description: 'Test goal',
    weight: 1,
    status: 'Active',
    progress: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeWeightedAverage — Req 5.2, 5.7, 5.8, 10.2
// ---------------------------------------------------------------------------

describe('ProgressService.computeWeightedAverage', () => {
  let service: ProgressService

  beforeEach(() => {
    setActivePinia(createPinia())
    service = new ProgressService(useGoalStore())
  })

  it('returns 0 for an empty array (Req 5.7)', () => {
    expect(service.computeWeightedAverage([])).toBe(0)
  })

  it('returns the goal progress when there is a single child (weight 1)', () => {
    expect(service.computeWeightedAverage([makeGoal({ progress: 60 })])).toBe(60)
  })

  it('returns the goal progress when there is a single child (weight > 1)', () => {
    expect(service.computeWeightedAverage([makeGoal({ weight: 5, progress: 40 })])).toBe(40)
  })

  it('computes simple average for two equal-weight children', () => {
    const children = [
      makeGoal({ id: 'g-1', weight: 1, progress: 0 }),
      makeGoal({ id: 'g-2', weight: 1, progress: 100 }),
    ]
    expect(service.computeWeightedAverage(children)).toBe(50)
  })

  it('weights heavier children more (Req 5.2)', () => {
    const children = [
      makeGoal({ id: 'g-1', weight: 3, progress: 100 }),
      makeGoal({ id: 'g-2', weight: 1, progress: 0 }),
    ]
    // (3×100 + 1×0) / (3+1) = 75
    expect(service.computeWeightedAverage(children)).toBe(75)
  })

  it('returns 0 when all children have weight 0 (Req 5.7)', () => {
    const children = [
      makeGoal({ id: 'g-1', weight: 0, progress: 100 }),
      makeGoal({ id: 'g-2', weight: 0, progress: 50 }),
    ]
    expect(service.computeWeightedAverage(children)).toBe(0)
  })

  it('treats NaN weight as 0 (Req 5.8)', () => {
    const children = [
      makeGoal({ id: 'g-1', weight: NaN, progress: 100 }),
      makeGoal({ id: 'g-2', weight: 2, progress: 50 }),
    ]
    // NaN → 0; only g-2 contributes: (0×100 + 2×50) / 2 = 50
    expect(service.computeWeightedAverage(children)).toBe(50)
  })

  it('treats Infinity weight as 0 (Req 5.8)', () => {
    const children = [
      makeGoal({ id: 'g-1', weight: Infinity, progress: 100 }),
      makeGoal({ id: 'g-2', weight: 2, progress: 50 }),
    ]
    // Infinity → 0; only g-2 contributes: (0×100 + 2×50) / 2 = 50
    expect(service.computeWeightedAverage(children)).toBe(50)
  })

  it('treats -Infinity weight as 0 (Req 5.8)', () => {
    const children = [
      makeGoal({ id: 'g-1', weight: -Infinity, progress: 60 }),
      makeGoal({ id: 'g-2', weight: 1, progress: 0 }),
    ]
    expect(service.computeWeightedAverage(children)).toBe(0)
  })

  it('clamps result above 100 to 100 (Req 10.2)', () => {
    expect(service.computeWeightedAverage([makeGoal({ progress: 150, weight: 1 })])).toBe(100)
  })

  it('clamps result below 0 to 0 (Req 10.2)', () => {
    expect(service.computeWeightedAverage([makeGoal({ progress: -10, weight: 1 })])).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// rollUp — Req 5.1, 5.3, 5.4, 5.6
// ---------------------------------------------------------------------------

describe('ProgressService.rollUp', () => {
  let goalStore: ReturnType<typeof useGoalStore>
  let service: ProgressService

  beforeEach(() => {
    setActivePinia(createPinia())
    goalStore = useGoalStore()
    service = new ProgressService(goalStore)
  })

  it('does not modify a goal that has no sourceGoalId', () => {
    goalStore.$patch((s) => {
      s.goals['root-g'] = makeGoal({ id: 'root-g', progress: 30 })
    })
    service.rollUp('root-g')
    expect(goalStore.goals['root-g'].progress).toBe(30)
  })

  it('does not crash for a non-existent goalId', () => {
    expect(() => service.rollUp('nonexistent')).not.toThrow()
  })

  it('updates parent progress with a single child (Req 5.1)', () => {
    goalStore.$patch((s) => {
      s.goals['parent-g'] = makeGoal({ id: 'parent-g', progress: 0 })
      s.goals['child-g'] = makeGoal({
        id: 'child-g',
        sourceGoalId: 'parent-g',
        progress: 80,
        weight: 1,
      })
    })
    service.rollUp('child-g')
    expect(goalStore.goals['parent-g'].progress).toBe(80)
  })

  it('averages multiple children when rolling up (Req 5.2)', () => {
    goalStore.$patch((s) => {
      s.goals['parent-g'] = makeGoal({ id: 'parent-g', progress: 0 })
      s.goals['child-1'] = makeGoal({
        id: 'child-1',
        sourceGoalId: 'parent-g',
        progress: 100,
        weight: 1,
      })
      s.goals['child-2'] = makeGoal({
        id: 'child-2',
        sourceGoalId: 'parent-g',
        progress: 0,
        weight: 1,
      })
    })
    service.rollUp('child-1')
    expect(goalStore.goals['parent-g'].progress).toBe(50)
  })

  it('walks up a two-level chain (Req 5.4)', () => {
    goalStore.$patch((s) => {
      s.goals['grandparent-g'] = makeGoal({ id: 'grandparent-g', progress: 0 })
      s.goals['parent-g'] = makeGoal({
        id: 'parent-g',
        sourceGoalId: 'grandparent-g',
        progress: 0,
        weight: 1,
      })
      s.goals['child-g'] = makeGoal({
        id: 'child-g',
        sourceGoalId: 'parent-g',
        progress: 60,
        weight: 1,
      })
    })
    service.rollUp('child-g')
    // parent-g is the only child of grandparent-g, so grandparent-g also becomes 60
    expect(goalStore.goals['parent-g'].progress).toBe(60)
    expect(goalStore.goals['grandparent-g'].progress).toBe(60)
  })

  it('applies all updates atomically via a single $patch (Req 5.3)', () => {
    // Set up a three-level chain and verify all levels are updated
    goalStore.$patch((s) => {
      s.goals['level-0'] = makeGoal({ id: 'level-0', progress: 0 })
      s.goals['level-1'] = makeGoal({
        id: 'level-1',
        sourceGoalId: 'level-0',
        progress: 0,
        weight: 2,
      })
      s.goals['level-2'] = makeGoal({
        id: 'level-2',
        sourceGoalId: 'level-1',
        progress: 100,
        weight: 1,
      })
    })
    service.rollUp('level-2')
    expect(goalStore.goals['level-1'].progress).toBe(100)
    expect(goalStore.goals['level-0'].progress).toBe(100)
  })

  it('uses weighted average when siblings have different weights', () => {
    goalStore.$patch((s) => {
      s.goals['parent-g'] = makeGoal({ id: 'parent-g', progress: 0 })
      s.goals['heavy'] = makeGoal({
        id: 'heavy',
        sourceGoalId: 'parent-g',
        progress: 100,
        weight: 3,
      })
      s.goals['light'] = makeGoal({
        id: 'light',
        sourceGoalId: 'parent-g',
        progress: 0,
        weight: 1,
      })
    })
    // rollUp from 'heavy': (3×100 + 1×0) / 4 = 75
    service.rollUp('heavy')
    expect(goalStore.goals['parent-g'].progress).toBe(75)
  })
})

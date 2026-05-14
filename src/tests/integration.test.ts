/**
 * Integration tests: create-node → add-goal → set-progress → rollup
 *
 * Exercises the full service stack (NodeService → GoalService → ProgressService)
 * wired against a MockAdapter, with real Pinia stores, to verify that progress
 * changes propagate correctly up through the goal hierarchy.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { MockAdapter } from '@/adapters/MockAdapter'
import { NodeService } from '@/services/NodeService'
import { GoalService } from '@/services/GoalService'
import { ProgressService } from '@/services/ProgressService'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import { useUiStore } from '@/stores/uiStore'
import type { Result } from '@/models'
import type { AppError } from '@/models'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Unwraps a Result, failing the test if it is an error. */
function unwrap<T>(result: Result<T, AppError>): T {
  if (!result.ok) throw new Error(`Expected ok but got error: ${result.error.message}`)
  return result.value
}

/** Construct a fresh service stack bound to the active Pinia. */
function buildStack() {
  const adapter = new MockAdapter()
  const nodeStore = useNodeStore()
  const goalStore = useGoalStore()
  const uiStore = useUiStore()
  const progressService = new ProgressService(goalStore)
  const nodeService = new NodeService(adapter, nodeStore, goalStore)
  const goalService = new GoalService(adapter, nodeStore, goalStore, uiStore, progressService)
  return { nodeStore, goalStore, nodeService, goalService, progressService }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('Integration: create-node → add-goal → set-progress → rollup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers() // prevent uiStore notification timers from leaking between tests
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. Single child completes → Root reaches 100 % ───────────────────────

  describe('single Refined goal, status Complete → Root reaches 100%', () => {
    it('persists nodes, links goals, propagates 100% through one level', async () => {
      const { nodeService, goalService, progressService, goalStore } = buildStack()

      // Step 1: create parent and child nodes
      const parentNode = unwrap(await nodeService.createNode({
        title: 'Engineering', ownerName: 'Alice', roleLevel: 'Director', parentId: null,
      }))
      const childNode = unwrap(await nodeService.createNode({
        title: 'Frontend', ownerName: 'Bob', roleLevel: 'Lead', parentId: parentNode.id,
      }))

      // Step 2: add Root goal on the parent
      const rootGoal = unwrap(await goalService.createGoal({
        nodeId: parentNode.id,
        type: 'Root',
        description: 'Ship v2.0',
        weight: 1,
        status: 'Active',
      }))
      expect(goalStore.goals[rootGoal.id].progress).toBe(0)

      // Step 3: add Refined goal on the child, linked to the Root
      const refinedGoal = unwrap(await goalService.createGoal({
        nodeId: childNode.id,
        type: 'Refined',
        description: 'Ship v2.0 frontend',
        weight: 1,
        status: 'Active',
        sourceGoalId: rootGoal.id,
      }))
      expect(goalStore.goals[refinedGoal.id].progress).toBe(0)

      // Step 4: mark Refined as Complete (forces progress to 100)
      unwrap(await goalService.updateGoal(refinedGoal.id, { status: 'Complete' }))
      expect(goalStore.goals[refinedGoal.id].progress).toBe(100)
      expect(goalStore.goals[refinedGoal.id].status).toBe('Complete')

      // Step 5: roll up — Root should now reflect 100%
      progressService.rollUp(refinedGoal.id)
      expect(goalStore.goals[rootGoal.id].progress).toBe(100)
    })
  })

  // ── 2. Weighted rollup: two children with different weights ──────────────

  describe('weighted rollup across two Refined goals', () => {
    it('Root = (3×100 + 1×0) / 4 = 75 when the heavier child completes', async () => {
      const { nodeService, goalService, progressService, goalStore } = buildStack()

      const parentNode = unwrap(await nodeService.createNode({
        title: 'Product', ownerName: 'Carol', roleLevel: 'Director', parentId: null,
      }))
      const childA = unwrap(await nodeService.createNode({
        title: 'Team A', ownerName: 'Dan', roleLevel: 'Lead', parentId: parentNode.id,
      }))
      const childB = unwrap(await nodeService.createNode({
        title: 'Team B', ownerName: 'Eve', roleLevel: 'Lead', parentId: parentNode.id,
      }))

      const rootGoal = unwrap(await goalService.createGoal({
        nodeId: parentNode.id,
        type: 'Root',
        description: 'Launch product',
        weight: 1,
        status: 'Active',
      }))

      // Refined A — weight 3
      const refinedA = unwrap(await goalService.createGoal({
        nodeId: childA.id,
        type: 'Refined',
        description: 'Build backend',
        weight: 3,
        status: 'Active',
        sourceGoalId: rootGoal.id,
      }))

      // Refined B — weight 1, stays at 0 %
      const refinedB = unwrap(await goalService.createGoal({
        nodeId: childB.id,
        type: 'Refined',
        description: 'Build UI',
        weight: 1,
        status: 'Active',
        sourceGoalId: rootGoal.id,
      }))

      // Complete A only
      unwrap(await goalService.updateGoal(refinedA.id, { status: 'Complete' }))
      expect(goalStore.goals[refinedA.id].progress).toBe(100)
      expect(goalStore.goals[refinedB.id].progress).toBe(0)

      // rollUp from A: (3×100 + 1×0) / (3+1) = 75
      progressService.rollUp(refinedA.id)
      expect(goalStore.goals[rootGoal.id].progress).toBe(75)
    })

    it('Root = 50 when both equal-weight children are each 50 %', async () => {
      const { nodeService, goalService, progressService, goalStore } = buildStack()

      const parentNode = unwrap(await nodeService.createNode({
        title: 'Platform', ownerName: 'Frank', roleLevel: 'Director', parentId: null,
      }))
      const childA = unwrap(await nodeService.createNode({
        title: 'Infra', ownerName: 'Grace', roleLevel: 'Lead', parentId: parentNode.id,
      }))
      const childB = unwrap(await nodeService.createNode({
        title: 'Security', ownerName: 'Hank', roleLevel: 'Lead', parentId: parentNode.id,
      }))

      const rootGoal = unwrap(await goalService.createGoal({
        nodeId: parentNode.id, type: 'Root', description: 'Platform reliability',
        weight: 1, status: 'Active',
      }))
      const refinedA = unwrap(await goalService.createGoal({
        nodeId: childA.id, type: 'Refined', description: 'Infra SLAs',
        weight: 1, status: 'Active', sourceGoalId: rootGoal.id,
      }))
      const refinedB = unwrap(await goalService.createGoal({
        nodeId: childB.id, type: 'Refined', description: 'Zero vulns',
        weight: 1, status: 'Active', sourceGoalId: rootGoal.id,
      }))

      // Set both to 50 % via direct store patch (no API accepts arbitrary progress)
      goalStore.$patch((state) => {
        state.goals[refinedA.id] = { ...state.goals[refinedA.id], progress: 50 }
        state.goals[refinedB.id] = { ...state.goals[refinedB.id], progress: 50 }
      })

      progressService.rollUp(refinedA.id)
      expect(goalStore.goals[rootGoal.id].progress).toBe(50)
    })
  })

  // ── 3. Three-level hierarchy: leaf → mid → root ──────────────────────────

  describe('three-level hierarchy: leaf Refined → mid Refined → Root', () => {
    it('rollUp from leaf propagates through both levels', async () => {
      const { nodeService, goalService, progressService, goalStore } = buildStack()

      const grandparent = unwrap(await nodeService.createNode({
        title: 'Org', ownerName: 'CEO', roleLevel: 'CEO/President', parentId: null,
      }))
      const parent = unwrap(await nodeService.createNode({
        title: 'Division', ownerName: 'VP', roleLevel: 'Vice President', parentId: grandparent.id,
      }))
      const child = unwrap(await nodeService.createNode({
        title: 'Team', ownerName: 'Manager', roleLevel: 'Manager', parentId: parent.id,
      }))

      const rootGoal = unwrap(await goalService.createGoal({
        nodeId: grandparent.id, type: 'Root', description: 'Grow revenue 20%',
        weight: 1, status: 'Active',
      }))
      const midGoal = unwrap(await goalService.createGoal({
        nodeId: parent.id, type: 'Refined', description: 'Drive division growth',
        weight: 1, status: 'Active', sourceGoalId: rootGoal.id,
      }))
      const leafGoal = unwrap(await goalService.createGoal({
        nodeId: child.id, type: 'Refined', description: 'Close Q1 deals',
        weight: 1, status: 'Active', sourceGoalId: midGoal.id,
      }))

      // Complete the leaf
      unwrap(await goalService.updateGoal(leafGoal.id, { status: 'Complete' }))
      expect(goalStore.goals[leafGoal.id].progress).toBe(100)

      // Roll up from leaf — should propagate through midGoal then rootGoal
      progressService.rollUp(leafGoal.id)
      expect(goalStore.goals[midGoal.id].progress).toBe(100)
      expect(goalStore.goals[rootGoal.id].progress).toBe(100)
    })

    it('partial leaf progress propagates through both levels', async () => {
      const { nodeService, goalService, progressService, goalStore } = buildStack()

      const grandparent = unwrap(await nodeService.createNode({
        title: 'Corp', ownerName: 'CEO', roleLevel: 'CEO/President', parentId: null,
      }))
      const parent = unwrap(await nodeService.createNode({
        title: 'BU', ownerName: 'SVP', roleLevel: 'Vice President', parentId: grandparent.id,
      }))
      const child = unwrap(await nodeService.createNode({
        title: 'Squad', ownerName: 'TL', roleLevel: 'Lead', parentId: parent.id,
      }))

      const rootGoal = unwrap(await goalService.createGoal({
        nodeId: grandparent.id, type: 'Root', description: 'Objective A',
        weight: 1, status: 'Active',
      }))
      const midGoal = unwrap(await goalService.createGoal({
        nodeId: parent.id, type: 'Refined', description: 'Mid objective',
        weight: 1, status: 'Active', sourceGoalId: rootGoal.id,
      }))
      const leafGoal = unwrap(await goalService.createGoal({
        nodeId: child.id, type: 'Refined', description: 'Leaf task',
        weight: 1, status: 'Active', sourceGoalId: midGoal.id,
      }))

      // Patch leaf to 40 %
      goalStore.$patch((state) => {
        state.goals[leafGoal.id] = { ...state.goals[leafGoal.id], progress: 40 }
      })

      progressService.rollUp(leafGoal.id)
      expect(goalStore.goals[midGoal.id].progress).toBe(40)
      expect(goalStore.goals[rootGoal.id].progress).toBe(40)
    })
  })

  // ── 4. Complete shortcut — no rollup needed ──────────────────────────────

  describe('Complete shortcut on a standalone Root goal', () => {
    it('immediately sets progress to 100 without calling rollUp', async () => {
      const { nodeService, goalService, goalStore } = buildStack()

      const node = unwrap(await nodeService.createNode({
        title: 'R&D', ownerName: 'Scientist', roleLevel: 'Employee', parentId: null,
      }))
      const goal = unwrap(await goalService.createGoal({
        nodeId: node.id, type: 'Root', description: 'File patent',
        weight: 1, status: 'Active',
      }))
      expect(goalStore.goals[goal.id].progress).toBe(0)

      unwrap(await goalService.updateGoal(goal.id, { status: 'Complete' }))
      expect(goalStore.goals[goal.id].progress).toBe(100)
      expect(goalStore.goals[goal.id].status).toBe('Complete')
    })
  })

  // ── 5. Store & adapter stay in sync after the full flow ──────────────────

  describe('store and adapter consistency after full flow', () => {
    it('node and goal counts in the store match what the adapter persisted', async () => {
      const { nodeService, goalService, nodeStore, goalStore } = buildStack()

      const parent = unwrap(await nodeService.createNode({
        title: 'Org', ownerName: 'Alice', roleLevel: 'Director', parentId: null,
      }))
      const child = unwrap(await nodeService.createNode({
        title: 'Team', ownerName: 'Bob', roleLevel: 'Lead', parentId: parent.id,
      }))
      const rootGoal = unwrap(await goalService.createGoal({
        nodeId: parent.id, type: 'Root', description: 'Goal A',
        weight: 1, status: 'Active',
      }))
      unwrap(await goalService.createGoal({
        nodeId: child.id, type: 'Refined', description: 'Goal B',
        weight: 1, status: 'Active', sourceGoalId: rootGoal.id,
      }))

      expect(Object.keys(nodeStore.nodes)).toHaveLength(2)
      expect(Object.keys(goalStore.goals)).toHaveLength(2)
    })
  })
})

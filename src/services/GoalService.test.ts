import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GoalService } from './GoalService'
import { ProgressService } from './ProgressService'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import { useUiStore } from '@/stores/uiStore'
import { MockAdapter } from '@/adapters/MockAdapter'
import type { OrgNode } from '@/models/OrgNode'
import type { Goal } from '@/models/Goal'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = '2024-01-01T00:00:00.000Z'

function makeNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    id: 'n-1',
    parentId: null,
    title: 'Node',
    ownerName: 'Owner',
    roleLevel: 'Manager',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g-seed',
    nodeId: 'n-1',
    type: 'Root',
    description: 'Test goal',
    weight: 1,
    status: 'Active',
    progress: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function makeServices(failAt?: ConstructorParameters<typeof MockAdapter>[0]) {
  setActivePinia(createPinia())
  const adapter = new MockAdapter(failAt)
  const nodeStore = useNodeStore()
  const goalStore = useGoalStore()
  const uiStore = useUiStore()
  const progressService = new ProgressService(goalStore)
  const service = new GoalService(adapter, nodeStore, goalStore, uiStore, progressService)
  return { adapter, nodeStore, goalStore, uiStore, service }
}

/** Seed a node into both the store and adapter. */
async function seedNode(
  adapter: MockAdapter,
  nodeStore: ReturnType<typeof useNodeStore>,
  overrides: Partial<OrgNode> = {},
): Promise<OrgNode> {
  const node = makeNode(overrides)
  nodeStore.$patch((s) => { s.nodes[node.id] = node })
  return node
}

/** Seed a goal into both the store and adapter. */
async function seedGoal(
  adapter: MockAdapter,
  goalStore: ReturnType<typeof useGoalStore>,
  overrides: Partial<Goal> = {},
): Promise<Goal> {
  const goal = makeGoal(overrides)
  await adapter.createGoal(goal)
  goalStore.$patch((s) => { s.goals[goal.id] = goal })
  return goal
}

// ---------------------------------------------------------------------------
// createGoal — Req 4.1–4.3, 4.9, 6.1, 6.4–6.6
// ---------------------------------------------------------------------------

describe('GoalService.createGoal', () => {
  it('creates a Root goal and adds it to the store', async () => {
    const { service, goalStore } = makeServices()
    const result = await service.createGoal({
      nodeId: 'n-1',
      type: 'Root',
      description: 'Increase revenue',
      weight: 1,
      status: 'Active',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.type).toBe('Root')
    expect(result.value.nodeId).toBe('n-1')
    expect(goalStore.goals[result.value.id]).toBeDefined()
  })

  it('creates a Sub_Task goal and adds it to the store', async () => {
    const { service, goalStore } = makeServices()
    const result = await service.createGoal({
      nodeId: 'n-1',
      type: 'Sub_Task',
      description: 'Write unit tests',
      weight: 0.5,
      status: 'Active',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.type).toBe('Sub_Task')
    expect(goalStore.goals[result.value.id]).toBeDefined()
  })

  it('returns VALIDATION_ERROR for empty description', async () => {
    const { service } = makeServices()
    const result = await service.createGoal({
      nodeId: 'n-1',
      type: 'Root',
      description: '',
      weight: 1,
      status: 'Active',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.field).toBe('description')
  })

  it('returns VALIDATION_ERROR for weight out of range', async () => {
    const { service } = makeServices()
    const result = await service.createGoal({
      nodeId: 'n-1',
      type: 'Root',
      description: 'Valid',
      weight: 0,
      status: 'Active',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.field).toBe('weight')
  })

  it('returns INVALID_SOURCE_GOAL for a Refined goal without sourceGoalId', async () => {
    const { service } = makeServices()
    const result = await service.createGoal({
      nodeId: 'n-child',
      type: 'Refined',
      description: 'Refined without source',
      weight: 1,
      status: 'Active',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_SOURCE_GOAL')
  })

  it('returns INVALID_SOURCE_GOAL when sourceGoalId does not exist in store', async () => {
    const { service } = makeServices()
    const result = await service.createGoal({
      nodeId: 'n-child',
      type: 'Refined',
      description: 'Refined',
      weight: 1,
      status: 'Active',
      sourceGoalId: 'nonexistent-goal',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_SOURCE_GOAL')
  })

  it('returns INVALID_SOURCE_GOAL when source goal is of type Sub_Task', async () => {
    const { adapter, nodeStore, goalStore, service } = makeServices()
    await seedNode(adapter, nodeStore, { id: 'n-parent', parentId: null })
    const sourceGoal = await seedGoal(adapter, goalStore, {
      id: 'sub-task-source',
      nodeId: 'n-parent',
      type: 'Sub_Task',
    })
    const result = await service.createGoal({
      nodeId: 'n-child',
      type: 'Refined',
      description: 'Refined from Sub_Task',
      weight: 1,
      status: 'Active',
      sourceGoalId: sourceGoal.id,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_SOURCE_GOAL')
  })

  it('returns SELF_REFERENTIAL_REFINEMENT when source and target are on the same node', async () => {
    const { adapter, nodeStore, goalStore, service } = makeServices()
    await seedNode(adapter, nodeStore, { id: 'n-same', parentId: null })
    const sourceGoal = await seedGoal(adapter, goalStore, {
      id: 'root-on-same',
      nodeId: 'n-same',
      type: 'Root',
    })
    const result = await service.createGoal({
      nodeId: 'n-same',
      type: 'Refined',
      description: 'Same-node refinement',
      weight: 1,
      status: 'Active',
      sourceGoalId: sourceGoal.id,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('SELF_REFERENTIAL_REFINEMENT')
  })

  it('returns INVALID_ANCESTOR_RELATIONSHIP when source node is not an ancestor', async () => {
    const { adapter, nodeStore, goalStore, service } = makeServices()
    // Two sibling nodes under a common root — neither is an ancestor of the other
    await seedNode(adapter, nodeStore, { id: 'n-root', parentId: null })
    await seedNode(adapter, nodeStore, { id: 'n-sibling-a', parentId: 'n-root' })
    await seedNode(adapter, nodeStore, { id: 'n-sibling-b', parentId: 'n-root' })
    const sourceGoal = await seedGoal(adapter, goalStore, {
      id: 'goal-on-a',
      nodeId: 'n-sibling-a',
      type: 'Root',
    })
    const result = await service.createGoal({
      nodeId: 'n-sibling-b',
      type: 'Refined',
      description: 'Cross-sibling refinement',
      weight: 1,
      status: 'Active',
      sourceGoalId: sourceGoal.id,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_ANCESTOR_RELATIONSHIP')
  })

  it('creates a Refined goal when source node is a proper ancestor', async () => {
    const { adapter, nodeStore, goalStore, service } = makeServices()
    await seedNode(adapter, nodeStore, { id: 'n-parent', parentId: null })
    await seedNode(adapter, nodeStore, { id: 'n-child', parentId: 'n-parent' })
    const sourceGoal = await seedGoal(adapter, goalStore, {
      id: 'root-on-parent',
      nodeId: 'n-parent',
      type: 'Root',
    })
    const result = await service.createGoal({
      nodeId: 'n-child',
      type: 'Refined',
      description: 'Valid refinement',
      weight: 1,
      status: 'Active',
      sourceGoalId: sourceGoal.id,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.sourceGoalId).toBe(sourceGoal.id)
    expect(goalStore.goals[result.value.id]).toBeDefined()
  })

  it('returns ADAPTER_ERROR when adapter.createGoal throws', async () => {
    const { service } = makeServices({ operation: 'createGoal' })
    const result = await service.createGoal({
      nodeId: 'n-1',
      type: 'Root',
      description: 'Will fail',
      weight: 1,
      status: 'Active',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ADAPTER_ERROR')
  })
})

// ---------------------------------------------------------------------------
// updateGoal — Req 4.4–4.7, 6.3
// ---------------------------------------------------------------------------

describe('GoalService.updateGoal', () => {
  let service: GoalService
  let adapter: MockAdapter
  let goalStore: ReturnType<typeof useGoalStore>
  let uiStore: ReturnType<typeof useUiStore>
  let rootGoalId: string

  beforeEach(async () => {
    const ctx = makeServices()
    service = ctx.service
    adapter = ctx.adapter
    goalStore = ctx.goalStore
    uiStore = ctx.uiStore

    // Seed a Root goal as shared fixture
    const goal = await seedGoal(adapter, goalStore, { id: 'root-goal', type: 'Root' })
    rootGoalId = goal.id
  })

  it('returns NOT_FOUND when the goal does not exist', async () => {
    const result = await service.updateGoal('nonexistent', { description: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns TYPE_IMMUTABLE when trying to change the goal type', async () => {
    const result = await service.updateGoal(rootGoalId, { type: 'Sub_Task' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('TYPE_IMMUTABLE')
  })

  it('updates description and reflects change in store', async () => {
    const result = await service.updateGoal(rootGoalId, { description: 'New description' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.description).toBe('New description')
    expect(goalStore.goals[rootGoalId].description).toBe('New description')
  })

  it('forces progress to 100 when status is set to Complete', async () => {
    const result = await service.updateGoal(rootGoalId, { status: 'Complete' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.progress).toBe(100)
    expect(goalStore.goals[rootGoalId].progress).toBe(100)
  })

  it('does not force progress to 100 for non-Complete status updates', async () => {
    const result = await service.updateGoal(rootGoalId, { status: 'Refined' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.progress).toBe(0)
  })

  it('triggers a notification for each direct refiner when description changes', async () => {
    // Add a Refined goal that references rootGoalId
    const { adapter: _a, goalStore: gs } = { adapter, goalStore }
    const refiner = await seedGoal(adapter, goalStore, {
      id: 'refiner-goal',
      nodeId: 'n-child',
      type: 'Refined',
      sourceGoalId: rootGoalId,
    })
    expect(uiStore.notifications).toHaveLength(0)
    const result = await service.updateGoal(rootGoalId, { description: 'Changed description' })
    expect(result.ok).toBe(true)
    expect(uiStore.notifications).toHaveLength(1)
    expect(uiStore.notifications[0].sourceGoalId).toBe(rootGoalId)
    expect(uiStore.notifications[0].nodeId).toBe(refiner.nodeId)
  })

  it('triggers notifications for each direct refiner when status changes', async () => {
    await seedGoal(adapter, goalStore, {
      id: 'refiner-1',
      nodeId: 'n-c1',
      type: 'Refined',
      sourceGoalId: rootGoalId,
    })
    await seedGoal(adapter, goalStore, {
      id: 'refiner-2',
      nodeId: 'n-c2',
      type: 'Refined',
      sourceGoalId: rootGoalId,
    })
    const result = await service.updateGoal(rootGoalId, { status: 'Refined' })
    expect(result.ok).toBe(true)
    expect(uiStore.notifications).toHaveLength(2)
  })

  it('returns ADAPTER_ERROR on a non-not-found adapter failure', async () => {
    setActivePinia(createPinia())
    const failAdapter = new MockAdapter({ operation: 'updateGoal' })
    const gs = useGoalStore()
    const us = useUiStore()
    const ps = new ProgressService(gs)
    const svc = new GoalService(failAdapter, useNodeStore(), gs, us, ps)
    const goal = await seedGoal(failAdapter, gs, { id: 'g-fail' })
    const result = await svc.updateGoal(goal.id, { description: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ADAPTER_ERROR')
  })
})

// ---------------------------------------------------------------------------
// deleteGoal — Req 4.8, 6.7
// ---------------------------------------------------------------------------

describe('GoalService.deleteGoal', () => {
  let service: GoalService
  let adapter: MockAdapter
  let goalStore: ReturnType<typeof useGoalStore>

  beforeEach(() => {
    const ctx = makeServices()
    service = ctx.service
    adapter = ctx.adapter
    goalStore = ctx.goalStore
  })

  it('returns NOT_FOUND when the goal does not exist', async () => {
    const result = await service.deleteGoal('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('deletes a goal and removes it from the store', async () => {
    const goal = await seedGoal(adapter, goalStore, { id: 'g-del' })
    const result = await service.deleteGoal(goal.id)
    expect(result.ok).toBe(true)
    expect(goalStore.goals[goal.id]).toBeUndefined()
  })

  it('cascades deletion to direct Refined children', async () => {
    const root = await seedGoal(adapter, goalStore, { id: 'root-g' })
    const child = await seedGoal(adapter, goalStore, {
      id: 'child-g',
      type: 'Refined',
      sourceGoalId: root.id,
    })
    const result = await service.deleteGoal(root.id)
    expect(result.ok).toBe(true)
    expect(goalStore.goals[root.id]).toBeUndefined()
    expect(goalStore.goals[child.id]).toBeUndefined()
  })

  it('cascades deletion transitively through nested refiners', async () => {
    const root = await seedGoal(adapter, goalStore, { id: 'root-g' })
    const level1 = await seedGoal(adapter, goalStore, {
      id: 'level-1-g',
      type: 'Refined',
      sourceGoalId: root.id,
    })
    const level2 = await seedGoal(adapter, goalStore, {
      id: 'level-2-g',
      type: 'Refined',
      sourceGoalId: level1.id,
    })
    const result = await service.deleteGoal(root.id)
    expect(result.ok).toBe(true)
    expect(goalStore.goals[root.id]).toBeUndefined()
    expect(goalStore.goals[level1.id]).toBeUndefined()
    expect(goalStore.goals[level2.id]).toBeUndefined()
  })

  it('returns ADAPTER_ERROR when adapter.deleteGoal throws', async () => {
    setActivePinia(createPinia())
    const failAdapter = new MockAdapter({ operation: 'deleteGoal' })
    const gs = useGoalStore()
    const us = useUiStore()
    const ps = new ProgressService(gs)
    const svc = new GoalService(failAdapter, useNodeStore(), gs, us, ps)
    const goal = await seedGoal(failAdapter, gs, { id: 'g-fail' })
    // Remove from adapter so the injected failure is the only path
    // (MockAdapter checks failure before existence)
    const result = await svc.deleteGoal(goal.id)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ADAPTER_ERROR')
  })
})

// ---------------------------------------------------------------------------
// setProgress — Req 5.1, 5.3, 5.5, 5.6
// ---------------------------------------------------------------------------

describe('GoalService.setProgress', () => {
  let service: GoalService
  let adapter: MockAdapter
  let goalStore: ReturnType<typeof useGoalStore>

  beforeEach(() => {
    const ctx = makeServices()
    service = ctx.service
    adapter = ctx.adapter
    goalStore = ctx.goalStore
  })

  it('returns NOT_FOUND when the goal does not exist', async () => {
    const result = await service.setProgress('nonexistent', 50)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns VALIDATION_ERROR for progress above 100', async () => {
    const goal = await seedGoal(adapter, goalStore, { id: 'g-prog' })
    const result = await service.setProgress(goal.id, 101)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.field).toBe('progress')
  })

  it('returns VALIDATION_ERROR for negative progress', async () => {
    const goal = await seedGoal(adapter, goalStore, { id: 'g-prog' })
    const result = await service.setProgress(goal.id, -1)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns VALIDATION_ERROR for NaN', async () => {
    const goal = await seedGoal(adapter, goalStore, { id: 'g-prog' })
    const result = await service.setProgress(goal.id, NaN)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
  })

  it('updates progress in the store for a valid value', async () => {
    const goal = await seedGoal(adapter, goalStore, { id: 'g-prog', progress: 0 })
    const result = await service.setProgress(goal.id, 75)
    expect(result.ok).toBe(true)
    expect(goalStore.goals[goal.id].progress).toBe(75)
  })

  it('accepts boundary values 0 and 100', async () => {
    const goal = await seedGoal(adapter, goalStore, { id: 'g-prog', progress: 50 })
    const r0 = await service.setProgress(goal.id, 0)
    expect(r0.ok).toBe(true)
    const r100 = await service.setProgress(goal.id, 100)
    expect(r100.ok).toBe(true)
    expect(goalStore.goals[goal.id].progress).toBe(100)
  })

  it('rolls up parent progress after setting progress (Req 5.1)', async () => {
    // Parent goal (Root)
    const parent = await seedGoal(adapter, goalStore, {
      id: 'parent-g',
      type: 'Root',
      progress: 0,
      weight: 1,
    })
    // Child goal referencing parent
    const child = await seedGoal(adapter, goalStore, {
      id: 'child-g',
      type: 'Refined',
      sourceGoalId: parent.id,
      progress: 0,
      weight: 1,
    })
    const result = await service.setProgress(child.id, 80)
    expect(result.ok).toBe(true)
    // Parent should be rolled up to 80
    expect(goalStore.goals[parent.id].progress).toBe(80)
  })

  it('returns ADAPTER_ERROR when adapter.updateGoal throws', async () => {
    setActivePinia(createPinia())
    const failAdapter = new MockAdapter({ operation: 'updateGoal' })
    const gs = useGoalStore()
    const us = useUiStore()
    const ps = new ProgressService(gs)
    const svc = new GoalService(failAdapter, useNodeStore(), gs, us, ps)
    const goal = await seedGoal(failAdapter, gs, { id: 'g-fail', progress: 0 })
    const result = await svc.setProgress(goal.id, 50)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ADAPTER_ERROR')
  })
})

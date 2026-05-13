import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { NodeService } from './NodeService'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
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
    title: 'Engineering',
    ownerName: 'Alice',
    roleLevel: 'Vice President',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g-1',
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
// createNode — Req 1.1–1.4, 1.6–1.8
// ---------------------------------------------------------------------------

describe('NodeService.createNode', () => {
  let service: NodeService
  let nodeStore: ReturnType<typeof useNodeStore>
  let adapter: MockAdapter

  beforeEach(() => {
    setActivePinia(createPinia())
    adapter = new MockAdapter()
    nodeStore = useNodeStore()
    service = new NodeService(adapter, nodeStore, useGoalStore())
  })

  it('creates a root node and adds it to the store', async () => {
    const result = await service.createNode({
      title: 'Engineering',
      ownerName: 'Alice',
      roleLevel: 'Vice President',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.title).toBe('Engineering')
    expect(result.value.ownerName).toBe('Alice')
    expect(result.value.parentId).toBeNull()
    expect(nodeStore.nodes[result.value.id]).toBeDefined()
  })

  it('creates a child node under an existing parent', async () => {
    const parentResult = await service.createNode({
      title: 'Parent',
      ownerName: 'Bob',
      roleLevel: 'Director',
    })
    expect(parentResult.ok).toBe(true)
    if (!parentResult.ok) return

    const childResult = await service.createNode({
      title: 'Child',
      ownerName: 'Carol',
      roleLevel: 'Manager',
      parentId: parentResult.value.id,
    })
    expect(childResult.ok).toBe(true)
    if (!childResult.ok) return
    expect(childResult.value.parentId).toBe(parentResult.value.id)
    expect(nodeStore.nodes[childResult.value.id]).toBeDefined()
  })

  it('returns VALIDATION_ERROR for an empty title', async () => {
    const result = await service.createNode({ title: '', ownerName: 'Alice', roleLevel: 'Manager' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.field).toBe('title')
  })

  it('returns VALIDATION_ERROR for an empty ownerName', async () => {
    const result = await service.createNode({ title: 'Eng', ownerName: '', roleLevel: 'Manager' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.field).toBe('ownerName')
  })

  it('returns VALIDATION_ERROR when Custom role has no customRoleLabel', async () => {
    const result = await service.createNode({
      title: 'Dept',
      ownerName: 'Dave',
      roleLevel: 'Custom',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.field).toBe('customRoleLabel')
  })

  it('returns NOT_FOUND when parentId does not exist in the adapter', async () => {
    const result = await service.createNode({
      title: 'Child',
      ownerName: 'Eve',
      roleLevel: 'Manager',
      parentId: 'nonexistent-parent',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns ADAPTER_ERROR when adapter.createNode throws', async () => {
    adapter = new MockAdapter({ operation: 'createNode' })
    service = new NodeService(adapter, nodeStore, useGoalStore())
    const result = await service.createNode({ title: 'Test', ownerName: 'Eve', roleLevel: 'Manager' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ADAPTER_ERROR')
  })

  it('sanitizes HTML special characters in title', async () => {
    const result = await service.createNode({
      title: 'Eng & <Testing>',
      ownerName: 'Alice',
      roleLevel: 'Manager',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.title).toBe('Eng &amp; &lt;Testing&gt;')
  })

  it('stores customRoleLabel on Custom role nodes', async () => {
    const result = await service.createNode({
      title: 'Dept',
      ownerName: 'Frank',
      roleLevel: 'Custom',
      customRoleLabel: 'Tech Lead',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.customRoleLabel).toBe('Tech Lead')
    expect(result.value.roleLevel).toBe('Custom')
  })
})

// ---------------------------------------------------------------------------
// updateNode — Req 1.4, 1.7, 1.8
// ---------------------------------------------------------------------------

describe('NodeService.updateNode', () => {
  let service: NodeService
  let nodeStore: ReturnType<typeof useNodeStore>
  let adapter: MockAdapter
  let createdId: string

  beforeEach(async () => {
    setActivePinia(createPinia())
    adapter = new MockAdapter()
    nodeStore = useNodeStore()
    service = new NodeService(adapter, nodeStore, useGoalStore())
    const result = await service.createNode({ title: 'Original', ownerName: 'Alice', roleLevel: 'Manager' })
    if (!result.ok) throw new Error('Setup failed: ' + result.error.message)
    createdId = result.value.id
  })

  it('updates title and reflects the change in the store', async () => {
    const result = await service.updateNode(createdId, { title: 'Updated Title' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.title).toBe('Updated Title')
    expect(nodeStore.nodes[createdId].title).toBe('Updated Title')
  })

  it('updates ownerName independently', async () => {
    const result = await service.updateNode(createdId, { ownerName: 'Bob' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.ownerName).toBe('Bob')
    expect(nodeStore.nodes[createdId].ownerName).toBe('Bob')
  })

  it('returns VALIDATION_ERROR for an empty title update', async () => {
    const result = await service.updateNode(createdId, { title: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.field).toBe('title')
  })

  it('returns NOT_FOUND when the node does not exist in the adapter', async () => {
    const result = await service.updateNode('nonexistent-id', { title: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns ADAPTER_ERROR on a non-not-found adapter failure', async () => {
    setActivePinia(createPinia())
    const failAdapter = new MockAdapter({ operation: 'updateNode' })
    const ns = useNodeStore()
    const node = makeNode({ id: 'n-fail' })
    ns.$patch((s) => { s.nodes['n-fail'] = node })
    // Seed adapter with the node so failure is from injected error, not missing node
    await failAdapter.createNode(node)
    const svc = new NodeService(failAdapter, ns, useGoalStore())
    const result = await svc.updateNode('n-fail', { title: 'New' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ADAPTER_ERROR')
  })
})

// ---------------------------------------------------------------------------
// deleteNode — Req 1.5
// ---------------------------------------------------------------------------

describe('NodeService.deleteNode', () => {
  let service: NodeService
  let nodeStore: ReturnType<typeof useNodeStore>
  let goalStore: ReturnType<typeof useGoalStore>
  let adapter: MockAdapter

  beforeEach(() => {
    setActivePinia(createPinia())
    adapter = new MockAdapter()
    nodeStore = useNodeStore()
    goalStore = useGoalStore()
    service = new NodeService(adapter, nodeStore, goalStore)
  })

  it('returns NOT_FOUND when the node does not exist in the store', async () => {
    const result = await service.deleteNode('nonexistent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('deletes a node and removes it from the store', async () => {
    const created = await service.createNode({ title: 'Leaf', ownerName: 'Alice', roleLevel: 'Manager' })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await service.deleteNode(created.value.id)
    expect(result.ok).toBe(true)
    expect(nodeStore.nodes[created.value.id]).toBeUndefined()
  })

  it('deletes a parent and its child subtree', async () => {
    const parent = await service.createNode({ title: 'Parent', ownerName: 'A', roleLevel: 'Director' })
    if (!parent.ok) return
    const child = await service.createNode({
      title: 'Child',
      ownerName: 'B',
      roleLevel: 'Manager',
      parentId: parent.value.id,
    })
    if (!child.ok) return

    const result = await service.deleteNode(parent.value.id)
    expect(result.ok).toBe(true)
    expect(nodeStore.nodes[parent.value.id]).toBeUndefined()
    expect(nodeStore.nodes[child.value.id]).toBeUndefined()
  })

  it('also removes goals belonging to the deleted subtree', async () => {
    const node = await service.createNode({ title: 'Node', ownerName: 'A', roleLevel: 'Manager' })
    if (!node.ok) return

    // Seed a goal for this node in both adapter and store
    const goal = makeGoal({ id: 'g-seed', nodeId: node.value.id })
    await adapter.createGoal(goal)
    goalStore.$patch((s) => { s.goals['g-seed'] = goal })

    const result = await service.deleteNode(node.value.id)
    expect(result.ok).toBe(true)
    expect(goalStore.goals['g-seed']).toBeUndefined()
    expect(nodeStore.nodes[node.value.id]).toBeUndefined()
  })

  it('returns ADAPTER_ERROR when adapter.deleteNode throws', async () => {
    setActivePinia(createPinia())
    const failAdapter = new MockAdapter({ operation: 'deleteNode' })
    const ns = useNodeStore()
    const node = makeNode({ id: 'n-fail' })
    ns.$patch((s) => { s.nodes['n-fail'] = node })
    const svc = new NodeService(failAdapter, ns, useGoalStore())
    const result = await svc.deleteNode('n-fail')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('ADAPTER_ERROR')
  })
})

// ---------------------------------------------------------------------------
// reparentNode — Req 3.2, 3.3, 3.5, 3.6
// ---------------------------------------------------------------------------

describe('NodeService.reparentNode', () => {
  let service: NodeService
  let nodeStore: ReturnType<typeof useNodeStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    const adapter = new MockAdapter()
    nodeStore = useNodeStore()
    service = new NodeService(adapter, nodeStore, useGoalStore())
  })

  it('returns NOT_FOUND when nodeId does not exist', async () => {
    const result = await service.reparentNode('ghost', 'also-ghost')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns NOT_FOUND when newParentId does not exist', async () => {
    const n = await service.createNode({ title: 'N', ownerName: 'A', roleLevel: 'Manager' })
    if (!n.ok) return
    const result = await service.reparentNode(n.value.id, 'nonexistent-parent')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('returns CYCLE_DETECTED when reparenting a node to itself', async () => {
    const n = await service.createNode({ title: 'N', ownerName: 'A', roleLevel: 'Manager' })
    if (!n.ok) return
    const result = await service.reparentNode(n.value.id, n.value.id)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CYCLE_DETECTED')
  })

  it('returns CYCLE_DETECTED when reparenting to a descendant', async () => {
    const root = await service.createNode({ title: 'Root', ownerName: 'A', roleLevel: 'Director' })
    if (!root.ok) return
    const child = await service.createNode({
      title: 'Child',
      ownerName: 'B',
      roleLevel: 'Manager',
      parentId: root.value.id,
    })
    if (!child.ok) return
    // Moving root → child would create a cycle
    const result = await service.reparentNode(root.value.id, child.value.id)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CYCLE_DETECTED')
  })

  it('reparents a node and updates the store', async () => {
    const parentA = await service.createNode({ title: 'A', ownerName: 'X', roleLevel: 'Director' })
    const parentB = await service.createNode({ title: 'B', ownerName: 'Y', roleLevel: 'Director' })
    const child = await service.createNode({
      title: 'Child',
      ownerName: 'Z',
      roleLevel: 'Manager',
      parentId: parentA.ok ? parentA.value.id : undefined,
    })
    if (!parentA.ok || !parentB.ok || !child.ok) return

    const result = await service.reparentNode(child.value.id, parentB.value.id)
    expect(result.ok).toBe(true)
    expect(nodeStore.nodes[child.value.id].parentId).toBe(parentB.value.id)
  })
})

// ---------------------------------------------------------------------------
// promoteToRoot — detaches a node from its parent
// ---------------------------------------------------------------------------

describe('NodeService.promoteToRoot', () => {
  let service: NodeService
  let nodeStore: ReturnType<typeof useNodeStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    const adapter = new MockAdapter()
    nodeStore = useNodeStore()
    service = new NodeService(adapter, nodeStore, useGoalStore())
  })

  it('returns NOT_FOUND when the node does not exist', async () => {
    const result = await service.promoteToRoot('ghost')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('sets parentId to null for a child node', async () => {
    const parent = await service.createNode({ title: 'Parent', ownerName: 'A', roleLevel: 'Director' })
    if (!parent.ok) return
    const child = await service.createNode({
      title: 'Child',
      ownerName: 'B',
      roleLevel: 'Manager',
      parentId: parent.value.id,
    })
    if (!child.ok) return

    const result = await service.promoteToRoot(child.value.id)
    expect(result.ok).toBe(true)
    expect(nodeStore.nodes[child.value.id].parentId).toBeNull()
  })

  it('returns ok:true for a node that is already a root', async () => {
    const root = await service.createNode({ title: 'Root', ownerName: 'A', roleLevel: 'Director' })
    if (!root.ok) return
    const result = await service.promoteToRoot(root.value.id)
    expect(result.ok).toBe(true)
    expect(nodeStore.nodes[root.value.id].parentId).toBeNull()
  })
})

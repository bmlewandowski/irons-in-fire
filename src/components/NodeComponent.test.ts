import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NodeComponent from './NodeComponent.vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
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
    description: 'Ship the product',
    weight: 1,
    status: 'Active',
    progress: 50,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function mountNode(
  nodeId: string,
  props: { isCollapsed?: boolean; goalsVisible?: boolean } = {},
) {
  return mount(NodeComponent, {
    props: { nodeId, ...props },
    global: {
      stubs: {
        // Stub Teleport targets — jsdom doesn't have a real body mount
        teleport: true,
        // Stub GoalCard so NodeComponent tests stay focused
        GoalCard: { template: '<div class="goal-card-stub" />' },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('NodeComponent', () => {
  let nodeStore: ReturnType<typeof useNodeStore>
  let goalStore: ReturnType<typeof useGoalStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    nodeStore = useNodeStore()
    goalStore = useGoalStore()
  })

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders ownerName and title', () => {
    const node = makeNode()
    nodeStore.$patch({ nodes: { 'n-1': node } })

    const wrapper = mountNode('n-1')

    expect(wrapper.find('.node-title').text()).toContain('Alice')
    expect(wrapper.find('.node-owner').text()).toBe('Engineering')
  })

  it('does not render collapse-toggle-btn when node has no children', () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() } })

    const wrapper = mountNode('n-1')

    expect(wrapper.find('.collapse-toggle-btn').exists()).toBe(false)
  })

  it('renders collapse-toggle-btn (▼) when node has children and is expanded', () => {
    const parent = makeNode({ id: 'n-1', parentId: null })
    const child = makeNode({ id: 'n-2', parentId: 'n-1', ownerName: 'Bob', title: 'Platform' })
    nodeStore.$patch({ nodes: { 'n-1': parent, 'n-2': child } })

    const wrapper = mountNode('n-1', { isCollapsed: false })

    const btn = wrapper.find('.collapse-toggle-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('▼')
  })

  it('renders collapse-toggle-btn (▶) when node has children and is collapsed', () => {
    const parent = makeNode({ id: 'n-1' })
    const child = makeNode({ id: 'n-2', parentId: 'n-1', ownerName: 'Bob', title: 'Platform' })
    nodeStore.$patch({ nodes: { 'n-1': parent, 'n-2': child } })

    const wrapper = mountNode('n-1', { isCollapsed: true })

    expect(wrapper.find('.collapse-toggle-btn').text()).toBe('▶')
  })

  it('does not render goal icon when node has no goals', () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() } })

    const wrapper = mountNode('n-1')

    expect(wrapper.find('.goal-icon-btn').exists()).toBe(false)
  })

  it('renders goal icon when node has goals', () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() } })
    goalStore.$patch({ goals: { 'g-1': makeGoal() } })

    const wrapper = mountNode('n-1')

    expect(wrapper.find('.goal-icon-btn').exists()).toBe(true)
  })

  it('shows goal badge count', () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() } })
    goalStore.$patch({ goals: { 'g-1': makeGoal(), 'g-2': makeGoal({ id: 'g-2' }) } })

    const wrapper = mountNode('n-1')

    expect(wrapper.find('.goal-badge').text()).toBe('2')
  })

  // ── Goal cards visibility ─────────────────────────────────────────────────

  it('shows GoalCard stubs when goalsVisible is true (default)', () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() } })
    goalStore.$patch({ goals: { 'g-1': makeGoal() } })

    const wrapper = mountNode('n-1', { goalsVisible: true })

    expect(wrapper.findAll('.goal-card-stub').length).toBe(1)
  })

  it('hides GoalCard stubs when goalsVisible is false', () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() } })
    goalStore.$patch({ goals: { 'g-1': makeGoal() } })

    const wrapper = mountNode('n-1', { goalsVisible: false })

    expect(wrapper.findAll('.goal-card-stub').length).toBe(0)
  })

  // ── Action menu ───────────────────────────────────────────────────────────

  it('does not show action-menu when node is not selected', () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() }, selectedNodeId: null })

    const wrapper = mountNode('n-1')

    expect(wrapper.find('.action-menu').exists()).toBe(false)
  })

  it('shows action-menu when node is selected', () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() }, selectedNodeId: 'n-1' })

    const wrapper = mountNode('n-1')

    expect(wrapper.find('.action-menu').exists()).toBe(true)
  })

  // ── Emitted events ────────────────────────────────────────────────────────

  it('emits toggle-collapse when collapse button is clicked', async () => {
    const parent = makeNode()
    const child = makeNode({ id: 'n-2', parentId: 'n-1', ownerName: 'Bob', title: 'Platform' })
    nodeStore.$patch({ nodes: { 'n-1': parent, 'n-2': child } })

    const wrapper = mountNode('n-1')
    await wrapper.find('.collapse-toggle-btn').trigger('click')

    expect(wrapper.emitted('toggle-collapse')).toEqual([['n-1']])
  })

  it('emits goals-toggled when goal icon is clicked', async () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() } })
    goalStore.$patch({ goals: { 'g-1': makeGoal() } })

    const wrapper = mountNode('n-1')
    await wrapper.find('.goal-icon-btn').trigger('click')

    expect(wrapper.emitted('goals-toggled')).toEqual([['n-1']])
  })

  it('emits add-child when action menu Add Child is clicked', async () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() }, selectedNodeId: 'n-1' })

    const wrapper = mountNode('n-1')
    const buttons = wrapper.findAll('[role="menuitem"]')
    const addChildBtn = buttons.find((b) => b.text() === 'Add Child')
    await addChildBtn!.trigger('click')

    expect(wrapper.emitted('add-child')).toEqual([['n-1']])
  })

  it('emits add-goal when action menu Add Goal is clicked', async () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() }, selectedNodeId: 'n-1' })

    const wrapper = mountNode('n-1')
    const buttons = wrapper.findAll('[role="menuitem"]')
    const addGoalBtn = buttons.find((b) => b.text() === 'Add Goal')
    await addGoalBtn!.trigger('click')

    expect(wrapper.emitted('add-goal')).toEqual([['n-1']])
  })

  it('emits edit when action menu Edit is clicked', async () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() }, selectedNodeId: 'n-1' })

    const wrapper = mountNode('n-1')
    const buttons = wrapper.findAll('[role="menuitem"]')
    const editBtn = buttons.find((b) => b.text() === 'Edit')
    await editBtn!.trigger('click')

    expect(wrapper.emitted('edit')).toEqual([['n-1']])
  })

  it('emits delete when delete button is clicked', async () => {
    nodeStore.$patch({ nodes: { 'n-1': makeNode() }, selectedNodeId: 'n-1' })

    const wrapper = mountNode('n-1')
    // Click Delete in the action menu — confirmation is handled by parent (OrgChartContainer)
    const buttons = wrapper.findAll('[role="menuitem"]')
    const deleteBtn = buttons.find((b) => b.text() === 'Delete')
    await deleteBtn!.trigger('click')

    expect(wrapper.emitted('delete')).toBeDefined()
    expect(wrapper.emitted('delete')![0]).toEqual(['n-1'])
  })
})

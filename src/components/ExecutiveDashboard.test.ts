/**
 * Tests for ExecutiveDashboard component.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useGoalStore } from '@/stores/goalStore'
import { useNodeStore } from '@/stores/nodeStore'
import ExecutiveDashboard from './ExecutiveDashboard.vue'
import type { Goal, OrgNode } from '@/models'

describe('ExecutiveDashboard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

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
      progress: 50,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }
  }

  it('renders empty state when no goals exist', () => {
    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.find('[data-testid="dashboard-empty-state"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No top-level goals yet')
  })

  it('renders goal cards when goals exist', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    const goal = makeGoal({ nodeId: node.id })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.find('[data-testid="dashboard-empty-state"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="goal-indicator"]').exists()).toBe(true)
  })

  it('displays node label on goal card', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode({ title: 'Sales', ownerName: 'Bob' })
    const goal = makeGoal({ nodeId: node.id })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.text()).toContain('Sales · Bob')
  })

  it('displays goal description on card', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    const goal = makeGoal({ nodeId: node.id, description: 'Launch new product' })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.text()).toContain('Launch new product')
  })

  it('displays progress percentage', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    const goal = makeGoal({ nodeId: node.id, progress: 75 })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.text()).toContain('75')
  })

  it('displays goal status badge', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    const goal = makeGoal({ nodeId: node.id, status: 'Complete' })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.find('.badge-complete').exists()).toBe(true)
    expect(wrapper.text()).toContain('Complete')
  })

  it('displays goal weight', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    const goal = makeGoal({ nodeId: node.id, weight: 3 })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.text()).toContain('Weight')
    expect(wrapper.text()).toContain('3')
  })

  it('opens drill-down panel when goal card clicked', async () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    const goal = makeGoal({ nodeId: node.id })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(ExecutiveDashboard)

    const goalCard = wrapper.find('[data-testid="goal-indicator"]')
    await goalCard.trigger('click')

    // DrillDownPanel should now be visible
    expect(wrapper.find('.drilldown-panel').exists()).toBe(true)
  })

  it('renders scope picker when nodes exist', () => {
    const nodeStore = useNodeStore()
    const node = makeNode()
    nodeStore.$patch({ nodes: { [node.id]: node } })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.find('#scope-select').exists()).toBe(true)
    expect(wrapper.find('.scope-label').text()).toBe('Scope:')
  })

  it('populates scope picker with available nodes', () => {
    const nodeStore = useNodeStore()
    const node1 = makeNode({ id: 'n1', title: 'Engineering', ownerName: 'Alice' })
    const node2 = makeNode({ id: 'n2', title: 'Sales', ownerName: 'Bob' })

    nodeStore.$patch({ nodes: { [node1.id]: node1, [node2.id]: node2 } })

    const wrapper = mount(ExecutiveDashboard)

    const select = wrapper.find('#scope-select')
    const options = select.findAll('option')

    expect(options.length).toBeGreaterThanOrEqual(2)
    expect(wrapper.text()).toContain('Engineering · Alice')
    expect(wrapper.text()).toContain('Sales · Bob')
  })

  it('shows virtual scroll info when many goals exist', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    nodeStore.$patch({ nodes: { [node.id]: node } })

    // Create 25 root goals
    const goals: Record<string, Goal> = {}
    for (let i = 0; i < 25; i++) {
      const goal = makeGoal({
        id: `g${i}`,
        nodeId: node.id,
        description: `Goal ${i}`,
      })
      goals[goal.id] = goal
    }
    goalStore.$patch({ goals })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.find('.virtual-scroll-info').exists()).toBe(true)
    expect(wrapper.text()).toContain('virtual scrolling enabled')
  })

  it('does not show virtual scroll info when few goals exist', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    const goal = makeGoal({ nodeId: node.id })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.find('.virtual-scroll-info').exists()).toBe(false)
  })

  it('displays refinement count', () => {
    const nodeStore = useNodeStore()
    const goalStore = useGoalStore()

    const node = makeNode()
    const rootGoal = makeGoal({ id: 'g1', nodeId: node.id, type: 'Root' })
    const refinedGoal1 = makeGoal({
      id: 'g2',
      nodeId: node.id,
      type: 'Refined',
      sourceGoalId: 'g1',
    })
    const refinedGoal2 = makeGoal({
      id: 'g3',
      nodeId: node.id,
      type: 'Refined',
      sourceGoalId: 'g1',
    })

    nodeStore.$patch({ nodes: { [node.id]: node } })
    goalStore.$patch({
      goals: {
        [rootGoal.id]: rootGoal,
        [refinedGoal1.id]: refinedGoal1,
        [refinedGoal2.id]: refinedGoal2,
      },
    })

    const wrapper = mount(ExecutiveDashboard)

    expect(wrapper.text()).toContain('Refinements')
    expect(wrapper.text()).toContain('2')
  })
})

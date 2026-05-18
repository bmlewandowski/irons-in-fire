/**
 * Tests for GoalCard component.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useGoalStore } from '@/stores/goalStore'
import GoalCard from './GoalCard.vue'
import type { Goal } from '@/models'

describe('GoalCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function makeGoal(overrides: Partial<Goal> = {}): Goal {
    return {
      id: 'g1',
      nodeId: 'n1',
      type: 'Root',
      description: 'Test goal',
      weight: 1,
      status: 'Active',
      progress: 50,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }
  }

  it('renders goal description', () => {
    const goalStore = useGoalStore()
    const goal = makeGoal({ description: 'Increase revenue by 20%' })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
    })

    expect(wrapper.find('[data-testid="goal-description"]').text()).toBe('Increase revenue by 20%')
  })

  it('renders goal weight and status', () => {
    const goalStore = useGoalStore()
    const goal = makeGoal({ weight: 3, status: 'Complete' })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
    })

    expect(wrapper.text()).toContain('Weight: 3')
    expect(wrapper.text()).toContain('Status: Complete')
  })

  it('renders progress bar with correct percentage', () => {
    const goalStore = useGoalStore()
    const goal = makeGoal({ progress: 75 })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
    })

    const progressBar = wrapper.find('.progress-bar-fill')
    expect(progressBar.attributes('style')).toContain('width: 75%')
    expect(wrapper.find('.progress-pct').text()).toBe('75%')
  })

  it('renders progress bar with green color when progress >= 80%', () => {
    const goalStore = useGoalStore()
    const goal = makeGoal({ progress: 85 })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
    })

    const progressBar = wrapper.find('.progress-bar-fill')
    expect(progressBar.attributes('style')).toContain('background: rgb(46, 125, 50)')
  })

  it('emits update-progress when range input changes', async () => {
    const goalStore = useGoalStore()
    const goal = makeGoal({ progress: 50 })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
    })

    const rangeInput = wrapper.find('input[type="range"]')
    await rangeInput.setValue('75')
    await rangeInput.trigger('change')

    expect(wrapper.emitted('update-progress')).toBeTruthy()
    expect(wrapper.emitted('update-progress')?.[0]).toEqual([75])
  })

  it('emits update-status when status select changes', async () => {
    const goalStore = useGoalStore()
    const goal = makeGoal({ status: 'Active' })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
    })

    const select = wrapper.find('select')
    await select.setValue('Complete')
    await select.trigger('change')

    expect(wrapper.emitted('update-status')).toBeTruthy()
    expect(wrapper.emitted('update-status')?.[0]).toEqual(['Complete'])
  })

  it('shows delete confirmation modal when delete button clicked', async () => {
    const goalStore = useGoalStore()
    const goal = makeGoal()
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
      attachTo: document.body, // Required for Teleport
    })

    // Activate the card so the delete icon appears
    await wrapper.find('.goal-card').trigger('click')

    const deleteBtn = wrapper.find('.btn-icon-danger')
    await deleteBtn.trigger('click')

    // Modal should be in the body via Teleport
    expect(document.querySelector('.modal-backdrop')).toBeTruthy()
    expect(document.querySelector('.modal-title')?.textContent).toBe('Delete Goal')

    wrapper.unmount()
  })

  it('emits delete event when confirming deletion', async () => {
    const goalStore = useGoalStore()
    const goal = makeGoal()
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
      attachTo: document.body,
    })

    // Open modal
    await wrapper.find('.goal-card').trigger('click')
    await wrapper.find('.btn-icon-danger').trigger('click')

    // Confirm deletion
    const confirmBtn = document.querySelector('.btn-confirm-delete') as HTMLButtonElement
    confirmBtn.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')).toHaveLength(1)

    wrapper.unmount()
  })

  it('closes modal without emitting when cancel clicked', async () => {
    const goalStore = useGoalStore()
    const goal = makeGoal()
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
      attachTo: document.body,
    })

    // Open modal
    await wrapper.find('.goal-card').trigger('click')
    await wrapper.find('.btn-icon-danger').trigger('click')
    expect(document.querySelector('.modal-backdrop')).toBeTruthy()

    // Cancel
    const cancelBtn = document.querySelector('.btn-cancel') as HTMLButtonElement
    cancelBtn.click()
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.modal-backdrop')).toBeFalsy()
    expect(wrapper.emitted('delete')).toBeFalsy()

    wrapper.unmount()
  })

  it('shows source goal description for Refined goals', () => {
    const goalStore = useGoalStore()
    const sourceGoal = makeGoal({ id: 'g1', description: 'Parent goal', type: 'Root' })
    const refinedGoal = makeGoal({
      id: 'g2',
      type: 'Refined',
      description: 'Child goal',
      sourceGoalId: 'g1',
    })
    goalStore.$patch({
      goals: {
        [sourceGoal.id]: sourceGoal,
        [refinedGoal.id]: refinedGoal,
      },
    })

    const wrapper = mount(GoalCard, {
      props: { goalId: refinedGoal.id },
    })

    expect(wrapper.find('[data-testid="source-description"]').text()).toBe('Parent goal')
    expect(wrapper.text()).toContain('Source:')
  })

  it('does not show source description for Root goals', () => {
    const goalStore = useGoalStore()
    const goal = makeGoal({ type: 'Root' })
    goalStore.$patch({ goals: { [goal.id]: goal } })

    const wrapper = mount(GoalCard, {
      props: { goalId: goal.id },
    })

    expect(wrapper.find('[data-testid="source-description"]').exists()).toBe(false)
  })
})

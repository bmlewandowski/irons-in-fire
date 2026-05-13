import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Goal } from '@/models'
import type { GoalService } from '@/services/GoalService'

/**
 * Module-level reference to the GoalService instance.
 * Set via setGoalService() from main.ts after the service is constructed.
 */
let _goalService: GoalService | null = null

/**
 * Injects the GoalService instance so store actions can delegate to it.
 * Must be called before any store action is invoked.
 */
export function setGoalService(service: GoalService): void {
  _goalService = service
}

/**
 * Pinia store for goals.
 * Actions delegate to GoalService once wired via setGoalService().
 * Requirements: 4.1–4.9, 5.1–5.8
 */
export const useGoalStore = defineStore('goal', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const goals = ref<Record<string, Goal>>({})

  // ── Getters ────────────────────────────────────────────────────────────────

  /** All goals owned by the given node. */
  function goalsForNode(nodeId: string): Goal[] {
    return Object.values(goals.value).filter((g) => g.nodeId === nodeId)
  }

  /** Look up a single goal by its ID. */
  function goalById(id: string): Goal | undefined {
    return goals.value[id]
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function createGoal(
    _input: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Goal> {
    if (!_goalService) throw new Error('GoalService not wired')
    const result = await _goalService.createGoal({
      nodeId: _input.nodeId,
      type: _input.type,
      description: _input.description,
      weight: _input.weight,
      status: _input.status,
      sourceGoalId: _input.sourceGoalId,
    })
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  async function updateGoal(
    _id: string,
    _input: Partial<Pick<Goal, 'description' | 'weight' | 'status'>>
  ): Promise<Goal> {
    if (!_goalService) throw new Error('GoalService not wired')
    const result = await _goalService.updateGoal(_id, _input)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  async function deleteGoal(_id: string): Promise<void> {
    if (!_goalService) throw new Error('GoalService not wired')
    const result = await _goalService.deleteGoal(_id)
    if (!result.ok) throw new Error(result.error.message)
  }

  async function setProgress(_id: string, _value: number): Promise<void> {
    if (!_goalService) throw new Error('GoalService not wired')
    const result = await _goalService.setProgress(_id, _value)
    if (!result.ok) throw new Error(result.error.message)
  }

  return {
    // state
    goals,
    // getters
    goalsForNode,
    goalById,
    // actions
    createGoal,
    updateGoal,
    deleteGoal,
    setProgress,
  }
})

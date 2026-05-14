import type { Goal } from '@/models/Goal'
import type { useGoalStore } from '@/stores/goalStore'
import { computeWeightedProgress } from '@/composables/useProgressColor'

/**
 * Service responsible for computing and rolling up progress percentages
 * through the goal hierarchy.
 *
 * Requirements: 5.1–5.8
 */
export class ProgressService {
  constructor(private goalStore: ReturnType<typeof useGoalStore>) {}

  // -------------------------------------------------------------------------
  // computeWeightedAverage
  // -------------------------------------------------------------------------

  /**
   * Computes the weighted average progress of a set of child goals.
   *
   * Formula: Σ(weight_i × progress_i) / Σ(weight_i)
   *
   * - Null/undefined/NaN weights are treated as 0 (Req 5.8).
   * - If Σ(weight_i) === 0, returns 0 (Req 5.7).
   * - Result is clamped to [0, 100] (Req 10.2).
   *
   * This is a pure function — no side effects.
   *
   * Requirements: 5.2, 5.7, 5.8, 10.2
   */
  computeWeightedAverage(children: Goal[]): number {
    return computeWeightedProgress(children)
  }

  // -------------------------------------------------------------------------
  // rollUp
  // -------------------------------------------------------------------------

  /**
   * Walks the ancestor chain from `goalId` upward through the goal hierarchy,
   * recomputing each parent goal's progress using the weighted-average formula.
   *
   * The "children" of a parent goal for progress computation are all goals in
   * the store whose `sourceGoalId === parentGoalId` (for Refined goals) or
   * that are Sub_Tasks / Root goals sharing the same parent in the source chain.
   *
   * In practice: a goal's children for roll-up are all goals where
   * `sourceGoalId === parentGoalId`.
   *
   * All updates are collected first, then applied in a single $patch call.
   *
   * The entire walk must complete within 100 ms (Req 5.3, 5.6).
   *
   * Requirements: 5.1, 5.3, 5.4, 5.6
   */
  rollUp(goalId: string): void {
    const updates: Record<string, Goal> = {}

    // Start from the given goal and walk up via sourceGoalId
    let currentId: string | undefined = goalId

    while (currentId !== undefined) {
      const current: Goal | undefined = this.goalStore.goals[currentId] ?? updates[currentId]
      if (!current) break

      // Find the parent goal (the goal that this goal is a refinement of)
      const parentId: string | undefined = current.sourceGoalId
      if (!parentId) break

      const parent = this.goalStore.goals[parentId] ?? updates[parentId]
      if (!parent) break

      // Find all children of the parent (goals whose sourceGoalId === parentId)
      const siblings = Object.values(this.goalStore.goals).filter(
        (g) => g.sourceGoalId === parentId,
      )

      // Merge in any already-updated siblings from this walk
      const mergedSiblings = siblings.map((g) => updates[g.id] ?? g)

      const newProgress = this.computeWeightedAverage(mergedSiblings)
      const updatedParent: Goal = {
        ...parent,
        progress: newProgress,
        updatedAt: new Date().toISOString(),
      }

      updates[parentId] = updatedParent

      // Continue walking up
      currentId = parentId
    }

    // Apply all updates in a single patch
    if (Object.keys(updates).length > 0) {
      this.goalStore.$patch((state) => {
        for (const [id, goal] of Object.entries(updates)) {
          state.goals[id] = goal
        }
      })
    }
  }
}

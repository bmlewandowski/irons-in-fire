import type { Goal } from '@/models/Goal'
import type { AppError } from '@/models/AppError'
import type { Result } from '@/models/Result'
import type { Notification } from '@/models/Notification'
import type { PersistenceAdapter } from '@/adapters/PersistenceAdapter'
import { AdapterError } from '@/adapters/PersistenceAdapter'
import type { useNodeStore } from '@/stores/nodeStore'
import type { useGoalStore } from '@/stores/goalStore'
import type { useUiStore } from '@/stores/uiStore'
import { sanitizer } from './Sanitizer'
import {
  validateCreateGoalInput,
  validateUpdateGoalInput,
} from './ValidationService'
import type { CreateGoalInput, UpdateGoalInput } from './ValidationService'
import type { ProgressService } from './ProgressService'

/**
 * Business-logic service for Goal operations.
 * Validates, sanitizes, persists, and updates the Pinia store.
 *
 * Requirements: 4.1–4.9, 5.1–5.8, 6.3, 6.5, 6.6, 6.7
 */
export class GoalService {
  constructor(
    private adapter: PersistenceAdapter,
    private nodeStore: ReturnType<typeof useNodeStore>,
    private goalStore: ReturnType<typeof useGoalStore>,
    private uiStore: ReturnType<typeof useUiStore>,
    private progressService: ProgressService,
  ) {}

  // -------------------------------------------------------------------------
  // createGoal
  // -------------------------------------------------------------------------

  /**
   * Creates a new Goal.
   *
   * 1. Validates input fields.
   * 2. Sanitizes description.
   * 3. For Refined goals: validates sourceGoalId, source goal existence,
   *    source goal type, self-referential check, and ancestor relationship.
   * 4. Persists via adapter.
   * 5. Updates goalStore.
   *
   * Requirements: 4.1, 4.2, 4.3, 4.9, 6.1, 6.4, 6.5, 6.6
   */
  async createGoal(input: CreateGoalInput): Promise<Result<Goal, AppError>> {
    // Step 1: validate
    const errors = validateCreateGoalInput(input)
    if (errors.length > 0) {
      return { ok: false, error: errors[0] }
    }

    // Step 2: sanitize description
    const descResult = sanitizer.sanitizeAndValidate(input.description)
    if (!descResult.ok) return descResult

    // Step 3: Refined goal checks
    if (input.type === 'Refined') {
      // 3a: sourceGoalId must be present
      if (!input.sourceGoalId) {
        return {
          ok: false,
          error: {
            code: 'INVALID_SOURCE_GOAL',
            message: 'Source goal ID is required for Refined goals.',
          },
        }
      }

      // 3b: source goal must exist
      const sourceGoal = this.goalStore.goals[input.sourceGoalId]
      if (!sourceGoal) {
        return {
          ok: false,
          error: {
            code: 'INVALID_SOURCE_GOAL',
            message: `Source goal ${input.sourceGoalId} does not exist.`,
          },
        }
      }

      // 3c: source goal must be Root or Refined (not Sub_Task)
      if (sourceGoal.type === 'Sub_Task') {
        return {
          ok: false,
          error: {
            code: 'INVALID_SOURCE_GOAL',
            message: 'Source goal must be of type Root or Refined.',
          },
        }
      }

      // 3d: same-node check — a Refined goal must live on a different (child) node
      if (input.nodeId === sourceGoal.nodeId) {
        return {
          ok: false,
          error: {
            code: 'SELF_REFERENTIAL_REFINEMENT',
            message: 'A refined goal must be created on a child node, not the same node as its source goal.',
          },
        }
      }

      // 3e: ancestor relationship check — sourceGoal.nodeId must be an ancestor of input.nodeId
      if (!this.isAncestorNode(sourceGoal.nodeId, input.nodeId)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_ANCESTOR_RELATIONSHIP',
            message: 'Source goal must be owned by an ancestor node.',
          },
        }
      }
    }

    // Step 4: build and persist the goal
    const now = new Date().toISOString()
    const goal: Goal = {
      id: crypto.randomUUID(),
      nodeId: input.nodeId,
      type: input.type,
      description: descResult.value,
      weight: input.weight,
      status: input.status,
      progress: 0,
      ...(input.sourceGoalId !== undefined ? { sourceGoalId: input.sourceGoalId } : {}),
      ...(input.scaleConfig !== undefined ? { scaleConfig: input.scaleConfig } : {}),
      createdAt: now,
      updatedAt: now,
    }

    try {
      const persisted = await this.adapter.createGoal(goal)

      // Step 5: update store
      this.goalStore.$patch((state) => {
        state.goals[persisted.id] = persisted
      })

      return { ok: true, value: persisted }
    } catch (err) {
      if (err instanceof AdapterError) {
        return {
          ok: false,
          error: {
            code: 'ADAPTER_ERROR',
            message: err.message,
          },
        }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // updateGoal
  // -------------------------------------------------------------------------

  /**
   * Updates an existing Goal's mutable fields.
   *
   * Requirements: 4.4, 4.5, 4.6, 4.7, 6.3
   */
  async updateGoal(id: string, input: UpdateGoalInput): Promise<Result<Goal, AppError>> {
    // Step 1: check goal exists
    const existing = this.goalStore.goals[id]
    if (!existing) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Goal ${id} does not exist.`,
        },
      }
    }

    // Step 2: type immutability check
    if (input.type !== undefined && input.type !== existing.type) {
      return {
        ok: false,
        error: {
          code: 'TYPE_IMMUTABLE',
          message: 'Goal type cannot be changed after creation.',
        },
      }
    }

    // Step 3: validate
    const errors = validateUpdateGoalInput(input)
    if (errors.length > 0) {
      return { ok: false, error: errors[0] }
    }

    // Step 4: sanitize description if present
    const patch: Partial<Goal> = {}

    if (input.description !== undefined) {
      const descResult = sanitizer.sanitizeAndValidate(input.description)
      if (!descResult.ok) return descResult
      patch.description = descResult.value
    }

    // Step 5: build patch (exclude type — it's immutable)
    if (input.weight !== undefined) {
      patch.weight = input.weight
    }

    if (input.status !== undefined) {
      patch.status = input.status
    }

    if (input.scaleConfig !== undefined) {
      patch.scaleConfig = input.scaleConfig
    }

    // Step 6: if status === 'Complete', force progress to 100
    if (input.status === 'Complete') {
      patch.progress = 100
    }

    patch.updatedAt = new Date().toISOString()

    // Step 7: persist
    try {
      const updated = await this.adapter.updateGoal(id, patch)

      // Step 8: update store
      this.goalStore.$patch((state) => {
        state.goals[id] = updated
      })

      // Step 9: notification trigger — if description or status changed,
      // notify owners of all direct refiners
      if (input.description !== undefined || input.status !== undefined) {
        const refiners = Object.values(this.goalStore.goals).filter(
          (g) => g.sourceGoalId === id,
        )
        for (const refiner of refiners) {
          const notification: Notification = {
            id: crypto.randomUUID(),
            nodeId: refiner.nodeId,
            message: `Source goal ${id} has changed.`,
            sourceGoalId: id,
            read: false,
            createdAt: new Date().toISOString(),
          }
          this.uiStore.addNotification(notification)
        }
      }

      return { ok: true, value: updated }
    } catch (err) {
      if (err instanceof AdapterError) {
        const isNotFound = err.message.toLowerCase().includes('not found')
        return {
          ok: false,
          error: {
            code: isNotFound ? 'NOT_FOUND' : 'ADAPTER_ERROR',
            message: err.message,
          },
        }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // deleteGoal
  // -------------------------------------------------------------------------

  /**
   * Deletes a goal and all goals that transitively reference it as their source.
   *
   * Requirements: 4.8, 6.7
   */
  async deleteGoal(id: string): Promise<Result<void, AppError>> {
    // Step 1: check goal exists
    if (!this.goalStore.goals[id]) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Goal ${id} does not exist.`,
        },
      }
    }

    // Step 2: collect all goals to delete recursively (BFS)
    const toDelete: string[] = []
    const queue: string[] = [id]

    while (queue.length > 0) {
      const currentId = queue.shift()!
      toDelete.push(currentId)

      // Find all direct refiners of this goal
      const refiners = Object.values(this.goalStore.goals).filter(
        (g) => g.sourceGoalId === currentId,
      )
      for (const refiner of refiners) {
        queue.push(refiner.id)
      }
    }

    // Step 3: delete in reverse BFS order (deepest first)
    try {
      for (const goalId of [...toDelete].reverse()) {
        await this.adapter.deleteGoal(goalId)
      }

      // Step 4: update store — remove all deleted goals
      this.goalStore.$patch((state) => {
        for (const goalId of toDelete) {
          delete state.goals[goalId]
        }
      })

      return { ok: true, value: undefined }
    } catch (err) {
      if (err instanceof AdapterError) {
        return {
          ok: false,
          error: {
            code: 'ADAPTER_ERROR',
            message: err.message,
          },
        }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // setProgress
  // -------------------------------------------------------------------------

  /**
   * Sets the progress of a goal and rolls up the ancestor chain.
   *
   * Requirements: 5.1, 5.3, 5.5, 5.6
   */
  async setProgress(id: string, value: number): Promise<Result<void, AppError>> {
    // Step 1: check goal exists
    if (!this.goalStore.goals[id]) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Goal ${id} does not exist.`,
        },
      }
    }

    // Step 2: validate value is in [0, 100]
    if (typeof value !== 'number' || !isFinite(value) || value < 0 || value > 100) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Progress must be a number in the range [0, 100].',
          field: 'progress',
          constraint: 'range:0,100',
        },
      }
    }

    const now = new Date().toISOString()

    // Step 3: persist
    try {
      await this.adapter.updateGoal(id, { progress: value, updatedAt: now })

      // Step 4: update store
      this.goalStore.$patch((state) => {
        state.goals[id] = { ...state.goals[id], progress: value, updatedAt: now }
      })

      // Step 5: roll up ancestor chain
      this.progressService.rollUp(id)

      return { ok: true, value: undefined }
    } catch (err) {
      if (err instanceof AdapterError) {
        return {
          ok: false,
          error: {
            code: 'ADAPTER_ERROR',
            message: err.message,
          },
        }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Returns true if `ancestorNodeId` is an ancestor of `nodeId`
   * (i.e., appears somewhere in the parentId chain above `nodeId`).
   */
  private isAncestorNode(ancestorNodeId: string, nodeId: string): boolean {
    const visited = new Set<string>()
    let cursor: string | null | undefined = this.nodeStore.nodes[nodeId]?.parentId
    while (cursor != null) {
      if (cursor === ancestorNodeId) return true
      if (visited.has(cursor)) break  // cycle detected — stop traversal
      visited.add(cursor)
      cursor = this.nodeStore.nodes[cursor]?.parentId
    }
    return false
  }
}

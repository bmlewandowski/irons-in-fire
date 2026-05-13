import type { Goal } from '@/models/Goal'
import type { OrgNode } from '@/models/OrgNode'

/**
 * Abstraction over all storage operations for Nodes and Goals.
 * Implementations must return Promises; failures must reject with AdapterError.
 *
 * Requirements: 7.1
 */
export interface PersistenceAdapter {
  // -------------------------------------------------------------------------
  // Nodes
  // -------------------------------------------------------------------------

  /** Returns all nodes in the store. */
  readAllNodes(): Promise<OrgNode[]>

  /** Returns the node with the given id, or null if not found. */
  readNodeById(id: string): Promise<OrgNode | null>

  /** Persists a new node and returns it. */
  createNode(node: OrgNode): Promise<OrgNode>

  /**
   * Applies patch to the node with the given id and returns the updated node.
   * Rejects with AdapterError if the id does not exist.
   */
  updateNode(id: string, patch: Partial<OrgNode>): Promise<OrgNode>

  /**
   * Removes the node with the given id.
   * Rejects with AdapterError if the id does not exist.
   */
  deleteNode(id: string): Promise<void>

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------

  /** Returns all goals in the store. */
  readAllGoals(): Promise<Goal[]>

  /** Returns the goal with the given id, or null if not found. */
  readGoalById(id: string): Promise<Goal | null>

  /** Persists a new goal and returns it. */
  createGoal(goal: Goal): Promise<Goal>

  /**
   * Applies patch to the goal with the given id and returns the updated goal.
   * Rejects with AdapterError if the id does not exist.
   */
  updateGoal(id: string, patch: Partial<Goal>): Promise<Goal>

  /**
   * Removes the goal with the given id.
   * Rejects with AdapterError if the id does not exist.
   */
  deleteGoal(id: string): Promise<void>
}

/**
 * Error thrown (or used to reject) by PersistenceAdapter implementations.
 * The service layer catches this and converts it to an AppError.
 *
 * Requirements: 7.4
 */
export class AdapterError extends Error {
  readonly code = 'ADAPTER_ERROR' as const

  constructor(message: string) {
    super(message)
    this.name = 'AdapterError'
    // Maintain proper prototype chain in transpiled ES5 output.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

import type { Goal } from '@/models/Goal'
import type { OrgNode } from '@/models/OrgNode'
import { AdapterError } from './PersistenceAdapter'
import type { PersistenceAdapter } from './PersistenceAdapter'

/**
 * Configuration for injecting failures into MockAdapter.
 *
 * - `operation`: the method name to fail on (e.g. 'createNode')
 * - `afterCount`: if provided, the operation succeeds this many times before
 *   throwing; if omitted, it fails on the very first call.
 */
export interface FailureConfig {
  operation: string
  afterCount?: number
}

/**
 * In-memory PersistenceAdapter for use in tests.
 * Stores nodes and goals in plain Maps.
 * Supports injected failure via the optional `failAt` constructor parameter.
 *
 * Requirements: 7.1
 */
export class MockAdapter implements PersistenceAdapter {
  private nodes = new Map<string, OrgNode>()
  private goals = new Map<string, Goal>()

  /** Tracks how many times each operation has been called successfully. */
  private callCounts = new Map<string, number>()

  constructor(private readonly failAt?: FailureConfig) {}

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Checks whether the named operation should throw on this invocation.
   * Increments the call counter before deciding.
   */
  private checkFailure(operation: string): void {
    if (!this.failAt || this.failAt.operation !== operation) return

    const count = this.callCounts.get(operation) ?? 0

    if (this.failAt.afterCount === undefined || count >= this.failAt.afterCount) {
      throw new AdapterError(`Injected failure on operation "${operation}"`)
    }

    this.callCounts.set(operation, count + 1)
  }

  // -------------------------------------------------------------------------
  // Nodes
  // -------------------------------------------------------------------------

  readAllNodes(): Promise<OrgNode[]> {
    this.checkFailure('readAllNodes')
    return Promise.resolve(Array.from(this.nodes.values()))
  }

  readNodeById(id: string): Promise<OrgNode | null> {
    this.checkFailure('readNodeById')
    return Promise.resolve(this.nodes.get(id) ?? null)
  }

  createNode(node: OrgNode): Promise<OrgNode> {
    this.checkFailure('createNode')
    this.nodes.set(node.id, { ...node })
    return Promise.resolve({ ...node })
  }

  updateNode(id: string, patch: Partial<OrgNode>): Promise<OrgNode> {
    this.checkFailure('updateNode')
    const existing = this.nodes.get(id)
    if (!existing) {
      return Promise.reject(new AdapterError('Not found'))
    }
    const updated: OrgNode = { ...existing, ...patch }
    this.nodes.set(id, updated)
    return Promise.resolve({ ...updated })
  }

  deleteNode(id: string): Promise<void> {
    this.checkFailure('deleteNode')
    if (!this.nodes.has(id)) {
      return Promise.reject(new AdapterError('Not found'))
    }
    this.nodes.delete(id)
    return Promise.resolve()
  }

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------

  readAllGoals(): Promise<Goal[]> {
    this.checkFailure('readAllGoals')
    return Promise.resolve(Array.from(this.goals.values()))
  }

  readGoalById(id: string): Promise<Goal | null> {
    this.checkFailure('readGoalById')
    return Promise.resolve(this.goals.get(id) ?? null)
  }

  createGoal(goal: Goal): Promise<Goal> {
    this.checkFailure('createGoal')
    this.goals.set(goal.id, { ...goal })
    return Promise.resolve({ ...goal })
  }

  updateGoal(id: string, patch: Partial<Goal>): Promise<Goal> {
    this.checkFailure('updateGoal')
    const existing = this.goals.get(id)
    if (!existing) {
      return Promise.reject(new AdapterError('Not found'))
    }
    const updated: Goal = { ...existing, ...patch }
    this.goals.set(id, updated)
    return Promise.resolve({ ...updated })
  }

  deleteGoal(id: string): Promise<void> {
    this.checkFailure('deleteGoal')
    if (!this.goals.has(id)) {
      return Promise.reject(new AdapterError('Not found'))
    }
    this.goals.delete(id)
    return Promise.resolve()
  }
}

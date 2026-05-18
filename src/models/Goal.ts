import type { ScaleConfig } from './RatingScale'

/**
 * The type of a goal. Immutable after creation.
 * - Root: top-level objective owned by a node
 * - Refined: a child-node restatement of a Root or Refined goal
 * - Sub_Task: leaf-level action item with no child goals
 */
export type GoalType = 'Root' | 'Refined' | 'Sub_Task'

/**
 * The lifecycle status of a goal.
 * Setting status to 'Complete' forces progress to 100.
 */
export type GoalStatus = 'Active' | 'Refined' | 'Complete'

/**
 * Represents a single objective owned by an OrgNode.
 */
export interface Goal {
  /** UUID, immutable after creation */
  id: string
  /** ID of the owning OrgNode */
  nodeId: string
  /** Goal classification; immutable after creation */
  type: GoalType
  /** 1–500 chars pre-sanitization; 1–1000 chars post-sanitization */
  description: string
  /** Finite positive number in range [0.01, 1000] */
  weight: number
  /** Lifecycle status */
  status: GoalStatus
  /** Completion percentage in [0, 100]; computed for non-leaf goals */
  progress: number
  /** Required for Refined goals; references the source Root or Refined goal */
  sourceGoalId?: string
  /** Optional rating scale configuration for progress measurement */
  scaleConfig?: ScaleConfig
  /** ISO 8601 timestamp */
  createdAt: string
  /** ISO 8601 timestamp */
  updatedAt: string
}

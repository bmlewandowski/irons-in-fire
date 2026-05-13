/**
 * An in-application notification surfaced to a node owner.
 * Created when a source goal's description or status changes
 * and there are Refined_Goals that directly reference it (Req 6.3).
 */
export interface Notification {
  /** UUID */
  id: string
  /** ID of the OrgNode whose owner should see this notification */
  nodeId: string
  /** Human-readable notification text */
  message: string
  /** ID of the goal that triggered this notification */
  sourceGoalId: string
  /** Whether the user has acknowledged this notification */
  read: boolean
  /** ISO 8601 timestamp */
  createdAt: string
}

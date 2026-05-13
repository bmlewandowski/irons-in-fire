/**
 * Role levels for organizational nodes.
 * 'Custom' requires a customRoleLabel to be provided.
 */
export type RoleLevel =
  | 'CEO/President'
  | 'Vice President'
  | 'Executive'
  | 'Director'
  | 'Manager'
  | 'Supervisor'
  | 'Lead'
  | 'Employee'
  | 'Contractor'
  | 'Custom'

/**
 * Represents a single node in the organizational hierarchy.
 * IDs are UUIDs assigned at creation and are immutable thereafter.
 */
export interface OrgNode {
  /** UUID, immutable after creation */
  id: string
  /** null for Root_Node (top of hierarchy) */
  parentId: string | null
  /** 1–100 chars (post-sanitization); per Req 10.3 up to 200 chars */
  title: string
  /** 1–100 chars (post-sanitization) */
  ownerName: string
  /** Role classification; 'Custom' requires customRoleLabel */
  roleLevel: RoleLevel
  /** Required when roleLevel === 'Custom'; 1–50 chars (post-sanitization) */
  customRoleLabel?: string
  /** ISO 8601 timestamp */
  createdAt: string
  /** ISO 8601 timestamp */
  updatedAt: string
}

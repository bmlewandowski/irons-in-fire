import type { AppError } from '@/models/AppError'
import type { GoalStatus, GoalType } from '@/models/Goal'
import type { RoleLevel } from '@/models/OrgNode'
import { sanitizer } from './Sanitizer'

// ---------------------------------------------------------------------------
// Input type definitions
// ---------------------------------------------------------------------------

/** Input for creating a new OrgNode. */
export interface CreateNodeInput {
  title: string
  ownerName: string
  roleLevel: RoleLevel
  customRoleLabel?: string
  parentId?: string | null
}

/** Input for updating an existing OrgNode (all fields optional). */
export type UpdateNodeInput = Partial<{
  title: string
  ownerName: string
  roleLevel: RoleLevel
  customRoleLabel?: string
}>

/** Input for creating a new Goal. */
export interface CreateGoalInput {
  nodeId: string
  type: GoalType
  description: string
  weight: number
  status: GoalStatus
  sourceGoalId?: string
}

/** Input for updating an existing Goal (all fields optional). */
export type UpdateGoalInput = Partial<{
  description: string
  weight: number
  status: GoalStatus
  type: GoalType
}>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_GOAL_STATUSES: GoalStatus[] = ['Active', 'Refined', 'Complete']
const VALID_GOAL_TYPES: GoalType[] = ['Root', 'Refined', 'Sub_Task']
const VALID_ROLE_LEVELS: RoleLevel[] = [
  'CEO/President', 'Vice President', 'Executive', 'Director', 'Manager',
  'Supervisor', 'Lead', 'Employee', 'Contractor', 'Custom',
]

const TITLE_MAX_LENGTH = 100        // Req 1.4 (stricter than Req 10.3's 200)
const OWNER_NAME_MAX_LENGTH = 100   // Req 1.4
const CUSTOM_ROLE_LABEL_MAX_LENGTH = 50  // Req 1.7, 1.8
const DESCRIPTION_PRE_SANITIZE_MAX = 500  // Req 4.1
const DESCRIPTION_POST_SANITIZE_MAX = 1000 // Req 10.4
const WEIGHT_MIN = 0.01             // Req 4.1, 4.5, 10.1
const WEIGHT_MAX = 1000             // Req 4.1, 4.5, 10.1

// ---------------------------------------------------------------------------
// Helper: build a structured VALIDATION_ERROR AppError
// ---------------------------------------------------------------------------

function validationError(field: string, constraint: string, message: string): AppError {
  return {
    code: 'VALIDATION_ERROR',
    message,
    field,
    constraint,
  }
}

// ---------------------------------------------------------------------------
// Field-level validators
// Each returns AppError | null — null means valid.
// Sanitization is run before length checks (Req 10.4).
// ---------------------------------------------------------------------------

/**
 * Validates a node title.
 * Rules: non-empty, max 100 chars post-sanitization (Req 1.4).
 */
export function validateNodeTitle(title: string): AppError | null {
  if (typeof title !== 'string' || title.trim().length === 0) {
    return validationError('title', 'non_empty', 'Title must be a non-empty string.')
  }
  const sanitized = sanitizer.sanitize(title)
  if (sanitized.length > TITLE_MAX_LENGTH) {
    return validationError(
      'title',
      `max_length:${TITLE_MAX_LENGTH}`,
      `Title must not exceed ${TITLE_MAX_LENGTH} characters.`,
    )
  }
  return null
}

/**
 * Validates an owner name.
 * Rules: non-empty, max 100 chars post-sanitization (Req 1.4).
 */
export function validateOwnerName(ownerName: string): AppError | null {
  if (typeof ownerName !== 'string' || ownerName.trim().length === 0) {
    return validationError('ownerName', 'non_empty', 'Owner name must be a non-empty string.')
  }
  const sanitized = sanitizer.sanitize(ownerName)
  if (sanitized.length > OWNER_NAME_MAX_LENGTH) {
    return validationError(
      'ownerName',
      `max_length:${OWNER_NAME_MAX_LENGTH}`,
      `Owner name must not exceed ${OWNER_NAME_MAX_LENGTH} characters.`,
    )
  }
  return null
}

/**
 * Validates a custom role label.
 * Rules: non-empty, max 50 chars post-sanitization (Req 1.7, 1.8).
 */
export function validateCustomRoleLabel(label: string): AppError | null {
  if (typeof label !== 'string' || label.trim().length === 0) {
    return validationError(
      'customRoleLabel',
      'non_empty',
      'Custom role label must be a non-empty string.',
    )
  }
  const sanitized = sanitizer.sanitize(label)
  if (sanitized.length > CUSTOM_ROLE_LABEL_MAX_LENGTH) {
    return validationError(
      'customRoleLabel',
      `max_length:${CUSTOM_ROLE_LABEL_MAX_LENGTH}`,
      `Custom role label must not exceed ${CUSTOM_ROLE_LABEL_MAX_LENGTH} characters.`,
    )
  }
  return null
}

/**
 * Validates a goal description.
 * Rules:
 *   - non-empty
 *   - max 500 chars pre-sanitization (Req 4.1)
 *   - max 1000 chars post-sanitization (Req 10.4)
 */
export function validateGoalDescription(description: string): AppError | null {
  if (typeof description !== 'string' || description.trim().length === 0) {
    return validationError(
      'description',
      'non_empty',
      'Description must be a non-empty string.',
    )
  }
  if (description.length > DESCRIPTION_PRE_SANITIZE_MAX) {
    return validationError(
      'description',
      `max_length:${DESCRIPTION_PRE_SANITIZE_MAX}`,
      `Description must not exceed ${DESCRIPTION_PRE_SANITIZE_MAX} characters.`,
    )
  }
  const sanitized = sanitizer.sanitize(description)
  if (sanitized.length > DESCRIPTION_POST_SANITIZE_MAX) {
    return validationError(
      'description',
      `max_length_post_sanitization:${DESCRIPTION_POST_SANITIZE_MAX}`,
      `Description must not exceed ${DESCRIPTION_POST_SANITIZE_MAX} characters after sanitization.`,
    )
  }
  return null
}

/**
 * Validates a goal weight.
 * Rules: finite positive number in range [0.01, 1000] (Req 4.1, 4.5, 10.1).
 */
export function validateGoalWeight(weight: number): AppError | null {
  if (typeof weight !== 'number' || !isFinite(weight)) {
    return validationError(
      'weight',
      'finite_number',
      'Weight must be a finite number.',
    )
  }
  if (weight < WEIGHT_MIN || weight > WEIGHT_MAX) {
    return validationError(
      'weight',
      `range:${WEIGHT_MIN},${WEIGHT_MAX}`,
      `Weight must be between ${WEIGHT_MIN} and ${WEIGHT_MAX}.`,
    )
  }
  return null
}

/**
 * Validates a role level.
 * Rules: must be one of the recognised RoleLevel values.
 */
export function validateRoleLevel(roleLevel: RoleLevel): AppError | null {
  if (!VALID_ROLE_LEVELS.includes(roleLevel)) {
    return validationError(
      'roleLevel',
      `enum:${VALID_ROLE_LEVELS.join(',')}`,
      `Role level must be one of: ${VALID_ROLE_LEVELS.join(', ')}.`,
    )
  }
  return null
}

/**
 * Validates a goal status.
 * Rules: must be one of 'Active' | 'Refined' | 'Complete' (Req 4.1).
 */
export function validateGoalStatus(status: GoalStatus): AppError | null {
  if (!VALID_GOAL_STATUSES.includes(status)) {
    return validationError(
      'status',
      `enum:${VALID_GOAL_STATUSES.join(',')}`,
      `Status must be one of: ${VALID_GOAL_STATUSES.join(', ')}.`,
    )
  }
  return null
}

/**
 * Validates a goal type.
 * Rules: must be one of 'Root' | 'Refined' | 'Sub_Task' (Req 4.1).
 */
export function validateGoalType(type: GoalType): AppError | null {
  if (!VALID_GOAL_TYPES.includes(type)) {
    return validationError(
      'type',
      `enum:${VALID_GOAL_TYPES.join(',')}`,
      `Type must be one of: ${VALID_GOAL_TYPES.join(', ')}.`,
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Composite validators
// Return AppError[] — empty array means all fields are valid (Req 10.5, 10.6).
// ---------------------------------------------------------------------------

/**
 * Validates all required fields for creating a new OrgNode.
 * Requirements: 1.4, 1.7, 1.8, 10.5, 10.6, 10.7
 */
export function validateCreateNodeInput(input: CreateNodeInput): AppError[] {
  const errors: AppError[] = []

  const titleError = validateNodeTitle(input.title)
  if (titleError) errors.push(titleError)

  const ownerError = validateOwnerName(input.ownerName)
  if (ownerError) errors.push(ownerError)

  const roleLevelError = validateRoleLevel(input.roleLevel)
  if (roleLevelError) errors.push(roleLevelError)

  // If roleLevel is Custom, customRoleLabel is required and must be valid
  if (input.roleLevel === 'Custom') {
    if (input.customRoleLabel === undefined || input.customRoleLabel === null) {
      errors.push(
        validationError(
          'customRoleLabel',
          'required_for_custom',
          'Custom role label is required when role level is Custom.',
        ),
      )
    } else {
      const labelError = validateCustomRoleLabel(input.customRoleLabel)
      if (labelError) errors.push(labelError)
    }
  }

  return errors
}

/**
 * Validates all provided fields for updating an existing OrgNode.
 * Only validates fields that are present in the input (partial update).
 * Requirements: 1.4, 1.7, 1.8, 10.5, 10.6, 10.7
 */
export function validateUpdateNodeInput(input: UpdateNodeInput): AppError[] {
  const errors: AppError[] = []

  if (input.title !== undefined) {
    const titleError = validateNodeTitle(input.title)
    if (titleError) errors.push(titleError)
  }

  if (input.ownerName !== undefined) {
    const ownerError = validateOwnerName(input.ownerName)
    if (ownerError) errors.push(ownerError)
  }

  // If roleLevel is being set to Custom, customRoleLabel must be provided and valid
  if (input.roleLevel === 'Custom') {
    if (input.customRoleLabel === undefined || input.customRoleLabel === null) {
      errors.push(
        validationError(
          'customRoleLabel',
          'required_for_custom',
          'Custom role label is required when role level is Custom.',
        ),
      )
    } else {
      const labelError = validateCustomRoleLabel(input.customRoleLabel)
      if (labelError) errors.push(labelError)
    }
  } else if (input.customRoleLabel !== undefined) {
    // customRoleLabel provided but roleLevel is not Custom — still validate it
    const labelError = validateCustomRoleLabel(input.customRoleLabel)
    if (labelError) errors.push(labelError)
  }

  return errors
}

/**
 * Validates all required fields for creating a new Goal.
 * Requirements: 4.1, 4.5, 10.1, 10.5, 10.6, 10.7
 */
export function validateCreateGoalInput(input: CreateGoalInput): AppError[] {
  const errors: AppError[] = []

  const typeError = validateGoalType(input.type)
  if (typeError) errors.push(typeError)

  const descError = validateGoalDescription(input.description)
  if (descError) errors.push(descError)

  const weightError = validateGoalWeight(input.weight)
  if (weightError) errors.push(weightError)

  const statusError = validateGoalStatus(input.status)
  if (statusError) errors.push(statusError)

  return errors
}

/**
 * Validates all provided fields for updating an existing Goal.
 * Only validates fields that are present in the input (partial update).
 * Requirements: 4.1, 4.5, 10.1, 10.5, 10.6, 10.7
 */
export function validateUpdateGoalInput(input: UpdateGoalInput): AppError[] {
  const errors: AppError[] = []

  if (input.description !== undefined) {
    const descError = validateGoalDescription(input.description)
    if (descError) errors.push(descError)
  }

  if (input.weight !== undefined) {
    const weightError = validateGoalWeight(input.weight)
    if (weightError) errors.push(weightError)
  }

  if (input.status !== undefined) {
    const statusError = validateGoalStatus(input.status)
    if (statusError) errors.push(statusError)
  }

  if (input.type !== undefined) {
    const typeError = validateGoalType(input.type)
    if (typeError) errors.push(typeError)
  }

  return errors
}

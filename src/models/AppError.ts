/**
 * Discriminated set of error codes used throughout the application.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CYCLE_DETECTED'
  | 'INVALID_SOURCE_GOAL'
  | 'SELF_REFERENTIAL_REFINEMENT'
  | 'INVALID_ANCESTOR_RELATIONSHIP'
  | 'TYPE_IMMUTABLE'
  | 'ADAPTER_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'SANITIZATION_REJECTED'
  | 'INVALID_SCALE_TYPE'

/**
 * Structured error returned by all service-layer operations.
 * Validation errors include `field` and `constraint` to identify
 * exactly which rule was violated (Req 10.5, 10.7).
 */
export interface AppError {
  /** Machine-readable error classification */
  code: ErrorCode
  /** Human-readable description suitable for display */
  message: string
  /** Present for validation errors; identifies the offending field */
  field?: string
  /** Present for validation errors; describes the violated constraint, e.g. "max_length:100" */
  constraint?: string
}

/**
 * Discriminated union for service-layer return values.
 * Avoids exception-based control flow by making success and failure
 * explicit branches that callers must handle.
 *
 * @example
 * const result: Result<OrgNode, AppError> = await nodeService.createNode(input)
 * if (result.ok) {
 *   console.log(result.value) // OrgNode
 * } else {
 *   console.error(result.error) // AppError
 * }
 */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }

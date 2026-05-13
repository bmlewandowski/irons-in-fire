# Implementation Plan: Irons in Fire (MBO Application)

## Overview

Implement the Irons in Fire MBO application in layers: project scaffolding → data models → sanitizer/validation → persistence adapters → Pinia stores → service layer → Vue components → accessibility and integration tests. Each task builds on the previous, ending with all pieces wired together and verified.

## Tasks

- [x] 1. Scaffold project structure and configuration
  - [x] 1.1 Initialize Vite + Vue 3 + TypeScript project
    - Run `npm create vite@latest` with the `vue-ts` template
    - Configure `tsconfig.json` with strict mode, path aliases (`@/` → `src/`)
    - Install dependencies: `pinia`, `vitest`, `@vitest/ui`, `fast-check`, `@vue/test-utils`
    - Add `vite.config.ts` with Vitest configuration (globals, environment: jsdom)
    - Create `.env.example` documenting `VITE_PERSISTENCE_ADAPTER` and `VITE_API_URL`
    - _Requirements: 7.5_

  - [x] 1.2 Create directory structure and barrel exports
    - Create `src/adapters/`, `src/services/`, `src/stores/`, `src/components/`, `src/models/`, `src/tests/`
    - Add `index.ts` barrel files in each directory
    - _Requirements: 7.1_

- [x] 2. Define core data models and types
  - [x] 2.1 Implement TypeScript interfaces and enums
    - Create `src/models/OrgNode.ts`: `OrgNode` interface, `RoleLevel` type
    - Create `src/models/Goal.ts`: `Goal` interface, `GoalType`, `GoalStatus` types
    - Create `src/models/AppError.ts`: `AppError` interface, `ErrorCode` union type
    - Create `src/models/Result.ts`: `Result<T, E>` discriminated union
    - Create `src/models/Notification.ts`: `Notification` interface
    - Create `src/models/ViewportRect.ts`: `ViewportRect` interface
    - Export all from `src/models/index.ts`
    - _Requirements: 1.1, 1.6, 4.1, 10.1–10.4_

- [x] 3. Implement Sanitizer module
  - [x] 3.1 Implement `Sanitizer` class
    - Create `src/services/Sanitizer.ts`
    - Implement `sanitize(input: string): string` — escape `<`, `>`, `"`, `'`, `&` to HTML entities
    - Implement `isSafe(input: string): boolean` — detect `<script>`, `onerror=`, `javascript:` URIs, and HTML-entity-encoded variants
    - Throw / return `SANITIZATION_REJECTED` error when `isSafe` returns false after sanitization
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x]* 3.2 Write property test: Sanitizer idempotence (Property 7)
    - **Property 7: Sanitizer idempotence** — `sanitize(sanitize(S)) === sanitize(S)` for all strings S
    - Use `fc.string()` (full unicode) as the arbitrary
    - **Validates: Requirements 9.1, 9.3**
    - Tag: `// Feature: irons-in-fire, Property 7: Sanitizer idempotence`

  - [x]* 3.3 Write property test: Sanitizer safe-output guarantee (Property 8)
    - **Property 8: Sanitizer safe-output guarantee** — sanitized output contains no executable constructs
    - Use `fc.string()` plus XSS payload generators (`<script>`, `onerror=`, `javascript:`, entity-encoded variants)
    - Assert no unescaped `<`, `>`, `"`, `'`, `&` in output; no `<script>`, `onerror=`, `javascript:` patterns
    - **Validates: Requirements 9.2, 9.4**
    - Tag: `// Feature: irons-in-fire, Property 8: Sanitizer safe-output guarantee`

  - [x]* 3.4 Write unit tests for Sanitizer
    - Test known XSS vectors: `<script>alert(1)</script>`, `onerror=alert(1)`, `javascript:void(0)`, entity-encoded variants
    - Test that clean strings pass through unchanged
    - Test that `isSafe` returns false for XSS payloads
    - _Requirements: 9.1–9.5_

- [x] 4. Implement ValidationService
  - [x] 4.1 Implement `ValidationService`
    - Create `src/services/ValidationService.ts`
    - Implement field-level validators: `validateNodeTitle`, `validateOwnerName`, `validateCustomRoleLabel`, `validateGoalDescription`, `validateGoalWeight`, `validateGoalStatus`, `validateGoalType`
    - Each validator returns `AppError | null`; a null return means valid
    - Integrate `Sanitizer` — run sanitization before length checks; enforce post-sanitization length limits (Req 10.4: 1000 chars)
    - Export `validateCreateNodeInput`, `validateUpdateNodeInput`, `validateCreateGoalInput`, `validateUpdateGoalInput` composite validators
    - _Requirements: 1.4, 1.7, 1.8, 4.1, 4.5, 10.1–10.7_

  - [x]* 4.2 Write property test: Validation rejects out-of-range weights (Property 9)
    - **Property 9: Validation rejects out-of-range weights** — any weight outside (0, 1000] is rejected with `VALIDATION_ERROR` on field `weight`
    - Use `fc.float()` filtered to values ≤ 0 or > 1000, plus `NaN`, `Infinity`, `-Infinity`
    - **Validates: Requirements 4.1, 4.5, 10.1, 10.5, 10.6**
    - Tag: `// Feature: irons-in-fire, Property 9: Validation rejects out-of-range weights`

  - [x]* 4.3 Write property test: Structured validation errors (Property 18)
    - **Property 18: Validation errors are structured and identify the violated field**
    - Generate random invalid inputs across all fields; assert every rejection includes `field` and `constraint`
    - **Validates: Requirements 10.5, 10.7**
    - Tag: `// Feature: irons-in-fire, Property 18: Structured validation errors`

  - [x]* 4.4 Write unit tests for ValidationService
    - Test each field validator with boundary values (empty string, max-length, max+1)
    - Test composite validators reject partial invalid inputs and accept fully valid inputs
    - _Requirements: 1.4, 1.7, 1.8, 4.1, 4.5, 10.1–10.7_

- [x] 5. Implement PersistenceAdapter interface and adapters
  - [x] 5.1 Define `PersistenceAdapter` interface and `MockAdapter`
    - Create `src/adapters/PersistenceAdapter.ts` with the full interface (readAllNodes, readNodeById, createNode, updateNode, deleteNode, readAllGoals, readGoalById, createGoal, updateGoal, deleteGoal)
    - Create `src/adapters/MockAdapter.ts` — in-memory implementation for tests; supports injected failure at a configurable operation step
    - _Requirements: 7.1_

  - [x] 5.2 Implement `LocalStorageAdapter`
    - Create `src/adapters/LocalStorageAdapter.ts`
    - Use `localStorage` with JSON serialization; fall back to `indexedDB` when `localStorage` quota is exceeded
    - All methods return Promises; failures reject with `AdapterError`
    - _Requirements: 7.2_

  - [x] 5.3 Implement `ApiAdapter`
    - Create `src/adapters/ApiAdapter.ts`
    - Read `VITE_API_URL` from `import.meta.env`; delegate all operations to REST endpoints
    - All methods return Promises; HTTP errors reject with `AdapterError`
    - _Requirements: 7.3_

  - [x] 5.4 Implement adapter factory and startup guard
    - Create `src/adapters/index.ts` with `createAdapter()` factory
    - Throw `ConfigurationError` (code: `CONFIGURATION_ERROR`) when `VITE_PERSISTENCE_ADAPTER` is absent or unrecognized
    - _Requirements: 7.5, 7.6_

  - [x]* 5.5 Write property test: Adapter operation atomicity (Property 12)
    - **Property 12: Adapter operation atomicity** — failed operations leave state identical to pre-operation state
    - Use `MockAdapter` with injected failure at random step; assert store state unchanged after failure
    - **Validates: Requirements 7.4, 10.5, 10.6**
    - Tag: `// Feature: irons-in-fire, Property 12: Adapter operation atomicity`

  - [x]* 5.6 Write integration tests for adapter swap
    - Run identical create/update/delete sequences against `LocalStorageAdapter` and `MockAdapter`; assert identical results
    - _Requirements: 7.1–7.5_

- [x] 6. Implement Pinia stores
  - [x] 6.1 Implement `nodeStore`
    - Create `src/stores/nodeStore.ts`
    - State: `nodes: Record<string, OrgNode>`, `selectedNodeId: string | null`
    - Actions: `createNode`, `updateNode`, `deleteNode`, `reparentNode` (delegate to `NodeService`)
    - _Requirements: 1.1–1.8, 3.1–3.7_

  - [x] 6.2 Implement `goalStore`
    - Create `src/stores/goalStore.ts`
    - State: `goals: Record<string, Goal>`
    - Actions: `createGoal`, `updateGoal`, `deleteGoal`, `setProgress` (delegate to `GoalService`)
    - _Requirements: 4.1–4.9, 5.1–5.8_

  - [x] 6.3 Implement `uiStore`
    - Create `src/stores/uiStore.ts`
    - State: `drillDownGoalId: string | null`, `notifications: Notification[]`, `viewport: ViewportRect`
    - Actions: `activateDrillDown`, `deactivateDrillDown`, `addNotification`, `dismissNotification`, `updateViewport`
    - _Requirements: 8.3, 8.4, 6.3_

  - [x] 6.4 Implement `dashboardStore`
    - Create `src/stores/dashboardStore.ts`
    - Derived store: expose `rootGoals: ComputedRef<Goal[]>` — goals where `type === 'Root'` and owning node has `parentId === null`
    - _Requirements: 8.1, 8.5_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement NodeService
  - [x] 8.1 Implement `NodeService` core operations
    - Create `src/services/NodeService.ts`
    - Implement `createNode(input)`: validate → sanitize → check parent exists → persist → update `nodeStore`
    - Implement `updateNode(id, input)`: validate → sanitize → persist → update `nodeStore` (ID and parentId immutable)
    - Implement `deleteNode(id)`: collect subtree → delete all goals in subtree → delete all nodes in subtree (cascade)
    - All methods return `Result<T, AppError>`
    - _Requirements: 1.1–1.8_

  - [x]* 8.2 Write property test: Node ID immutability (Property 1)
    - **Property 1: Node ID immutability after creation** — id and parentId unchanged after any update sequence
    - Use `fc.record` for node fields + random update sequences
    - **Validates: Requirements 1.1, 1.4**
    - Tag: `// Feature: irons-in-fire, Property 1: Node ID immutability after creation`

  - [x] 8.3 Implement `reparentNode` with cycle detection
    - Implement `reparentNode(nodeId, newParentId)`: walk ancestors of `newParentId`; reject if `nodeId` is encountered
    - On success: persist updated `parentId` → update `nodeStore` → trigger progress recalculation for old and new ancestor chains
    - On cycle: return `Result` with `CYCLE_DETECTED` error; snap node back in UI
    - _Requirements: 3.1–3.7_

  - [x]* 8.4 Write property test: Cascade delete removes entire subtree (Property 2)
    - **Property 2: Cascade delete removes entire subtree** — no orphaned nodes or goals remain after delete
    - Use `fc.array` of child nodes with associated goals; assert store empty of all descendants and their goals
    - **Validates: Requirements 1.5**
    - Tag: `// Feature: irons-in-fire, Property 2: Cascade delete removes entire subtree`

  - [x]* 8.5 Write property test: Cycle detection rejects all ancestor targets (Property 3)
    - **Property 3: Cycle detection rejects all ancestor targets** — reparenting to any ancestor is rejected; hierarchy unchanged
    - Use random tree + ancestor selection; assert rejection and unchanged state
    - **Validates: Requirements 3.5, 3.6**
    - Tag: `// Feature: irons-in-fire, Property 3: Cycle detection rejects all ancestor targets`

  - [x]* 8.6 Write unit tests for NodeService
    - Test create with valid/invalid parent, update fields, delete leaf vs. subtree, reparent valid/cycle cases
    - _Requirements: 1.1–1.8, 3.1–3.7_

- [x] 9. Implement GoalService
  - [x] 9.1 Implement `GoalService` core operations
    - Create `src/services/GoalService.ts`
    - Implement `createGoal(input)`: validate → sanitize → check source goal exists (Refined) → check ancestor relationship → persist → update `goalStore`
    - Implement `updateGoal(id, input)`: validate → sanitize → reject type changes (`TYPE_IMMUTABLE`) → persist → update `goalStore`
    - Implement `deleteGoal(id)`: collect all Refined_Goals referencing this goal (recursive) → delete cascade → update `goalStore`
    - Implement `setProgress(id, value)`: validate [0,100] → persist → call `ProgressService.rollUp(id)`
    - All methods return `Result<T, AppError>`
    - _Requirements: 4.1–4.9, 6.1–6.7_

  - [x]* 9.2 Write property test: Goal type immutability (Property 6)
    - **Property 6: Goal type immutability** — any update attempting to change `type` is rejected with `TYPE_IMMUTABLE`
    - Use `fc.constantFrom` for GoalType + random update payloads
    - **Validates: Requirements 4.6**
    - Tag: `// Feature: irons-in-fire, Property 6: Goal type immutability`

  - [x]* 9.3 Write property test: Refined goal ancestor check (Property 10)
    - **Property 10: Refined goal source must be an ancestor-owned goal** — non-ancestor source is rejected
    - Use random tree + non-ancestor node selection
    - **Validates: Requirements 6.5**
    - Tag: `// Feature: irons-in-fire, Property 10: Refined goal source must be an ancestor-owned goal`

  - [x]* 9.4 Write property test: Refinement cascade delete (Property 11)
    - **Property 11: Refinement cascade delete** — no Refined_Goal referencing a deleted goal remains in store
    - Use multi-level refinement chains; assert complete removal
    - **Validates: Requirements 4.8, 6.7**
    - Tag: `// Feature: irons-in-fire, Property 11: Refinement cascade delete`

  - [x]* 9.5 Write property test: Complete status forces progress to 100 (Property 13)
    - **Property 13: Complete status forces progress to 100** — setting status to Complete sets progress to exactly 100
    - Use random goals with random prior progress values
    - **Validates: Requirements 4.7**
    - Tag: `// Feature: irons-in-fire, Property 13: Complete status forces progress to 100`

  - [x]* 9.6 Write property test: Source update triggers notifications (Property 16)
    - **Property 16: Source goal update triggers notifications for all direct refiners**
    - Use random refinement graphs + source updates; assert exactly one notification per direct refiner
    - **Validates: Requirements 6.3**
    - Tag: `// Feature: irons-in-fire, Property 16: Source goal update triggers notifications for all direct refiners`

  - [x]* 9.7 Write unit tests for GoalService
    - Test create Root/Refined/Sub_Task, update description/weight/status, complete → progress=100, self-referential rejection, non-ancestor rejection
    - _Requirements: 4.1–4.9, 6.1–6.7_

- [x] 10. Implement ProgressService
  - [x] 10.1 Implement `ProgressService`
    - Create `src/services/ProgressService.ts`
    - Implement `computeWeightedAverage(children: Goal[]): number` — `Σ(weight_i × progress_i) / Σ(weight_i)`; return 0 when all weights are zero or null; clamp result to [0, 100]
    - Implement `rollUp(goalId: string): void` — walk ancestor chain from `goalId` to Root_Goal; recompute each parent's `progress` using `computeWeightedAverage`; call `goalStore.$patch` with all updated goals; entire walk must complete within 100 ms
    - _Requirements: 5.1–5.8_

  - [x]* 10.2 Write property test: Weighted-average progress formula (Property 4)
    - **Property 4: Weighted-average progress formula** — computed progress equals `Σ(w_i × p_i) / Σ(w_i)` and lies in [0, 100]
    - Use `fc.array` of `{weight: fc.float({min:0.01,max:1000}), progress: fc.float({min:0,max:100})}` pairs
    - **Validates: Requirements 5.2, 5.7, 10.2**
    - Tag: `// Feature: irons-in-fire, Property 4: Weighted-average progress formula`

  - [x]* 10.3 Write property test: Progress roll-up propagates to root (Property 5)
    - **Property 5: Progress roll-up propagates to root** — every ancestor goal is recomputed; no non-ancestor goal is modified
    - Use random goal tree with Sub_Task update; assert ancestor chain updated, others unchanged
    - **Validates: Requirements 5.1, 5.6**
    - Tag: `// Feature: irons-in-fire, Property 5: Progress roll-up propagates to root`

  - [x]* 10.4 Write property test: Progress always in bounds (Property 14)
    - **Property 14: Progress always in bounds** — every goal's progress remains in [0, 100] after any sequence of valid operations
    - Use random operation sequences on goal trees; assert all progress values in [0, 100]
    - **Validates: Requirements 5.2, 10.2**
    - Tag: `// Feature: irons-in-fire, Property 14: Progress always in bounds`

  - [x]* 10.5 Write unit tests for ProgressService
    - Test zero-weight children → progress=0, null weight treated as 0, single child, all-complete children → 100
    - Test performance: roll-up on 200-node / 500-goal tree completes within 100 ms
    - _Requirements: 5.1–5.8_

- [x] 11. Checkpoint — Ensure all service-layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Vue components — OrgChartContainer
  - [x] 12.1 Implement `OrgChartContainer` base structure
    - Create `src/components/OrgChartContainer.vue`
    - Render directed tree as SVG `<line>` edges and `<foreignObject>` node slots; read from `nodeStore`
    - Implement empty-state prompt when no nodes exist
    - Add pan/zoom state management (transform matrix on SVG root)
    - _Requirements: 2.1, 2.5_

  - [x] 12.2 Implement lazy viewport rendering
    - Mount only nodes whose bounding box intersects the current viewport (threshold: 51+ nodes)
    - Subscribe to `uiStore.viewport`; recompute visible set on viewport change
    - _Requirements: 2.6_

  - [x] 12.3 Implement drag-and-drop orchestration
    - Handle `drag-start`, `drag-end`, `drop` events from `NodeComponent`
    - Highlight valid drop targets (exclude dragged node, its descendants, and current parent)
    - On drop: call `nodeStore.reparentNode`; on cycle error snap node back and show error toast; on adapter failure snap back and revert store via `$patch`
    - Show confirmation dialog before deleting a node with children (list descendant count and goal count)
    - _Requirements: 3.1–3.7, 2.7_

  - [x]* 12.4 Write unit tests for OrgChartContainer
    - Test empty state, viewport lazy rendering threshold (50 vs. 51 nodes), drop target highlighting, cycle rejection snap-back
    - _Requirements: 2.1, 2.6, 3.1, 3.5_

- [x] 13. Implement Vue components — NodeComponent and GoalCard
  - [x] 13.1 Implement `NodeComponent`
    - Create `src/components/NodeComponent.vue`; prop: `nodeId: string`
    - Render node title, ownerName, roleLevel; include drag handle with `aria-label`
    - Emit `drag-start`, `drag-end`, `drop`
    - Show action menu (add child, edit, delete) when node is selected; action menu items have ARIA labels
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 13.2 Implement `GoalCard`
    - Create `src/components/GoalCard.vue`; prop: `goalId: string`
    - Render description, weight, status, progress bar (`role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`)
    - For Refined goals: display source goal's description alongside own description
    - Emit `update-progress`, `update-status`, `delete`
    - _Requirements: 4.1–4.9, 6.2_

  - [x]* 13.3 Write property test: GoalCard renders both descriptions for Refined goals (Property 15)
    - **Property 15: GoalCard renders both descriptions for Refined goals** — rendered output contains both own and source descriptions
    - Use `fc.record` for random Refined_Goal + source goal pairs; mount with `@vue/test-utils`; assert both descriptions present in DOM
    - **Validates: Requirements 6.2**
    - Tag: `// Feature: irons-in-fire, Property 15: GoalCard renders both descriptions for Refined goals`

  - [x]* 13.4 Write unit tests for GoalCard and NodeComponent
    - Test progress bar ARIA attributes, dual-description rendering, action menu visibility, drag handle presence
    - _Requirements: 2.2, 4.7, 6.2_

- [x] 14. Implement ExecutiveDashboard
  - [x] 14.1 Implement `ExecutiveDashboard` component
    - Create `src/components/ExecutiveDashboard.vue`
    - Read `dashboardStore.rootGoals`; render each Root_Goal's progress as a progress bar or ring chart
    - Empty-state message when no Root_Goals exist
    - On progress indicator click (not in loading state): emit `drill-down(goalId)` → call `uiStore.activateDrillDown`
    - Display "Exit Drill-Down" / "Back to Full View" button while drill-down is active; clicking calls `uiStore.deactivateDrillDown`
    - Progress indicators use `role="progressbar"` with ARIA attributes
    - _Requirements: 8.1–8.5_

  - [x]* 14.2 Write property test: Dashboard shows only Root_Goals of Root_Nodes (Property 17)
    - **Property 17: Executive Dashboard shows only Root_Goals of Root_Nodes**
    - Use `fc.array` of random mixed goal/node sets; mount component; assert displayed goals match exactly `type==='Root' && node.parentId===null`
    - **Validates: Requirements 8.1**
    - Tag: `// Feature: irons-in-fire, Property 17: Executive Dashboard shows only Root_Goals of Root_Nodes`

  - [x]* 14.3 Write unit tests for ExecutiveDashboard
    - Test empty state, progress indicator rendering, drill-down activation/deactivation, 5-second update SLA (mock timers)
    - _Requirements: 8.1–8.5_

- [x] 15. Accessibility pass
  - [x] 15.1 Audit and fix ARIA attributes across all components
    - Ensure all interactive elements (buttons, drag handles, progress indicators) have `aria-label` or `aria-labelledby`
    - Confirmation dialogs use `role="dialog"` with focus trap (trap focus within dialog while open; restore focus on close)
    - All progress indicators use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
    - _Requirements: 2.2, 8.2_

- [x] 16. End-to-end integration and wiring
  - [x] 16.1 Wire adapter factory into app entry point
    - In `src/main.ts`: call `createAdapter()` at startup; catch `ConfigurationError` and display configuration error screen before mounting Vue app
    - Pass adapter instance to all services via dependency injection (constructor injection or provide/inject)
    - _Requirements: 7.5, 7.6_

  - [x] 16.2 Wire stores, services, and components together
    - Register all Pinia stores in `src/main.ts`
    - Ensure `OrgChartContainer` and `ExecutiveDashboard` are mounted in `App.vue`
    - Connect `uiStore.notifications` to a toast/notification component
    - _Requirements: 6.3, 8.3, 8.4_

  - [x]* 16.3 Write end-to-end integration tests
    - Test: create 3-level goal tree → update Sub_Task progress → assert Root_Goal progress updated correctly
    - Test: adapter swap — same operations via `LocalStorageAdapter` and `MockAdapter` produce identical results
    - _Requirements: 5.1, 7.1–7.5_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests use `fast-check` with a minimum of 100 iterations per property; each is tagged with `// Feature: irons-in-fire, Property N: ...`
- Unit tests use Vitest; component tests use `@vue/test-utils`
- The `MockAdapter` (in-memory) is used for all property and unit tests; no real storage I/O in tests
- Performance: progress roll-up on 200-node / 500-goal tree must complete within 100 ms; org chart initial paint of 100 nodes within 500 ms

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "4.1", "5.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "4.2", "4.3", "4.4", "5.2", "5.3", "5.4"] },
    { "id": 4, "tasks": ["5.5", "5.6", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["8.1", "10.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.6", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 7, "tasks": ["8.4", "8.5", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] },
    { "id": 9, "tasks": ["12.1", "13.1"] },
    { "id": 10, "tasks": ["12.2", "12.3", "13.2"] },
    { "id": 11, "tasks": ["12.4", "13.3", "13.4", "14.1"] },
    { "id": 12, "tasks": ["14.2", "14.3", "15.1"] },
    { "id": 13, "tasks": ["16.1"] },
    { "id": 14, "tasks": ["16.2"] },
    { "id": 15, "tasks": ["16.3"] }
  ]
}
```

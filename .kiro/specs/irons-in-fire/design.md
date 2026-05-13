# Design Document: Irons in Fire (MBO Application)

## Overview

Irons in Fire is a Management by Objective (MBO) web application built on **Vue 3 / Vite / Pinia**. It models an organization as a recursive node hierarchy (org chart) where each node owns a set of goals. Goals can be refined by child nodes, progress rolls up the tree via weighted averages, and an executive dashboard provides a bird's-eye view of top-tier objectives.

### Key Design Goals

- **Separation of concerns**: Business logic, persistence, and UI are strictly layered. The persistence adapter pattern ensures storage is swappable without touching Vue components or Pinia stores.
- **Correctness by construction**: Validation, cycle detection, and cascade rules are enforced in the business-logic layer, not in the UI, so they apply regardless of how the layer is invoked.
- **Performance**: Progress roll-up completes within 100 ms; the org chart uses lazy viewport rendering for hierarchies of 51+ nodes.
- **Security**: All user-supplied text passes through a Sanitizer module before storage or rendering.

### Technology Stack

| Concern | Choice |
|---|---|
| UI framework | Vue 3 (Composition API) |
| Build tool | Vite |
| State management | Pinia |
| Org chart rendering | SVG (primary); canvas fallback for very large trees |
| Persistence (dev) | LocalStorageAdapter (LocalStorage / IndexedDB) |
| Persistence (prod) | ApiAdapter (REST or GraphQL) |
| Property-based testing | fast-check (TypeScript) |
| Unit testing | Vitest |

---

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        UI Layer                         │
│  OrgChartContainer · NodeComponent · GoalCard           │
│  ExecutiveDashboard · DrillDown overlay                 │
└────────────────────────┬────────────────────────────────┘
                         │ reads / dispatches
┌────────────────────────▼────────────────────────────────┐
│                    Pinia Store Layer                     │
│  nodeStore · goalStore · uiStore · dashboardStore       │
└────────────────────────┬────────────────────────────────┘
                         │ calls
┌────────────────────────▼────────────────────────────────┐
│                  Business Logic Layer                    │
│  NodeService · GoalService · ProgressService            │
│  RefinementService · ValidationService · Sanitizer      │
└────────────────────────┬────────────────────────────────┘
                         │ delegates to
┌────────────────────────▼────────────────────────────────┐
│               Persistence Adapter Layer                  │
│  PersistenceAdapter (interface)                         │
│  ├── LocalStorageAdapter                                │
│  └── ApiAdapter                                         │
└─────────────────────────────────────────────────────────┘
```

### Adapter Selection

The active adapter is chosen at startup from the environment variable `VITE_PERSISTENCE_ADAPTER`:

- `"local"` → `LocalStorageAdapter`
- `"api"` → `ApiAdapter`
- absent or unrecognized → application refuses to start and displays a configuration error

```typescript
// src/adapters/index.ts
import { LocalStorageAdapter } from './LocalStorageAdapter'
import { ApiAdapter } from './ApiAdapter'
import type { PersistenceAdapter } from './PersistenceAdapter'

export function createAdapter(): PersistenceAdapter {
  const value = import.meta.env.VITE_PERSISTENCE_ADAPTER
  if (value === 'local') return new LocalStorageAdapter()
  if (value === 'api') return new ApiAdapter(import.meta.env.VITE_API_URL)
  throw new ConfigurationError(`VITE_PERSISTENCE_ADAPTER is "${value}" — expected "local" or "api"`)
}
```

### Data Flow: Progress Roll-up

```
Sub_Task progress updated
        │
        ▼
GoalService.updateProgress(goalId, value)
        │
        ▼
ProgressService.rollUp(goalId)   ← walks ancestor chain
        │  (≤100 ms SLA)
        ▼
goalStore.$patch(updatedGoals)
        │
        ▼
Vue reactivity → GoalCard re-renders → ExecutiveDashboard updates
```

---

## Components and Interfaces

### Vue Components

#### `OrgChartContainer`

Top-level canvas component. Owns the SVG viewport, pan/zoom state, and drag-and-drop orchestration.

**Props:** none (reads from `nodeStore`)  
**Emits:** none (dispatches to stores)

Responsibilities:
- Renders the directed tree as SVG `<line>` edges and `<foreignObject>` node slots
- Implements lazy viewport rendering: only nodes whose bounding box intersects the current viewport are mounted (threshold: 51+ nodes)
- Highlights valid drop targets during drag; rejects drops that would create cycles
- Shows confirmation dialog before deleting a node with children

#### `NodeComponent`

Renders a single org-chart node. Draggable. Contains one or more `GoalCard` children.

**Props:** `nodeId: string`  
**Emits:** `drag-start`, `drag-end`, `drop`

#### `GoalCard`

Renders a single goal. Shows description, weight, status, progress bar, and (for Refined goals) the source goal's description.

**Props:** `goalId: string`  
**Emits:** `update-progress`, `update-status`, `delete`

#### `ExecutiveDashboard`

Bird's-eye view. Reads only Root_Goals owned by Root_Nodes.

**Props:** none  
**Emits:** `drill-down(goalId)`

Displays each Root_Goal's progress as a visual indicator (progress bar or ring chart). Polls or reacts to store changes; display must update within 5 seconds of an underlying change.

### Pinia Stores

#### `nodeStore`

```typescript
interface NodeState {
  nodes: Record<string, OrgNode>
  selectedNodeId: string | null
}
```

Actions: `createNode`, `updateNode`, `deleteNode`, `reparentNode`

#### `goalStore`

```typescript
interface GoalState {
  goals: Record<string, Goal>
}
```

Actions: `createGoal`, `updateGoal`, `deleteGoal`, `setProgress`

#### `uiStore`

```typescript
interface UiState {
  drillDownGoalId: string | null
  notifications: Notification[]
  viewport: ViewportRect
}
```

#### `dashboardStore`

Derived store (computed from `goalStore` + `nodeStore`). Exposes `rootGoals: ComputedRef<Goal[]>`.

### Service Layer

#### `NodeService`

```typescript
interface NodeService {
  createNode(input: CreateNodeInput): Promise<Result<OrgNode, AppError>>
  updateNode(id: string, input: UpdateNodeInput): Promise<Result<OrgNode, AppError>>
  deleteNode(id: string): Promise<Result<void, AppError>>
  reparentNode(nodeId: string, newParentId: string): Promise<Result<void, AppError>>
}
```

`reparentNode` runs cycle detection before calling the adapter. Cycle detection: walk ancestors of `newParentId`; if `nodeId` is encountered, reject.

#### `GoalService`

```typescript
interface GoalService {
  createGoal(input: CreateGoalInput): Promise<Result<Goal, AppError>>
  updateGoal(id: string, input: UpdateGoalInput): Promise<Result<Goal, AppError>>
  deleteGoal(id: string): Promise<Result<void, AppError>>
  setProgress(id: string, value: number): Promise<Result<void, AppError>>
}
```

#### `ProgressService`

```typescript
interface ProgressService {
  rollUp(goalId: string): void   // synchronous; updates goalStore in-place
  computeWeightedAverage(children: Goal[]): number
}
```

`rollUp` walks the ancestor chain from `goalId` to the Root_Goal, recomputing each parent's `Progress_Percentage` using the weighted-average formula. The entire walk must complete within 100 ms.

#### `ValidationService`

Centralizes all field-level and cross-entity validation rules. Returns structured `ValidationError` objects identifying field name and constraint.

#### `Sanitizer`

```typescript
interface Sanitizer {
  sanitize(input: string): string          // escapes <, >, ", ', &
  isSafe(input: string): boolean           // returns false if XSS vector detected
}
```

Escapes `<`, `>`, `"`, `'`, `&` to HTML entities. Detects and rejects `<script>`, `onerror=`, `javascript:` URIs, and HTML-entity-encoded variants.

### `PersistenceAdapter` Interface

```typescript
interface PersistenceAdapter {
  // Nodes
  readAllNodes(): Promise<OrgNode[]>
  readNodeById(id: string): Promise<OrgNode | null>
  createNode(node: OrgNode): Promise<OrgNode>
  updateNode(id: string, patch: Partial<OrgNode>): Promise<OrgNode>
  deleteNode(id: string): Promise<void>

  // Goals
  readAllGoals(): Promise<Goal[]>
  readGoalById(id: string): Promise<Goal | null>
  createGoal(goal: Goal): Promise<Goal>
  updateGoal(id: string, patch: Partial<Goal>): Promise<Goal>
  deleteGoal(id: string): Promise<void>
}
```

All methods return Promises. Failures throw (or reject with) an `AdapterError` that the service layer catches and converts to `AppError`.

---

## Data Models

### `OrgNode`

```typescript
interface OrgNode {
  id: string                  // UUID, immutable after creation
  parentId: string | null     // null for Root_Node
  title: string               // 1–100 chars (post-sanitization)
  ownerName: string           // 1–100 chars (post-sanitization)
  roleLevel: RoleLevel        // enum + optional customLabel
  customRoleLabel?: string    // required when roleLevel === 'Custom'; 1–50 chars
  createdAt: string           // ISO 8601
  updatedAt: string           // ISO 8601
}

type RoleLevel = 'CEO' | 'VP' | 'Director' | 'Manager' | 'Individual_Contributor' | 'Custom'
```

### `Goal`

```typescript
interface Goal {
  id: string                  // UUID, immutable after creation
  nodeId: string              // owning node
  type: GoalType              // immutable after creation
  description: string         // 1–500 chars (post-sanitization; 1–1000 per Req 10.4)
  weight: number              // [0.01, 1000]
  status: GoalStatus
  progress: number            // [0, 100]; computed for non-leaf goals
  sourceGoalId?: string       // required for Refined; absent for Root / Sub_Task
  createdAt: string
  updatedAt: string
}

type GoalType   = 'Root' | 'Refined' | 'Sub_Task'
type GoalStatus = 'Active' | 'Refined' | 'Complete'
```

> **Note on description length**: Requirement 4.1 caps Description at 500 characters; Requirement 10.4 caps it at 1000 characters after sanitization. The stricter rule (500 chars pre-sanitization) is enforced at input time; the 1000-char post-sanitization cap is enforced after entity-escaping expands the string.

### `AppError` / `ValidationError`

```typescript
interface AppError {
  code: ErrorCode
  message: string
  field?: string              // present for validation errors
  constraint?: string         // e.g. "max_length:100"
}

type ErrorCode =
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
```

### `Result<T, E>` Type

Services return a discriminated union to avoid exception-based control flow:

```typescript
type Result<T, E> =
  | { ok: true;  value: T }
  | { ok: false; error: E }
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Node ID immutability after creation

*For any* node that has been created and subsequently updated (title, ownerName, roleLevel), the node's `id` and `parentId` SHALL remain identical to the values assigned at creation time.

**Validates: Requirements 1.1, 1.4**

---

### Property 2: Cascade delete removes entire subtree

*For any* node N in the hierarchy, deleting N SHALL result in the complete removal of every node in N's subtree and every goal owned by any of those nodes, leaving no orphaned nodes or goals in the store.

**Validates: Requirements 1.5**

---

### Property 3: Cycle detection rejects all ancestor targets

*For any* node N and any node A that is an ancestor of N (including N itself), attempting to reparent N to A SHALL be rejected, and the hierarchy SHALL remain unchanged.

**Validates: Requirements 3.5, 3.6**

---

### Property 4: Weighted-average progress formula

*For any* parent goal with a non-empty set of child goals whose weights are all positive, the parent's computed `progress` SHALL equal `Σ(weight_i × progress_i) / Σ(weight_i)` and SHALL lie in the closed interval [0, 100].

**Validates: Requirements 5.2, 5.7, 10.2**

---

### Property 5: Progress roll-up propagates to root

*For any* Sub_Task whose `progress` is updated, every ancestor goal up to and including the Root_Goal SHALL have its `progress` recomputed, and no ancestor goal outside the updated Sub_Task's ancestor chain SHALL be modified.

**Validates: Requirements 5.1, 5.6**

---

### Property 6: Goal type immutability

*For any* goal that has been created with a given `type`, any update request that attempts to change the `type` field SHALL be rejected with a `TYPE_IMMUTABLE` error, and the goal SHALL remain unchanged.

**Validates: Requirements 4.6**

---

### Property 7: Sanitizer idempotence

*For any* string S, applying the Sanitizer twice SHALL produce the same result as applying it once: `sanitize(sanitize(S)) === sanitize(S)`.

**Validates: Requirements 9.1, 9.3**

---

### Property 8: Sanitizer safe-output guarantee

*For any* string S that the Sanitizer accepts (i.e., `isSafe(S)` returns true after sanitization), the sanitized output SHALL contain no executable script constructs, no `onerror=` attributes, no `javascript:` URIs, and no unescaped `<`, `>`, `"`, `'`, or `&` characters.

**Validates: Requirements 9.2, 9.4**

---

### Property 9: Validation rejects out-of-range weights

*For any* weight value W that is not a finite positive number in the range (0, 1000], any create or update operation supplying W SHALL be rejected with a structured `VALIDATION_ERROR` identifying the `weight` field, and no data SHALL be persisted.

**Validates: Requirements 4.1, 4.5, 10.1, 10.5, 10.6**

---

### Property 10: Refined goal source must be an ancestor-owned goal

*For any* Refined_Goal creation request where the source goal is owned by a node that is not an ancestor of the Refined_Goal's owning node, the request SHALL be rejected, and no goal SHALL be created.

**Validates: Requirements 6.5**

---

### Property 11: Refinement cascade delete

*For any* goal G that is deleted, every Refined_Goal that directly or transitively references G as its source SHALL also be deleted, and no Refined_Goal referencing a deleted goal SHALL remain in the store.

**Validates: Requirements 4.8, 6.7**

---

### Property 12: Adapter operation atomicity

*For any* create or update operation that fails at the adapter layer, the application state and persisted data SHALL be identical to their state immediately before the operation was attempted — no partial writes.

**Validates: Requirements 7.4, 10.5, 10.6**

---

### Property 13: Complete status forces progress to 100

*For any* goal whose `status` is set to `Complete`, the goal's `progress` SHALL be exactly 100, regardless of its previous progress value or child goal states.

**Validates: Requirements 4.7**

---

### Property 14: Progress always in bounds

*For any* sequence of valid operations on any goal tree, every goal's `progress` value SHALL remain within the closed interval [0, 100] at all times.

**Validates: Requirements 5.2, 10.2**

---

### Property 15: GoalCard renders both descriptions for Refined goals

*For any* Refined_Goal with a valid source goal, the rendered GoalCard output SHALL contain both the Refined_Goal's own description and the source goal's description.

**Validates: Requirements 6.2**

---

### Property 16: Source goal update triggers notifications for all direct refiners

*For any* goal G whose description or status is updated, every Refined_Goal that directly references G as its source SHALL have a corresponding notification created for its owning node's owner, and no notification SHALL be created for goals that do not directly reference G.

**Validates: Requirements 6.3**

---

### Property 17: Executive Dashboard shows only Root_Goals of Root_Nodes

*For any* application state, the ExecutiveDashboard SHALL display exactly the set of goals whose `type` is `Root` and whose owning node has `parentId === null`, and SHALL display no other goals.

**Validates: Requirements 8.1**

---

### Property 18: Validation errors are structured and identify the violated field

*For any* create or update operation that is rejected due to a validation rule violation, the returned error SHALL include the field name and the specific constraint that was violated, and the same structured error format SHALL be returned whether the operation is invoked through the UI or directly on the business-logic layer.

**Validates: Requirements 10.5, 10.7**

---

## Error Handling

### Principles

1. **No partial writes**: Every service operation is all-or-nothing. If any step fails, the operation is rolled back (or never committed).
2. **Structured errors**: All errors are `AppError` objects with a `code`, human-readable `message`, and optional `field`/`constraint` for validation errors.
3. **UI feedback**: Stores expose an `errors` list; components subscribe and display inline error messages or toast notifications.
4. **Adapter failures**: `AdapterError` is caught by the service layer, converted to `AppError`, and surfaced to the UI without leaking internal details.

### Error Scenarios

| Scenario | Error Code | User-visible message |
|---|---|---|
| Parent node not found on create | `NOT_FOUND` | "Parent node `{id}` does not exist." |
| Cycle detected on reparent | `CYCLE_DETECTED` | "Cannot move a node to one of its own descendants." |
| Source goal not found | `INVALID_SOURCE_GOAL` | "Source goal `{id}` does not exist." |
| Self-referential refinement | `SELF_REFERENTIAL_REFINEMENT` | "A goal cannot refine itself." |
| Source goal not in ancestor node | `INVALID_ANCESTOR_RELATIONSHIP` | "Source goal must be owned by an ancestor node." |
| Goal type change attempted | `TYPE_IMMUTABLE` | "Goal type cannot be changed after creation." |
| Weight out of range | `VALIDATION_ERROR` (field: `weight`) | "Weight must be between 0.01 and 1000." |
| Description too long | `VALIDATION_ERROR` (field: `description`) | "Description must not exceed 500 characters." |
| XSS vector detected | `SANITIZATION_REJECTED` | "Input contains disallowed content." |
| Adapter failure | `ADAPTER_ERROR` | "A storage error occurred. Please try again." |
| Missing/invalid env var | `CONFIGURATION_ERROR` | "VITE_PERSISTENCE_ADAPTER is missing or invalid." |

### Drag-and-Drop Error Recovery

- On cycle detection: node snaps back to original position; error toast displayed.
- On adapter failure after drop: node snaps back; store state reverted via `nodeStore.$patch` rollback; error toast displayed.

### Confirmation Dialogs

- Deleting a node with children: modal dialog listing the number of descendant nodes and goals to be removed.
- Deleting a goal with refinements: modal dialog listing the number of dependent Refined_Goals.

---

## Testing Strategy

### Dual Testing Approach

Both unit/example-based tests and property-based tests are used. Unit tests cover specific scenarios, integration points, and edge cases. Property-based tests verify universal invariants across randomly generated inputs.

### Property-Based Testing

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (TypeScript)  
**Runner**: Vitest  
**Minimum iterations per property**: 100

Each property test is tagged with a comment in the format:

```
// Feature: irons-in-fire, Property {N}: {property_text}
```

Properties are implemented as pure-function tests against the service layer (no adapter I/O). The `LocalStorageAdapter` is replaced with an in-memory `MockAdapter` for all property tests.

#### Property Test Mapping

| Property | Test file | fast-check arbitraries |
|---|---|---|
| 1 — Node ID immutability | `nodeService.property.test.ts` | `fc.record` for node fields + random update sequences |
| 2 — Cascade delete | `nodeService.property.test.ts` | `fc.array` of child nodes with associated goals |
| 3 — Cycle detection | `nodeService.property.test.ts` | random tree + ancestor selection |
| 4 — Weighted-average formula | `progressService.property.test.ts` | `fc.array` of `{weight, progress}` pairs |
| 5 — Roll-up propagation | `progressService.property.test.ts` | random goal tree with Sub_Task update |
| 6 — Goal type immutability | `goalService.property.test.ts` | `fc.constantFrom` for GoalType + random update |
| 7 — Sanitizer idempotence | `sanitizer.property.test.ts` | `fc.string` (full unicode) |
| 8 — Sanitizer safe output | `sanitizer.property.test.ts` | `fc.string` + XSS payload generators |
| 9 — Weight validation | `validationService.property.test.ts` | `fc.float` outside (0, 1000] |
| 10 — Refined goal ancestor check | `goalService.property.test.ts` | random tree + non-ancestor node selection |
| 11 — Refinement cascade delete | `goalService.property.test.ts` | multi-level refinement chains |
| 12 — Adapter atomicity | `adapter.property.test.ts` | injected failure at random operation step |
| 13 — Complete status forces progress=100 | `goalService.property.test.ts` | random goals with random prior progress |
| 14 — Progress always in bounds | `progressService.property.test.ts` | random operation sequences on goal trees |
| 15 — GoalCard renders both descriptions | `GoalCard.property.test.ts` | random Refined_Goal + source goal pairs |
| 16 — Source update triggers notifications | `goalService.property.test.ts` | random refinement graphs + source updates |
| 17 — Dashboard shows only Root_Goals | `ExecutiveDashboard.property.test.ts` | random mixed goal/node sets |
| 18 — Structured validation errors | `validationService.property.test.ts` | random invalid inputs across all fields |

### Unit / Example-Based Tests

- **NodeService**: create with valid/invalid parent, update fields, delete leaf vs. subtree
- **GoalService**: create Root/Refined/Sub_Task, update description/weight/status, complete → progress=100
- **ProgressService**: zero-weight children → progress=0, null weight treated as 0, single child
- **Sanitizer**: known XSS vectors (`<script>alert(1)</script>`, `onerror=`, `javascript:`, entity-encoded variants)
- **ExecutiveDashboard**: empty state, progress indicator rendering, drill-down activation/deactivation
- **OrgChartContainer**: empty state, viewport lazy rendering threshold (50 vs. 51 nodes), drop target highlighting

### Integration Tests

- Adapter swap: same operations produce identical results via `LocalStorageAdapter` and a mock `ApiAdapter`
- End-to-end progress roll-up: create a 3-level goal tree, update a Sub_Task, assert Root_Goal progress

### Performance Tests

- Progress roll-up on a 200-node, 500-goal tree must complete within 100 ms (measured with `performance.now()`)
- Org chart render of 100 nodes must complete initial paint within 500 ms

### Accessibility

- All interactive elements (buttons, drag handles, progress indicators) have ARIA labels
- Confirmation dialogs use `role="dialog"` with focus trap
- Progress indicators use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

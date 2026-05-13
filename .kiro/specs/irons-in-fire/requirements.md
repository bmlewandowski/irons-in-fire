# Requirements Document

## Introduction

"Irons in Fire" is a Management by Objective (MBO) application built on Vue 3 / Vite / Pinia. It models an organization as a recursive node hierarchy (org chart) where each node owns a set of goals. Goals can be refined by child nodes, progress rolls up the tree via weighted averages, and an executive dashboard provides a bird's-eye view of top-tier objectives. The persistence layer uses an adapter pattern so that local storage (dev) and a REST/GraphQL API (prod) are interchangeable without touching business logic.

---

## Glossary

- **Application**: The "Irons in Fire" MBO web application.
- **Node**: An organizational unit in the hierarchy, identified by a unique ID and optionally linked to a parent Node via Parent_ID.
- **Root_Node**: A Node with no parent (top of the hierarchy).
- **Subtree**: A Node together with all of its direct and indirect descendant Nodes.
- **Goal**: An objective owned by a Node, carrying a description, weight, status, and progress percentage.
- **Root_Goal**: A Goal of type "Root" — the original, top-level statement of an objective.
- **Refined_Goal**: A Goal of type "Refined" — a child-node restatement of a Root_Goal or another Refined_Goal, maintaining a data link to its source Goal.
- **Sub_Task**: A Goal of type "Sub-task" — a leaf-level action item that has no child Goals.
- **Progress_Percentage**: A numeric value in the range [0, 100] representing completion of a Goal.
- **Weighted_Average**: The sum of (child Goal Progress_Percentage × child Goal Weight) divided by the sum of child Goal Weights.
- **OrgChartContainer**: The top-level Vue component that renders the interactive org-chart canvas.
- **NodeComponent**: The Vue component that renders a single Node on the canvas.
- **GoalCard**: The Vue component that renders a single Goal within a NodeComponent.
- **PersistenceAdapter**: The interface that abstracts storage operations (read, write, delete) from business logic.
- **LocalStorageAdapter**: A PersistenceAdapter implementation backed by the browser's LocalStorage or IndexedDB.
- **ApiAdapter**: A PersistenceAdapter implementation backed by a REST or GraphQL API.
- **ExecutiveDashboard**: The "bird's-eye" view component showing only top-tier Goals and their aggregate progress.
- **DrillDown**: The act of filtering the visual tree to show only Nodes and Goals contributing to a selected Goal.
- **Cycle**: A directed path in the Node hierarchy that leads back to a Node already in the path (i.e., a Node becoming its own ancestor).
- **XSS**: Cross-site scripting — injection of malicious scripts via user-supplied text.
- **Sanitizer**: The module responsible for stripping or escaping XSS payloads from user input.

---

## Requirements

### Requirement 1: Node Hierarchy Management

**User Story:** As an organization administrator, I want to create, edit, and delete nodes in a recursive hierarchy, so that I can model my organization's structure accurately.

#### Acceptance Criteria

1. THE Application SHALL assign each Node a unique, immutable ID upon creation.
2. WHEN a Node is created with a Parent_ID, THE Application SHALL validate that the referenced parent Node exists before persisting the new Node.
3. IF a referenced Parent_ID does not correspond to an existing Node, THEN THE Application SHALL reject the creation request and return an error message that identifies the invalid Parent_ID value, without emitting additional error messages for that same operation.
4. WHEN a Node's Title, Role_Level, or Owner_Name is updated, THE Application SHALL persist the change without modifying the Node's ID or Parent_ID; Title SHALL be a non-empty string of at most 100 characters and Owner_Name SHALL be a non-empty string of at most 100 characters.
5. WHEN a Node is deleted, THE Application SHALL delete all descendant Nodes in the Node's Subtree, all Goals associated with the deleted Node itself, and all Goals associated with those descendant Nodes.
6. THE Application SHALL support a Role_Level value drawn from the set: CEO, VP, Director, Manager, Individual_Contributor, and Custom.
7. WHERE a Custom Role_Level is selected, THE Application SHALL require the user to supply a non-empty label of at most 50 characters.
8. IF a Custom Role_Level label is empty or exceeds 50 characters, THEN THE Application SHALL reject the operation and return an error message identifying the constraint violation.

---

### Requirement 2: Visual Org Chart Engine

**User Story:** As a user, I want to view and interact with the organization hierarchy as a visual tree on a canvas, so that I can understand reporting relationships at a glance.

#### Acceptance Criteria

1. THE OrgChartContainer SHALL render all Nodes as a directed tree using an SVG or canvas-based layout; WHEN no Nodes exist, THE OrgChartContainer SHALL display an empty-state prompt inviting the user to create the first Node.
2. WHEN a user selects a Node on the canvas, THE OrgChartContainer SHALL display an action menu offering options to add a child Node, edit the Node, or delete the Node.
3. WHEN a child Node is spawned from a parent Node via the action menu and the creation succeeds, THE Application SHALL create the new Node with the selected Node's ID as its Parent_ID and render it on the canvas.
4. IF the child Node creation fails, THEN THE Application SHALL display an error message and leave the canvas unchanged.
5. THE OrgChartContainer SHALL visually connect each Node to its parent with a directed edge drawn from the parent Node to the child Node.
6. WHEN the Node hierarchy contains 51 or more Nodes, THE OrgChartContainer SHALL omit off-screen Nodes from the rendered output and add them to the render only when the user pans them into the visible viewport.
7. WHEN a user attempts to delete a Node that has child Nodes, THE Application SHALL display a confirmation dialog warning that all descendant Nodes and their Goals will also be deleted before proceeding.

---

### Requirement 3: Dynamic Re-parenting via Drag-and-Drop

**User Story:** As an organization administrator, I want to drag a node to a new parent on the canvas, so that I can reorganize the hierarchy without manually re-entering data.

#### Acceptance Criteria

1. WHEN a user begins dragging a NodeComponent, THE OrgChartContainer SHALL apply a distinct visual style (e.g., border highlight or color change) to all Nodes that are valid drop targets, and SHALL NOT apply that style to the dragged Node, its descendants, or its current parent.
2. WHEN a NodeComponent is dropped onto a valid target Node, THE Application SHALL attempt to persist the updated Parent_ID; IF the persistence operation succeeds, THE Application SHALL update the dragged Node's Parent_ID to the target Node's ID in the application state.
3. WHEN a NodeComponent is dropped onto a valid target Node and the persistence operation succeeds, THE Application SHALL move the entire Subtree rooted at the dragged Node, preserving all internal parent-child relationships.
4. IF the persistence operation fails after a drop onto a valid target, THEN THE Application SHALL return the dragged NodeComponent to its original position, display an error message, and leave all persisted data unchanged.
5. IF a drag-and-drop operation would create a Cycle — that is, the target Node is the dragged Node itself or a descendant of the dragged Node — THEN THE Application SHALL reject the operation and display an error message to the user.
6. WHEN a drag-and-drop operation is rejected due to Cycle detection, THE Application SHALL return the dragged NodeComponent to its pre-drag position without modifying any data.
7. WHEN a Subtree is successfully re-parented, THE Application SHALL recalculate Progress_Percentage for all Goals in the ancestor chains of both the old parent and the new parent, up to and including their respective Root_Goals.

---

### Requirement 4: Goal Creation and Management

**User Story:** As a node owner, I want to create and manage goals for my node, so that I can track my team's objectives.

#### Acceptance Criteria

1. WHEN a Goal is created, THE Application SHALL require a non-empty Description of at most 500 characters, a Weight in the range [0.01, 1000], a Status of Active, Refined, or Complete, and a Type of Root, Refined, or Sub_Task.
2. WHEN a Goal of type Refined is created, THE Application SHALL require a Source_Goal_ID that references an existing Root_Goal or Refined_Goal.
3. IF a provided Source_Goal_ID does not reference an existing Goal, THEN THE Application SHALL reject the creation request and return an error message identifying the unresolved Source_Goal_ID value.
4. WHEN a Goal's Description, Weight, or Status is updated and all supplied values are valid, THE Application SHALL persist the changes without modifying the Goal's ID or Type.
5. IF an update request supplies a Weight outside [0.01, 1000], THEN THE Application SHALL reject the update and return an error message identifying the Weight constraint violation.
6. IF an update request attempts to change a Goal's Type, THEN THE Application SHALL reject the update and return an error message stating that Type is immutable after creation.
7. WHEN a Goal's Status is set to Complete, THE Application SHALL set the Goal's Progress_Percentage to 100.
8. WHEN a Goal is deleted, THE Application SHALL also delete all Refined_Goals and Sub_Tasks that reference the deleted Goal as their source.
9. WHEN a Root_Goal or Sub_Task is created, THE Application SHALL not require or validate a Source_Goal_ID for that Goal.

---

### Requirement 5: Recursive Progress Roll-up

**User Story:** As a manager, I want a parent goal's progress to automatically reflect the weighted progress of its child goals, so that I always see an accurate, up-to-date completion percentage.

#### Acceptance Criteria

1. WHEN a Sub_Task's Progress_Percentage is updated, THE Application SHALL recalculate the Progress_Percentage of every ancestor Goal up to and including the Root_Goal, and all updated values SHALL be visible to the user before any subsequent user interaction is processed.
2. THE Application SHALL calculate a parent Goal's Progress_Percentage as: sum(weight_i × progress_i) / sum(weight_i), where the sum is taken over all direct child Goals.
3. WHEN a child Goal's Weight is changed, THE Application SHALL recalculate the parent Goal's Progress_Percentage within 100 milliseconds of the change being applied.
4. WHEN a child Goal is added to or removed from a parent Goal, THE Application SHALL recalculate the parent Goal's Progress_Percentage within 100 milliseconds of the structural change.
5. IF a Goal has no child Goals, THEN THE Application SHALL treat that Goal's Progress_Percentage as a directly editable value in the range [0, 100].
6. THE Application SHALL propagate Progress_Percentage recalculations in real-time, completing all ancestor updates within 100 milliseconds from the triggering change to the updated Progress_Percentage value being displayed.
7. WHEN all child Goals of a parent Goal have a Weight of zero, THE Application SHALL set the parent Goal's Progress_Percentage to zero.
8. WHEN a child Goal has a null or unassigned Weight, THE Application SHALL treat that child Goal's Weight as zero for the purpose of the Weighted_Average calculation.

---

### Requirement 6: Goal Inheritance (Refinement)

**User Story:** As a lower-level node owner, I want to refine a parent node's goal for my team's context, so that my objectives stay aligned with the organization's top-level strategy.

#### Acceptance Criteria

1. WHEN a Refined_Goal is created, THE Application SHALL store a Source_Goal_ID linking the Refined_Goal to its source Root_Goal or Refined_Goal.
2. WHEN a GoalCard for a Refined_Goal is rendered, THE Application SHALL display the source Goal's Description alongside the Refined_Goal's own Description.
3. WHEN the source Goal's Description or Status is updated, THE Application SHALL display an in-application notification to the owner of each Refined_Goal that directly references it, stating that the source Goal has changed and identifying the source Goal by its ID and title.
4. THE Application SHALL allow a Refined_Goal to itself be the source of further Refined_Goals, enabling multi-level refinement chains.
5. IF a Refined_Goal creation request references a source Goal owned by a Node that is not an ancestor of the Refined_Goal's owning Node, THEN THE Application SHALL reject the request and return an error message identifying the invalid source Node relationship.
6. IF a Refined_Goal creation request references a source Goal owned by the same Node as the Refined_Goal itself, THEN THE Application SHALL reject the request and return an error message stating that self-referential refinement is not permitted.
7. WHEN a source Goal is deleted, THE Application SHALL delete all Refined_Goals that directly reference it as their Source_Goal_ID, cascading recursively through any further refinement chains.

---

### Requirement 7: Persistence Adapter Pattern

**User Story:** As a developer, I want the storage layer to be swappable without changing business logic, so that I can use local storage in development and a remote API in production.

#### Acceptance Criteria

1. THE Application SHALL define a PersistenceAdapter interface with operations: `readAll`, `readById`, `create`, `update`, and `delete` for both Nodes and Goals.
2. THE LocalStorageAdapter SHALL implement the PersistenceAdapter interface using the browser's LocalStorage or IndexedDB as the backing store.
3. THE ApiAdapter SHALL implement the PersistenceAdapter interface by delegating all operations to a REST or GraphQL endpoint whose URL is read from the same environment variable used to select the active adapter at application startup.
4. IF a PersistenceAdapter operation fails, THEN THE Application SHALL display an error message in the active view and leave all persisted application data unchanged, committing no partial writes.
5. THE Application SHALL select the active PersistenceAdapter based on a build-time or runtime environment variable, requiring no changes to business logic or Vue components.
6. IF the adapter environment variable is absent or contains an unrecognized value at application startup, THEN THE Application SHALL refuse to start and display a configuration error message identifying the missing or invalid variable.

---

### Requirement 8: Executive Dashboard

**User Story:** As an executive, I want a bird's-eye view of top-tier goals and their aggregate progress, so that I can assess organizational health without navigating the full tree.

#### Acceptance Criteria

1. THE ExecutiveDashboard SHALL display only Root_Goals owned by Root_Nodes and their current Progress_Percentage values; WHEN no Root_Goals exist, THE ExecutiveDashboard SHALL display an empty-state message indicating that no top-level goals have been created.
2. WHEN a user views the ExecutiveDashboard, THE Application SHALL present each Root_Goal's Progress_Percentage as a visual progress indicator (a progress bar or ring chart, not a plain numeric label).
3. WHEN a user clicks a progress indicator on the ExecutiveDashboard and the indicator is not in a loading state, THE Application SHALL activate DrillDown mode and filter the OrgChartContainer to display only the Nodes and Goals that contribute to the selected Root_Goal.
4. WHILE DrillDown mode is active, THE Application SHALL display a control labeled "Exit Drill-Down" or "Back to Full View" that, when clicked, deactivates DrillDown mode and restores the full unfiltered tree view.
5. WHEN an underlying Goal's Progress_Percentage changes, THE ExecutiveDashboard SHALL update its displayed value within 5 seconds of the change occurring.

---

### Requirement 9: Input Sanitization (XSS Prevention)

**User Story:** As a security-conscious operator, I want all user-supplied text to be sanitized before rendering, so that malicious scripts cannot be injected into the application.

#### Acceptance Criteria

1. WHEN a user submits a Goal Description, Node Title, Owner_Name, or custom Role_Level label, THE Sanitizer SHALL escape the characters `<`, `>`, `"`, `'`, and `&` to their HTML entity equivalents before the value is stored.
2. WHEN user-supplied text is rendered in the Application, THE rendered output SHALL not execute scripts, load external resources, or alter the DOM outside the intended text container.
3. WHEN sanitized output differs from the original input, THE Application SHALL store only the sanitized value and display the sanitized value to the user.
4. WHEN the Sanitizer processes an input containing a recognized XSS vector — including `<script>` tags, `onerror=` attributes, `javascript:` URIs, or HTML entity-encoded variants of those patterns — THE Sanitizer SHALL produce safe plain-text output by escaping all such constructs.
5. IF the Sanitizer cannot guarantee safe plain-text output for a given input, THEN THE Application SHALL reject the input and return an error message stating that the value contains disallowed content.

---

### Requirement 10: Data Integrity and Validation

**User Story:** As a developer, I want the application to enforce data integrity rules consistently, so that the data model remains coherent at all times.

#### Acceptance Criteria

1. THE Application SHALL enforce that every Goal's Weight is a finite positive number greater than 0 and at most 1000.
2. THE Application SHALL enforce that every Goal's Progress_Percentage is a number in the closed interval [0, 100].
3. THE Application SHALL enforce that every Node's Title is a non-empty string of at most 200 characters.
4. THE Application SHALL enforce that every Goal's Description is a non-empty string of at most 1000 characters after sanitization.
5. IF any validation rule is violated during a create or update operation, THEN THE Application SHALL reject the entire operation, return a structured error that identifies the field name and the specific constraint that was violated, and leave all persisted data unchanged.
6. WHEN a create or update operation is rejected due to a validation violation, THE Application SHALL not commit any partial changes — the operation is all-or-nothing.
7. WHEN a create or update operation is invoked directly on the business-logic layer without going through the UI, THE Application SHALL apply the same validation rules and reject the operation with the same structured error format if any rule is violated.

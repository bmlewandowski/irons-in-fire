# Irons in Fire

A visual **Management by Objectives (MBO)** application for building organizational hierarchies, defining goals, tracking progress, and rolling up results through the chain of command — all in the browser with no server required.

---

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org/) 18 or later and npm.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/irons-in-fire.git
cd irons-in-fire

# 2. Install dependencies
npm install

# 3. Copy the environment file (uses localStorage by default)
cp .env.example .env

# 4. Start the development server
npm run dev
```

Open `http://localhost:5173` in your browser. That's it — no database, no login required.

### Other commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Type-check and compile for production |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run the full test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

---

## What Is Irons in Fire?

Irons in Fire is a browser-only tool that lets teams model their organizational structure as an interactive node graph, attach weighted goals to each node, and instantly see progress bubble up through the hierarchy.

It is designed for managers who want a lightweight, no-friction way to practice MBO without connecting to an external service. All data is stored in the browser's local storage (with an automatic IndexedDB fallback) and can be exported to or imported from JSON at any time.

---

## Features

### Three Views

Irons in Fire offers three complementary views for managing your organization:

1. **Org Chart** — Visual SVG canvas with spatial layout and goal management
2. **List View** — Streamlined tree interface for rapid organizational structure building
3. **Executive Dashboard** — Analytics view showing goal progress and metrics

Switch between views using the navigation tabs at the top of the application.

---

### Org Chart

- **Interactive canvas** — pan by dragging the background; zoom with the scroll wheel.
- **Create nodes** — add root nodes or attach child nodes anywhere in the hierarchy.
  - New children are automatically positioned below their parent; if siblings already exist the layout re-flows cleanly.
- **Edit nodes** — update the title, owner name, and role level at any time.
- **Delete nodes** — safely remove a node with a confirmation prompt. When a node has children you can either delete the entire subtree or promote the children to the grandparent level first.
- **Drag-and-drop reparenting** — drag any node onto another to move it; cycle detection prevents invalid moves.
- **Free drag positioning** — drag individual nodes (and their subtrees) anywhere on the canvas for custom layouts.
- **Resize nodes** — drag any corner handle to resize a node; the subtree adjusts automatically.
- **Role levels** — choose from CEO/President, Vice President, Executive, Director, Manager, Supervisor, Lead, Employee, Contractor, or define a Custom label.
- **Node display** — each node shows the person's **name** (bold) on top and their position title below it.
- **Collapse/expand subtree** — nodes with children show a ▶/▼ triangle next to the name. Clicking it hides or reveals the entire subtree beneath that node. The layout re-flows automatically on expand so no nodes overlap. Collapse state is saved and restored between sessions. Use the **Expand All** / **Collapse All** toolbar buttons to expand or collapse all parent nodes at once.

### Toolbar

| Button | Action |
|---|---|
| **⌂ Home** | Re-centers the view on the leftmost root node |
| **+ Zoom / − Zoom** | Zoom in or out; also available via the scroll wheel |
| **+ Add Node** | Opens the form to create a new root node |
| **⬜ Clean Up** | Re-runs the tree layout algorithm to neatly arrange all nodes |
| **↩ Undo** | Reverts the last destructive action (delete node, delete goal, reparent, import) — also `Ctrl+Z` |
| **Expand All** | Expands all parent nodes to show their children |
| **Collapse All** | Collapses all parent nodes to hide their children |
| **Show Goals** | Shows the goal cards on every node simultaneously; child nodes shift down to maintain spacing |
| **Hide Goals** | Hides the goal cards on every node simultaneously; child nodes shift up to maintain spacing |
| **↺ Reset Layout** | Clears all manual size and position overrides |
| **↓ Export** | Downloads all nodes, goals, and layout as a JSON file |
| **↑ Import** | Loads nodes and goals (plus optional layout) from a previously exported JSON file |

### List View

A streamlined, tree-based interface optimized for **rapid organizational structure creation** without the complexity of goals or spatial layout.

- **Floating card design** — each node appears as an independent bordered card on the workspace
- **Hierarchical indentation** — child nodes are offset 32px from their parents, creating a staggered visual cascade that clearly shows relationships
- **Expand/collapse** — nodes start **fully expanded by default** for immediate visibility of the entire hierarchy; click ▶/▼ arrows to collapse or expand individual branches; supports **Expand All** and **Collapse All** toolbar buttons
- **Inline editing** — click **Edit** to modify Name, Title, and Role Level directly within the node card
  - Press **Enter** to save or **Escape** to cancel
- **Quick child creation** — click **+ Child** on any node to add a child inline with automatic indentation
- **Drag and drop reparenting** — drag any node card to a new parent
  - Valid drop targets highlight with a **green glow** to show where the connection will be made
  - Cycle detection prevents dropping on descendants
  - Indentation automatically updates after drop
- **Delete with confirmation** — deletes the node and all descendants with a confirmation dialog
- **Alphabetical sorting** — children are automatically sorted by name within each level
- **Keyboard-friendly** — Enter to save, Escape to cancel throughout the interface
- **Export/Import** — export nodes to JSON (goals not required) or import organizational structures
- **Undo support** — all destructive operations support undo

**List View Toolbar:**

| Button | Action |
|---|---|
| **+ Add Node** | Creates a new root node via modal dialog |
| **↩ Undo** | Reverts the last action (delete, reparent, import) |
| **Expand All** | Expands all parent nodes to show full hierarchy |
| **Collapse All** | Collapses all parent nodes to show only root level |
| **↓ Export** | Downloads organizational structure as JSON |
| **↑ Import** | Loads organizational structure from JSON file |

**Use List View when:**
- Building initial organizational structures quickly
- Populating the hierarchy without goal data
- Preferring a familiar tree/outline interface over a spatial canvas
- Bulk editing node properties
- Need keyboard-driven workflow

### Goals

- **Attach goals to any node** — each goal has a description, weight, status (Active / Refined / Complete), and an optional link to a parent goal on an ancestor node.
- **Goal types** — Root (top-level objective), Refined (child-node restatement linked to an ancestor goal), Sub_Task (leaf-level action item).
- **Measurement scales** — choose how progress is measured when creating a goal:
  - **Sliders** — continuous adjustment with 1%, 10%, or 25% increments
  - **Star ratings** — 3, 4, 5, or 10-star quality ratings
  - **Binary controls** — thumbs up/down, checkbox, or happy/sad emoji for yes/no completion
  - **Likert scales** — 3, 5, or 7-point agreement scales (Strongly Disagree → Strongly Agree)
  - All scales normalize to 0-100% for consistent progress tracking and rollup calculations
  - Default is a 1% increment slider for maximum flexibility
- **Weighted progress roll-up** — changing a leaf goal's progress automatically propagates upward through the hierarchy using a weighted average formula: $\text{progress} = \frac{\sum w_i \cdot p_i}{\sum w_i}$
- **Complete shortcut** — setting a goal's status to *Complete* immediately forces its progress to 100 %.
- **Goal panel toggle** — click the 🎯 icon on any node to show or hide its goal cards inline. The node resizes to fit the content, and any child nodes shift to maintain their original distance. Use **Hide Goals** / **Show Goals** in the toolbar to do this across all nodes at once.
- **Goal tooltip** — hover the 🎯 icon on any node for an instant summary of that node's goals, including progress bars and statuses, without expanding the node.
- **Cascade delete** — deleting a goal also removes all Refined goals that trace back to it. Goal deletion supports undo.
- **Change notifications** — when a source goal's description or status changes, a toast notification is generated for every node that has a Refined goal referencing it. Notifications auto-dismiss after 5 seconds.

### Executive Dashboard

- **Goal cards** — every root goal is shown as a card with a progress ring, status badge, refinement count, and weight.
- **Progress ring** — color-coded (green ≥ 80 %, blue ≥ 50 %, orange ≥ 25 %, red < 25 %).
- **Subtree scope picker** — filter the dashboard to show only Root goals belonging to nodes within a chosen subtree. A clear (✕) button resets to the full top-level view.
- **Drill-down panel** — click any card to expand the full goal hierarchy tree, showing weighted progress at each level, owner names, weights, and statuses.

### Data & Persistence

- All data (nodes, goals, and canvas layout) is stored in `localStorage` automatically.
- When storage quota is exceeded the app falls back to IndexedDB transparently.
- **Export / Import** — snapshot the full dataset — nodes, goals, and canvas layout (positions, sizes, collapse state) — to a portable JSON file and reload it on any machine. Layout is restored exactly as exported.
- **Undo** — up to 50 levels of undo for destructive operations (delete node, delete goal, reparent, import). History is stored in memory only and cleared when the page is reloaded or a new dataset is imported.

---

## Project Structure

```
src/
├── adapters/       # Persistence layer (localStorage + IndexedDB fallback, mock for tests)
├── components/     # Vue components (OrgChartContainer, ListView, NodeComponent, GoalCard, ExecutiveDashboard, …)
├── composables/    # Reusable Composition API logic (useUndoRedo, useListView, useProgressColor, useCanvasTransform, …)
├── models/         # TypeScript interfaces (OrgNode, Goal, Notification, …)
├── services/       # Business logic (NodeService, GoalService, ProgressService, Sanitizer, ValidationService)
├── stores/         # Pinia stores (nodeStore, goalStore, uiStore, dashboardStore)
└── tests/          # Shared test utilities
```

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API) |
| State management | Pinia |
| Build tooling | Vite + TypeScript |
| Testing | Vitest |
| Persistence | localStorage / IndexedDB |

---

## Security

All user-supplied text is HTML-escaped before storage and display. The `Sanitizer` service rejects strings containing script tags, event-handler attributes, and dangerous URI schemes (`javascript:`, `data:`, `vbscript:`) — including when embedded inside CSS `url()` constructs. Input lengths are validated both before and after sanitization.

---

## License

MIT

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

# 3. Start the development server
npm run dev
```

Open `http://localhost:5173` in your browser. That's it — no database, no login, no configuration.

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

### Toolbar

| Button | Action |
|---|---|
| **⌂ Home** | Re-centers the view on the leftmost root node |
| **+ Add Node** | Opens the form to create a new root node |
| **⬜ Clean Up** | Re-runs the tree layout algorithm to neatly arrange all nodes |
| **↺ Reset Layout** | Clears all manual size and position overrides |
| **↓ Export** | Downloads all nodes and goals as a JSON file |
| **↑ Import** | Loads nodes and goals from a previously exported JSON file |

### Goals

- **Attach goals to any node** — each goal has a description, weight, status (Active / Refined / Complete), and an optional link to a parent goal on an ancestor node.
- **Goal types** — Root (top-level objective), Refined (child-node restatement linked to an ancestor goal), Sub_Task (leaf-level action item).
- **Weighted progress roll-up** — changing a leaf goal's progress automatically propagates upward through the hierarchy using a weighted average formula: $\text{progress} = \frac{\sum w_i \cdot p_i}{\sum w_i}$
- **Complete shortcut** — setting a goal's status to *Complete* immediately forces its progress to 100 %.
- **Goal tooltip** — hover the goal indicator icon on any node for an instant summary of that node's goals.
- **Cascade delete** — deleting a goal also removes all Refined goals that trace back to it.
- **Change notifications** — when a source goal's description or status changes, a toast notification is generated for every node that has a Refined goal referencing it.

### Executive Dashboard

- **Goal cards** — every root goal is shown as a card with a progress ring, status badge, refinement count, and weight.
- **Progress ring** — color-coded (green ≥ 80 %, blue ≥ 50 %, orange ≥ 25 %, red < 25 %).
- **Drill-down panel** — click any card to expand the full goal hierarchy tree, showing weighted progress at each level, owner names, weights, and statuses.

### Data & Persistence

- All data (nodes, goals, and canvas layout) is stored in `localStorage` automatically.
- When storage quota is exceeded the app falls back to IndexedDB transparently.
- **Export / Import** — snapshot the full dataset to a portable JSON file and reload it on any machine.

---

## Project Structure

```
src/
├── adapters/       # Persistence layer (localStorage + IndexedDB fallback, mock for tests)
├── components/     # Vue components (OrgChartContainer, NodeComponent, GoalCard, …)
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

All user-supplied text is HTML-escaped before storage and display. The `Sanitizer` service rejects strings containing script tags, event-handler attributes, and dangerous URI schemes (`javascript:`, `data:`, `vbscript:`). Input lengths are validated both before and after sanitization.

---

## License

MIT

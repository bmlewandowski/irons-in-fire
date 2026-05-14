/**
 * Undo/redo stack for destructive operations (delete node, reparent, import).
 *
 * Snapshots capture the full `nodes` and `goals` record maps so that a single
 * undo call can restore the exact pre-operation state.  Layout state (sizes,
 * offsets, collapse) is captured separately so it can also be unwound.
 *
 * Usage:
 *   const { canUndo, canRedo, snapshot, undo, redo } = useUndoRedo()
 *
 *   // Before a destructive operation:
 *   snapshot()
 *   await nodeStore.deleteNode(id)
 *
 *   // Keyboard shortcut / button:
 *   undo()   // restores stores + localStorage
 */

import { ref, computed } from 'vue'
import type { OrgNode } from '@/models/OrgNode'
import type { Goal } from '@/models/Goal'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'

const MAX_UNDO_DEPTH = 50

interface LayoutSnapshot {
  sizes: [string, { width: number; height: number }][]
  positions: [string, { x: number; y: number }][]
  collapsed: string[]
  collapsedGoals: string[]
}

interface HistoryEntry {
  nodes: Record<string, OrgNode>
  goals: Record<string, Goal>
  layout: LayoutSnapshot
}

/**
 * The layout refs live in OrgChartContainer so they are passed as getter/setter
 * callbacks rather than direct refs to avoid circular imports.
 */
export interface LayoutAccessors {
  getLayout: () => LayoutSnapshot
  setLayout: (layout: LayoutSnapshot) => void
  saveLayout: () => void
}

export function useUndoRedo(layoutAccessors: LayoutAccessors) {
  const nodeStore = useNodeStore()
  const goalStore = useGoalStore()

  /** Entries before each destructive operation — index 0 is the oldest. */
  const past = ref<HistoryEntry[]>([])
  /** Entries after the current position (populated on undo). */
  const future = ref<HistoryEntry[]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  /** Call this BEFORE a destructive operation to capture the current state. */
  function snapshot() {
    // Deep-copy nodes + goals (they are plain JSON-serialisable objects)
    const entry: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodeStore.nodes)),
      goals: JSON.parse(JSON.stringify(goalStore.goals)),
      layout: layoutAccessors.getLayout(),
    }
    past.value = [...past.value.slice(-(MAX_UNDO_DEPTH - 1)), entry]
    // A new action invalidates the redo stack
    future.value = []
  }

  function restoreEntry(entry: HistoryEntry) {
    nodeStore.$patch({ nodes: entry.nodes })
    goalStore.$patch({ goals: entry.goals })
    layoutAccessors.setLayout(entry.layout)
    layoutAccessors.saveLayout()
    // Also sync localStorage so a page refresh won't lose the undo
    try {
      localStorage.setItem('irons-in-fire:nodes', JSON.stringify(Object.values(entry.nodes)))
      localStorage.setItem('irons-in-fire:goals', JSON.stringify(Object.values(entry.goals)))
    } catch {
      // quota errors are non-fatal
    }
  }

  function undo() {
    if (past.value.length === 0) return
    // Snapshot current state for redo
    const current: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodeStore.nodes)),
      goals: JSON.parse(JSON.stringify(goalStore.goals)),
      layout: layoutAccessors.getLayout(),
    }
    future.value = [current, ...future.value]

    const prev = past.value[past.value.length - 1]
    past.value = past.value.slice(0, -1)
    restoreEntry(prev)
  }

  function redo() {
    if (future.value.length === 0) return
    // Push current state onto past
    const current: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodeStore.nodes)),
      goals: JSON.parse(JSON.stringify(goalStore.goals)),
      layout: layoutAccessors.getLayout(),
    }
    past.value = [...past.value, current]

    const next = future.value[0]
    future.value = future.value.slice(1)
    restoreEntry(next)
  }

  /** Clear both stacks (e.g. after import replaces the full dataset). */
  function clearHistory() {
    past.value = []
    future.value = []
  }

  return { canUndo, canRedo, snapshot, undo, redo, clearHistory }
}

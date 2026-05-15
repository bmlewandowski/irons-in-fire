/**
 * Undo/redo stack for destructive operations (delete node, reparent, import).
 *
 * Snapshots capture the full `nodes` and `goals` record maps so that a single
 * undo call can restore the exact pre-operation state.  Layout state (sizes,
 * offsets, collapse) is captured separately so it can also be unwound.
 *
 * Usage:
 *   const { canUndo, snapshot, undo } = useUndoRedo()
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
  /** Serialized JSON string of Record<string, OrgNode> — parsed only on restore. */
  nodes: string
  /** Serialized JSON string of Record<string, Goal> — parsed only on restore. */
  goals: string
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

  const canUndo = computed(() => past.value.length > 0)

  /** Call this BEFORE a destructive operation to capture the current state. */
  function snapshot() {
    const entry: HistoryEntry = {
      nodes: JSON.stringify(nodeStore.nodes),
      goals: JSON.stringify(goalStore.goals),
      layout: layoutAccessors.getLayout(),
    }
    past.value = [...past.value.slice(-(MAX_UNDO_DEPTH - 1)), entry]
  }

  function restoreEntry(entry: HistoryEntry) {
    const nodes: Record<string, OrgNode> = JSON.parse(entry.nodes)
    const goals: Record<string, Goal> = JSON.parse(entry.goals)
    nodeStore.$patch({ nodes })
    goalStore.$patch({ goals })
    layoutAccessors.setLayout(entry.layout)
    layoutAccessors.saveLayout()
    // Also sync localStorage so a page refresh won't lose the undo
    try {
      localStorage.setItem('irons-in-fire:nodes', JSON.stringify(Object.values(nodes)))
      localStorage.setItem('irons-in-fire:goals', JSON.stringify(Object.values(goals)))
    } catch {
      // quota errors are non-fatal
    }
  }

  function undo() {
    if (past.value.length === 0) return
    const prev = past.value[past.value.length - 1]
    past.value = past.value.slice(0, -1)
    restoreEntry(prev)
  }

  /** Clear the undo stack (e.g. after import replaces the full dataset). */
  function clearHistory() {
    past.value = []
  }

  return { canUndo, snapshot, undo, clearHistory }
}

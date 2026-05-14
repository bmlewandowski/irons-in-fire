/**
 * Delta-based Undo/Redo system - Memory-efficient alternative to full snapshots
 * 
 * Instead of serializing the entire state (5+ MB per snapshot at max capacity),
 * this system stores only the changes (deltas) needed to undo/redo operations.
 * 
 * For a delete operation with 10 affected nodes and 20 goals:
 * - Full snapshot: ~500KB
 * - Delta snapshot: ~50KB (10x reduction)
 * 
 * For 50 undo levels, this saves ~22MB of memory.
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

type OperationType = 'delete' | 'reparent' | 'import' | 'update'

interface DeltaEntry {
  type: OperationType
  /** Nodes that were added/changed (for redo) */
  nodesAdded?: Record<string, OrgNode>
  /** Node IDs that were removed (for redo) */
  nodesRemoved?: string[]
  /** Nodes that were removed (for undo - to restore them) */
  nodesRemovedData?: Record<string, OrgNode>
  /** Goals that were added/changed (for redo) */
  goalsAdded?: Record<string, Goal>
  /** Goal IDs that were removed (for redo) */
  goalsRemoved?: string[]
  /** Goals that were removed (for undo - to restore them) */
  goalsRemovedData?: Record<string, Goal>
  /** Layout before the operation (for undo) */
  layoutBefore?: LayoutSnapshot
  /** Layout after the operation (for redo) */
  layoutAfter?: LayoutSnapshot
  /** For reparent operations - track the change */
  reparent?: {
    nodeId: string
    oldParentId: string | null
    newParentId: string | null
  }
}

export interface LayoutAccessors {
  getLayout: () => LayoutSnapshot
  setLayout: (layout: LayoutSnapshot) => void
  saveLayout: () => void
}

/**
 * Deep clone layout snapshot to avoid mutation issues
 */
function cloneLayout(layout: LayoutSnapshot): LayoutSnapshot {
  return {
    sizes: layout.sizes.map(([id, size]) => [id, { ...size }] as [string, { width: number; height: number }]),
    positions: layout.positions.map(([id, pos]) => [id, { ...pos }] as [string, { x: number; y: number }]),
    collapsed: [...layout.collapsed],
    collapsedGoals: [...layout.collapsedGoals],
  }
}

export function useUndoRedoDelta(layoutAccessors: LayoutAccessors) {
  const nodeStore = useNodeStore()
  const goalStore = useGoalStore()

  const past = ref<DeltaEntry[]>([])
  const future = ref<DeltaEntry[]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  /**
   * Capture state before a delete operation.
   * Stores only the nodes/goals that will be deleted.
   */
  function snapshotDelete(nodeIds: string[], goalIds: string[]): void {
    const delta: DeltaEntry = {
      type: 'delete',
      nodesRemoved: nodeIds,
      nodesRemovedData: {},
      goalsRemoved: goalIds,
      goalsRemovedData: {},
      layoutBefore: cloneLayout(layoutAccessors.getLayout()),
    }

    // Capture data for nodes that will be deleted
    for (const id of nodeIds) {
      const node = nodeStore.nodes[id]
      if (node) {
        delta.nodesRemovedData![id] = { ...node }
      }
    }

    // Capture data for goals that will be deleted
    for (const id of goalIds) {
      const goal = goalStore.goals[id]
      if (goal) {
        delta.goalsRemovedData![id] = { ...goal }
      }
    }

    pushToHistory(delta)
  }

  /**
   * Capture state for a reparent operation.
   */
  function snapshotReparent(nodeId: string, oldParentId: string | null, newParentId: string | null): void {
    const delta: DeltaEntry = {
      type: 'reparent',
      reparent: { nodeId, oldParentId, newParentId },
      layoutBefore: cloneLayout(layoutAccessors.getLayout()),
    }
    pushToHistory(delta)
  }

  /**
   * Capture state for an import operation (full replacement).
   * This is the only case where we store full state (old and new).
   */
  function snapshotImport(
    oldNodes: Record<string, OrgNode>,
    oldGoals: Record<string, Goal>,
    newNodes: Record<string, OrgNode>,
    newGoals: Record<string, Goal>
  ): void {
    const delta: DeltaEntry = {
      type: 'import',
      nodesRemovedData: oldNodes,
      goalsRemovedData: oldGoals,
      nodesAdded: newNodes,
      goalsAdded: newGoals,
      layoutBefore: cloneLayout(layoutAccessors.getLayout()),
    }
    pushToHistory(delta)
  }

  /**
   * Capture state for an update operation (node or goal edit).
   */
  function snapshotUpdate(
    oldNode?: OrgNode,
    newNode?: OrgNode,
    oldGoal?: Goal,
    newGoal?: Goal
  ): void {
    const delta: DeltaEntry = {
      type: 'update',
      nodesRemovedData: oldNode ? { [oldNode.id]: oldNode } : {},
      nodesAdded: newNode ? { [newNode.id]: newNode } : {},
      goalsRemovedData: oldGoal ? { [oldGoal.id]: oldGoal } : {},
      goalsAdded: newGoal ? { [newGoal.id]: newGoal } : {},
      layoutBefore: cloneLayout(layoutAccessors.getLayout()),
    }
    pushToHistory(delta)
  }

  function pushToHistory(delta: DeltaEntry): void {
    past.value = [...past.value.slice(-(MAX_UNDO_DEPTH - 1)), delta]
    future.value = [] // Invalidate redo stack
  }

  function applyDelta(delta: DeltaEntry, forward: boolean): void {
    if (forward) {
      // Apply forward (redo): remove old, add new
      if (delta.type === 'import' && delta.nodesAdded && delta.goalsAdded) {
        // For import, replace everything (not merge)
        nodeStore.$state.nodes = { ...delta.nodesAdded }
        goalStore.$state.goals = { ...delta.goalsAdded }
      } else {
        // For other operations, apply changes incrementally
        let nodes = { ...nodeStore.nodes }
        let goals = { ...goalStore.goals }
        let nodesChanged = false
        let goalsChanged = false

        if (delta.nodesRemoved) {
          for (const id of delta.nodesRemoved) {
            delete nodes[id]
          }
          nodesChanged = true
        }
        if (delta.nodesAdded) {
          nodes = { ...nodes, ...delta.nodesAdded }
          nodesChanged = true
        }
        if (delta.goalsRemoved) {
          for (const id of delta.goalsRemoved) {
            delete goals[id]
          }
          goalsChanged = true
        }
        if (delta.goalsAdded) {
          goals = { ...goals, ...delta.goalsAdded }
          goalsChanged = true
        }
        if (delta.reparent) {
          const node = nodes[delta.reparent.nodeId]
          if (node) {
            nodes = {
              ...nodes,
              [delta.reparent.nodeId]: {
                ...node,
                parentId: delta.reparent.newParentId,
              },
            }
            nodesChanged = true
          }
        }

        if (nodesChanged) nodeStore.$state.nodes = nodes
        if (goalsChanged) goalStore.$state.goals = goals
      }
      if (delta.layoutAfter) {
        layoutAccessors.setLayout(delta.layoutAfter)
      }
    } else {
      // Apply backward (undo): restore old, remove new
      if (delta.type === 'import' && delta.nodesRemovedData && delta.goalsRemovedData) {
        // For import undo, restore everything (not merge)
        nodeStore.$state.nodes = { ...delta.nodesRemovedData }
        goalStore.$state.goals = { ...delta.goalsRemovedData }
      } else {
        // For other operations, apply changes incrementally
        // IMPORTANT: For undo, restore removed data BEFORE deleting added data
        // to handle updates where the same ID exists in both
        let nodes = { ...nodeStore.nodes }
        let goals = { ...goalStore.goals }
        let nodesChanged = false
        let goalsChanged = false

        // First, restore removed data (this will overwrite any existing entries)
        if (delta.nodesRemovedData) {
          nodes = { ...nodes, ...delta.nodesRemovedData }
          nodesChanged = true
        }
        // Then, remove newly added data
        if (delta.nodesAdded) {
          for (const id of Object.keys(delta.nodesAdded)) {
            // Only delete if it's not also in nodesRemovedData (update case)
            if (!delta.nodesRemovedData || !delta.nodesRemovedData[id]) {
              delete nodes[id]
            }
          }
          nodesChanged = true
        }

        // Same for goals
        if (delta.goalsRemovedData) {
          goals = { ...goals, ...delta.goalsRemovedData }
          goalsChanged = true
        }
        if (delta.goalsAdded) {
          for (const id of Object.keys(delta.goalsAdded)) {
            // Only delete if it's not also in goalsRemovedData (update case)
            if (!delta.goalsRemovedData || !delta.goalsRemovedData[id]) {
              delete goals[id]
            }
          }
          goalsChanged = true
        }

        if (delta.reparent) {
          const node = nodes[delta.reparent.nodeId]
          if (node) {
            nodes = {
              ...nodes,
              [delta.reparent.nodeId]: {
                ...node,
                parentId: delta.reparent.oldParentId,
              },
            }
            nodesChanged = true
          }
        }

        if (nodesChanged) nodeStore.$state.nodes = nodes
        if (goalsChanged) goalStore.$state.goals = goals
      }
      if (delta.layoutBefore) {
        layoutAccessors.setLayout(delta.layoutBefore)
      }
    }

    // Sync to localStorage
    layoutAccessors.saveLayout()
    try {
      localStorage.setItem('irons-in-fire:nodes', JSON.stringify(Object.values(nodeStore.nodes)))
      localStorage.setItem('irons-in-fire:goals', JSON.stringify(Object.values(goalStore.goals)))
    } catch {
      // quota errors are non-fatal
    }
  }

  function undo(): void {
    if (past.value.length === 0) return

    const delta = past.value[past.value.length - 1]
    past.value = past.value.slice(0, -1)

    // Capture current layout for redo (this is the "after" state)
    if (!delta.layoutAfter) {
      delta.layoutAfter = cloneLayout(layoutAccessors.getLayout())
    }

    // Apply the undo
    applyDelta(delta, false)

    // Move to future
    future.value = [delta, ...future.value]
  }

  function redo(): void {
    if (future.value.length === 0) return

    const delta = future.value[0]
    future.value = future.value.slice(1)

    // Apply the redo
    applyDelta(delta, true)

    // Move to past
    past.value = [...past.value, delta]
  }

  function clearHistory(): void {
    past.value = []
    future.value = []
  }

  // For backward compatibility, provide a generic snapshot that creates a full import delta
  function snapshot(): void {
    const delta: DeltaEntry = {
      type: 'import',
      nodesRemovedData: { ...nodeStore.nodes },
      goalsRemovedData: { ...goalStore.goals },
      layoutBefore: cloneLayout(layoutAccessors.getLayout()),
    }
    pushToHistory(delta)
  }

  return {
    canUndo,
    canRedo,
    snapshot, // Generic snapshot for backward compatibility
    snapshotDelete,
    snapshotReparent,
    snapshotImport,
    snapshotUpdate,
    undo,
    redo,
    clearHistory,
  }
}

import { defineStore, storeToRefs } from 'pinia'
import { computed } from 'vue'
import type { Goal } from '@/models'
import { useGoalStore } from './goalStore'
import { useNodeStore } from './nodeStore'

/**
 * Derived Pinia store for the Executive Dashboard.
 * Reads from goalStore and nodeStore to expose Root_Goals owned by Root_Nodes.
 * Requirements: 8.1, 8.5
 */
export const useDashboardStore = defineStore('dashboard', () => {
  const goalStore = useGoalStore()
  const nodeStore = useNodeStore()

  const { goals } = storeToRefs(goalStore)
  const { nodes } = storeToRefs(nodeStore)

  /**
   * Goals where type === 'Root' AND the owning node has parentId === null.
   * These are the top-tier objectives shown on the Executive Dashboard.
   */
  const rootGoals = computed<Goal[]>(() =>
    Object.values(goals.value).filter((g) => {
      if (g.type !== 'Root') return false
      const owningNode = nodes.value[g.nodeId]
      return owningNode !== undefined && owningNode.parentId === null
    })
  )

  /**
   * Root goals owned by any node in the subtree of `nodeId`.
   * Pass null to fall back to rootGoals (top-level only).
   */
  function goalsForScope(nodeId: string | null): Goal[] {
    if (nodeId === null) return rootGoals.value
    const subtreeIds = new Set(nodeStore.subtreeOf(nodeId).map((n) => n.id))
    return Object.values(goals.value).filter(
      (g) => g.type === 'Root' && subtreeIds.has(g.nodeId),
    )
  }

  return {
    rootGoals,
    goalsForScope,
  }
})

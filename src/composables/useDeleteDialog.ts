/**
 * useDeleteDialog — manages the node-delete confirmation dialog, including
 * focus-trap behaviour, promote-children-and-delete, and cascade delete.
 *
 * Extracted from OrgChartContainer.
 */

import { ref, watch, nextTick } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import { useUiStore } from '@/stores/uiStore'

export function useDeleteDialog(snapshot: () => void) {
  const nodeStore = useNodeStore()
  const goalStore = useGoalStore()
  const uiStore = useUiStore()

  const confirmDelete = ref<{
    nodeId: string
    descendantCount: number
    goalCount: number
    directChildCount: number
    grandparentId: string | null
  } | null>(null)

  const dialogPanelRef = ref<HTMLElement | null>(null)
  const focusOrigin = ref<HTMLElement | null>(null)

  watch(
    () => confirmDelete.value,
    async (val) => {
      if (val) {
        focusOrigin.value = document.activeElement as HTMLElement | null
        await nextTick()
        const firstBtn = dialogPanelRef.value?.querySelector<HTMLElement>('button')
        firstBtn?.focus()
      } else {
        focusOrigin.value?.focus()
        focusOrigin.value = null
      }
    },
  )

  function onDeleteNode(nodeId: string) {
    const subtree = nodeStore.subtreeOf(nodeId)
    const descendantCount = subtree.length - 1
    const directChildren = nodeStore.childrenOf(nodeId)
    const node = nodeStore.nodes[nodeId]

    if (descendantCount > 0) {
      const goalCount = subtree.reduce(
        (sum, n) => sum + goalStore.goalsForNode(n.id).length,
        0,
      )
      confirmDelete.value = {
        nodeId,
        descendantCount,
        goalCount,
        directChildCount: directChildren.length,
        grandparentId: node?.parentId ?? null,
      }
    } else {
      const goalCount = goalStore.goalsForNode(nodeId).length
      confirmDelete.value = {
        nodeId,
        descendantCount: 0,
        goalCount,
        directChildCount: 0,
        grandparentId: nodeStore.nodes[nodeId]?.parentId ?? null,
      }
    }
  }

  async function confirmDeleteNode() {
    if (!confirmDelete.value) return
    const { nodeId } = confirmDelete.value
    confirmDelete.value = null
    snapshot()
    try {
      await nodeStore.deleteNode(nodeId)
    } catch (err) {
      uiStore.addNotification({
        id: crypto.randomUUID(),
        nodeId,
        message: err instanceof Error ? err.message : 'Failed to delete node.',
        sourceGoalId: '',
        read: false,
        createdAt: new Date().toISOString(),
      })
    }
  }

  async function promoteAndDeleteNode() {
    if (!confirmDelete.value) return
    const { nodeId, grandparentId } = confirmDelete.value
    confirmDelete.value = null
    snapshot()
    const directChildren = nodeStore.childrenOf(nodeId)
    try {
      for (const child of directChildren) {
        if (grandparentId !== null) {
          await nodeStore.reparentNode(child.id, grandparentId)
        } else {
          await nodeStore.promoteToRoot(child.id)
        }
      }
      await nodeStore.deleteNode(nodeId)
    } catch (err) {
      uiStore.addNotification({
        id: crypto.randomUUID(),
        nodeId,
        message: err instanceof Error ? err.message : 'Failed to promote and delete node.',
        sourceGoalId: '',
        read: false,
        createdAt: new Date().toISOString(),
      })
    }
  }

  function cancelDelete() {
    confirmDelete.value = null
  }

  function onDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      cancelDelete()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = dialogPanelRef.value?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable || focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return {
    confirmDelete,
    dialogPanelRef,
    onDeleteNode,
    confirmDeleteNode,
    promoteAndDeleteNode,
    cancelDelete,
    onDialogKeydown,
  }
}

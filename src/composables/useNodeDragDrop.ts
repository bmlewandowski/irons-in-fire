/**
 * useNodeDragDrop — manages HTML5 drag-and-drop reparenting of nodes on the
 * SVG canvas, including cycle detection via validDropTargetIds.
 *
 * Extracted from OrgChartContainer.
 */

import { ref, computed } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useUiStore } from '@/stores/uiStore'
import type { Ref } from 'vue'

export function useNodeDragDrop(
  nodeAbsPositions: Ref<Map<string, { x: number; y: number }>>,
  snapshot: () => void,
) {
  const nodeStore = useNodeStore()
  const uiStore = useUiStore()

  const dragState = ref<{
    draggingNodeId: string | null
    originalParentId: string | null
    originalPosition: { x: number; y: number } | null
  }>({
    draggingNodeId: null,
    originalParentId: null,
    originalPosition: null,
  })

  /**
   * Valid drop targets: all nodes EXCEPT the dragged node, its descendants,
   * and its current parent.
   */
  const validDropTargetIds = computed<Set<string>>(() => {
    const draggingId = dragState.value.draggingNodeId
    if (!draggingId) return new Set()

    const subtree = new Set(nodeStore.subtreeOf(draggingId).map((n) => n.id))
    const currentParentId = nodeStore.nodes[draggingId]?.parentId

    const valid = new Set<string>()
    for (const id of Object.keys(nodeStore.nodes)) {
      if (subtree.has(id)) continue
      if (id === currentParentId) continue
      valid.add(id)
    }
    return valid
  })

  function onDragStart(nodeId: string) {
    const node = nodeStore.nodes[nodeId]
    if (!node) return
    const pos = nodeAbsPositions.value.get(nodeId)
    dragState.value = {
      draggingNodeId: nodeId,
      originalParentId: node.parentId,
      originalPosition: pos ? { ...pos } : null,
    }
  }

  function onDragEnd() {
    dragState.value = {
      draggingNodeId: null,
      originalParentId: null,
      originalPosition: null,
    }
  }

  async function onDrop(targetNodeId: string) {
    const draggingId = dragState.value.draggingNodeId
    if (!draggingId) return

    if (!validDropTargetIds.value.has(targetNodeId)) {
      onDragEnd()
      return
    }

    snapshot()
    try {
      await nodeStore.reparentNode(draggingId, targetNodeId)
      onDragEnd()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move node.'
      uiStore.addNotification({
        id: crypto.randomUUID(),
        nodeId: draggingId,
        message,
        sourceGoalId: '',
        read: false,
        createdAt: new Date().toISOString(),
      })

      const originalParentId = dragState.value.originalParentId
      if (originalParentId !== undefined) {
        nodeStore.$patch((state) => {
          if (state.nodes[draggingId]) {
            state.nodes[draggingId] = { ...state.nodes[draggingId], parentId: originalParentId }
          }
        })
      }
      onDragEnd()
    }
  }

  return {
    dragState,
    validDropTargetIds,
    onDragStart,
    onDragEnd,
    onDrop,
  }
}

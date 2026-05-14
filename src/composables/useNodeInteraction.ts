/**
 * useNodeInteraction — manages free-move drag and corner-resize of nodes on
 * the SVG canvas, including descendant tracking so entire subtrees move/resize
 * together.
 *
 * Extracted from OrgChartContainer.
 */

import { ref } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { MIN_NODE_WIDTH, MIN_NODE_HEIGHT } from './useNodeLayout'
import type { Ref } from 'vue'

interface NodeLayoutAccessors {
  getNodeSize: (id: string) => { width: number; height: number }
  getNodeX: (id: string) => number
  getNodeY: (id: string) => number
  nodeSizes: Ref<Map<string, { width: number; height: number }>>
  nodeAbsPositions: Ref<Map<string, { x: number; y: number }>>
}

export function useNodeInteraction(
  transform: Ref<{ scale: number; x: number; y: number }>,
  layout: NodeLayoutAccessors,
) {
  const nodeStore = useNodeStore()
  const { getNodeSize, getNodeX, getNodeY, nodeSizes, nodeAbsPositions } = layout

  // ── Resize State ───────────────────────────────────────────────────────
  const resizeState = ref<{
    nodeId: string
    corner: 'se' | 'sw' | 'ne' | 'nw'
    startScreenX: number
    startScreenY: number
    startW: number
    startH: number
    startX: number
    startY: number
    startDescendantPositions: Map<string, { x: number; y: number }>
  } | null>(null)

  function startResize(event: MouseEvent, nodeId: string, corner: 'se' | 'sw' | 'ne' | 'nw') {
    event.stopPropagation()
    event.preventDefault()
    const { width, height } = getNodeSize(nodeId)

    const descendants = nodeStore.subtreeOf(nodeId).slice(1)
    const startDescendantPositions = new Map<string, { x: number; y: number }>()
    for (const desc of descendants) {
      startDescendantPositions.set(desc.id, { x: getNodeX(desc.id), y: getNodeY(desc.id) })
    }

    resizeState.value = {
      nodeId, corner,
      startScreenX: event.clientX, startScreenY: event.clientY,
      startW: width, startH: height,
      startX: getNodeX(nodeId), startY: getNodeY(nodeId),
      startDescendantPositions,
    }
  }

  function onResizeHandleMouseDown(event: MouseEvent, nodeId: string) { startResize(event, nodeId, 'se') }
  function onResizeHandleSwMouseDown(event: MouseEvent, nodeId: string) { startResize(event, nodeId, 'sw') }
  function onResizeHandleNeMouseDown(event: MouseEvent, nodeId: string) { startResize(event, nodeId, 'ne') }
  function onResizeHandleNwMouseDown(event: MouseEvent, nodeId: string) { startResize(event, nodeId, 'nw') }

  // ── Move State ─────────────────────────────────────────────────────────
  const moveState = ref<{
    nodeId: string
    startScreenX: number
    startScreenY: number
    startX: number
    startY: number
    active: boolean
    startDescendantPositions: Map<string, { x: number; y: number }>
  } | null>(null)

  const suppressNextClick = ref(false)

  function onNodeWrapperMouseDown(event: MouseEvent, nodeId: string) {
    const target = event.target as Element
    if (target.closest('button, input, select, textarea, [draggable="true"]')) return
    event.stopPropagation()
    const moveDescendants = nodeStore.subtreeOf(nodeId).slice(1)
    const startDescendantPositions = new Map<string, { x: number; y: number }>()
    for (const desc of moveDescendants) {
      startDescendantPositions.set(desc.id, { x: getNodeX(desc.id), y: getNodeY(desc.id) })
    }
    moveState.value = {
      nodeId,
      startScreenX: event.clientX,
      startScreenY: event.clientY,
      startX: getNodeX(nodeId),
      startY: getNodeY(nodeId),
      active: false,
      startDescendantPositions,
    }
  }

  // ── Mouse event handlers ───────────────────────────────────────────────
  /**
   * Handles the resize and move portions of mousemove.
   * Returns true if the event was consumed (resize or move was active),
   * false if the caller should fall through to pan handling.
   */
  function handleMouseMove(event: MouseEvent): boolean {
    if (resizeState.value) {
      const { nodeId, corner, startScreenX, startScreenY, startW, startH, startX, startY } = resizeState.value
      const dX = (event.clientX - startScreenX) / transform.value.scale
      const dY = (event.clientY - startScreenY) / transform.value.scale

      let newW = startW
      let newH = startH
      let newX = startX
      let newY = startY

      if (corner === 'se') {
        newW = Math.max(MIN_NODE_WIDTH, startW + dX)
        newH = Math.max(MIN_NODE_HEIGHT, startH + dY)
      } else if (corner === 'sw') {
        newW = Math.max(MIN_NODE_WIDTH, startW - dX)
        newH = Math.max(MIN_NODE_HEIGHT, startH + dY)
        newX = startX + (startW - newW)
      } else if (corner === 'ne') {
        newW = Math.max(MIN_NODE_WIDTH, startW + dX)
        newH = Math.max(MIN_NODE_HEIGHT, startH - dY)
        newY = startY + (startH - newH)
      } else if (corner === 'nw') {
        newW = Math.max(MIN_NODE_WIDTH, startW - dX)
        newH = Math.max(MIN_NODE_HEIGHT, startH - dY)
        newX = startX + (startW - newW)
        newY = startY + (startH - newH)
      }

      const newSizeMap = new Map(nodeSizes.value)
      newSizeMap.set(nodeId, { width: newW, height: newH })
      nodeSizes.value = newSizeMap

      const newPositions = new Map(nodeAbsPositions.value)
      newPositions.set(nodeId, { x: newX, y: newY })

      const deltaW = newW - startW
      const deltaH = newH - startH
      const deltaCenterX = (corner === 'se' || corner === 'ne') ? deltaW / 2 : -deltaW / 2
      const pushDown = (corner === 'se' || corner === 'sw') ? deltaH : 0
      for (const [descId, descStart] of resizeState.value.startDescendantPositions) {
        newPositions.set(descId, {
          x: descStart.x + deltaCenterX,
          y: descStart.y + pushDown,
        })
      }

      nodeAbsPositions.value = newPositions
      return true
    }

    if (moveState.value) {
      const { nodeId, startScreenX, startScreenY, startX, startY } = moveState.value
      const dX = (event.clientX - startScreenX) / transform.value.scale
      const dY = (event.clientY - startScreenY) / transform.value.scale
      if (!moveState.value.active && Math.hypot(dX, dY) < 4) return true
      moveState.value.active = true
      const newPositions = new Map(nodeAbsPositions.value)
      newPositions.set(nodeId, { x: startX + dX, y: startY + dY })
      for (const [descId, descStart] of moveState.value.startDescendantPositions) {
        newPositions.set(descId, { x: descStart.x + dX, y: descStart.y + dY })
      }
      nodeAbsPositions.value = newPositions
      return true
    }

    return false
  }

  function handleMouseUp() {
    resizeState.value = null
    if (moveState.value?.active) {
      suppressNextClick.value = true
    }
    moveState.value = null
  }

  return {
    resizeState,
    moveState,
    suppressNextClick,
    onNodeWrapperMouseDown,
    onResizeHandleMouseDown,
    onResizeHandleSwMouseDown,
    onResizeHandleNeMouseDown,
    onResizeHandleNwMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}

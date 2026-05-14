/**
 * useNodeLayout — manages node sizes, absolute canvas positions, layout
 * persistence, and the two-pass tree layout algorithm.
 *
 * Extracted from OrgChartContainer to keep that component focused on
 * rendering and user-event wiring.
 */

import { ref, watch, nextTick } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'

// ── Layout Constants ───────────────────────────────────────────────────────
export const NODE_WIDTH = 180
export const NODE_HEIGHT = 100
export const MIN_NODE_WIDTH = 120
export const MIN_NODE_HEIGHT = 80
export const LAYOUT_GAP_X = 24  // horizontal gap between sibling subtrees
export const LAYOUT_GAP_Y = 40  // vertical gap between parent bottom and children top

const LAYOUT_STORAGE_KEY = 'irons-in-fire:layout'

export interface LayoutSnapshot {
  sizes: [string, { width: number; height: number }][]
  positions: [string, { x: number; y: number }][]
  collapsed: string[]
  collapsedGoals: string[]
}

/**
 * Composable that owns all node-sizing and positioning state.
 *
 * @param collapsedNodes  ref to the set of collapsed tree-node IDs — needed
 *   by the layout algorithm to skip collapsed subtrees.  Owned by
 *   useNodeCollapse and threaded in here to avoid duplicating state.
 * @param collapsedGoalNodes  ref to the set of nodes whose goal panels are
 *   hidden — needed so saveLayout / loadLayout can round-trip the value.
 */
export function useNodeLayout(
  collapsedNodes: ReturnType<typeof ref<Set<string>>>,
  collapsedGoalNodes: ReturnType<typeof ref<Set<string>>>,
) {
  const nodeStore = useNodeStore()

  const nodeSizes = ref(new Map<string, { width: number; height: number }>())
  const nodeAbsPositions = ref(new Map<string, { x: number; y: number }>())
  const showResetConfirm = ref(false)

  // ── Accessors ──────────────────────────────────────────────────────────
  function getNodeSize(nodeId: string): { width: number; height: number } {
    return nodeSizes.value.get(nodeId) ?? { width: NODE_WIDTH, height: NODE_HEIGHT }
  }

  function getNodeX(nodeId: string): number {
    return nodeAbsPositions.value.get(nodeId)?.x ?? 0
  }

  function getNodeY(nodeId: string): number {
    return nodeAbsPositions.value.get(nodeId)?.y ?? 0
  }

  // ── Persistence ────────────────────────────────────────────────────────
  function saveLayout() {
    try {
      const payload = JSON.stringify({
        sizes: [...nodeSizes.value.entries()],
        positions: [...nodeAbsPositions.value.entries()],
        collapsed: [...(collapsedNodes.value ?? new Set())],
        collapsedGoals: [...(collapsedGoalNodes.value ?? new Set())],
      })
      localStorage.setItem(LAYOUT_STORAGE_KEY, payload)
    } catch {
      // quota errors are non-fatal for layout state
    }
  }

  function loadLayout() {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (!raw) return
      const { sizes, positions, collapsed, collapsedGoals } = JSON.parse(raw) as LayoutSnapshot
      if (Array.isArray(sizes)) nodeSizes.value = new Map(sizes)
      if (Array.isArray(positions)) nodeAbsPositions.value = new Map(positions)
      if (Array.isArray(collapsed) && collapsedNodes.value !== undefined) {
        collapsedNodes.value = new Set(collapsed)
      }
      if (Array.isArray(collapsedGoals) && collapsedGoalNodes.value !== undefined) {
        collapsedGoalNodes.value = new Set(collapsedGoals)
      }
    } catch {
      // corrupt data — ignore and start fresh
    }
  }

  function resetLayout() {
    nodeSizes.value = new Map()
    nodeAbsPositions.value = new Map()
    if (collapsedNodes.value !== undefined) collapsedNodes.value = new Set()
    if (collapsedGoalNodes.value !== undefined) collapsedGoalNodes.value = new Set()
    localStorage.removeItem(LAYOUT_STORAGE_KEY)
    nextTick(() => relayoutNodes())
  }

  // ── Auto-save (debounced) ──────────────────────────────────────────────
  let _layoutSaveTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    [nodeSizes, nodeAbsPositions, collapsedNodes],
    () => {
      if (_layoutSaveTimer !== null) clearTimeout(_layoutSaveTimer)
      _layoutSaveTimer = setTimeout(saveLayout, 300)
    },
    { deep: true },
  )

  // ── Two-pass Tree Layout Algorithm ─────────────────────────────────────
  /**
   * Re-computes positions using each node's actual (possibly user-resized) size
   * and writes results directly into nodeAbsPositions.
   *
   * Pass 1 — subtreeWidth(): minimum horizontal slot for each subtree.
   * Pass 2 — placeSubtree(): assign absolute (x, y) positions top-down.
   */
  function relayoutNodes() {
    const nodes = nodeStore.nodes
    if (Object.keys(nodes).length === 0) return

    function subtreeWidth(nodeId: string): number {
      const children = collapsedNodes.value?.has(nodeId) ? [] : nodeStore.childrenOf(nodeId)
      const { width } = getNodeSize(nodeId)
      if (children.length === 0) return width
      const childrenSpan =
        children.reduce((sum, c) => sum + subtreeWidth(c.id), 0) +
        LAYOUT_GAP_X * (children.length - 1)
      return Math.max(width, childrenSpan)
    }

    const newAbsPositions = new Map<string, { x: number; y: number }>()

    function placeSubtree(nodeId: string, xStart: number, yStart: number): void {
      const children = collapsedNodes.value?.has(nodeId) ? [] : nodeStore.childrenOf(nodeId)
      const { width, height } = getNodeSize(nodeId)
      const slot = subtreeWidth(nodeId)

      newAbsPositions.set(nodeId, { x: xStart + (slot - width) / 2, y: yStart })

      if (children.length === 0) return

      const childY = yStart + height + LAYOUT_GAP_Y
      const childrenSpan =
        children.reduce((sum, c) => sum + subtreeWidth(c.id), 0) +
        LAYOUT_GAP_X * (children.length - 1)

      let childX = xStart + (slot - childrenSpan) / 2
      for (const child of children) {
        const childSlot = subtreeWidth(child.id)
        placeSubtree(child.id, childX, childY)
        childX += childSlot + LAYOUT_GAP_X
      }
    }

    const rootNodes = Object.values(nodes).filter((n) => n.parentId === null)
    let xStart = 0
    for (const root of rootNodes) {
      const slot = subtreeWidth(root.id)
      placeSubtree(root.id, xStart, 0)
      xStart += slot + LAYOUT_GAP_X * 2
    }

    nodeAbsPositions.value = newAbsPositions
  }

  return {
    nodeSizes,
    nodeAbsPositions,
    showResetConfirm,
    getNodeSize,
    getNodeX,
    getNodeY,
    saveLayout,
    loadLayout,
    resetLayout,
    relayoutNodes,
    LAYOUT_STORAGE_KEY,
  }
}

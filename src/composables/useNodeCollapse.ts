/**
 * useNodeCollapse — manages tree-node collapse/expand state, goal-panel
 * collapse state, the visible-node computed, and goal-panel resize-to-content.
 *
 * Extracted from OrgChartContainer.
 */

import { ref, computed, watch, nextTick } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import { useUiStore } from '@/stores/uiStore'
import { MIN_NODE_HEIGHT } from './useNodeLayout'
import type { Ref } from 'vue'

const LAZY_THRESHOLD = 51

interface LayoutAccessors {
  nodeSizes: Ref<Map<string, { width: number; height: number }>>
  nodeAbsPositions: Ref<Map<string, { x: number; y: number }>>
  getNodeSize: (id: string) => { width: number; height: number }
}

export function useNodeCollapse(
  layout: LayoutAccessors,
  saveLayoutDebounced: () => void,
  relayoutNodes: () => void,
) {
  const nodeStore = useNodeStore()
  const goalStore = useGoalStore()
  const uiStore = useUiStore()
  const { nodeSizes, nodeAbsPositions, getNodeSize } = layout

  // ── Tree collapse ──────────────────────────────────────────────────────
  const collapsedNodes = ref<Set<string>>(new Set())

  const hiddenNodeIds = computed<Set<string>>(() => {
    const hidden = new Set<string>()
    for (const collapsedId of collapsedNodes.value) {
      const subtree = nodeStore.subtreeOf(collapsedId).slice(1)
      for (const node of subtree) {
        hidden.add(node.id)
      }
    }
    return hidden
  })

  const allNodeIds = computed<string[]>(() => Object.keys(nodeStore.nodes))

  const visibleNodes = computed<string[]>(() => {
    const notHidden = allNodeIds.value.filter((id) => !hiddenNodeIds.value.has(id))
    if (notHidden.length < LAZY_THRESHOLD) return notHidden
    return notHidden.filter((id) => {
      const pos = nodeAbsPositions.value.get(id)
      if (!pos) return true
      return intersectsViewport(pos, id)
    })
  })

  function intersectsViewport(pos: { x: number; y: number }, nodeId: string): boolean {
    const vp = uiStore.viewport
    const { width, height } = getNodeSize(nodeId)
    const nodeRight = pos.x + width
    const nodeBottom = pos.y + height
    const vpRight = vp.x + vp.width
    const vpBottom = vp.y + vp.height
    return pos.x < vpRight && nodeRight > vp.x && pos.y < vpBottom && nodeBottom > vp.y
  }

  function toggleCollapse(nodeId: string) {
    const newSet = new Set(collapsedNodes.value)
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId)
      collapsedNodes.value = newSet
      nextTick(() => relayoutNodes())
    } else {
      newSet.add(nodeId)
      collapsedNodes.value = newSet
    }
  }

  function expandAll() {
    collapsedNodes.value = new Set()
    nextTick(() => relayoutNodes())
  }

  function collapseAll() {
    const allParentIds = Object.keys(nodeStore.nodes).filter(
      (id) => nodeStore.childrenOf(id).length > 0
    )
    collapsedNodes.value = new Set(allParentIds)
  }

  // ── Goal-panel collapse ────────────────────────────────────────────────
  const collapsedGoalNodes = ref<Set<string>>(new Set())

  watch(collapsedGoalNodes, saveLayoutDebounced, { deep: true })

  // ── Node wrapper refs for resize-to-content ────────────────────────────
  const nodeWrapperEls = new Map<string, HTMLElement>()

  function setWrapperRef(nodeId: string, el: HTMLElement | null) {
    if (el) nodeWrapperEls.set(nodeId, el)
    else nodeWrapperEls.delete(nodeId)
  }

  function resizeNodeToContent(nodeId: string) {
    nextTick(() => {
      const el = nodeWrapperEls.get(nodeId)
      if (!el) return
      
      // Measure the .node-component inside the wrapper (which has height: auto)
      const nodeComponent = el.querySelector('.node-component') as HTMLElement
      if (!nodeComponent) return
      
      const newH = Math.max(MIN_NODE_HEIGHT, nodeComponent.scrollHeight + 16) // +16 for wrapper padding
      const oldH = getNodeSize(nodeId).height
      const deltaH = newH - oldH
      if (deltaH === 0) return

      const newSizeMap = new Map(nodeSizes.value)
      const current = getNodeSize(nodeId)
      newSizeMap.set(nodeId, { width: current.width, height: newH })
      nodeSizes.value = newSizeMap

      const descendants = nodeStore.subtreeOf(nodeId).slice(1)
      if (descendants.length === 0) return
      const newPositions = new Map(nodeAbsPositions.value)
      for (const desc of descendants) {
        const existing = newPositions.get(desc.id) ?? { x: 0, y: 0 }
        newPositions.set(desc.id, { x: existing.x, y: existing.y + deltaH })
      }
      nodeAbsPositions.value = newPositions
    })
  }

  function onGoalsToggled(nodeId: string) {
    const newSet = new Set(collapsedGoalNodes.value)
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId)
    } else {
      newSet.add(nodeId)
    }
    collapsedGoalNodes.value = newSet
    resizeNodeToContent(nodeId)
  }

  // ── Toolbar helpers ────────────────────────────────────────────────────
  function hasGoals(): boolean {
    return Object.keys(nodeStore.nodes).some(
      (id) => goalStore.goalsForNode(id).length > 0,
    )
  }

  function collapseAllGoals() {
    const nodesWithGoals = Object.keys(nodeStore.nodes).filter(
      (id) => goalStore.goalsForNode(id).length > 0,
    )
    collapsedGoalNodes.value = new Set(nodesWithGoals)
    
    // Clear sizes for nodes with goals so they'll be remeasured from DOM
    nextTick(() => {
      const newSizeMap = new Map(nodeSizes.value)
      for (const id of nodesWithGoals) {
        newSizeMap.delete(id)
      }
      nodeSizes.value = newSizeMap
      
      // Trigger relayout to recalculate positions with new (default) sizes
      // Nodes will render at default height, then we measure and update
      nextTick(() => {
        for (const id of nodesWithGoals) {
          resizeNodeToContent(id)
        }
        nextTick(() => relayoutNodes())
      })
    })
  }

  function expandAllGoals() {
    const was = [...collapsedGoalNodes.value]
    collapsedGoalNodes.value = new Set()
    
    // Clear sizes for nodes that were collapsed so they'll be remeasured
    nextTick(() => {
      const newSizeMap = new Map(nodeSizes.value)
      for (const id of was) {
        newSizeMap.delete(id)
      }
      nodeSizes.value = newSizeMap
      
      // Trigger remeasure after nodes render with goals visible
      nextTick(() => {
        for (const id of was) {
          resizeNodeToContent(id)
        }
        nextTick(() => relayoutNodes())
      })
    })
  }

  return {
    collapsedNodes,
    collapsedGoalNodes,
    hiddenNodeIds,
    visibleNodes,
    toggleCollapse,
    expandAll,
    collapseAll,
    setWrapperRef,
    resizeNodeToContent,
    onGoalsToggled,
    hasGoals,
    collapseAllGoals,
    expandAllGoals,
  }
}

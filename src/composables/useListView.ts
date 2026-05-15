/**
 * useListView - Manages tree view state for the List View
 * Handles expand/collapse, hierarchy display, and tree operations
 */

import { ref, computed } from 'vue'
import type { OrgNode } from '@/models/OrgNode'

export interface TreeNode {
  node: OrgNode
  level: number
  isExpanded: boolean
  hasChildren: boolean
  children: TreeNode[]
}

export function useListView() {
  const expandedNodeIds = ref<Set<string>>(new Set())
  const editingNodeId = ref<string | null>(null)

  /**
   * Build a tree structure from flat nodes, respecting expand/collapse state
   */
  function buildTree(
    nodes: Record<string, OrgNode>,
    parentId: string | null = null,
    level: number = 0
  ): TreeNode[] {
    const children = Object.values(nodes)
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.ownerName.localeCompare(b.ownerName))

    return children.map((node) => {
      const nodeChildren = Object.values(nodes).filter((n) => n.parentId === node.id)
      const hasChildren = nodeChildren.length > 0
      const isExpanded = expandedNodeIds.value.has(node.id)

      return {
        node,
        level,
        isExpanded,
        hasChildren,
        children: isExpanded ? buildTree(nodes, node.id, level + 1) : [],
      }
    })
  }

  /**
   * Flatten tree structure into a linear list for rendering
   */
  function flattenTree(tree: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = []
    for (const treeNode of tree) {
      result.push(treeNode)
      if (treeNode.isExpanded && treeNode.children.length > 0) {
        result.push(...flattenTree(treeNode.children))
      }
    }
    return result
  }

  /**
   * Get visible nodes for rendering
   */
  function getVisibleNodes(nodes: Record<string, OrgNode>): TreeNode[] {
    const tree = buildTree(nodes)
    return flattenTree(tree)
  }

  function toggleExpand(nodeId: string) {
    if (expandedNodeIds.value.has(nodeId)) {
      expandedNodeIds.value.delete(nodeId)
    } else {
      expandedNodeIds.value.add(nodeId)
    }
  }

  function expandAll(nodes: Record<string, OrgNode>) {
    expandedNodeIds.value = new Set(Object.keys(nodes))
  }

  function collapseAll() {
    expandedNodeIds.value.clear()
  }

  function startEditing(nodeId: string) {
    editingNodeId.value = nodeId
  }

  function stopEditing() {
    editingNodeId.value = null
  }

  const isEditing = computed(() => (nodeId: string) => editingNodeId.value === nodeId)

  return {
    expandedNodeIds,
    editingNodeId,
    getVisibleNodes,
    toggleExpand,
    expandAll,
    collapseAll,
    startEditing,
    stopEditing,
    isEditing,
  }
}

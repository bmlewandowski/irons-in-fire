/**
 * Tests for useListView composable
 */

import { describe, it, expect } from 'vitest'
import { useListView } from './useListView'
import type { OrgNode } from '@/models/OrgNode'

describe('useListView', () => {
  const createNode = (
    id: string,
    ownerName: string,
    parentId: string | null = null
  ): OrgNode => ({
    id,
    ownerName,
    title: `${ownerName} Title`,
    roleLevel: 'Employee',
    parentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  describe('buildTree and flattenTree', () => {
    it('builds tree from flat nodes', () => {
      const { getVisibleNodes } = useListView()

      const nodes = {
        root: createNode('root', 'CEO'),
        child1: createNode('child1', 'Manager 1', 'root'),
        child2: createNode('child2', 'Manager 2', 'root'),
      }

      const visible = getVisibleNodes(nodes)

      expect(visible).toHaveLength(1) // Only root visible (not expanded)
      expect(visible[0].node.id).toBe('root')
      expect(visible[0].level).toBe(0)
      expect(visible[0].hasChildren).toBe(true)
      expect(visible[0].isExpanded).toBe(false)
    })

    it('expands nodes when toggled', () => {
      const { getVisibleNodes, toggleExpand } = useListView()

      const nodes = {
        root: createNode('root', 'CEO'),
        child1: createNode('child1', 'Manager 1', 'root'),
        child2: createNode('child2', 'Manager 2', 'root'),
      }

      toggleExpand('root')
      const visible = getVisibleNodes(nodes)

      expect(visible).toHaveLength(3) // Root + 2 children
      expect(visible[0].node.id).toBe('root')
      expect(visible[0].isExpanded).toBe(true)
      expect(visible[1].node.id).toBe('child1')
      expect(visible[1].level).toBe(1)
      expect(visible[2].node.id).toBe('child2')
      expect(visible[2].level).toBe(1)
    })

    it('sorts children alphabetically', () => {
      const { getVisibleNodes, toggleExpand } = useListView()

      const nodes = {
        root: createNode('root', 'CEO'),
        charlie: createNode('charlie', 'Charlie', 'root'),
        alice: createNode('alice', 'Alice', 'root'),
        bob: createNode('bob', 'Bob', 'root'),
      }

      toggleExpand('root')
      const visible = getVisibleNodes(nodes)

      expect(visible[1].node.ownerName).toBe('Alice')
      expect(visible[2].node.ownerName).toBe('Bob')
      expect(visible[3].node.ownerName).toBe('Charlie')
    })

    it('handles deeply nested hierarchies', () => {
      const { getVisibleNodes, toggleExpand } = useListView()

      const nodes = {
        root: createNode('root', 'CEO'),
        l1: createNode('l1', 'Level 1', 'root'),
        l2: createNode('l2', 'Level 2', 'l1'),
        l3: createNode('l3', 'Level 3', 'l2'),
      }

      toggleExpand('root')
      toggleExpand('l1')
      toggleExpand('l2')
      const visible = getVisibleNodes(nodes)

      expect(visible).toHaveLength(4)
      expect(visible[0].level).toBe(0) // root
      expect(visible[1].level).toBe(1) // l1
      expect(visible[2].level).toBe(2) // l2
      expect(visible[3].level).toBe(3) // l3
    })

    it('collapses expanded node', () => {
      const { getVisibleNodes, toggleExpand } = useListView()

      const nodes = {
        root: createNode('root', 'CEO'),
        child: createNode('child', 'Manager', 'root'),
      }

      toggleExpand('root')
      expect(getVisibleNodes(nodes)).toHaveLength(2)

      toggleExpand('root')
      expect(getVisibleNodes(nodes)).toHaveLength(1)
    })

    it('handles multiple root nodes', () => {
      const { getVisibleNodes } = useListView()

      const nodes = {
        root1: createNode('root1', 'CEO 1'),
        root2: createNode('root2', 'CEO 2'),
        child1: createNode('child1', 'Manager 1', 'root1'),
      }

      const visible = getVisibleNodes(nodes)

      expect(visible).toHaveLength(2) // Both roots visible
      expect(visible[0].node.ownerName).toBe('CEO 1')
      expect(visible[1].node.ownerName).toBe('CEO 2')
    })
  })

  describe('expandAll and collapseAll', () => {
    it('expands all nodes', () => {
      const { getVisibleNodes, expandAll } = useListView()

      const nodes = {
        root: createNode('root', 'CEO'),
        child1: createNode('child1', 'Manager 1', 'root'),
        child2: createNode('child2', 'Manager 2', 'root'),
        grandchild: createNode('grandchild', 'Employee', 'child1'),
      }

      expandAll(nodes)
      const visible = getVisibleNodes(nodes)

      expect(visible).toHaveLength(4)
      expect(visible[0].isExpanded).toBe(true)
      expect(visible[1].isExpanded).toBe(true)
    })

    it('collapses all nodes', () => {
      const { getVisibleNodes, expandAll, collapseAll } = useListView()

      const nodes = {
        root: createNode('root', 'CEO'),
        child: createNode('child', 'Manager', 'root'),
      }

      expandAll(nodes)
      expect(getVisibleNodes(nodes)).toHaveLength(2)

      collapseAll()
      expect(getVisibleNodes(nodes)).toHaveLength(1)
    })
  })

  describe('editing state', () => {
    it('tracks editing state', () => {
      const { startEditing, stopEditing, isEditing } = useListView()

      expect(isEditing.value('node1')).toBe(false)

      startEditing('node1')
      expect(isEditing.value('node1')).toBe(true)
      expect(isEditing.value('node2')).toBe(false)

      stopEditing()
      expect(isEditing.value('node1')).toBe(false)
    })

    it('only allows one node to be edited at a time', () => {
      const { startEditing, isEditing } = useListView()

      startEditing('node1')
      expect(isEditing.value('node1')).toBe(true)

      startEditing('node2')
      expect(isEditing.value('node1')).toBe(false)
      expect(isEditing.value('node2')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles empty nodes', () => {
      const { getVisibleNodes } = useListView()

      const visible = getVisibleNodes({})

      expect(visible).toHaveLength(0)
    })

    it('handles nodes with no children correctly', () => {
      const { getVisibleNodes } = useListView()

      const nodes = {
        root: createNode('root', 'CEO'),
      }

      const visible = getVisibleNodes(nodes)

      expect(visible[0].hasChildren).toBe(false)
      expect(visible[0].children).toHaveLength(0)
    })

    it('maintains correct level when nodes are reparented', () => {
      const { getVisibleNodes, toggleExpand } = useListView()

      // Start with tree: root -> child1 -> grandchild
      let nodes = {
        root: createNode('root', 'CEO'),
        child1: createNode('child1', 'Manager', 'root'),
        grandchild: createNode('grandchild', 'Employee', 'child1'),
      }

      toggleExpand('root')
      toggleExpand('child1')

      let visible = getVisibleNodes(nodes)
      expect(visible[2].level).toBe(2) // grandchild at level 2

      // Reparent grandchild to root
      nodes = {
        ...nodes,
        grandchild: { ...nodes.grandchild, parentId: 'root' },
      }

      visible = getVisibleNodes(nodes)
      const grandchildNode = visible.find((n) => n.node.id === 'grandchild')
      expect(grandchildNode?.level).toBe(1) // Now at level 1
    })
  })
})

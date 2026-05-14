import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OrgNode } from '@/models'
import type { NodeService } from '@/services/NodeService'
export type { OrgNode }

/**
 * Module-level reference to the NodeService instance.
 * Set via setNodeService() from main.ts after the service is constructed.
 */
let _nodeService: NodeService | null = null

/**
 * Injects the NodeService instance so store actions can delegate to it.
 * Must be called before any store action is invoked.
 */
export function setNodeService(service: NodeService): void {
  _nodeService = service
}

/**
 * Pinia store for organizational node hierarchy.
 * Actions delegate to NodeService once wired via setNodeService().
 * Requirements: 1.1–1.8, 3.1–3.7
 */
export const useNodeStore = defineStore('node', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const nodes = ref<Record<string, OrgNode>>({})
  const selectedNodeId = ref<string | null>(null)

  // ── Getters ────────────────────────────────────────────────────────────────

  /** All nodes at the top of the hierarchy (no parent). */
  const rootNodes = computed<OrgNode[]>(() =>
    Object.values(nodes.value).filter((n) => n.parentId === null)
  )

  /**
   * O(1) index: parentId → direct children list.
   * Recomputed only when the nodes map reference changes.
   */
  const childrenByParentId = computed<Map<string, OrgNode[]>>(() => {
    const map = new Map<string, OrgNode[]>()
    for (const node of Object.values(nodes.value)) {
      if (node.parentId !== null) {
        let bucket = map.get(node.parentId)
        if (!bucket) { bucket = []; map.set(node.parentId, bucket) }
        bucket.push(node)
      }
    }
    return map
  })

  /** Direct children of the given parent node — O(1) via index. */
  function childrenOf(parentId: string): OrgNode[] {
    return childrenByParentId.value.get(parentId) ?? []
  }

  /** The node itself plus all of its descendants (recursive). */
  function subtreeOf(nodeId: string): OrgNode[] {
    const result: OrgNode[] = []
    const queue: string[] = [nodeId]
    while (queue.length > 0) {
      const id = queue.shift()!
      const node = nodes.value[id]
      if (node) {
        result.push(node)
        const children = childrenOf(id)
        for (const child of children) {
          queue.push(child.id)
        }
      }
    }
    return result
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function createNode(
    _input: Omit<OrgNode, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<OrgNode> {
    if (!_nodeService) throw new Error('NodeService not wired')
    const result = await _nodeService.createNode({
      title: _input.title,
      ownerName: _input.ownerName,
      roleLevel: _input.roleLevel,
      customRoleLabel: _input.customRoleLabel,
      parentId: _input.parentId,
    })
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  async function updateNode(
    _id: string,
    _input: Partial<Pick<OrgNode, 'title' | 'ownerName' | 'roleLevel' | 'customRoleLabel'>>
  ): Promise<OrgNode> {
    if (!_nodeService) throw new Error('NodeService not wired')
    const result = await _nodeService.updateNode(_id, _input)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  async function deleteNode(_id: string): Promise<void> {
    if (!_nodeService) throw new Error('NodeService not wired')
    const result = await _nodeService.deleteNode(_id)
    if (!result.ok) throw new Error(result.error.message)
  }

  async function reparentNode(_nodeId: string, _newParentId: string): Promise<void> {
    if (!_nodeService) throw new Error('NodeService not wired')
    const result = await _nodeService.reparentNode(_nodeId, _newParentId)
    if (!result.ok) throw new Error(result.error.message)
  }

  async function promoteToRoot(_nodeId: string): Promise<void> {
    if (!_nodeService) throw new Error('NodeService not wired')
    const result = await _nodeService.promoteToRoot(_nodeId)
    if (!result.ok) throw new Error(result.error.message)
  }

  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
  }

  return {
    // state
    nodes,
    selectedNodeId,
    // getters
    rootNodes,
    childrenOf,
    subtreeOf,
    // actions
    createNode,
    updateNode,
    deleteNode,
    reparentNode,
    promoteToRoot,
    selectNode,
  }
})

import { ref, watch, nextTick } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import type { RoleLevel } from '@/models'

type NodeModalMode = 'create-root' | 'create-child' | 'edit'

interface NodeModalState {
  mode: NodeModalMode
  parentId: string | null
  editId: string | null
  title: string
  ownerName: string
  roleLevel: string
  customRoleLabel: string
  error: string
}

export const ROLE_LEVELS = [
  'CEO/President', 'Vice President', 'Executive', 'Director', 'Manager',
  'Supervisor', 'Lead', 'Employee', 'Contractor', 'Custom',
]

/**
 * Manages the node create/edit modal.
 * @param onNewChild - callback invoked after a new child node is created so
 *   the layout composable can position it correctly.
 */
export function useNodeModal(
  onNewChild: (childId: string, parentId: string | null, siblingsBefore: number) => void,
) {
  const nodeStore = useNodeStore()

  const nodeModal = ref<NodeModalState | null>(null)
  const nodeModalRef = ref<HTMLElement | null>(null)

  function openCreateRoot() {
    nodeModal.value = {
      mode: 'create-root',
      parentId: null,
      editId: null,
      title: '',
      ownerName: '',
      roleLevel: 'Manager',
      customRoleLabel: '',
      error: '',
    }
  }

  function openAddChild(parentId: string) {
    nodeModal.value = {
      mode: 'create-child',
      parentId,
      editId: null,
      title: '',
      ownerName: '',
      roleLevel: 'Manager',
      customRoleLabel: '',
      error: '',
    }
  }

  function openEditNode(nodeId: string) {
    const node = nodeStore.nodes[nodeId]
    if (!node) return
    nodeModal.value = {
      mode: 'edit',
      parentId: node.parentId,
      editId: nodeId,
      title: node.title,
      ownerName: node.ownerName,
      roleLevel: node.roleLevel,
      customRoleLabel: node.customRoleLabel ?? '',
      error: '',
    }
  }

  async function saveNode() {
    if (!nodeModal.value) return
    const { mode, parentId, editId, title, ownerName, roleLevel, customRoleLabel } = nodeModal.value

    try {
      if (mode === 'edit' && editId) {
        await nodeStore.updateNode(editId, {
          title,
          ownerName,
          roleLevel: roleLevel as RoleLevel,
          customRoleLabel: roleLevel === 'Custom' ? customRoleLabel : undefined,
        })
      } else {
        const siblingsBefore = parentId ? nodeStore.childrenOf(parentId).length : 0
        const newNode = await nodeStore.createNode({
          title,
          ownerName,
          roleLevel: roleLevel as RoleLevel,
          customRoleLabel: roleLevel === 'Custom' ? customRoleLabel : undefined,
          parentId: parentId ?? null,
        })
        if (mode === 'create-child' && parentId) {
          onNewChild(newNode.id, parentId, siblingsBefore)
        } else if (mode === 'create-root') {
          onNewChild(newNode.id, null, siblingsBefore)
        }
      }
      nodeModal.value = null
    } catch (err) {
      if (nodeModal.value) {
        nodeModal.value.error = err instanceof Error ? err.message : 'An error occurred.'
      }
    }
  }

  function cancelNodeModal() {
    nodeModal.value = null
  }

  // Auto-focus first interactive element when modal opens
  watch(
    () => nodeModal.value,
    async (val) => {
      if (val) {
        await nextTick()
        const first = nodeModalRef.value?.querySelector<HTMLElement>('input, select, button')
        first?.focus()
      }
    },
  )

  return {
    nodeModal,
    nodeModalRef,
    openCreateRoot,
    openAddChild,
    openEditNode,
    saveNode,
    cancelNodeModal,
  }
}

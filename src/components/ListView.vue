<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useUiStore } from '@/stores/uiStore'
import { useListView } from '@/composables/useListView'
import { useUndoRedo } from '@/composables/useUndoRedo'
import type { OrgNode, RoleLevel } from '@/models/OrgNode'

const nodeStore = useNodeStore()
const uiStore = useUiStore()

const {
  getVisibleNodes,
  toggleExpand,
  expandAll,
  collapseAll,
  startEditing,
  stopEditing,
  isEditing,
} = useListView()

// Undo/Redo with minimal layout accessors (not used in list view)
const layoutAccessors = {
  getLayout: () => ({ sizes: [], positions: [], collapsed: [], collapsedGoals: [] }),
  setLayout: () => {},
  saveLayout: () => {},
}
const { snapshot, undo, canUndo } = useUndoRedo(layoutAccessors)

// Role level options
const roleLevels: RoleLevel[] = [
  'CEO/President',
  'Vice President',
  'Executive',
  'Director',
  'Manager',
  'Supervisor',
  'Lead',
  'Employee',
  'Contractor',
  'Custom',
]

// Drag and drop state
const dragState = ref<{
  draggingNodeId: string | null
  originalParentId: string | null
  dragOverNodeId: string | null
}>({
  draggingNodeId: null,
  originalParentId: null,
  dragOverNodeId: null,
})

const visibleNodes = computed(() => getVisibleNodes(nodeStore.nodes))
const hasNodes = computed(() => Object.keys(nodeStore.nodes).length > 0)

// Expand all nodes by default when component mounts
onMounted(() => {
  if (hasNodes.value) {
    expandAll(nodeStore.nodes)
  }
})

// Node creation
const showCreateRoot = ref(false)
const newNodeForm = ref({
  ownerName: '',
  title: '',
  roleLevel: 'Employee' as RoleLevel,
  customRoleLabel: '',
  parentId: null as string | null,
})

// Import/Export
const fileInputRef = ref<HTMLInputElement | null>(null)

function openCreateRoot() {
  newNodeForm.value = {
    ownerName: '',
    title: '',
    roleLevel: 'Employee',
    customRoleLabel: '',
    parentId: null,
  }
  showCreateRoot.value = true
}

function openCreateChild(parentId: string) {
  newNodeForm.value = {
    ownerName: '',
    title: '',
    roleLevel: 'Employee',
    customRoleLabel: '',
    parentId,
  }
}

async function createNode() {
  if (!newNodeForm.value.ownerName.trim() || !newNodeForm.value.title.trim()) {
    return
  }

  const newNode: Omit<OrgNode, 'id' | 'createdAt' | 'updatedAt'> = {
    ownerName: newNodeForm.value.ownerName.trim(),
    title: newNodeForm.value.title.trim(),
    roleLevel: newNodeForm.value.roleLevel,
    customRoleLabel:
      newNodeForm.value.roleLevel === 'Custom'
        ? newNodeForm.value.customRoleLabel.trim()
        : undefined,
    parentId: newNodeForm.value.parentId,
  }

  try {
    await nodeStore.createNode(newNode)
    
    // Reset form
    newNodeForm.value = {
      ownerName: '',
      title: '',
      roleLevel: 'Employee',
      customRoleLabel: '',
      parentId: null,
    }
    showCreateRoot.value = false
  } catch (err) {
    uiStore.addNotification({
      id: crypto.randomUUID(),
      nodeId: '',
      message: err instanceof Error ? err.message : 'Failed to create node',
      sourceGoalId: '',
      read: false,
      createdAt: new Date().toISOString(),
    })
  }
}

function cancelCreate() {
  showCreateRoot.value = false
  newNodeForm.value.parentId = null
}

// Inline editing
const editForm = ref<{
  ownerName: string
  title: string
  roleLevel: RoleLevel
  customRoleLabel: string
}>({
  ownerName: '',
  title: '',
  roleLevel: 'Employee',
  customRoleLabel: '',
})

function startEdit(node: OrgNode) {
  editForm.value = {
    ownerName: node.ownerName,
    title: node.title,
    roleLevel: node.roleLevel,
    customRoleLabel: node.customRoleLabel || '',
  }
  startEditing(node.id)
}

async function saveEdit(nodeId: string) {
  const node = nodeStore.nodes[nodeId]
  if (!node) return

  if (!editForm.value.ownerName.trim() || !editForm.value.title.trim()) {
    stopEditing()
    return
  }

  try {
    await nodeStore.updateNode(nodeId, {
      ownerName: editForm.value.ownerName.trim(),
      title: editForm.value.title.trim(),
      roleLevel: editForm.value.roleLevel,
      customRoleLabel:
        editForm.value.roleLevel === 'Custom' ? editForm.value.customRoleLabel.trim() : undefined,
    })
    stopEditing()
  } catch (err) {
    uiStore.addNotification({
      id: crypto.randomUUID(),
      nodeId,
      message: err instanceof Error ? err.message : 'Failed to update node',
      sourceGoalId: '',
      read: false,
      createdAt: new Date().toISOString(),
    })
  }
}

function cancelEdit() {
  stopEditing()
}

// Delete node
const showDeleteConfirm = ref(false)
const nodeToDelete = ref<string | null>(null)

function confirmDelete(nodeId: string) {
  nodeToDelete.value = nodeId
  showDeleteConfirm.value = true
}

async function deleteNode() {
  if (!nodeToDelete.value) return

  snapshot()
  
  try {
    await nodeStore.deleteNode(nodeToDelete.value)
  } catch (err) {
    uiStore.addNotification({
      id: crypto.randomUUID(),
      nodeId: nodeToDelete.value,
      message: err instanceof Error ? err.message : 'Failed to delete node',
      sourceGoalId: '',
      read: false,
      createdAt: new Date().toISOString(),
    })
  }

  showDeleteConfirm.value = false
  nodeToDelete.value = null
}

function cancelDelete() {
  showDeleteConfirm.value = false
  nodeToDelete.value = null
}

// Drag and drop
function onDragStart(nodeId: string, event: DragEvent) {
  const node = nodeStore.nodes[nodeId]
  if (!node || !event.dataTransfer) return

  dragState.value = {
    draggingNodeId: nodeId,
    originalParentId: node.parentId,
    dragOverNodeId: null,
  }

  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', nodeId)
}

function onDragOver(targetNodeId: string, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  
  // Only set drag over if it's a valid target
  if (isValidDropTarget(targetNodeId)) {
    dragState.value.dragOverNodeId = targetNodeId
  }
}

function onDragLeave(targetNodeId: string) {
  // Clear drag over if leaving this specific node
  if (dragState.value.dragOverNodeId === targetNodeId) {
    dragState.value.dragOverNodeId = null
  }
}

function isValidDropTarget(targetNodeId: string): boolean {
  const draggingId = dragState.value.draggingNodeId
  if (!draggingId) return false
  if (draggingId === targetNodeId) return false

  // Check if target is a descendant of dragging node (would create cycle)
  const subtree = nodeStore.subtreeOf(draggingId)
  if (subtree.some((n) => n.id === targetNodeId)) return false

  // Can't drop on current parent
  const draggingNode = nodeStore.nodes[draggingId]
  if (draggingNode?.parentId === targetNodeId) return false

  return true
}

async function onDrop(targetNodeId: string, event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()

  const draggingId = dragState.value.draggingNodeId
  if (!draggingId || !isValidDropTarget(targetNodeId)) {
    dragState.value = { draggingNodeId: null, originalParentId: null, dragOverNodeId: null }
    return
  }

  snapshot()
  
  try {
    await nodeStore.reparentNode(draggingId, targetNodeId)
  } catch (err) {
    uiStore.addNotification({
      id: crypto.randomUUID(),
      nodeId: draggingId,
      message: err instanceof Error ? err.message : 'Failed to reparent node',
      sourceGoalId: '',
      read: false,
      createdAt: new Date().toISOString(),
    })
  }

  dragState.value = { draggingNodeId: null, originalParentId: null, dragOverNodeId: null }
}

function onDragEnd() {
  dragState.value = { draggingNodeId: null, originalParentId: null, dragOverNodeId: null }
}

// Import/Export
function triggerImport() {
  fileInputRef.value?.click()
}

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    const content = e.target?.result as string
    if (!content) return

    try {
      const data = JSON.parse(content)
      
      // Simple validation
      if (!data.nodes || !Array.isArray(data.nodes)) {
        throw new Error('Invalid import format: missing nodes array')
      }

      snapshot()

      // Import nodes
      for (const nodeData of data.nodes) {
        try {
          await nodeStore.createNode({
            ownerName: nodeData.ownerName,
            title: nodeData.title,
            roleLevel: nodeData.roleLevel,
            customRoleLabel: nodeData.customRoleLabel,
            parentId: nodeData.parentId,
          })
        } catch (err) {
          console.error('Failed to import node:', err)
        }
      }
    } catch (err) {
      uiStore.addNotification({
        id: crypto.randomUUID(),
        nodeId: '',
        message: err instanceof Error ? err.message : 'Import failed',
        sourceGoalId: '',
        read: false,
        createdAt: new Date().toISOString(),
      })
    }
  }
  reader.readAsText(file)

  // Reset file input
  target.value = ''
}

function exportData() {
  const data = {
    nodes: Object.values(nodeStore.nodes),
    exportedAt: new Date().toISOString(),
  }
  
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `irons-in-fire-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Expose methods for App.vue toolbar
defineExpose({
  undo,
  canUndo,
  expandAll: () => expandAll(nodeStore.nodes),
  collapseAll,
  openCreateRoot,
  exportData,
  triggerImport,
})
</script>

<template>
  <div class="list-view">
    <!-- Hidden file input for import -->
    <input
      ref="fileInputRef"
      type="file"
      accept="application/json"
      style="display: none"
      @change="handleImport"
    />

    <!-- Empty state -->
    <div v-if="!hasNodes" class="empty-state">
      <h2>No Nodes Yet</h2>
      <p>Create your first organizational node to get started.</p>
      <button class="btn-primary" @click="openCreateRoot">+ Add Root Node</button>
    </div>

    <!-- Tree view -->
    <div v-else class="tree-container">
      <div class="tree-body">
        <template v-for="treeNode in visibleNodes" :key="treeNode.node.id">
          <div
            class="tree-row"
            :class="{
              'is-dragging': dragState.draggingNodeId === treeNode.node.id,
              'is-drag-over': dragState.dragOverNodeId === treeNode.node.id && isValidDropTarget(treeNode.node.id),
            }"
            :style="{ marginLeft: `${treeNode.level * 32}px` }"
            :draggable="!isEditing(treeNode.node.id)"
            @dragstart="onDragStart(treeNode.node.id, $event)"
            @dragover="onDragOver(treeNode.node.id, $event)"
            @dragleave="onDragLeave(treeNode.node.id)"
            @drop="onDrop(treeNode.node.id, $event)"
            @dragend="onDragEnd"
          >
            <!-- Expand/Collapse Button -->
            <button
              v-if="treeNode.hasChildren"
              class="expand-btn"
              :aria-label="treeNode.isExpanded ? 'Collapse' : 'Expand'"
              @click="toggleExpand(treeNode.node.id)"
            >
              {{ treeNode.isExpanded ? '▼' : '▶' }}
            </button>
            <span v-else class="expand-spacer"></span>

            <!-- View Mode -->
            <template v-if="!isEditing(treeNode.node.id)">
              <div class="tree-cell col-name">
                {{ treeNode.node.ownerName }}
              </div>
              <div class="tree-cell col-title">
                {{ treeNode.node.title }}
              </div>
              <div class="tree-cell col-role">
                {{ treeNode.node.roleLevel === 'Custom' && treeNode.node.customRoleLabel
                  ? treeNode.node.customRoleLabel
                  : treeNode.node.roleLevel
                }}
              </div>
              <div class="tree-cell col-actions">
                <button class="btn-small" @click="startEdit(treeNode.node)">Edit</button>
                <button class="btn-small" @click="openCreateChild(treeNode.node.id)">+ Child</button>
                <button class="btn-small btn-danger" @click="confirmDelete(treeNode.node.id)">Delete</button>
              </div>
            </template>

            <!-- Edit Mode -->
            <template v-else>
              <div class="tree-cell col-name">
                <input
                  v-model="editForm.ownerName"
                  type="text"
                  class="tree-input"
                  placeholder="Name"
                  @keyup.enter="saveEdit(treeNode.node.id)"
                  @keyup.escape="cancelEdit"
                />
              </div>
              <div class="tree-cell col-title">
                <input
                  v-model="editForm.title"
                  type="text"
                  class="tree-input"
                  placeholder="Title"
                  @keyup.enter="saveEdit(treeNode.node.id)"
                  @keyup.escape="cancelEdit"
                />
              </div>
              <div class="tree-cell col-role">
                <select v-model="editForm.roleLevel" class="tree-select">
                  <option v-for="role in roleLevels" :key="role" :value="role">
                    {{ role }}
                  </option>
                </select>
                <input
                  v-if="editForm.roleLevel === 'Custom'"
                  v-model="editForm.customRoleLabel"
                  type="text"
                  class="tree-input tree-input--small"
                  placeholder="Custom role"
                  @keyup.enter="saveEdit(treeNode.node.id)"
                  @keyup.escape="cancelEdit"
                />
              </div>
              <div class="tree-cell col-actions">
                <button class="btn-small btn-primary" @click="saveEdit(treeNode.node.id)">Save</button>
                <button class="btn-small" @click="cancelEdit">Cancel</button>
              </div>
            </template>
          </div>

          <!-- Create child form (inline) - appears immediately after parent -->
          <div
            v-if="newNodeForm.parentId === treeNode.node.id"
            class="tree-row tree-row--create"
            :style="{
              marginLeft: `${(treeNode.level + 1) * 32}px`,
            }"
          >
            <span class="expand-spacer"></span>
            <div class="tree-cell col-name">
              <input
                v-model="newNodeForm.ownerName"
                type="text"
                class="tree-input"
                placeholder="Name"
                @keyup.enter="createNode"
                @keyup.escape="cancelCreate"
              />
            </div>
            <div class="tree-cell col-title">
              <input
                v-model="newNodeForm.title"
                type="text"
                class="tree-input"
                placeholder="Title"
                @keyup.enter="createNode"
                @keyup.escape="cancelCreate"
              />
            </div>
            <div class="tree-cell col-role">
              <select v-model="newNodeForm.roleLevel" class="tree-select">
                <option v-for="role in roleLevels" :key="role" :value="role">
                  {{ role }}
                </option>
              </select>
              <input
                v-if="newNodeForm.roleLevel === 'Custom'"
                v-model="newNodeForm.customRoleLabel"
                type="text"
                class="tree-input tree-input--small"
                placeholder="Custom role"
                @keyup.enter="createNode"
                @keyup.escape="cancelCreate"
              />
            </div>
            <div class="tree-cell col-actions">
              <button class="btn-small btn-primary" @click="createNode">Add</button>
              <button class="btn-small" @click="cancelCreate">Cancel</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Create Root Modal -->
    <div v-if="showCreateRoot" class="modal-overlay" @click.self="cancelCreate">
      <div class="modal-content">
        <h2>Create Root Node</h2>
        <div class="form-group">
          <label>Name</label>
          <input
            v-model="newNodeForm.ownerName"
            type="text"
            class="form-input"
            placeholder="Enter name"
            @keyup.enter="createNode"
          />
        </div>
        <div class="form-group">
          <label>Title</label>
          <input
            v-model="newNodeForm.title"
            type="text"
            class="form-input"
            placeholder="Enter title"
            @keyup.enter="createNode"
          />
        </div>
        <div class="form-group">
          <label>Role Level</label>
          <select v-model="newNodeForm.roleLevel" class="form-input">
            <option v-for="role in roleLevels" :key="role" :value="role">
              {{ role }}
            </option>
          </select>
        </div>
        <div v-if="newNodeForm.roleLevel === 'Custom'" class="form-group">
          <label>Custom Role</label>
          <input
            v-model="newNodeForm.customRoleLabel"
            type="text"
            class="form-input"
            placeholder="Enter custom role"
            @keyup.enter="createNode"
          />
        </div>
        <div class="modal-actions">
          <button class="btn-primary" @click="createNode">Create</button>
          <button class="btn-secondary" @click="cancelCreate">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="cancelDelete">
      <div class="modal-content">
        <h2>Delete Node</h2>
        <p>Are you sure you want to delete this node and all its descendants?</p>
        <div class="modal-actions">
          <button class="btn-danger" @click="deleteNode">Delete</button>
          <button class="btn-secondary" @click="cancelDelete">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 2rem;
  color: #666;
}

.empty-state h2 {
  margin: 0 0 0.5rem;
  color: #333;
}

.empty-state p {
  margin: 0 0 1.5rem;
}

.tree-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.tree-header {
  display: none;
}

.tree-header-col {
  display: none;
}

.col-name {
  flex: 2;
  min-width: 200px;
}

.col-title {
  flex: 2;
  min-width: 200px;
}

.col-role {
  flex: 1.5;
  min-width: 180px;
}

.col-actions {
  flex: 1.5;
  min-width: 220px;
}

.tree-body {
  flex: 1;
  overflow-y: auto;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  color: #333;
  border: 2px solid #333;
  border-radius: 6px;
  transition: all 0.15s;
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tree-row:hover {
  background: #f9f9f9;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  border-color: #555;
}

.tree-row.is-dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.tree-row.is-drag-over {
  background: #e8f5e9;
  border-color: #4caf50;
  border-width: 3px;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.tree-row--create {
  background: #fffbf0;
  cursor: default;
  border-color: #ffa726;
  border-style: dashed;
}

.expand-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  margin-right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}

.expand-btn:hover {
  color: #333;
}

.expand-spacer {
  width: 32px;
  flex-shrink: 0;
}

.tree-cell {
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tree-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.tree-input:focus {
  outline: none;
  border-color: #2196f3;
}

.tree-input--small {
  max-width: 150px;
}

.tree-select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.tree-select:focus {
  outline: none;
  border-color: #2196f3;
}

.btn-small {
  padding: 4px 10px;
  font-size: 13px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #333;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-small:hover {
  background: #f5f5f5;
  border-color: #999;
}

.btn-small.btn-primary {
  background: #2196f3;
  color: white;
  border-color: #2196f3;
}

.btn-small.btn-primary:hover {
  background: #1976d2;
  border-color: #1976d2;
}

.btn-small.btn-danger {
  background: #d32f2f;
  color: white;
  border: none;
}

.btn-small.btn-danger:hover {
  background: #b71c1c;
}

.btn-primary {
  padding: 10px 20px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #1976d2;
}

.btn-secondary {
  padding: 10px 20px;
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background: #e0e0e0;
  border-color: #999;
}

.btn-danger {
  padding: 10px 20px;
  background: #d32f2f;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-danger:hover {
  background: #b71c1c;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-content h2 {
  margin: 0 0 16px;
  font-size: 20px;
  color: #333;
}

.modal-content p {
  margin: 0 0 16px;
  color: #666;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: #2196f3;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>

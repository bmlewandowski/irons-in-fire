<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import { useUiStore } from '@/stores/uiStore'
import { useListView } from '@/composables/useListView'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { progressColor } from '@/composables/useProgressColor'
import type { OrgNode, RoleLevel } from '@/models/OrgNode'

const nodeStore = useNodeStore()
const goalStore = useGoalStore()
const uiStore = useUiStore()

const emit = defineEmits<{
  'node-reparented': []
}>()

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
const confirmDelete = ref<{
  nodeId: string
  descendantCount: number
  goalCount: number
  directChildCount: number
  grandparentId: string | null
} | null>(null)

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
      grandparentId: node?.parentId ?? null,
    }
  }
  showDeleteConfirm.value = true
}

async function deleteNode() {
  if (!confirmDelete.value) return
  const { nodeId } = confirmDelete.value
  confirmDelete.value = null
  showDeleteConfirm.value = false

  snapshot()
  
  try {
    await nodeStore.deleteNode(nodeId)
  } catch (err) {
    uiStore.addNotification({
      id: crypto.randomUUID(),
      nodeId,
      message: err instanceof Error ? err.message : 'Failed to delete node',
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
  showDeleteConfirm.value = false

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
  showDeleteConfirm.value = false
  confirmDelete.value = null
}

// Goal tooltip
const showGoalTooltip = ref(false)
const tooltipNodeId = ref<string | null>(null)
const tooltipStyle = ref({ top: '0px', left: '0px' })

function onGoalIconEnter(nodeId: string, event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tooltipStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
  }
  tooltipNodeId.value = nodeId
  showGoalTooltip.value = true
}

function onGoalIconLeave() {
  showGoalTooltip.value = false
  tooltipNodeId.value = null
}

const tooltipGoals = computed(() => {
  if (!tooltipNodeId.value) return []
  return goalStore.goalsForNode(tooltipNodeId.value)
})

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
    emit('node-reparented')
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
              'is-editing': isEditing(treeNode.node.id),
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
                <!-- Goal icon with badge -->
                <button
                  v-if="goalStore.goalsForNode(treeNode.node.id).length > 0"
                  class="goal-icon-btn"
                  :aria-label="`${goalStore.goalsForNode(treeNode.node.id).length} goal${goalStore.goalsForNode(treeNode.node.id).length !== 1 ? 's' : ''}`"
                  @mouseenter="onGoalIconEnter(treeNode.node.id, $event)"
                  @mouseleave="onGoalIconLeave"
                >
                  🎯
                  <span class="goal-badge">{{ goalStore.goalsForNode(treeNode.node.id).length }}</span>
                </button>
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
                <button class="btn-small btn-danger" @click="onDeleteNode(treeNode.node.id)">Delete</button>
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
        <p v-if="confirmDelete">
          This will also delete {{ confirmDelete.descendantCount }} descendant
          node(s) and {{ confirmDelete.goalCount }} goal(s).
        </p>
        <p v-if="confirmDelete && confirmDelete.directChildCount > 0" class="promote-hint">
          Or promote {{ confirmDelete.directChildCount }} direct child(ren) up one level and remove only this node.
        </p>
        <div class="modal-actions">
          <button
            v-if="confirmDelete && confirmDelete.directChildCount > 0"
            class="btn-promote"
            @click="promoteAndDeleteNode"
          >Promote Children &amp; Delete</button>
          <button class="btn-danger" @click="deleteNode">Delete All</button>
          <button class="btn-secondary" @click="cancelDelete">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Goal tooltip -->
    <Teleport to="body">
      <div
        v-if="showGoalTooltip"
        class="goal-tooltip"
        :style="tooltipStyle"
        role="tooltip"
      >
        <div class="goal-tooltip-header">
          <span class="goal-tooltip-title">Goals</span>
          <span class="goal-tooltip-count">{{ tooltipGoals.length }}</span>
        </div>
        <div v-if="tooltipGoals.length === 0" class="goal-tooltip-empty">No goals yet</div>
        <ul v-else class="goal-tooltip-list">
          <li v-for="goal in tooltipGoals" :key="goal.id" class="goal-tooltip-item">
            <div class="goal-tooltip-row">
              <span class="goal-tooltip-desc">{{ goal.description }}</span>
              <span class="goal-tooltip-status" :class="`status-${goal.status.toLowerCase()}`">{{ goal.status }}</span>
            </div>
            <div class="goal-tooltip-progress-row">
              <div class="goal-tooltip-bar-track">
                <div
                  class="goal-tooltip-bar-fill"
                  :style="{ width: goal.progress + '%', background: progressColor(goal.progress) }"
                />
              </div>
              <span class="goal-tooltip-pct" :style="{ color: progressColor(goal.progress) }">
                {{ Math.round(goal.progress) }}%
              </span>
            </div>
          </li>
        </ul>
      </div>
    </Teleport>
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

.tree-row.is-editing {
  background: #fffde7;
  border-color: #f9a825;
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
  background: #fff;
  color: #333;
  color-scheme: light;
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
  background: #fff;
  color: #333;
  color-scheme: light;
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
  background: #fff;
  color: #333;
  color-scheme: light;
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

/* ── Goal icon and tooltip ──────────────────────────────────────────────── */

.goal-icon-btn {
  position: relative;
  background: none;
  border: none;
  padding: 2px 4px;
  margin-left: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: inherit;
  border-radius: 3px;
  transition: background 0.15s;
}

.goal-icon-btn:hover {
  background: rgba(0, 0, 0, 0.07);
}

.goal-badge {
  font-size: 0.65rem;
  font-weight: 700;
  background: #1a1a2e;
  color: #fff;
  border-radius: 8px;
  padding: 0 4px;
  line-height: 1.4;
  min-width: 14px;
  text-align: center;
}

.goal-tooltip {
  position: fixed;
  z-index: 2000;
  background: #fff;
  color: #213547;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  padding: 10px 12px;
  min-width: 220px;
  max-width: 300px;
  font-size: 0.78rem;
  pointer-events: none;
}

.goal-tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  border-bottom: 1px solid #eee;
  padding-bottom: 6px;
}

.goal-tooltip-title {
  font-weight: 700;
  font-size: 0.8rem;
}

.goal-tooltip-count {
  font-size: 0.72rem;
  background: #1a1a2e;
  color: #fff;
  border-radius: 10px;
  padding: 1px 7px;
  font-weight: 600;
}

.goal-tooltip-empty {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 4px 0;
}

.goal-tooltip-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-tooltip-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.goal-tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
}

.goal-tooltip-desc {
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.35;
}

.goal-tooltip-status {
  font-size: 0.68rem;
  font-weight: 600;
  border-radius: 3px;
  padding: 1px 5px;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-active  { background: #e3f2fd; color: #1565c0; }
.status-complete { background: #e8f5e9; color: #2e7d32; }
.status-refined { background: #fff8e1; color: #e65100; }

.goal-tooltip-progress-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.goal-tooltip-bar-track {
  flex: 1;
  height: 5px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.goal-tooltip-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.2s;
}

.goal-tooltip-pct {
  font-size: 0.68rem;
  font-weight: 700;
  min-width: 28px;
  text-align: right;
}

/* ── Modals ─────────────────────────────────────────────────────────────── */

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

.promote-hint {
  font-size: 0.85rem;
  color: #555;
  margin: 8px 0 4px;
}

.btn-promote {
  padding: 10px 20px;
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #2e7d32;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-promote:hover {
  background: #c8e6c9;
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

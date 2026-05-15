<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import NodeComponent from './NodeComponent.vue'
import { useCanvasTransform } from '@/composables/useCanvasTransform'
import { useNodeModal, ROLE_LEVELS } from '@/composables/useNodeModal'
import { useGoalModal } from '@/composables/useGoalModal'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { useNodeLayout, LAYOUT_GAP_Y } from '@/composables/useNodeLayout'
import { useNodeInteraction } from '@/composables/useNodeInteraction'
import { useNodeDragDrop } from '@/composables/useNodeDragDrop'
import { useImportExport } from '@/composables/useImportExport'
import { useNodeCollapse } from '@/composables/useNodeCollapse'
import { useDeleteDialog } from '@/composables/useDeleteDialog'

// ── Stores ─────────────────────────────────────────────────────────────────
const nodeStore = useNodeStore()

// ── Pan/Zoom Transform ──────────────────────────────────────────────────────
const svgRef = ref<SVGSVGElement | null>(null)
const {
  transform,
  transformString,
  onWheel,
  onMouseDown,
  applyPanMove,
  stopPan,
  updateViewport,
  zoomBy,
} = useCanvasTransform(svgRef)

// ── Collapse state (must be created before useNodeLayout so it can be threaded in) ──
// Collapse refs are created here so useNodeLayout can persist/restore them,
// and useNodeCollapse can own the behaviour logic.
const _collapsedNodes = ref<Set<string>>(new Set())
const _collapsedGoalNodes = ref<Set<string>>(new Set())

// ── Layout ─────────────────────────────────────────────────────────────────
const {
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
} = useNodeLayout(_collapsedNodes, _collapsedGoalNodes)

// ── Undo / Redo ─────────────────────────────────────────────────────────────
const { canUndo, snapshot, undo, clearHistory } = useUndoRedo({
  getLayout: () => ({
    sizes: [...nodeSizes.value.entries()],
    positions: [...nodeAbsPositions.value.entries()],
    collapsed: [..._collapsedNodes.value],
    collapsedGoals: [..._collapsedGoalNodes.value],
  }),
  setLayout: (layout) => {
    nodeSizes.value = new Map(layout.sizes)
    nodeAbsPositions.value = new Map(layout.positions)
    _collapsedNodes.value = new Set(layout.collapsed)
    _collapsedGoalNodes.value = new Set(layout.collapsedGoals)
  },
  saveLayout,
})

// ── Collapse / Expand ───────────────────────────────────────────────────────
// Debounced save helper for useNodeCollapse's goal-panel watch
let _layoutSaveTimer: ReturnType<typeof setTimeout> | null = null
function saveLayoutDebounced() {
  if (_layoutSaveTimer !== null) clearTimeout(_layoutSaveTimer)
  _layoutSaveTimer = setTimeout(saveLayout, 300)
}

const {
  collapsedNodes,
  collapsedGoalNodes,
  hiddenNodeIds,
  visibleNodes,
  toggleCollapse,
  setWrapperRef,
  onGoalsToggled,
  hasGoals,
  collapseAllGoals,
  expandAllGoals,
} = useNodeCollapse(
  { nodeSizes, nodeAbsPositions, getNodeSize },
  saveLayoutDebounced,
  relayoutNodes,
)

// Keep the private refs and the collapse composable's refs in sync.
// The collapse composable owns the reactive sets; we wire them through here
// so useNodeLayout can persist/restore them via the refs threaded in at init.
// Since _collapsedNodes / _collapsedGoalNodes were passed by reference into
// useNodeLayout, and useNodeCollapse initialises its own identically-named
// internal refs, we need to alias them for the template.
// Simplest: we re-export the composable's refs as the canonical source.

// ── Node Interaction (resize + free-move) ───────────────────────────────────
const {
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
} = useNodeInteraction(transform, { getNodeSize, getNodeX, getNodeY, nodeSizes, nodeAbsPositions })

// ── Drag-and-Drop ───────────────────────────────────────────────────────────
const {
  dragState,
  validDropTargetIds,
  onDragStart,
  onDragEnd,
  onDrop,
} = useNodeDragDrop(nodeAbsPositions, snapshot)

// ── Delete Dialog ───────────────────────────────────────────────────────────
const {
  confirmDelete,
  dialogPanelRef,
  onDeleteNode,
  confirmDeleteNode,
  promoteAndDeleteNode,
  cancelDelete,
  onDialogKeydown,
} = useDeleteDialog(snapshot)

// ── Import / Export ─────────────────────────────────────────────────────────
const {
  importFileInput,
  importPayload,
  importError,
  exportData,
  onImportFileChange,
  confirmImport,
  cancelImport,
} = useImportExport(
  {
    nodeSizes,
    nodeAbsPositions,
    collapsedNodes,
    collapsedGoalNodes,
  },
  saveLayout,
  resetLayout,
  snapshot,
  clearHistory,
)

// ── Canvas mouse event routing ──────────────────────────────────────────────
function onMouseMove(event: MouseEvent) {
  if (!handleMouseMove(event)) {
    applyPanMove(event)
  }
}

function onMouseUp() {
  handleMouseUp()
  stopPan()
}

function onNodeWrapperClick(nodeId: string) {
  if (suppressNextClick.value) {
    suppressNextClick.value = false
    return
  }
  nodeStore.selectNode(nodeId)
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────────
function onKeyDown(event: KeyboardEvent) {
  const ctrl = event.ctrlKey || event.metaKey
  if (!ctrl) return
  if (event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    undo()
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  loadLayout()
  if (nodeAbsPositions.value.size === 0 && Object.keys(nodeStore.nodes).length > 0) {
    nextTick(() => relayoutNodes())
  }
  updateViewport()
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('keydown', onKeyDown)
})

// ── Node Form Modal ──────────────────────────────────────────────────────────
async function positionNewChild(childId: string, parentId: string | null, siblingCountBefore: number): Promise<void> {
  if (parentId === null) {
    await nextTick()
    relayoutNodes()
    return
  }

  if (collapsedNodes.value.has(parentId)) {
    const newSet = new Set(collapsedNodes.value)
    newSet.delete(parentId)
    collapsedNodes.value = newSet
  }

  await nextTick()

  if (siblingCountBefore >= 1) {
    relayoutNodes()
    return
  }

  const parentX = getNodeX(parentId)
  const parentY = getNodeY(parentId)
  const { width: parentW, height: parentH } = getNodeSize(parentId)
  const { width: childW } = getNodeSize(childId)

  const targetX = parentX + (parentW - childW) / 2
  const targetY = parentY + parentH + LAYOUT_GAP_Y

  const newPositions = new Map(nodeAbsPositions.value)
  newPositions.set(childId, { x: targetX, y: targetY })
  nodeAbsPositions.value = newPositions
}

const {
  nodeModal,
  nodeModalRef,
  openCreateRoot,
  openAddChild,
  openEditNode,
  saveNode,
  cancelNodeModal,
} = useNodeModal(positionNewChild)

// ── Goal Form Modal ──────────────────────────────────────────────────────────
const {
  goalModal,
  goalModalRef,
  goalModalAncestorGoals,
  openAddGoal,
  saveGoal,
  cancelGoalModal,
} = useGoalModal()

// ── Computed helpers ─────────────────────────────────────────────────────────
const isEmpty = computed(() => Object.keys(nodeStore.nodes).length === 0)

const edges = computed<Array<{ x1: number; y1: number; x2: number; y2: number; key: string }>>(() => {
  void nodeAbsPositions.value
  void nodeSizes.value
  const result = []
  for (const id of Object.keys(nodeStore.nodes)) {
    const node = nodeStore.nodes[id]
    if (!node?.parentId) continue
    if (hiddenNodeIds.value.has(id)) continue
    if (!nodeAbsPositions.value.has(id) || !nodeAbsPositions.value.has(node.parentId)) continue
    const { width: pw, height: ph } = getNodeSize(node.parentId)
    const { width: cw, height: ch } = getNodeSize(id)
    result.push({
      key: `${node.parentId}-${id}`,
      x1: getNodeX(node.parentId) + pw / 2,
      y1: getNodeY(node.parentId) + ph / 2,
      x2: getNodeX(id) + cw / 2,
      y2: getNodeY(id) + ch / 2,
    })
  }
  return result
})

// ── goHome ──────────────────────────────────────────────────────────────────
function goHome() {
  const positions = nodeAbsPositions.value
  if (positions.size === 0) return

  const rootIds = Object.values(nodeStore.nodes)
    .filter((n) => n.parentId === null)
    .map((n) => n.id)

  if (rootIds.length === 0) return

  let targetId = rootIds[0]
  for (const id of rootIds) {
    const pos = positions.get(id)
    const best = positions.get(targetId)
    if (pos && best && pos.x < best.x) targetId = id
  }

  const nodeX = getNodeX(targetId)
  const nodeY = getNodeY(targetId)
  const MARGIN = 40

  transform.value = {
    ...transform.value,
    x: -nodeX * transform.value.scale + MARGIN,
    y: -nodeY * transform.value.scale + MARGIN,
  }
  updateViewport()
}

defineExpose({
  exportData,
  triggerImport: () => importFileInput.value?.click(),
  openCreateRoot,
  relayoutNodes,
  showResetConfirm,
  resetLayout,
  isEmpty,
  goHome,
  collapseAllGoals,
  expandAllGoals,
  hasGoals,
  zoomIn: () => zoomBy(1.2),
  zoomOut: () => zoomBy(1 / 1.2),
  canUndo,
  undo,
})
</script>

<template>
  <!-- Empty state -->
  <div v-if="isEmpty" class="empty-state" data-testid="empty-state">
    <p>No nodes yet. Create your first node to get started.</p>
    <button class="btn-primary" @click="openCreateRoot">Create First Node</button>
  </div>

  <!-- SVG canvas -->
  <svg
    v-else
    ref="svgRef"
    class="org-chart-canvas"
    :style="{ width: '100%', height: '100%', overflow: 'hidden', cursor: resizeState ? 'nwse-resize' : moveState?.active ? 'grabbing' : 'grab' }"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
  >
    <g :transform="transformString">
      <!-- Edges -->
      <line
        v-for="edge in edges"
        :key="edge.key"
        :x1="edge.x1"
        :y1="edge.y1"
        :x2="edge.x2"
        :y2="edge.y2"
        stroke="#888"
        stroke-width="1.5"
        marker-end="url(#arrowhead)"
      />

      <!-- Arrowhead marker definition -->
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
        </marker>
      </defs>

      <!-- Node slots as foreignObject + resize handles -->
      <g v-for="nodeId in visibleNodes" :key="nodeId">
        <foreignObject
          class="node-foreign-object"
          :x="getNodeX(nodeId)"
          :y="getNodeY(nodeId)"
          :width="getNodeSize(nodeId).width"
          :height="getNodeSize(nodeId).height"
        >
          <!-- NodeComponent renders the node content -->
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            class="node-wrapper"
            :ref="(el) => setWrapperRef(nodeId, el as HTMLElement | null)"
            :class="{
              dragging: dragState.draggingNodeId === nodeId,
              'drop-target-valid':
                dragState.draggingNodeId !== null &&
                validDropTargetIds.has(nodeId),
              moving: moveState?.nodeId === nodeId && moveState?.active,
            }"
            @mousedown="onNodeWrapperMouseDown($event, nodeId)"
            @click="onNodeWrapperClick(nodeId)"
          >
            <NodeComponent
              :node-id="nodeId"
              :is-collapsed="collapsedNodes.has(nodeId)"
              :goals-visible="!collapsedGoalNodes.has(nodeId)"
              @drag-start="onDragStart"
              @drag-end="onDragEnd"
              @drop="onDrop"
              @add-child="openAddChild"
              @add-goal="openAddGoal"
              @edit="openEditNode"
              @delete="onDeleteNode"
              @toggle-collapse="toggleCollapse"
              @goals-toggled="onGoalsToggled"
            />
          </div>
        </foreignObject>
        <!-- Bottom-right resize handle -->
        <rect
          class="resize-handle"
          :x="getNodeX(nodeId) + getNodeSize(nodeId).width - 7"
          :y="getNodeY(nodeId) + getNodeSize(nodeId).height - 7"
          width="14"
          height="14"
          rx="3"
          @mousedown.stop.prevent="onResizeHandleMouseDown($event, nodeId)"
        />
        <!-- Bottom-left resize handle -->
        <rect
          class="resize-handle resize-handle-sw"
          :x="getNodeX(nodeId) - 7"
          :y="getNodeY(nodeId) + getNodeSize(nodeId).height - 7"
          width="14"
          height="14"
          rx="3"
          @mousedown.stop.prevent="onResizeHandleSwMouseDown($event, nodeId)"
        />
        <!-- Top-right resize handle -->
        <rect
          class="resize-handle resize-handle-ne"
          :x="getNodeX(nodeId) + getNodeSize(nodeId).width - 7"
          :y="getNodeY(nodeId) - 7"
          width="14"
          height="14"
          rx="3"
          @mousedown.stop.prevent="onResizeHandleNeMouseDown($event, nodeId)"
        />
        <!-- Top-left resize handle -->
        <rect
          class="resize-handle resize-handle-nw"
          :x="getNodeX(nodeId) - 7"
          :y="getNodeY(nodeId) - 7"
          width="14"
          height="14"
          rx="3"
          @mousedown.stop.prevent="onResizeHandleNwMouseDown($event, nodeId)"
        />
      </g>
    </g>
  </svg>

  <!-- Delete confirmation dialog -->
  <div
    v-if="confirmDelete"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-delete-title"
    data-testid="confirm-delete-dialog"
    class="confirm-delete-overlay"
    @keydown="onDialogKeydown"
  >
    <div ref="dialogPanelRef" class="confirm-delete-panel">
      <h2 id="confirm-delete-title">Delete Node</h2>
      <p>
        This will also delete {{ confirmDelete.descendantCount }} descendant
        node(s) and {{ confirmDelete.goalCount }} goal(s).
      </p>
      <p v-if="confirmDelete.directChildCount > 0" class="promote-hint">
        Or promote {{ confirmDelete.directChildCount }} direct child(ren) up one level and remove only this node.
      </p>
      <button
        v-if="confirmDelete.directChildCount > 0"
        aria-label="Promote children and delete this node"
        class="btn-promote"
        @click="promoteAndDeleteNode"
      >Promote Children &amp; Delete</button>
      <button aria-label="Confirm delete" class="btn-danger" @click="confirmDeleteNode">Delete All</button>
      <button aria-label="Cancel delete" @click="cancelDelete">Cancel</button>
    </div>
  </div>

  <!-- Hidden file input for import -->
  <input
    ref="importFileInput"
    type="file"
    accept="application/json,.json"
    style="display:none"
    @change="onImportFileChange"
  />

  <!-- Import error toast -->
  <div v-if="importError" class="import-error" role="alert">
    {{ importError }}
    <button aria-label="Dismiss error" @click="importError = null">✕</button>
  </div>

  <!-- Import confirmation dialog -->
  <div
    v-if="importPayload"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-import-title"
    class="confirm-delete-overlay"
    @click.self="cancelImport"
  >
    <div class="confirm-delete-panel">
      <h2 id="confirm-import-title">Import Data</h2>
      <p>This will <strong>replace all current nodes and goals</strong> with the imported data. This cannot be undone.</p>
      <p class="import-summary">{{ importPayload.nodes.length }} node(s) and {{ importPayload.goals.length }} goal(s) will be imported.</p>
      <button class="btn-danger" aria-label="Confirm import" @click="confirmImport">Import</button>
      <button aria-label="Cancel import" @click="cancelImport">Cancel</button>
    </div>
  </div>

  <!-- Reset layout confirmation dialog -->
  <div
    v-if="showResetConfirm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-reset-title"
    class="confirm-delete-overlay"
    @click.self="showResetConfirm = false"
  >
    <div class="confirm-delete-panel">
      <h2 id="confirm-reset-title">Reset Layout</h2>
      <p>This will collapse all nodes to their default sizes and positions, and any custom resizing or repositioning will be lost.</p>
      <button class="btn-danger" aria-label="Confirm reset layout" @click="() => { showResetConfirm = false; resetLayout() }">Reset Layout</button>
      <button aria-label="Cancel reset" @click="showResetConfirm = false">Cancel</button>
    </div>
  </div>

  <!-- Goal create modal -->
  <div
    v-if="goalModal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="goal-modal-title"
    class="confirm-delete-overlay"
    @click.self="cancelGoalModal"
    @keydown.escape="cancelGoalModal"
  >
    <div ref="goalModalRef" class="node-modal-panel">
      <h2 id="goal-modal-title">Add Goal</h2>
      <form @submit.prevent="saveGoal">
        <!-- Refine a parent goal (only shown when ancestor goals exist) -->
        <label v-if="goalModalAncestorGoals.length > 0" class="form-label">
          Refine a parent goal (optional)
          <select v-model="goalModal.sourceGoalId" class="form-input">
            <option value="">— New independent goal —</option>
            <option
              v-for="ag in goalModalAncestorGoals"
              :key="ag.id"
              :value="ag.id"
            >{{ ag.label }}</option>
          </select>
        </label>
        <label class="form-label">
          Description
          <textarea v-model="goalModal.description" required maxlength="500" class="form-input" rows="3" placeholder="Describe this goal…" />
        </label>
        <label class="form-label">
          Weight
          <input v-model="goalModal.weight" type="number" required min="0.01" max="1000" step="0.01" class="form-input" />
        </label>
        <p v-if="goalModal.error" class="form-error">{{ goalModal.error }}</p>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Create</button>
          <button type="button" @click="cancelGoalModal">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Node create/edit modal -->
  <div
    v-if="nodeModal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="node-modal-title"
    class="confirm-delete-overlay"
    @click.self="cancelNodeModal"
    @keydown.escape="cancelNodeModal"
  >
    <div ref="nodeModalRef" class="node-modal-panel">
      <h2 id="node-modal-title">
        {{ nodeModal.mode === 'edit' ? 'Edit Node' : 'Create Node' }}
      </h2>
      <form @submit.prevent="saveNode">
        <label class="form-label">
          Title
          <input v-model="nodeModal.title" type="text" required maxlength="200" class="form-input" placeholder="Node title" />
        </label>
        <label class="form-label">
          Owner Name
          <input v-model="nodeModal.ownerName" type="text" required maxlength="100" class="form-input" placeholder="Owner name" />
        </label>
        <label class="form-label">
          Role Level
          <select v-model="nodeModal.roleLevel" class="form-input">
            <option v-for="r in ROLE_LEVELS" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>
        <label v-if="nodeModal.roleLevel === 'Custom'" class="form-label">
          Custom Role Label
          <input v-model="nodeModal.customRoleLabel" type="text" required maxlength="50" class="form-input" placeholder="Custom role" />
        </label>
        <p v-if="nodeModal.error" class="form-error">{{ nodeModal.error }}</p>
        <div class="form-actions">
          <button type="submit" class="btn-primary">{{ nodeModal.mode === 'edit' ? 'Save' : 'Create' }}</button>
          <button type="button" @click="cancelNodeModal">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.org-chart-canvas {
  display: block;
  background: #fafafa;
  user-select: none;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 200px;
  color: #666;
  font-size: 1rem;
}

.node-wrapper {
  width: 100%;
  height: auto;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  color: #213547;
  padding: 8px;
  cursor: move;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.node-wrapper.dragging {
  opacity: 0.5;
  border-color: #999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.node-wrapper.moving {
  opacity: 0.85;
  border-color: #5577ff;
  box-shadow: 0 4px 16px rgba(85, 119, 255, 0.3);
  cursor: grabbing;
}

.node-wrapper.drop-target-valid {
  border-color: #4caf50;
  box-shadow: 0 0 0 2px #4caf5066;
}

.resize-handle {
  fill: #888;
  opacity: 0;
  cursor: se-resize;
  transition: opacity 0.15s;
}

.resize-handle.resize-handle-sw { cursor: sw-resize; }
.resize-handle.resize-handle-ne { cursor: ne-resize; }
.resize-handle.resize-handle-nw { cursor: nw-resize; }

/* Show handles when hovering the containing g element */
g:hover > .resize-handle {
  opacity: 0.65;
}
.resize-handle:hover {
  opacity: 1 !important;
  fill: #444;
}

.confirm-delete-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-delete-panel {
  background: #fff;
  color: #213547;
  border-radius: 8px;
  padding: 24px;
  min-width: 320px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.confirm-delete-panel h2 {
  margin: 0 0 12px;
}

.confirm-delete-panel button {
  margin-right: 8px;
  margin-top: 8px;
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #ccc;
  cursor: pointer;
}

.promote-hint {
  font-size: 0.85rem;
  color: #555;
  margin: 8px 0 4px;
}

.btn-promote {
  background: #e8f5e9;
  border-color: #2e7d32 !important;
  color: #2e7d32;
  font-weight: 600;
}

.btn-promote:hover {
  background: #c8e6c9;
}

.btn-danger {
  background: #fce4ec;
  border-color: #b71c1c !important;
  color: #b71c1c;
  font-weight: 600;
}

.btn-danger:hover {
  background: #ffcdd2;
}

.btn-primary {
  padding: 8px 18px;
  background: #1a1a2e;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-primary:hover {
  background: #2d2d4e;
}

.import-error {
  position: fixed;
  bottom: 5rem;
  left: 1.5rem;
  background: #fdecea;
  color: #c62828;
  border: 1px solid #f5c6c6;
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

.import-error button {
  background: none;
  border: none;
  cursor: pointer;
  color: #c62828;
  font-size: 1rem;
  padding: 0;
  line-height: 1;
}

.import-summary {
  font-size: 0.85rem;
  color: #555;
  margin: 0 0 16px;
}

.node-modal-panel {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  min-width: 340px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.node-modal-panel h2 {
  margin: 0 0 16px;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.form-input {
  padding: 7px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
}

.form-error {
  color: #c00;
  font-size: 0.85rem;
  margin: 4px 0 8px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-actions button {
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #ccc;
  cursor: pointer;
  font-size: 0.9rem;
}
</style>

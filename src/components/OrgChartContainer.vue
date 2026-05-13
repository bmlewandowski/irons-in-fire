<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import { useUiStore } from '@/stores/uiStore'
import NodeComponent from './NodeComponent.vue'

// ── Stores ─────────────────────────────────────────────────────────────────
const nodeStore = useNodeStore()
const goalStore = useGoalStore()
const uiStore = useUiStore()

// ── Pan/Zoom State ──────────────────────────────────────────────────────────
const transform = ref<{ x: number; y: number; scale: number }>({
  x: 0,
  y: 0,
  scale: 1,
})

const isPanning = ref(false)
const panStart = ref<{ x: number; y: number; tx: number; ty: number }>({
  x: 0,
  y: 0,
  tx: 0,
  ty: 0,
})

const svgRef = ref<SVGSVGElement | null>(null)

function onWheel(event: WheelEvent) {
  event.preventDefault()
  const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9
  const newScale = Math.min(Math.max(transform.value.scale * scaleFactor, 0.1), 5)

  // Zoom toward the cursor position
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const dx = mouseX - transform.value.x
  const dy = mouseY - transform.value.y

  transform.value = {
    x: transform.value.x + dx - (dx * newScale) / transform.value.scale,
    y: transform.value.y + dy - (dy * newScale) / transform.value.scale,
    scale: newScale,
  }

  updateViewport()
}

function onMouseDown(event: MouseEvent) {
  // Only pan on left-click on the SVG background (not on nodes)
  if (event.button !== 0) return
  if ((event.target as Element).closest('.node-foreign-object')) return

  isPanning.value = true
  panStart.value = {
    x: event.clientX,
    y: event.clientY,
    tx: transform.value.x,
    ty: transform.value.y,
  }
}

function onMouseMove(event: MouseEvent) {
  if (resizeState.value) {    const { nodeId, corner, startScreenX, startScreenY, startW, startH, startDx, startDy } = resizeState.value
    const dX = (event.clientX - startScreenX) / transform.value.scale
    const dY = (event.clientY - startScreenY) / transform.value.scale

    let newW = startW
    let newH = startH
    let newDx = startDx
    let newDy = startDy

    if (corner === 'se') {
      newW = Math.max(MIN_NODE_WIDTH, startW + dX)
      newH = Math.max(MIN_NODE_HEIGHT, startH + dY)
    } else if (corner === 'sw') {
      newW = Math.max(MIN_NODE_WIDTH, startW - dX)
      newH = Math.max(MIN_NODE_HEIGHT, startH + dY)
      newDx = startDx + (startW - newW)
    } else if (corner === 'ne') {
      newW = Math.max(MIN_NODE_WIDTH, startW + dX)
      newH = Math.max(MIN_NODE_HEIGHT, startH - dY)
      newDy = startDy + (startH - newH)
    } else if (corner === 'nw') {
      newW = Math.max(MIN_NODE_WIDTH, startW - dX)
      newH = Math.max(MIN_NODE_HEIGHT, startH - dY)
      newDx = startDx + (startW - newW)
      newDy = startDy + (startH - newH)
    }

    const newSizeMap = new Map(nodeSizes.value)
    newSizeMap.set(nodeId, { width: newW, height: newH })
    nodeSizes.value = newSizeMap

    const newOffsetMap = new Map(nodePositionOffsets.value)
    newOffsetMap.set(nodeId, { dx: newDx, dy: newDy })

    // Keep every descendant centred under the parent's new centre X, and
    // pushed down/up whenever the bottom edge moves (SE or SW).
    const deltaW = newW - startW
    const deltaH = newH - startH
    // SE/NE expand the right edge → centre shifts right; SW/NW expand left → shifts left.
    const deltaCenterX = (corner === 'se' || corner === 'ne') ? deltaW / 2 : -deltaW / 2
    // Bottom edge only moves for SE and SW.
    const pushDown = (corner === 'se' || corner === 'sw') ? deltaH : 0
    for (const [descId, descStart] of resizeState.value.startDescendantOffsets) {
      newOffsetMap.set(descId, {
        dx: descStart.dx + deltaCenterX,
        dy: descStart.dy + pushDown,
      })
    }

    nodePositionOffsets.value = newOffsetMap
    return
  }
  if (moveState.value) {
    const { nodeId, startScreenX, startScreenY, startDx, startDy } = moveState.value
    const dX = (event.clientX - startScreenX) / transform.value.scale
    const dY = (event.clientY - startScreenY) / transform.value.scale
    if (!moveState.value.active && Math.hypot(dX, dY) < 4) return
    moveState.value.active = true
    const newOffsetMap = new Map(nodePositionOffsets.value)
    newOffsetMap.set(nodeId, { dx: startDx + dX, dy: startDy + dY })
    for (const [descId, descStart] of moveState.value.startDescendantOffsets) {
      newOffsetMap.set(descId, { dx: descStart.dx + dX, dy: descStart.dy + dY })
    }
    nodePositionOffsets.value = newOffsetMap
    return
  }
  if (!isPanning.value) return
  transform.value = {
    ...transform.value,
    x: panStart.value.tx + (event.clientX - panStart.value.x),
    y: panStart.value.ty + (event.clientY - panStart.value.y),
  }
  updateViewport()
}

function onMouseUp() {
  resizeState.value = null
  if (moveState.value?.active) {
    suppressNextClick.value = true
  }
  moveState.value = null
  isPanning.value = false
}

function updateViewport() {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  // Convert screen viewport to canvas coordinates
  const { x, y, scale } = transform.value
  uiStore.updateViewport({
    x: -x / scale,
    y: -y / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  })
}

onMounted(() => {
  loadLayout()
  updateViewport()
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onMouseMove)
})

// ── Node Layout Algorithm ───────────────────────────────────────────────────
const NODE_WIDTH = 180
const NODE_HEIGHT = 100
const LEVEL_HEIGHT = 120
const SIBLING_SPACING = 200

/**
 * Compute positions for all nodes using a simple recursive tree layout.
 * Root nodes start at y=0; each level adds y += 120.
 * Siblings are spaced x += 200 apart.
 */
const nodePositions = computed<Map<string, { x: number; y: number }>>(() => {
  const positions = new Map<string, { x: number; y: number }>()
  const nodes = nodeStore.nodes

  if (Object.keys(nodes).length === 0) return positions

  // Find root nodes (no parent)
  const rootNodes = Object.values(nodes).filter((n) => n.parentId === null)

  let xCursor = 0

  function layoutSubtree(nodeId: string, depth: number): number {
    const children = nodeStore.childrenOf(nodeId)
    const y = depth * LEVEL_HEIGHT

    if (children.length === 0) {
      // Leaf node: place at current xCursor
      positions.set(nodeId, { x: xCursor, y })
      const nodeX = xCursor
      xCursor += SIBLING_SPACING
      return nodeX
    }

    // Layout children first, then center parent over them
    const firstChildX = xCursor
    for (const child of children) {
      layoutSubtree(child.id, depth + 1)
    }
    const lastChildX = xCursor - SIBLING_SPACING

    // Center parent over its children
    const parentX = (firstChildX + lastChildX) / 2
    positions.set(nodeId, { x: parentX, y })
    return parentX
  }

  for (const root of rootNodes) {
    layoutSubtree(root.id, 0)
    xCursor += SIBLING_SPACING // extra gap between root trees
  }

  return positions
})

// ── Lazy Viewport Rendering (Subtask 12.2) ──────────────────────────────────
const LAZY_THRESHOLD = 51

function intersectsViewport(pos: { x: number; y: number }): boolean {
  const vp = uiStore.viewport
  const nodeRight = pos.x + NODE_WIDTH
  const nodeBottom = pos.y + NODE_HEIGHT
  const vpRight = vp.x + vp.width
  const vpBottom = vp.y + vp.height

  return (
    pos.x < vpRight &&
    nodeRight > vp.x &&
    pos.y < vpBottom &&
    nodeBottom > vp.y
  )
}

const allNodeIds = computed<string[]>(() => Object.keys(nodeStore.nodes))

const visibleNodes = computed<string[]>(() => {
  const count = allNodeIds.value.length
  if (count < LAZY_THRESHOLD) {
    // Render all nodes when below threshold
    return allNodeIds.value
  }
  // Only render nodes whose bounding box intersects the viewport
  return allNodeIds.value.filter((id) => {
    const pos = nodePositions.value.get(id)
    if (!pos) return false
    return intersectsViewport(pos)
  })
})

// ── Per-node size overrides ────────────────────────────────────────────────
const MIN_NODE_WIDTH = 120
const MIN_NODE_HEIGHT = 80
const nodeSizes = ref(new Map<string, { width: number; height: number }>())
const nodePositionOffsets = ref(new Map<string, { dx: number; dy: number }>())

// ── Layout persistence ─────────────────────────────────────────────────────
const LAYOUT_STORAGE_KEY = 'irons-in-fire:layout'

function saveLayout() {
  try {
    const payload = JSON.stringify({
      sizes: [...nodeSizes.value.entries()],
      offsets: [...nodePositionOffsets.value.entries()],
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
    const { sizes, offsets } = JSON.parse(raw)
    if (Array.isArray(sizes)) nodeSizes.value = new Map(sizes)
    if (Array.isArray(offsets)) nodePositionOffsets.value = new Map(offsets)
  } catch {
    // corrupt data — ignore and start fresh
  }
}

function resetLayout() {
  nodeSizes.value = new Map()
  nodePositionOffsets.value = new Map()
  localStorage.removeItem(LAYOUT_STORAGE_KEY)
}

// Auto-save whenever sizes or offsets change (debounced to avoid thrashing).
let _layoutSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [nodeSizes, nodePositionOffsets],
  () => {
    if (_layoutSaveTimer !== null) clearTimeout(_layoutSaveTimer)
    _layoutSaveTimer = setTimeout(saveLayout, 300)
  },
  { deep: true },
)

function getNodeSize(nodeId: string): { width: number; height: number } {
  return nodeSizes.value.get(nodeId) ?? { width: NODE_WIDTH, height: NODE_HEIGHT }
}

function getNodeOffset(nodeId: string): { dx: number; dy: number } {
  return nodePositionOffsets.value.get(nodeId) ?? { dx: 0, dy: 0 }
}

function getNodeX(nodeId: string): number {
  return (nodePositions.value.get(nodeId)?.x ?? 0) + getNodeOffset(nodeId).dx
}

function getNodeY(nodeId: string): number {
  return (nodePositions.value.get(nodeId)?.y ?? 0) + getNodeOffset(nodeId).dy
}

const resizeState = ref<{
  nodeId: string
  corner: 'se' | 'sw' | 'ne' | 'nw'
  startScreenX: number
  startScreenY: number
  startW: number
  startH: number
  startDx: number
  startDy: number
  // Snapshot of every descendant's offset at the moment resize began,
  // used to push the whole family down/up as the bottom edge moves.
  startDescendantOffsets: Map<string, { dx: number; dy: number }>
} | null>(null)

function startResize(event: MouseEvent, nodeId: string, corner: 'se' | 'sw' | 'ne' | 'nw') {
  event.stopPropagation()
  event.preventDefault()
  const { width, height } = getNodeSize(nodeId)
  const { dx, dy } = getNodeOffset(nodeId)

  // Capture current offsets for all descendants (subtreeOf includes the node itself at index 0)
  const descendants = nodeStore.subtreeOf(nodeId).slice(1)
  const startDescendantOffsets = new Map<string, { dx: number; dy: number }>()
  for (const desc of descendants) {
    startDescendantOffsets.set(desc.id, { ...getNodeOffset(desc.id) })
  }

  resizeState.value = {
    nodeId, corner,
    startScreenX: event.clientX, startScreenY: event.clientY,
    startW: width, startH: height,
    startDx: dx, startDy: dy,
    startDescendantOffsets,
  }
}

function onResizeHandleMouseDown(event: MouseEvent, nodeId: string) { startResize(event, nodeId, 'se') }
function onResizeHandleSwMouseDown(event: MouseEvent, nodeId: string) { startResize(event, nodeId, 'sw') }
function onResizeHandleNeMouseDown(event: MouseEvent, nodeId: string) { startResize(event, nodeId, 'ne') }
function onResizeHandleNwMouseDown(event: MouseEvent, nodeId: string) { startResize(event, nodeId, 'nw') }

// ── Free node movement ─────────────────────────────────────────────────────
const moveState = ref<{
  nodeId: string
  startScreenX: number
  startScreenY: number
  startDx: number
  startDy: number
  active: boolean
  startDescendantOffsets: Map<string, { dx: number; dy: number }>
} | null>(null)

const suppressNextClick = ref(false)

function onNodeWrapperMouseDown(event: MouseEvent, nodeId: string) {
  // Don't intercept interactive elements or the HTML5 drag handle
  const target = event.target as Element
  if (target.closest('button, input, select, textarea, [draggable="true"]')) return
  event.stopPropagation()
  const { dx, dy } = getNodeOffset(nodeId)
  const moveDescendants = nodeStore.subtreeOf(nodeId).slice(1)
  const startDescendantOffsets = new Map<string, { dx: number; dy: number }>()
  for (const desc of moveDescendants) {
    startDescendantOffsets.set(desc.id, { ...getNodeOffset(desc.id) })
  }
  moveState.value = {
    nodeId,
    startScreenX: event.clientX,
    startScreenY: event.clientY,
    startDx: dx,
    startDy: dy,
    active: false,
    startDescendantOffsets,
  }
}

function onNodeWrapperClick(nodeId: string) {
  if (suppressNextClick.value) {
    suppressNextClick.value = false
    return
  }
  nodeStore.selectedNodeId = nodeId
}

// ── Drag-and-Drop State (Subtask 12.3) ──────────────────────────────────────
const dragState = ref<{
  draggingNodeId: string | null
  originalParentId: string | null
  originalPosition: { x: number; y: number } | null
}>({
  draggingNodeId: null,
  originalParentId: null,
  originalPosition: null,
})

/**
 * Valid drop targets: all nodes EXCEPT the dragged node, its descendants,
 * and its current parent.
 */
const validDropTargetIds = computed<Set<string>>(() => {
  const draggingId = dragState.value.draggingNodeId
  if (!draggingId) return new Set()

  const subtree = new Set(nodeStore.subtreeOf(draggingId).map((n) => n.id))
  const currentParentId = nodeStore.nodes[draggingId]?.parentId

  const valid = new Set<string>()
  for (const id of Object.keys(nodeStore.nodes)) {
    if (subtree.has(id)) continue // dragged node or its descendants
    if (id === currentParentId) continue // current parent
    valid.add(id)
  }
  return valid
})

function onDragStart(nodeId: string) {
  const node = nodeStore.nodes[nodeId]
  if (!node) return

  const pos = nodePositions.value.get(nodeId)
  dragState.value = {
    draggingNodeId: nodeId,
    originalParentId: node.parentId,
    originalPosition: pos ? { ...pos } : null,
  }
}

function onDragEnd() {
  dragState.value = {
    draggingNodeId: null,
    originalParentId: null,
    originalPosition: null,
  }
}

async function onDrop(targetNodeId: string) {
  const draggingId = dragState.value.draggingNodeId
  if (!draggingId) return

  // Ignore invalid drop targets
  if (!validDropTargetIds.value.has(targetNodeId)) {
    onDragEnd()
    return
  }

  try {
    await nodeStore.reparentNode(draggingId, targetNodeId)
    // Success: clear drag state
    onDragEnd()
  } catch (err) {
    // Failure: snap back and show error toast
    const message = err instanceof Error ? err.message : 'Failed to move node.'

    uiStore.addNotification({
      id: crypto.randomUUID(),
      nodeId: draggingId,
      message,
      sourceGoalId: '',
      read: false,
      createdAt: new Date().toISOString(),
    })

    // Revert store if needed (snap back)
    const originalParentId = dragState.value.originalParentId
    if (originalParentId !== undefined) {
      nodeStore.$patch((state) => {
        if (state.nodes[draggingId]) {
          state.nodes[draggingId] = {
            ...state.nodes[draggingId],
            parentId: originalParentId,
          }
        }
      })
    }

    onDragEnd()
  }
}

// ── Delete Confirmation Dialog (Subtask 12.3) ────────────────────────────────
const confirmDelete = ref<{
  nodeId: string
  descendantCount: number
  goalCount: number
  directChildCount: number
  grandparentId: string | null
} | null>(null)

function onDeleteNode(nodeId: string) {
  const subtree = nodeStore.subtreeOf(nodeId)
  const descendantCount = subtree.length - 1 // exclude the node itself
  const directChildren = nodeStore.childrenOf(nodeId)
  const node = nodeStore.nodes[nodeId]

  if (descendantCount > 0) {
    // Count goals across the entire subtree
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
    // No children: delete directly
    nodeStore.deleteNode(nodeId).catch((err) => {
      uiStore.addNotification({
        id: crypto.randomUUID(),
        nodeId,
        message: err instanceof Error ? err.message : 'Failed to delete node.',
        sourceGoalId: '',
        read: false,
        createdAt: new Date().toISOString(),
      })
    })
  }
}

async function confirmDeleteNode() {
  if (!confirmDelete.value) return
  const { nodeId } = confirmDelete.value
  confirmDelete.value = null
  try {
    await nodeStore.deleteNode(nodeId)
  } catch (err) {
    uiStore.addNotification({
      id: crypto.randomUUID(),
      nodeId,
      message: err instanceof Error ? err.message : 'Failed to delete node.',
      sourceGoalId: '',
      read: false,
      createdAt: new Date().toISOString(),
    })
  }
}

/**
 * Reparent every direct child of the deleted node to its grandparent
 * (or to root level when grandparentId is null), then delete the node.
 */
async function promoteAndDeleteNode() {
  if (!confirmDelete.value) return
  const { nodeId, grandparentId } = confirmDelete.value
  confirmDelete.value = null

  const directChildren = nodeStore.childrenOf(nodeId)
  try {
    // Reparent each direct child to the grandparent.
    // reparentNode accepts null to mean "make root", but the current service
    // signature takes a string targetId. We use $patch to set parentId = null
    // directly when promoting to root level.
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
  confirmDelete.value = null
}

// ── Clean-up Layout ────────────────────────────────────────────────────
const LAYOUT_GAP_X = 24  // horizontal gap between sibling subtrees
const LAYOUT_GAP_Y = 40  // vertical gap between parent bottom and children top

/**
 * Re-computes positions using each node's actual (possibly user-resized) size,
 * then writes the results into nodePositionOffsets so that getNodeX/Y use the
 * new layout while keeping the base nodePositions intact.
 * Node sizes are preserved exactly as-is.
 *
 * Two-pass algorithm:
 *   Pass 1 — subtreeWidth(): compute the minimum horizontal slot needed for
 *             each subtree, which is max(node width, sum of children slots + gaps).
 *             This guarantees a wide parent never overlaps its neighbors.
 *   Pass 2 — placeSubtree(): assign absolute (x, y) positions top-down,
 *             centering each node in its slot and centering the children block
 *             under the parent when the parent is wider.
 */
function relayoutNodes() {
  const nodes = nodeStore.nodes
  if (Object.keys(nodes).length === 0) return

  // Pass 1: compute the full horizontal slot required by each subtree.
  function subtreeWidth(nodeId: string): number {
    const children = nodeStore.childrenOf(nodeId)
    const { width } = getNodeSize(nodeId)
    if (children.length === 0) return width
    const childrenSpan =
      children.reduce((sum, c) => sum + subtreeWidth(c.id), 0) +
      LAYOUT_GAP_X * (children.length - 1)
    return Math.max(width, childrenSpan)
  }

  // Pass 2: place nodes given an allocated slot starting at xStart.
  const newAbsPositions = new Map<string, { x: number; y: number }>()

  function placeSubtree(nodeId: string, xStart: number, yStart: number): void {
    const children = nodeStore.childrenOf(nodeId)
    const { width, height } = getNodeSize(nodeId)
    const slot = subtreeWidth(nodeId)

    // Center this node within its allocated slot.
    newAbsPositions.set(nodeId, { x: xStart + (slot - width) / 2, y: yStart })

    if (children.length === 0) return

    const childY = yStart + height + LAYOUT_GAP_Y
    const childrenSpan =
      children.reduce((sum, c) => sum + subtreeWidth(c.id), 0) +
      LAYOUT_GAP_X * (children.length - 1)

    // Center the children block under the parent slot.
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
    xStart += slot + LAYOUT_GAP_X * 2 // extra gap between separate root trees
  }

  // Convert absolute positions to offsets relative to the default layout.
  const newOffsetMap = new Map<string, { dx: number; dy: number }>()
  for (const [nodeId, newPos] of newAbsPositions) {
    const defaultPos = nodePositions.value.get(nodeId) ?? { x: 0, y: 0 }
    newOffsetMap.set(nodeId, {
      dx: newPos.x - defaultPos.x,
      dy: newPos.y - defaultPos.y,
    })
  }
  nodePositionOffsets.value = newOffsetMap
}

// ── Focus Trap for Delete Dialog (Task 15.1) ────────────────────────────────
const dialogPanelRef = ref<HTMLElement | null>(null)
const focusOrigin = ref<HTMLElement | null>(null)

watch(
  () => confirmDelete.value,
  async (val) => {
    if (val) {
      focusOrigin.value = document.activeElement as HTMLElement | null
      await nextTick()
      const firstBtn = dialogPanelRef.value?.querySelector<HTMLElement>('button')
      firstBtn?.focus()
    } else {
      focusOrigin.value?.focus()
      focusOrigin.value = null
    }
  },
)

function onDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    cancelDelete()
    return
  }
  if (event.key !== 'Tab') return

  const focusable = dialogPanelRef.value?.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  if (!focusable || focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

// ── Node Form Modal ──────────────────────────────────────────────────────────
type NodeModalMode = 'create-root' | 'create-child' | 'edit'

const nodeModal = ref<{
  mode: NodeModalMode
  parentId: string | null
  editId: string | null
  title: string
  ownerName: string
  roleLevel: string
  customRoleLabel: string
  error: string
} | null>(null)

const ROLE_LEVELS = ['CEO/President', 'Vice President', 'Executive', 'Director', 'Manager', 'Supervisor', 'Lead', 'Employee', 'Contractor', 'Custom']

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
        roleLevel: roleLevel as any,
        customRoleLabel: roleLevel === 'Custom' ? customRoleLabel : undefined,
      })
    } else {
      await nodeStore.createNode({
        title,
        ownerName,
        roleLevel: roleLevel as any,
        customRoleLabel: roleLevel === 'Custom' ? customRoleLabel : undefined,
        parentId: parentId ?? null,
      })
    }
    nodeModal.value = null
  } catch (err) {
    if (nodeModal.value) nodeModal.value.error = err instanceof Error ? err.message : 'An error occurred.'
  }
}

function cancelNodeModal() {
  nodeModal.value = null
}

const nodeModalRef = ref<HTMLElement | null>(null)

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

// ── Goal Form Modal ──────────────────────────────────────────────────────────
const goalModal = ref<{
  nodeId: string
  description: string
  weight: string
  sourceGoalId: string
  error: string
} | null>(null)

const goalModalRef = ref<HTMLElement | null>(null)

/** Walk up the node ancestor chain and collect all goals from those nodes. */
function ancestorGoals(nodeId: string): Array<{ id: string; label: string }> {
  const results: Array<{ id: string; label: string }> = []
  let current = nodeStore.nodes[nodeId]
  while (current?.parentId) {
    current = nodeStore.nodes[current.parentId]
    if (!current) break
    for (const g of goalStore.goalsForNode(current.id)) {
      results.push({
        id: g.id,
        label: `[${current.title}] ${g.description.slice(0, 60)}${g.description.length > 60 ? '…' : ''}`,
      })
    }
  }
  return results
}

const goalModalAncestorGoals = computed(() =>
  goalModal.value ? ancestorGoals(goalModal.value.nodeId) : []
)

function openAddGoal(nodeId: string) {
  goalModal.value = { nodeId, description: '', weight: '1', sourceGoalId: '', error: '' }
}

async function saveGoal() {
  if (!goalModal.value) return
  const { nodeId, description, weight, sourceGoalId } = goalModal.value
  const weightNum = parseFloat(weight)
  const isRefined = sourceGoalId !== ''

  try {
    await goalStore.createGoal({
      nodeId,
      type: isRefined ? 'Refined' : 'Root',
      description,
      weight: weightNum,
      status: 'Active',
      progress: 0,
      sourceGoalId: isRefined ? sourceGoalId : undefined,
    })
    goalModal.value = null
  } catch (err) {
    if (goalModal.value) goalModal.value.error = err instanceof Error ? err.message : 'An error occurred.'
  }
}

function cancelGoalModal() {
  goalModal.value = null
}

watch(
  () => goalModal.value,
  async (val) => {
    if (val) {
      await nextTick()
      const first = goalModalRef.value?.querySelector<HTMLElement>('input, textarea, button')
      first?.focus()
    }
  },
)

// ── Computed helpers ─────────────────────────────────────────────────────────
const isEmpty = computed(() => Object.keys(nodeStore.nodes).length === 0)

const transformString = computed(
  () =>
    `translate(${transform.value.x},${transform.value.y}) scale(${transform.value.scale})`,
)

/** Edges: for each node with a parentId, draw a line from parent center to child center. */
const edges = computed<Array<{ x1: number; y1: number; x2: number; y2: number; key: string }>>(() => {
  // Access offsets so edges update when nodes are resized/moved
  void nodePositionOffsets.value
  void nodeSizes.value
  const result = []
  for (const id of Object.keys(nodeStore.nodes)) {
    const node = nodeStore.nodes[id]
    if (!node?.parentId) continue
    if (!nodePositions.value.has(id) || !nodePositions.value.has(node.parentId)) continue
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
              @drag-start="onDragStart"
              @drag-end="onDragEnd"
              @drop="onDrop"
              @add-child="openAddChild"
              @add-goal="openAddGoal"
              @edit="openEditNode"
              @delete="onDeleteNode"
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

  <!-- Floating Add Root Node button (when nodes already exist) -->
  <button
    v-if="!isEmpty"
    class="btn-add-root"
    aria-label="Add root node"
    @click="openCreateRoot"
  >
    + Add Node
  </button>

  <!-- Floating Clean Up Layout button -->
  <button
    v-if="!isEmpty"
    class="btn-relayout"
    aria-label="Clean up layout"
    @click="relayoutNodes"
  >
    ⬜ Clean Up Layout
  </button>

  <!-- Floating Reset Layout button -->
  <button
    v-if="!isEmpty"
    class="btn-reset-layout"
    aria-label="Reset layout"
    @click="resetLayout"
  >
    ↺ Reset Layout
  </button>

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
  height: 100%;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
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

.btn-add-root {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 10px 18px;
  background: #1a1a2e;
  color: #fff;
  border: none;
  border-radius: 24px;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 500;
}

.btn-add-root:hover {
  background: #2d2d4e;
}

.btn-relayout {
  position: fixed;
  bottom: 1.5rem;
  right: 10rem;
  padding: 10px 18px;
  background: #fff;
  color: #1a1a2e;
  border: 1.5px solid #1a1a2e;
  border-radius: 24px;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 500;
}

.btn-relayout:hover {
  background: #f0f0f8;
}

.btn-reset-layout {
  position: fixed;
  bottom: 1.5rem;
  right: 20.5rem;
  padding: 10px 18px;
  background: #fff;
  color: #555;
  border: 1.5px solid #aaa;
  border-radius: 24px;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 500;
}

.btn-reset-layout:hover {
  background: #fafafa;
  border-color: #888;
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

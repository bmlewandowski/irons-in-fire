<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import GoalCard from './GoalCard.vue'

// ── Props & Emits ───────────────────────────────────────────────────────────
const props = defineProps<{
  nodeId: string
  isCollapsed?: boolean
  goalsVisible?: boolean
}>()

const emit = defineEmits<{
  'drag-start': [nodeId: string]
  'drag-end': [nodeId: string]
  'drop': [targetNodeId: string]
  'add-child': [parentNodeId: string]
  'add-goal': [nodeId: string]
  'edit': [nodeId: string]
  'delete': [nodeId: string]
  'toggle-collapse': [nodeId: string]
  'goals-toggled': [nodeId: string]
}>()

// ── Stores ──────────────────────────────────────────────────────────────────
const nodeStore = useNodeStore()
const goalStore = useGoalStore()

// ── Derived state ───────────────────────────────────────────────────────────
const node = computed(() => nodeStore.nodes[props.nodeId])
const goals = computed(() => goalStore.goalsForNode(props.nodeId))
const isSelected = computed(() => nodeStore.selectedNodeId === props.nodeId)
const hasChildren = computed(() => nodeStore.childrenOf(props.nodeId).length > 0)

const roleCssClass = computed(() => {
  const role = node.value?.roleLevel ?? ''
  return 'role-' + role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
})

const showDeleteConfirm = ref(false)

function onDeleteClick() {
  showDeleteConfirm.value = true
}

function onConfirmDelete() {
  showDeleteConfirm.value = false
  emit('delete', props.nodeId)
}

function onCancelDelete() {
  showDeleteConfirm.value = false
}

// ── Goal tooltip ────────────────────────────────────────────────────────────
// ── Goal expand/collapse ────────────────────────────────────────────────────
function toggleGoals() {
  emit('goals-toggled', props.nodeId)
}

const showGoalTooltip = ref(false)
const tooltipStyle = ref({ top: '0px', left: '0px' })

function onGoalIconEnter(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  // Position below the icon, right-aligned to it
  tooltipStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.right}px`,
  }
  showGoalTooltip.value = true
}

function onGoalIconLeave() {
  showGoalTooltip.value = false
}

function progressColor(pct: number): string {
  if (pct >= 80) return '#2e7d32'
  if (pct >= 50) return '#1565c0'
  if (pct >= 25) return '#e65100'
  return '#b71c1c'
}
</script>

<template>
  <div
    class="node-component"
    data-testid="node-component"
    @drop.prevent="emit('drop', props.nodeId)"
    @dragover.prevent
  >
    <div class="node-header">
      <button
        class="drag-handle"
        aria-label="Drag node"
        draggable="true"
        @dragstart.stop="emit('drag-start', props.nodeId)"
        @dragend.stop="emit('drag-end', props.nodeId)"
      >⠿</button>
      <div class="node-info" :class="roleCssClass">
        <strong class="node-title">
          <button
            v-if="hasChildren"
            class="collapse-toggle-btn"
            :aria-label="props.isCollapsed ? 'Show child nodes' : 'Hide child nodes'"
            @click.stop="emit('toggle-collapse', props.nodeId)"
          >{{ props.isCollapsed ? '\u25b6' : '\u25bc' }}</button>{{ node?.ownerName }}</strong>
        <div class="node-owner">{{ node?.title }}</div>
      </div>
      <!-- Goal icon: top-right, opposite drag handle (only when goals exist) -->
      <button
        v-if="goals.length > 0"
        class="goal-icon-btn"
        :class="{ 'goals-expanded': props.goalsVisible !== false }"
        :aria-label="`${goals.length} goal${goals.length !== 1 ? 's' : ''}; click to ${props.goalsVisible !== false ? 'hide' : 'show'}`"
        @mouseenter="onGoalIconEnter"
        @mouseleave="onGoalIconLeave"
        @click.stop="toggleGoals"
      >
        🎯
        <span v-if="goals.length" class="goal-badge">{{ goals.length }}</span>
      </button>
    </div>

    <!-- Action menu: only visible when this node is selected -->
    <div v-if="isSelected" class="action-menu" role="menu" :aria-label="`Actions for ${node?.title}`">
      <button aria-label="Add child node" role="menuitem" @click="emit('add-child', props.nodeId)">Add Child</button>
      <button aria-label="Add goal" role="menuitem" @click="emit('add-goal', props.nodeId)">Add Goal</button>
      <button aria-label="Edit node" role="menuitem" @click="emit('edit', props.nodeId)">Edit</button>
      <button aria-label="Delete node" role="menuitem" @click="onDeleteClick">Delete</button>
    </div>

    <!-- Goal cards (toggled by clicking the 🎯 icon) -->
    <template v-if="props.goalsVisible !== false">
      <GoalCard
        v-for="goal in goals"
        :key="goal.id"
        :goal-id="goal.id"
        @update-progress="(val) => goalStore.setProgress(goal.id, val)"
        @update-status="(val) => goalStore.updateGoal(goal.id, { status: val })"
        @delete="goalStore.deleteGoal(goal.id)"
      />
    </template>

  </div>

  <!-- Delete confirmation modal -->
  <Teleport to="body">
    <div v-if="showDeleteConfirm" class="modal-backdrop" @click.self="onCancelDelete">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="node-modal-title">
        <h3 id="node-modal-title" class="modal-title">Delete Node</h3>
        <p class="modal-body">Are you sure you want to delete <strong>"{{ node?.title }}"</strong>? All associated goals will also be removed. This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="onCancelDelete">Cancel</button>
          <button class="btn-confirm-delete" @click="onConfirmDelete">Delete</button>
        </div>
      </div>
    </div>
  </Teleport>

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
        <span class="goal-tooltip-count">{{ goals.length }}</span>
      </div>
      <div v-if="goals.length === 0" class="goal-tooltip-empty">No goals yet</div>
      <ul v-else class="goal-tooltip-list">
        <li v-for="goal in goals" :key="goal.id" class="goal-tooltip-item">
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
</template>

<style scoped>
.node-component {
  width: 100%;
  height: auto;
  box-sizing: border-box;
  font-size: 0.8rem;
  overflow: visible;
}

.node-header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.drag-handle {
  cursor: grab;
  background: none;
  border: none;
  padding: 2px 4px;
  font-size: 1rem;
  color: #999;
  flex-shrink: 0;
  line-height: 1;
}

.drag-handle:hover {
  color: #555;
}

.drag-handle:active {
  cursor: grabbing;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-title {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-owner {
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-menu {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.action-menu button {
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #ccc;
  cursor: pointer;
  background: #fff;
  color: #213547;
  font-size: 0.75rem;
}

.action-menu button:hover {
  background: #f0f0f0;
}

/* ── Goal icon ──────────────────────────────────────────────────────────── */

.goal-icon-btn {
  position: relative;
  background: none;
  border: none;
  padding: 1px 3px;
  font-size: 0.95rem;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  color: inherit;
  border-radius: 3px;
  transition: background 0.15s;
}

.goal-icon-btn:hover {
  background: rgba(0, 0, 0, 0.07);
}

.goal-icon-btn.goals-expanded {
  background: rgba(21, 101, 192, 0.1);
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

/* ── Goal tooltip ───────────────────────────────────────────────────────── */

.goal-tooltip {
  position: fixed;
  transform: translateX(-100%);
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

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  color: #213547;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  padding: 24px;
  width: 340px;
  max-width: 90vw;
  font-size: 0.9rem;
}

.modal-title {
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 700;
}

.modal-body {
  margin: 0 0 20px;
  line-height: 1.5;
  color: #444;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel {
  padding: 6px 16px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background: #f5f5f5;
  color: #213547;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-cancel:hover {
  background: #e8e8e8;
}

.btn-confirm-delete {
  padding: 6px 16px;
  border-radius: 4px;
  border: 1px solid #d32f2f;
  background: #d32f2f;
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-confirm-delete:hover {
  background: #b71c1c;
  border-color: #b71c1c;
}

/* ── Collapse toggle ────────────────────────────────────────────────── */

.collapse-toggle-btn {
  flex-shrink: 0;
  padding: 0;
  font-size: 0.6rem;
  line-height: 1;
  background: none;
  border: none;
  color: #444;
  cursor: pointer;
}

.collapse-toggle-btn:hover {
  color: #000;
}
</style>

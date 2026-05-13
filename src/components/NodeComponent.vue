<script setup lang="ts">
import { computed } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import GoalCard from './GoalCard.vue'

// ── Props & Emits ───────────────────────────────────────────────────────────
const props = defineProps<{ nodeId: string }>()

const emit = defineEmits<{
  'drag-start': [nodeId: string]
  'drag-end': [nodeId: string]
  'drop': [targetNodeId: string]
  'add-child': [parentNodeId: string]
  'add-goal': [nodeId: string]
  'edit': [nodeId: string]
  'delete': [nodeId: string]
}>()

// ── Stores ──────────────────────────────────────────────────────────────────
const nodeStore = useNodeStore()
const goalStore = useGoalStore()

// ── Derived state ───────────────────────────────────────────────────────────
const node = computed(() => nodeStore.nodes[props.nodeId])
const goals = computed(() => goalStore.goalsForNode(props.nodeId))
const isSelected = computed(() => nodeStore.selectedNodeId === props.nodeId)
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
      <div class="node-info">
        <strong class="node-title">{{ node?.title }}</strong>
        <div class="node-owner">{{ node?.ownerName }}</div>
        <div class="node-role">{{ node?.roleLevel === 'Custom' ? node.customRoleLabel : node?.roleLevel }}</div>
      </div>
    </div>

    <!-- Action menu: only visible when this node is selected -->
    <div v-if="isSelected" class="action-menu" role="menu" :aria-label="`Actions for ${node?.title}`">
      <button aria-label="Add child node" role="menuitem" @click="emit('add-child', props.nodeId)">Add Child</button>
      <button aria-label="Add goal" role="menuitem" @click="emit('add-goal', props.nodeId)">Add Goal</button>
      <button aria-label="Edit node" role="menuitem" @click="emit('edit', props.nodeId)">Edit</button>
      <button aria-label="Delete node" role="menuitem" @click="emit('delete', props.nodeId)">Delete</button>
    </div>

    <!-- Goal cards -->
    <GoalCard
      v-for="goal in goals"
      :key="goal.id"
      :goal-id="goal.id"
      @update-progress="(val) => goalStore.setProgress(goal.id, val)"
      @update-status="(val) => goalStore.updateGoal(goal.id, { status: val })"
      @delete="goalStore.deleteGoal(goal.id)"
    />
  </div>
</template>

<style scoped>
.node-component {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-size: 0.8rem;
  overflow: auto;
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
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-owner,
.node-role {
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
  font-size: 0.75rem;
}

.action-menu button:hover {
  background: #f0f0f0;
}
</style>

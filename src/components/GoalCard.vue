<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGoalStore } from '@/stores/goalStore'
import type { GoalStatus } from '@/models'
import { progressColor } from '@/composables/useProgressColor'

// ── Props & Emits ───────────────────────────────────────────────────────────
const props = defineProps<{ goalId: string }>()

const emit = defineEmits<{
  'update-progress': [value: number]
  'update-status': [value: GoalStatus]
  'delete': []
}>()

// ── Store ───────────────────────────────────────────────────────────────────
const goalStore = useGoalStore()

// ── Derived state ───────────────────────────────────────────────────────────
const goal = computed(() => goalStore.goals[props.goalId])

const sourceGoal = computed(() => {
  if (goal.value?.type !== 'Refined' || !goal.value.sourceGoalId) return undefined
  return goalStore.goals[goal.value.sourceGoalId]
})



const showDeleteConfirm = ref(false)

function onDeleteClick() {
  showDeleteConfirm.value = true
}

function onConfirmDelete() {
  showDeleteConfirm.value = false
  emit('delete')
}

function onCancelDelete() {
  showDeleteConfirm.value = false
}

</script>

<template>
  <div class="goal-card" data-testid="goal-card">
    <!-- Source goal description (Refined goals only) -->
    <div v-if="goal?.type === 'Refined' && sourceGoal" class="source-description">
      <span class="source-label">Source:</span>
      <span class="source-text" data-testid="source-description">{{ sourceGoal.description }}</span>
    </div>

    <!-- Own description -->
    <div class="goal-description" data-testid="goal-description">{{ goal?.description }}</div>

    <!-- Weight and status -->
    <div class="goal-meta">
      <span>Weight: {{ goal?.weight }}</span>
      <span>Status: {{ goal?.status }}</span>
    </div>

    <!-- Progress bar + percentage -->
    <div class="progress-row">
      <div
        class="progress-bar-track"
        role="progressbar"
        :aria-valuenow="goal?.progress ?? 0"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Progress: ${goal?.progress ?? 0}%`"
      >
        <div
          class="progress-bar-fill"
          :style="{ width: (goal?.progress ?? 0) + '%', background: progressColor(goal?.progress ?? 0) }"
        />
      </div>
      <span class="progress-pct" :style="{ color: progressColor(goal?.progress ?? 0) }">
        {{ Math.round(goal?.progress ?? 0) }}%
      </span>
    </div>

    <!-- Progress input -->
    <input
      type="range"
      min="0"
      max="100"
      :value="goal?.progress ?? 0"
      :aria-label="`Set progress for ${goal?.description}`"
      @change="emit('update-progress', Number(($event.target as HTMLInputElement).value))"
    />

    <!-- Status select -->
    <select
      :value="goal?.status"
      :aria-label="`Set status for ${goal?.description}`"
      @change="emit('update-status', ($event.target as HTMLSelectElement).value as GoalStatus)"
    >
      <option value="Active">Active</option>
      <option value="Refined">Refined</option>
      <option value="Complete">Complete</option>
    </select>

    <!-- Delete button -->
    <button class="btn-delete" aria-label="Delete goal" @click="onDeleteClick">Delete</button>
  </div>

  <!-- Delete confirmation modal -->
  <Teleport to="body">
    <div v-if="showDeleteConfirm" class="modal-backdrop" @click.self="onCancelDelete">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title" class="modal-title">Delete Goal</h3>
        <p class="modal-body">Are you sure you want to delete <strong>"{{ goal?.description }}"</strong>?</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="onCancelDelete">Cancel</button>
          <button class="btn-confirm-delete" @click="onConfirmDelete">Delete</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.goal-card {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  margin-top: 6px;
  background: #fafafa;
  font-size: 0.8rem;
}

.source-description {
  margin-bottom: 4px;
  color: #666;
}

.source-label {
  font-weight: 600;
  margin-right: 4px;
}

.goal-description {
  font-weight: 500;
  margin-bottom: 4px;
}

.goal-meta {
  display: flex;
  gap: 12px;
  color: #555;
  margin-bottom: 6px;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.progress-bar-track {
  flex: 1;
  height: 7px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.2s ease, background 0.2s ease;
}

.progress-pct {
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 32px;
  text-align: right;
  line-height: 1;
}

input[type='range'] {
  width: 100%;
  margin-bottom: 4px;
}

select {
  width: 100%;
  margin-bottom: 4px;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
}

button {
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #ccc;
  cursor: pointer;
  background: #fff;
  color: #213547;
}

button:hover {
  background: #fee;
  border-color: #f88;
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

</style>

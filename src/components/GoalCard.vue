<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useGoalStore } from '@/stores/goalStore'
import type { GoalStatus } from '@/models'
import { progressColor } from '@/composables/useProgressColor'
import { DEFAULT_SCALE_CONFIG } from '@/models/RatingScale'
import RatingScale from './rating/RatingScale.vue'

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

// ── Scale config ────────────────────────────────────────────────────────────
const scaleConfig = computed(() => goal.value?.scaleConfig ?? DEFAULT_SCALE_CONFIG)

const sourceGoal = computed(() => {
  if (goal.value?.type !== 'Refined' || !goal.value.sourceGoalId) return undefined
  return goalStore.goals[goal.value.sourceGoalId]
})



const isActive = ref(false)
const cardRef = ref<HTMLElement | null>(null)

function activate() {
  isActive.value = true
}

function onDocumentClick(e: MouseEvent) {
  if (cardRef.value && !cardRef.value.contains(e.target as Node)) {
    isActive.value = false
    if (isEditing.value) cancelEdit()
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

// ── Inline editing ──────────────────────────────────────────────────────────
const isEditing = ref(false)
const editDescription = ref('')
const editWeight = ref(1)

function startEdit() {
  editDescription.value = goal.value?.description ?? ''
  editWeight.value = goal.value?.weight ?? 1
  isEditing.value = true
}

async function saveEdit() {
  const desc = editDescription.value.trim()
  if (!desc) return
  await goalStore.updateGoal(props.goalId, {
    description: desc,
    weight: editWeight.value,
  })
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

const showDeleteConfirm = ref(false)

function onDeleteClick() {
  showDeleteConfirm.value = true
}

function onConfirmDelete() {
  showDeleteConfirm.value = false
  isActive.value = false
  emit('delete')
}

function onCancelDelete() {
  showDeleteConfirm.value = false
  isActive.value = false
}

</script>

<template>
  <div ref="cardRef" class="goal-card" :class="{ 'goal-card--active': isActive }" data-testid="goal-card" @click="activate">
    <!-- Source goal description (Refined goals only) -->
    <div v-if="goal?.type === 'Refined' && sourceGoal" class="source-description">
      <span class="source-label">Source:</span>
      <span class="source-text" data-testid="source-description">{{ sourceGoal.description }}</span>
    </div>

    <!-- Own description (view mode) -->
    <template v-if="!isEditing">
      <div class="goal-description" data-testid="goal-description">{{ goal?.description }}</div>

      <!-- Weight and status -->
      <div class="goal-meta">
        <span>Weight: {{ goal?.weight }}</span>
        <span>Status: {{ goal?.status }}</span>
      </div>
    </template>

    <!-- Inline edit form -->
    <template v-else>
      <input
        v-model="editDescription"
        class="goal-edit-input"
        type="text"
        placeholder="Description"
        @click.stop
        @keyup.enter="saveEdit"
        @keyup.escape="cancelEdit"
      />
      <div class="goal-edit-weight-row">
        <label class="goal-edit-label">Weight</label>
        <input
          v-model.number="editWeight"
          class="goal-edit-input goal-edit-input--weight"
          type="number"
          min="0.01"
          max="1000"
          step="0.01"
          @click.stop
          @keyup.enter="saveEdit"
          @keyup.escape="cancelEdit"
        />
      </div>
      <div class="goal-edit-actions">
        <button class="btn-edit-save" @click.stop="saveEdit">Save</button>
        <button class="btn-edit-cancel" @click.stop="cancelEdit">Cancel</button>
      </div>
    </template>

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

    <!-- Progress input / Rating scale -->
    <RatingScale
      :model-value="goal?.progress ?? 0"
      :config="scaleConfig"
      @update:model-value="emit('update-progress', $event)"
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

    <!-- Action icons: only shown when card is active and not editing -->
    <div v-if="isActive && !isEditing" class="goal-card-actions">
      <button class="btn-icon-edit" title="Edit" aria-label="Edit goal" @click.stop="startEdit">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn-icon-danger" title="Delete" aria-label="Delete goal" @click.stop="onDeleteClick">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
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
  cursor: pointer;
  transition: border-color 0.15s;
}

.goal-card--active {
  border-color: #1a73e8;
  background: #fff;
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

.goal-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  margin-top: 4px;
}

.btn-icon-edit,
.btn-icon-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: transparent;
  color: #aaa;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-icon-edit:hover {
  background: #e8f0fe;
  color: #1a73e8;
  border-color: #1a73e8;
}

.btn-icon-danger:hover {
  background: #fde8e8;
  color: #d32f2f;
  border-color: #d32f2f;
}

.goal-edit-input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 6px;
  border: 1px solid #1a73e8;
  border-radius: 3px;
  font-size: 0.8rem;
  margin-bottom: 4px;
  background: #fff;
  color: #213547;
}

.goal-edit-input:focus {
  outline: none;
  border-color: #1557b0;
}

.goal-edit-input--weight {
  width: 70px;
}

.goal-edit-weight-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.goal-edit-label {
  font-size: 0.75rem;
  color: #555;
  flex-shrink: 0;
}

.goal-edit-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 2px;
}

.btn-edit-save {
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #1a73e8;
  background: #1a73e8;
  color: #fff;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn-edit-save:hover {
  background: #1557b0;
  border-color: #1557b0;
}

.btn-edit-cancel {
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #ccc;
  background: #f5f5f5;
  color: #213547;
  cursor: pointer;
  font-size: 0.75rem;
}

.btn-edit-cancel:hover {
  background: #e0e0e0;
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

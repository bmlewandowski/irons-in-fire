<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGoalStore } from '@/stores/goalStore'
import type { GoalStatus } from '@/models'

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

function progressColor(pct: number): string {
  if (pct >= 80) return '#2e7d32'
  if (pct >= 50) return '#1565c0'
  if (pct >= 25) return '#e65100'
  return '#b71c1c'
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
    <button aria-label="Delete goal" @click="emit('delete')">Delete</button>
  </div>
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
}

button:hover {
  background: #fee;
  border-color: #f88;
}

</style>

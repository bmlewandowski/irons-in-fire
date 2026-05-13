<template>
  <!-- Drill-down panel fills the whole dashboard when active -->
  <DrillDownPanel
    v-if="selectedGoalId"
    :goal-id="selectedGoalId"
    @close="selectedGoalId = null"
  />

  <!-- Summary view -->
  <div v-else class="executive-dashboard" data-testid="executive-dashboard">
    <div class="dashboard-heading">
      <h2>Executive Dashboard</h2>
      <p class="dashboard-subtitle">Top-level goals — click any card to see the hierarchical breakdown</p>
    </div>

    <!-- Empty state -->
    <div
      v-if="dashboardStore.rootGoals.length === 0"
      class="empty-state"
      data-testid="dashboard-empty-state"
    >
      No top-level goals yet. Create a root node, select it, and use "Add Goal" to get started.
    </div>

    <!-- Root goal cards -->
    <div v-else class="goal-grid">
      <button
        v-for="goal in dashboardStore.rootGoals"
        :key="goal.id"
        class="goal-card"
        data-testid="goal-indicator"
        :data-goal-id="goal.id"
        :aria-label="`${goal.description} — ${Math.round(goal.progress)}% complete. Click to see breakdown.`"
        @click="selectedGoalId = goal.id"
      >
        <!-- Node name -->
        <div class="card-node-label">{{ nodeLabel(goal.nodeId) }}</div>

        <!-- Description -->
        <div class="card-desc">{{ goal.description }}</div>

        <!-- Progress ring + percent -->
        <div class="card-progress-row">
          <div class="ring-wrapper" :title="`${Math.round(goal.progress)}%`">
            <svg viewBox="0 0 36 36" class="ring-svg" aria-hidden="true">
              <circle class="ring-bg" cx="18" cy="18" r="15.9" />
              <circle
                class="ring-fill"
                cx="18" cy="18" r="15.9"
                :stroke="ringColor(goal.progress)"
                :stroke-dasharray="`${goal.progress} ${100 - goal.progress}`"
                stroke-dashoffset="25"
              />
            </svg>
            <span class="ring-pct" :style="{ color: ringColor(goal.progress) }">
              {{ Math.round(goal.progress) }}<small>%</small>
            </span>
          </div>
          <div class="card-stats">
            <div class="stat-row">
              <span class="stat-label">Status</span>
              <span :class="['badge', statusClass(goal.status)]">{{ goal.status }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Refinements</span>
              <span class="stat-val">{{ childCount(goal.id) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Weight</span>
              <span class="stat-val">{{ goal.weight }}</span>
            </div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="card-track" role="progressbar"
             :aria-valuenow="Math.round(goal.progress)" aria-valuemin="0" aria-valuemax="100">
          <div class="card-fill"
               :style="{ width: goal.progress + '%', background: ringColor(goal.progress) }" />
        </div>

        <div class="card-cta">View breakdown →</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useGoalStore } from '@/stores/goalStore'
import { useNodeStore } from '@/stores/nodeStore'
import DrillDownPanel from './DrillDownPanel.vue'

const dashboardStore = useDashboardStore()
const goalStore = useGoalStore()
const nodeStore = useNodeStore()

const selectedGoalId = ref<string | null>(null)

function nodeLabel(nodeId: string): string {
  const n = nodeStore.nodes[nodeId]
  return n ? `${n.title} · ${n.ownerName}` : '(unknown node)'
}

function childCount(goalId: string): number {
  return Object.values(goalStore.goals).filter((g) => g.sourceGoalId === goalId).length
}

function ringColor(pct: number): string {
  if (pct >= 80) return '#2e7d32'
  if (pct >= 50) return '#1565c0'
  if (pct >= 25) return '#e65100'
  return '#b71c1c'
}

function statusClass(status: string): string {
  if (status === 'Complete') return 'badge-complete'
  if (status === 'Refined') return 'badge-refined'
  return 'badge-active'
}
</script>

<style scoped>
.executive-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem;
  flex: 1;
  background: #f4f6fb;
}

.dashboard-heading h2 {
  margin: 0 0 0.25rem;
  font-size: 1.4rem;
  color: #1a1a2e;
}

.dashboard-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #777;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 200px;
  color: #6c757d;
  font-size: 0.95rem;
  font-style: italic;
  text-align: center;
  padding: 2rem;
  background: #fff;
  border-radius: 10px;
  border: 1px dashed #ccc;
}

.goal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.goal-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 1.25rem 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  cursor: pointer;
  text-align: left;
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.1s;
}

.goal-card:hover {
  box-shadow: 0 4px 18px rgba(0,0,0,0.1);
  border-color: #b0c4de;
  transform: translateY(-2px);
}

.card-node-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
}

.card-desc {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
  line-height: 1.35;
}

.card-progress-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.ring-wrapper {
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
}

.ring-svg {
  width: 64px;
  height: 64px;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: #e8e8e8;
  stroke-width: 3.5;
}

.ring-fill {
  fill: none;
  stroke-width: 3.5;
  stroke-linecap: round;
  transition: stroke-dasharray 0.4s ease;
}

.ring-pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
}

.ring-pct small { font-size: 0.55rem; }

.card-stats {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
}

.stat-label { color: #888; }
.stat-val { font-weight: 600; color: #333; }

.badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
}
.badge-active   { background: #e3f2fd; color: #1565c0; }
.badge-refined  { background: #fff3e0; color: #e65100; }
.badge-complete { background: #e8f5e9; color: #2e7d32; }

.card-track {
  width: 100%;
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
}

.card-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.card-cta {
  font-size: 0.78rem;
  color: #1565c0;
  text-align: right;
  font-weight: 500;
}
</style>


<style scoped>
.executive-dashboard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  min-height: 200px;
}

.exit-drilldown {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  background-color: #6c757d;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.exit-drilldown:hover {
  background-color: #5a6268;
}

.exit-drilldown:focus-visible {
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #6c757d;
  font-size: 1rem;
  font-style: italic;
  text-align: center;
  padding: 2rem;
}

.goal-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.goal-indicator {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background-color: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  min-width: 180px;
  max-width: 240px;
  flex: 1;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.goal-indicator:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  border-color: #0d6efd;
}

.goal-indicator:focus-visible {
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
}

.goal-description {
  font-size: 0.875rem;
  font-weight: 600;
  color: #212529;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.progress-ring-track {
  position: relative;
  width: 100%;
  height: 10px;
  background-color: #e9ecef;
  border-radius: 5px;
  overflow: hidden;
}

.progress-ring-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: #0d6efd;
  border-radius: 5px;
  transition: width 0.3s ease;
  min-width: 0;
  max-width: 100%;
}

.progress-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #495057;
  text-align: right;
}
</style>

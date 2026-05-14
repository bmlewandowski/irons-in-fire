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
      <div class="heading-top">
        <h2>Executive Dashboard</h2>
        <!-- Scope picker -->
        <div class="scope-picker" v-if="allNodes.length > 0">
          <label for="scope-select" class="scope-label">Scope:</label>
          <select
            id="scope-select"
            v-model="scopeNodeId"
            class="scope-select"
            aria-label="Filter goals by subtree"
          >
            <option :value="null">All top-level goals</option>
            <option v-for="node in allNodes" :key="node.id" :value="node.id">
              {{ node.title }} · {{ node.ownerName }}
            </option>
          </select>
          <button
            v-if="scopeNodeId"
            class="scope-clear"
            aria-label="Clear scope filter"
            @click="scopeNodeId = null"
          >✕</button>
        </div>
      </div>
      <p class="dashboard-subtitle">
        <template v-if="scopeLabel">
          Goals in subtree of <strong>{{ scopeLabel }}</strong> — click any card to see the hierarchical breakdown
        </template>
        <template v-else>
          Top-level goals — click any card to see the hierarchical breakdown
        </template>
      </p>
    </div>

    <!-- Empty state -->
    <div
      v-if="scopedGoals.length === 0"
      class="empty-state"
      data-testid="dashboard-empty-state"
    >
      <template v-if="scopeNodeId">
        No root goals in this subtree. Select a node with goals or clear the scope filter.
      </template>
      <template v-else>
        No top-level goals yet. Create a root node, select it, and use "Add Goal" to get started.
      </template>
    </div>

    <!-- Root goal cards with virtual scrolling -->
    <div v-else class="goal-grid-container" v-bind="containerProps">
      <div class="goal-grid-inner" v-bind="listProps">
        <button
          v-for="vItem in virtualItems"
          :key="vItem.item.id"
          class="goal-card"
          data-testid="goal-indicator"
          :data-goal-id="vItem.item.id"
          :style="{
            position: 'absolute',
            top: `${vItem.offsetTop}px`,
            left: 0,
            right: 0,
          }"
          :aria-label="`${vItem.item.description} — ${Math.round(vItem.item.progress)}% complete. Click to see breakdown.`"
          @click="selectedGoalId = vItem.item.id"
        >
          <!-- Node name -->
          <div class="card-node-label">{{ nodeLabel(vItem.item.nodeId) }}</div>

          <!-- Description -->
          <div class="card-desc">{{ vItem.item.description }}</div>

          <!-- Progress ring + percent -->
          <div class="card-progress-row">
            <div class="ring-wrapper" :title="`${Math.round(vItem.item.progress)}%`">
              <svg viewBox="0 0 36 36" class="ring-svg" aria-hidden="true">
                <circle class="ring-bg" cx="18" cy="18" r="15.9" />
                <circle
                  class="ring-fill"
                  cx="18" cy="18" r="15.9"
                  :stroke="ringColor(vItem.item.progress)"
                  :stroke-dasharray="`${vItem.item.progress} ${100 - vItem.item.progress}`"
                  stroke-dashoffset="25"
                />
              </svg>
              <span class="ring-pct" :style="{ color: ringColor(vItem.item.progress) }">
                {{ Math.round(vItem.item.progress) }}<small>%</small>
              </span>
            </div>
            <div class="card-stats">
              <div class="stat-row">
                <span class="stat-label">Status</span>
                <span :class="['badge', statusClass(vItem.item.status)]">{{ vItem.item.status }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Refinements</span>
                <span class="stat-val">{{ childCount(vItem.item.id) }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Weight</span>
                <span class="stat-val">{{ vItem.item.weight }}</span>
              </div>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="card-track" role="progressbar"
               :aria-valuenow="Math.round(vItem.item.progress)" aria-valuemin="0" aria-valuemax="100">
            <div class="card-fill"
                 :style="{ width: vItem.item.progress + '%', background: ringColor(vItem.item.progress) }" />
          </div>

          <div class="card-cta">View breakdown →</div>
        </button>
      </div>
      <div v-if="scopedGoals.length > 20" class="virtual-scroll-info">
        Showing {{ virtualItems.length }} of {{ scopedGoals.length }} goals (virtual scrolling enabled)
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useGoalStore } from '@/stores/goalStore'
import { useNodeStore } from '@/stores/nodeStore'
import DrillDownPanel from './DrillDownPanel.vue'
import { progressColor } from '@/composables/useProgressColor'
import { useVirtualScroll } from '@/composables/useVirtualScroll'

const dashboardStore = useDashboardStore()
const goalStore = useGoalStore()
const nodeStore = useNodeStore()

const selectedGoalId = ref<string | null>(null)
const scopeNodeId = ref<string | null>(null)

/** Nodes available for scope selection, sorted alphabetically by title. */
const allNodes = computed(() =>
  Object.values(nodeStore.nodes).sort((a, b) => a.title.localeCompare(b.title))
)

/** Goals shown in the grid — scoped to a subtree when scopeNodeId is set. */
const scopedGoals = computed(() => dashboardStore.goalsForScope(scopeNodeId.value))

const scopeLabel = computed(() => {
  if (!scopeNodeId.value) return null
  const n = nodeStore.nodes[scopeNodeId.value]
  return n ? `${n.title} · ${n.ownerName}` : null
})

// Virtual scrolling for goal cards
const { virtualItems, containerProps, listProps } = useVirtualScroll({
  items: scopedGoals,
  estimateSize: () => 280, // Estimated card height
  overscan: 5,
  minHeight: '500px',
})

function nodeLabel(nodeId: string): string {
  const n = nodeStore.nodes[nodeId]
  return n ? `${n.title} · ${n.ownerName}` : '(unknown node)'
}

function childCount(goalId: string): number {
  return Object.values(goalStore.goals).filter((g) => g.sourceGoalId === goalId).length
}

const ringColor = progressColor

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

.heading-top {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.scope-picker {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.scope-label {
  font-size: 0.8rem;
  color: #555;
  white-space: nowrap;
}

.scope-select {
  font-size: 0.82rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  color: #1a1a2e;
  max-width: 220px;
  cursor: pointer;
}

.scope-select:focus {
  outline: 2px solid #3b5bdb;
  outline-offset: 1px;
}

.scope-clear {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  color: #888;
  padding: 0.2rem 0.35rem;
  border-radius: 4px;
  line-height: 1;
}

.scope-clear:hover {
  background: #eee;
  color: #c00;
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

.goal-grid-container {
  flex: 1;
  overflow: auto;
  background: #f4f6fb;
  border-radius: 8px;
  padding: 1rem 0;
}

.goal-grid-inner {
  position: relative;
  padding: 0 1rem;
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
  min-height: 240px;
}

.goal-card:hover {
  box-shadow: 0 4px 18px rgba(0,0,0,0.1);
  border-color: #b0c4de;
  transform: translateY(-2px);
  z-index: 1;
}

.virtual-scroll-info {
  text-align: center;
  padding: 1rem;
  font-size: 0.75rem;
  color: #888;
  font-style: italic;
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

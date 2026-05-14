<script setup lang="ts">
import { useGoalStore } from '@/stores/goalStore'
import { useNodeStore } from '@/stores/nodeStore'
import type { Goal } from '@/models'
import { progressColor, computeWeightedProgress } from '@/composables/useProgressColor'

const props = defineProps<{ goalId: string }>()
const emit = defineEmits<{ close: [] }>()

const goalStore = useGoalStore()
const nodeStore = useNodeStore()

// ── Tree building ────────────────────────────────────────────────────────────

interface TreeNode {
  goal: Goal
  nodeTitle: string
  ownerName: string
  depth: number
  weightedProgress: number
  children: TreeNode[]
}

function directChildren(goalId: string): Goal[] {
  return Object.values(goalStore.goals).filter((g) => g.sourceGoalId === goalId)
}

function buildTree(goalId: string, depth: number): TreeNode | null {
  const goal = goalStore.goals[goalId]
  if (!goal) return null

  const orgNode = nodeStore.nodes[goal.nodeId]
  const children = directChildren(goalId)
    .map((g) => buildTree(g.id, depth + 1))
    .filter((n): n is TreeNode => n !== null)
    .sort((a, b) => b.goal.weight - a.goal.weight)

  // Weighted progress: from children if any, else the goal's own progress
  const weightedProgress = children.length > 0
    ? computeWeightedProgress(children.map((c) => c.goal))
    : goal.progress

  return {
    goal,
    nodeTitle: orgNode?.title ?? '(unknown)',
    ownerName: orgNode?.ownerName ?? '',
    depth,
    weightedProgress,
    children,
  }
}

const tree = computed(() => buildTree(props.goalId, 0))

// ── Totals line for a node ───────────────────────────────────────────────────
function totalWeight(node: TreeNode): number {
  return node.children.reduce((s, c) => s + c.goal.weight, 0)
}



function statusBadgeClass(status: string): string {
  if (status === 'Complete') return 'badge-complete'
  if (status === 'Refined') return 'badge-refined'
  return 'badge-active'
}
</script>

<template>
  <div class="drilldown-panel" v-if="tree">
    <!-- Header -->
    <div class="drilldown-header">
      <button class="back-btn" aria-label="Back to goals" @click="emit('close')">← Back</button>
      <div class="drilldown-title">
        <span class="drilldown-node-label">{{ tree.nodeTitle }}</span>
        <h2 class="drilldown-goal-desc">{{ tree.goal.description }}</h2>
        <span :class="['badge', statusBadgeClass(tree.goal.status)]">{{ tree.goal.status }}</span>
      </div>
    </div>

    <!-- Root progress bar -->
    <div class="root-progress-section">
      <div class="progress-label-row">
        <span class="progress-headline">Overall Progress</span>
        <span class="progress-pct" :style="{ color: progressColor(tree.weightedProgress) }">
          {{ Math.round(tree.weightedProgress) }}%
        </span>
      </div>
      <div class="progress-track large-track" role="progressbar"
           :aria-valuenow="Math.round(tree.weightedProgress)" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill"
             :style="{ width: tree.weightedProgress + '%', background: progressColor(tree.weightedProgress) }" />
      </div>
      <div class="root-meta">
        <span>Owner: <strong>{{ tree.ownerName }}</strong></span>
        <span>Weight: <strong>{{ tree.goal.weight }}</strong></span>
        <span>Direct refinements: <strong>{{ tree.children.length }}</strong></span>
      </div>
    </div>

    <!-- No children -->
    <div v-if="tree.children.length === 0" class="no-children">
      No refinements — this is a leaf goal. Progress is set directly.
    </div>

    <!-- Hierarchical tree -->
    <div v-else class="tree-container">
      <div class="tree-legend">
        <span>Refinement chain — sorted by weight desc</span>
        <span class="legend-weight">weight contributes to parent rollup</span>
      </div>
      <GoalTreeNode
        v-for="child in tree.children"
        :key="child.goal.id"
        :node="child"
        :total-sibling-weight="totalWeight(tree)"
      />
    </div>
  </div>

  <div v-else class="drilldown-panel no-data">
    <button class="back-btn" @click="emit('close')">← Back</button>
    <p>Goal not found.</p>
  </div>
</template>

<!-- ─── Recursive sub-component ──────────────────────────────────────────── -->
<script lang="ts">
import { defineComponent, computed, h, resolveComponent } from 'vue'
import type { PropType } from 'vue'

interface TreeNodeType {
  goal: { id: string; description: string; weight: number; progress: number; status: string; type: string }
  nodeTitle: string
  ownerName: string
  depth: number
  weightedProgress: number
  children: TreeNodeType[]
}

export const GoalTreeNode = defineComponent({
  name: 'GoalTreeNode',
  props: {
    node: { type: Object as PropType<TreeNodeType>, required: true },
    totalSiblingWeight: { type: Number, required: true },
  },
  setup(props) {
    const pct = computed(() => Math.round(props.node.weightedProgress))
    const contribution = computed(() =>
      props.totalSiblingWeight > 0
        ? Math.round((props.node.goal.weight / props.totalSiblingWeight) * 100)
        : 0
    )
    const color = computed(() => {
      const p = pct.value
      if (p >= 80) return '#2e7d32'
      if (p >= 50) return '#1565c0'
      if (p >= 25) return '#e65100'
      return '#b71c1c'
    })
    const tw = computed(() =>
      props.node.children.reduce((s: number, c: TreeNodeType) => s + c.goal.weight, 0)
    )

    return () => {
      const GoalTreeNodeComp = resolveComponent('GoalTreeNode') as any
      return h('div', { class: 'tree-node', style: `--depth: ${props.node.depth}` }, [
        h('div', { class: 'tree-row' }, [
          h('div', { class: 'tree-indent' }, [
            h('span', { class: 'tree-connector' }),
          ]),
          h('div', { class: 'tree-content' }, [
            h('div', { class: 'tree-top-line' }, [
              h('span', { class: 'tree-node-label' }, props.node.nodeTitle),
              h('span', { class: 'tree-owner' }, `· ${props.node.ownerName}`),
              h('span', { class: ['badge-sm', props.node.goal.status === 'Complete' ? 'badge-complete' : props.node.goal.status === 'Refined' ? 'badge-refined' : 'badge-active'] }, props.node.goal.status),
            ]),
            h('div', { class: 'tree-desc' }, props.node.goal.description),
            h('div', { class: 'tree-bar-row' }, [
              h('div', { class: 'tree-track', role: 'progressbar', 'aria-valuenow': pct.value, 'aria-valuemin': 0, 'aria-valuemax': 100 }, [
                h('div', { class: 'tree-fill', style: { width: pct.value + '%', background: color.value } }),
              ]),
              h('span', { class: 'tree-pct', style: { color: color.value } }, `${pct.value}%`),
            ]),
            h('div', { class: 'tree-meta' }, [
              h('span', {}, `Weight: ${props.node.goal.weight}`),
              h('span', { class: 'contrib' }, `${contribution.value}% of parent`),
              props.node.children.length > 0
                ? h('span', {}, `${props.node.children.length} sub-goal${props.node.children.length > 1 ? 's' : ''}`)
                : h('span', { class: 'leaf-tag' }, 'leaf'),
            ]),
          ]),
        ]),
        props.node.children.length > 0
          ? h('div', { class: 'tree-children' },
              props.node.children.map((child: TreeNodeType) =>
                h(GoalTreeNodeComp, {
                  key: child.goal.id,
                  node: child,
                  totalSiblingWeight: tw.value,
                })
              )
            )
          : null,
      ])
    }
  },
})
</script>

<style scoped>
.drilldown-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem 2rem;
  background: #fff;
  overflow-y: auto;
  gap: 1.25rem;
}

.back-btn {
  align-self: flex-start;
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: #444;
  flex-shrink: 0;
}
.back-btn:hover { background: #f0f0f0; }

.drilldown-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.drilldown-node-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
  font-weight: 600;
}

.drilldown-goal-desc {
  margin: 0.15rem 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.3;
}

.badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
}
.badge-active  { background: #e3f2fd; color: #1565c0; }
.badge-refined { background: #fff3e0; color: #e65100; }
.badge-complete{ background: #e8f5e9; color: #2e7d32; }

/* Root progress */
.root-progress-section {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.progress-label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.progress-headline {
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.progress-pct {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.progress-track {
  width: 100%;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}
.large-track { height: 14px; }

.progress-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
}

.root-meta {
  display: flex;
  gap: 1.5rem;
  font-size: 0.8rem;
  color: #555;
}

.no-children {
  color: #666;
  font-style: italic;
  font-size: 0.9rem;
  padding: 0.75rem 0;
}

/* Tree */
.tree-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tree-legend {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #888;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 0.5rem;
}

.legend-weight { font-style: italic; }

/* GoalTreeNode (rendered via render fn, no scoped possible — use :global) */
</style>

<style>
.tree-node {
  margin-left: calc(var(--depth, 0) * 0px); /* depth handled by nesting */
}

.tree-row {
  display: flex;
  gap: 0;
  padding: 0.6rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.tree-indent {
  width: 24px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding-top: 0.3rem;
}

.tree-connector {
  display: block;
  width: 2px;
  background: #ddd;
  height: 100%;
  border-radius: 1px;
}

.tree-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.tree-top-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tree-node-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1a1a2e;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tree-owner {
  font-size: 0.75rem;
  color: #777;
}

.badge-sm {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
}
.badge-sm.badge-active   { background: #e3f2fd; color: #1565c0; }
.badge-sm.badge-refined  { background: #fff3e0; color: #e65100; }
.badge-sm.badge-complete { background: #e8f5e9; color: #2e7d32; }

.tree-desc {
  font-size: 0.88rem;
  color: #222;
  line-height: 1.4;
}

.tree-bar-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.tree-track {
  flex: 1;
  height: 8px;
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}

.tree-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.tree-pct {
  font-size: 0.85rem;
  font-weight: 700;
  min-width: 36px;
  text-align: right;
}

.tree-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.72rem;
  color: #888;
}

.tree-meta .contrib { color: #555; font-style: italic; }
.tree-meta .leaf-tag { color: #aaa; font-style: italic; }

.tree-children {
  padding-left: 1.5rem;
  border-left: 2px solid #e8e8e8;
  margin-left: 12px;
}
</style>

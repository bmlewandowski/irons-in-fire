import { ref, computed, watch, nextTick } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'

interface GoalModalState {
  nodeId: string
  description: string
  weight: string
  sourceGoalId: string
  error: string
}

/**
 * Manages the goal creation modal, including ancestor-goal selection for
 * Refined goals.
 */
export function useGoalModal() {
  const nodeStore = useNodeStore()
  const goalStore = useGoalStore()

  const goalModal = ref<GoalModalState | null>(null)
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
          label: `[${current.title}] ${g.description.slice(0, 60)}${g.description.length > 60 ? '\u2026' : ''}`,
        })
      }
    }
    return results
  }

  const goalModalAncestorGoals = computed(() =>
    goalModal.value ? ancestorGoals(goalModal.value.nodeId) : [],
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
      if (goalModal.value) {
        goalModal.value.error = err instanceof Error ? err.message : 'An error occurred.'
      }
    }
  }

  function cancelGoalModal() {
    goalModal.value = null
  }

  // Auto-focus first interactive element when modal opens
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

  return {
    goalModal,
    goalModalRef,
    goalModalAncestorGoals,
    openAddGoal,
    saveGoal,
    cancelGoalModal,
  }
}

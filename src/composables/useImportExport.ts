/**
 * useImportExport — handles JSON export/import of the full dataset
 * (nodes, goals, and canvas layout), including per-record validation,
 * sanitization, and size caps.
 *
 * Extracted from OrgChartContainer.
 */

import { ref } from 'vue'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import { sanitizer } from '@/services/Sanitizer'
import { validateCreateNodeInput, validateCreateGoalInput } from '@/services/ValidationService'
import type { RoleLevel } from '@/models'
import type { GoalType, GoalStatus } from '@/models'
import type { Ref } from 'vue'

const IMPORT_MAX_BYTES = 5 * 1024 * 1024   // 5 MB
const IMPORT_MAX_NODES = 5_000
const IMPORT_MAX_GOALS = 25_000

export type ImportLayout = {
  sizes: [string, { width: number; height: number }][]
  positions: [string, { x: number; y: number }][]
  collapsed: string[]
  collapsedGoals: string[]
}

export type ImportPayload = {
  nodes: import('@/models').OrgNode[]
  goals: import('@/models').Goal[]
  layout?: ImportLayout
}

interface LayoutRefs {
  nodeSizes: Ref<Map<string, { width: number; height: number }>>
  nodeAbsPositions: Ref<Map<string, { x: number; y: number }>>
  collapsedNodes: Ref<Set<string>>
  collapsedGoalNodes: Ref<Set<string>>
}

export function useImportExport(
  layoutRefs: LayoutRefs,
  saveLayout: () => void,
  resetLayout: () => void,
  snapshot: () => void,
  clearHistory: () => void,
) {
  const nodeStore = useNodeStore()
  const goalStore = useGoalStore()

  const importFileInput = ref<HTMLInputElement | null>(null)
  const importPayload = ref<ImportPayload | null>(null)
  const importError = ref<string | null>(null)

  function exportData() {
    const { nodeSizes, nodeAbsPositions, collapsedNodes, collapsedGoalNodes } = layoutRefs
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      nodes: Object.values(nodeStore.nodes),
      goals: Object.values(goalStore.goals),
      layout: {
        sizes: [...nodeSizes.value.entries()],
        positions: [...nodeAbsPositions.value.entries()],
        collapsed: [...collapsedNodes.value],
        collapsedGoals: [...collapsedGoalNodes.value],
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `irons-in-fire-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onImportFileChange(event: Event) {
    importError.value = null
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (file.size > IMPORT_MAX_BYTES) {
      importError.value = `File is too large (${(file.size / 1_048_576).toFixed(1)} MB). Maximum size is 5 MB.`
      if (importFileInput.value) importFileInput.value.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        if (!Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.goals)) {
          importError.value = 'Invalid file: must contain "nodes" and "goals" arrays.'
          return
        }
        if (parsed.nodes.length > IMPORT_MAX_NODES) {
          importError.value = `Too many nodes in file (max ${IMPORT_MAX_NODES.toLocaleString()}).`
          return
        }
        if (parsed.goals.length > IMPORT_MAX_GOALS) {
          importError.value = `Too many goals in file (max ${IMPORT_MAX_GOALS.toLocaleString()}).`
          return
        }

        const errors: string[] = []
        const cleanNodes: import('@/models').OrgNode[] = []
        const cleanGoals: import('@/models').Goal[] = []
        const nodeIdSet = new Set<string>()
        const goalIdSet = new Set<string>()

        for (const raw of parsed.nodes) {
          if (typeof raw !== 'object' || raw === null) { errors.push('A node record is not an object.'); continue }
          const r = raw as Record<string, unknown>
          if (typeof r.id !== 'string' || !r.id.trim()) { errors.push('A node is missing a valid id.'); continue }
          const shortId = (r.id as string).slice(0, 8)
          if (nodeIdSet.has(r.id as string)) { errors.push(`Duplicate node id: ${shortId}.`); continue }
          if (r.parentId !== null && typeof r.parentId !== 'string') { errors.push(`Node ${shortId}: parentId must be a string or null.`); continue }
          if (typeof r.title !== 'string' || typeof r.ownerName !== 'string') { errors.push(`Node ${shortId}: title and ownerName must be strings.`); continue }
          const nodeFieldErrors = validateCreateNodeInput({
            title: r.title as string,
            ownerName: r.ownerName as string,
            roleLevel: r.roleLevel as RoleLevel,
            customRoleLabel: typeof r.customRoleLabel === 'string' ? r.customRoleLabel : undefined,
            parentId: (r.parentId as string | null) ?? null,
          })
          if (nodeFieldErrors.length > 0) { errors.push(`Node ${shortId}: ${nodeFieldErrors[0].message}`); continue }
          nodeIdSet.add(r.id as string)
          cleanNodes.push({
            id: r.id as string,
            parentId: (r.parentId as string | null) ?? null,
            title: sanitizer.sanitize(r.title as string),
            ownerName: sanitizer.sanitize(r.ownerName as string),
            roleLevel: r.roleLevel as RoleLevel,
            customRoleLabel: typeof r.customRoleLabel === 'string'
              ? sanitizer.sanitize(r.customRoleLabel)
              : undefined,
            createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
            updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
          })
        }

        for (const raw of parsed.goals) {
          if (typeof raw !== 'object' || raw === null) { errors.push('A goal record is not an object.'); continue }
          const r = raw as Record<string, unknown>
          if (typeof r.id !== 'string' || !r.id.trim()) { errors.push('A goal is missing a valid id.'); continue }
          const shortId = (r.id as string).slice(0, 8)
          if (goalIdSet.has(r.id as string)) { errors.push(`Duplicate goal id: ${shortId}.`); continue }
          if (typeof r.nodeId !== 'string' || !nodeIdSet.has(r.nodeId)) { errors.push(`Goal ${shortId}: nodeId references an unknown node.`); continue }
          if (typeof r.description !== 'string') { errors.push(`Goal ${shortId}: description must be a string.`); continue }
          if (typeof r.weight !== 'number' || typeof r.progress !== 'number') { errors.push(`Goal ${shortId}: weight and progress must be numbers.`); continue }
          if (r.sourceGoalId !== undefined && r.sourceGoalId !== null && typeof r.sourceGoalId !== 'string') {
            errors.push(`Goal ${shortId}: sourceGoalId must be a string or absent.`); continue
          }
          const goalFieldErrors = validateCreateGoalInput({
            nodeId: r.nodeId as string,
            type: r.type as GoalType,
            description: r.description as string,
            weight: r.weight as number,
            status: r.status as GoalStatus,
            sourceGoalId: typeof r.sourceGoalId === 'string' ? r.sourceGoalId : undefined,
          })
          if (goalFieldErrors.length > 0) { errors.push(`Goal ${shortId}: ${goalFieldErrors[0].message}`); continue }
          goalIdSet.add(r.id as string)
          cleanGoals.push({
            id: r.id as string,
            nodeId: r.nodeId as string,
            type: r.type as GoalType,
            description: sanitizer.sanitize(r.description as string),
            weight: r.weight as number,
            status: r.status as GoalStatus,
            progress: Math.min(100, Math.max(0, r.progress as number)),
            sourceGoalId: typeof r.sourceGoalId === 'string' ? r.sourceGoalId : undefined,
            createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
            updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
          })
        }

        if (errors.length > 0) {
          importError.value = `Import rejected — ${errors.length} invalid record(s). First error: ${errors[0]}`
          return
        }

        let importedLayout: ImportLayout | undefined
        const rawLayout = parsed.layout
        if (
          rawLayout &&
          typeof rawLayout === 'object' &&
          Array.isArray(rawLayout.sizes) &&
          Array.isArray(rawLayout.positions) &&
          Array.isArray(rawLayout.collapsed) &&
          Array.isArray(rawLayout.collapsedGoals)
        ) {
          importedLayout = rawLayout as ImportLayout
        }
        importPayload.value = { nodes: cleanNodes, goals: cleanGoals, layout: importedLayout }
      } catch {
        importError.value = 'Could not parse file as JSON.'
      }
      if (importFileInput.value) importFileInput.value.value = ''
    }
    reader.readAsText(file)
  }

  function confirmImport() {
    if (!importPayload.value) return
    snapshot()
    const { nodes: newNodes, goals: newGoals, layout: newLayout } = importPayload.value
    importPayload.value = null
    localStorage.setItem('irons-in-fire:nodes', JSON.stringify(newNodes))
    localStorage.setItem('irons-in-fire:goals', JSON.stringify(newGoals))
    nodeStore.$patch({ nodes: Object.fromEntries(newNodes.map(n => [n.id, n])) })
    goalStore.$patch({ goals: Object.fromEntries(newGoals.map(g => [g.id, g])) })
    if (newLayout) {
      try {
        layoutRefs.nodeSizes.value = new Map(newLayout.sizes)
        layoutRefs.nodeAbsPositions.value = new Map(newLayout.positions)
        layoutRefs.collapsedNodes.value = new Set(newLayout.collapsed)
        layoutRefs.collapsedGoalNodes.value = new Set(newLayout.collapsedGoals)
        saveLayout()
      } catch {
        resetLayout()
      }
    } else {
      resetLayout()
    }
    clearHistory()
  }

  function cancelImport() {
    importPayload.value = null
    importError.value = null
  }

  return {
    importFileInput,
    importPayload,
    importError,
    exportData,
    onImportFileChange,
    confirmImport,
    cancelImport,
  }
}

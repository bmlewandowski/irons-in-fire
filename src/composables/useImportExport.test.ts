/**
 * Tests for useImportExport composable, focusing on referential integrity
 * validation during import.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { useImportExport } from './useImportExport'
import type { OrgNode, Goal } from '@/models'

// In-memory localStorage stub
class MemoryStorage {
  private store: Record<string, string> = {}
  get length(): number { return Object.keys(this.store).length }
  key(n: number): string | null { return Object.keys(this.store)[n] ?? null }
  getItem(key: string): string | null { return key in this.store ? this.store[key] : null }
  setItem(key: string, value: string): void { this.store[String(key)] = String(value) }
  removeItem(key: string): void { delete this.store[key] }
  clear(): void { this.store = {} }
}

describe('useImportExport - referential integrity validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('localStorage', new MemoryStorage())
  })

  function createComposable() {
    const layoutRefs = {
      nodeSizes: ref(new Map<string, { width: number; height: number }>()),
      nodeAbsPositions: ref(new Map<string, { x: number; y: number }>()),
      collapsedNodes: ref(new Set<string>()),
      collapsedGoalNodes: ref(new Set<string>()),
    }
    const saveLayout = () => {}
    const resetLayout = () => {}
    const snapshot = () => {}
    const clearHistory = () => {}

    return useImportExport(layoutRefs, saveLayout, resetLayout, snapshot, clearHistory)
  }

  function makeNode(overrides: Partial<OrgNode> = {}): OrgNode {
    return {
      id: 'n1',
      parentId: null,
      title: 'Engineering',
      ownerName: 'Alice',
      roleLevel: 'Director',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }
  }

  function makeGoal(overrides: Partial<Goal> = {}): Goal {
    return {
      id: 'g1',
      nodeId: 'n1',
      type: 'Root',
      description: 'Increase revenue',
      weight: 1,
      status: 'Active',
      progress: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }
  }

  function createImportFile(nodes: OrgNode[], goals: Goal[]): File {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      nodes,
      goals,
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    return new File([blob], 'test-import.json', { type: 'application/json' })
  }

  it('rejects node with parentId referencing non-existent node', async () => {
    const { onImportFileChange, importError, importPayload } = createComposable()

    const nodes = [
      makeNode({ id: 'n1', parentId: 'non-existent' }),
    ]
    const file = createImportFile(nodes, [])

    const event = {
      target: { files: [file] },
    } as unknown as Event

    await new Promise<void>((resolve) => {
      onImportFileChange(event)
      setTimeout(() => {
        expect(importError.value).toContain('parentId references unknown node')
        expect(importPayload.value).toBeNull()
        resolve()
      }, 100)
    })
  })

  it('rejects node tree with cycle', async () => {
    const { onImportFileChange, importError, importPayload } = createComposable()

    const nodes = [
      makeNode({ id: 'n1', parentId: 'n2' }),
      makeNode({ id: 'n2', parentId: 'n3' }),
      makeNode({ id: 'n3', parentId: 'n1' }), // Creates cycle
    ]
    const file = createImportFile(nodes, [])

    const event = {
      target: { files: [file] },
    } as unknown as Event

    await new Promise<void>((resolve) => {
      onImportFileChange(event)
      setTimeout(() => {
        expect(importError.value).toContain('parentId chain contains a cycle')
        expect(importPayload.value).toBeNull()
        resolve()
      }, 100)
    })
  })

  it('accepts valid parent-child relationships', async () => {
    const { onImportFileChange, importError, importPayload } = createComposable()

    const nodes = [
      makeNode({ id: 'n1', parentId: null }),
      makeNode({ id: 'n2', parentId: 'n1', title: 'HR', ownerName: 'Bob' }),
      makeNode({ id: 'n3', parentId: 'n2', title: 'Recruiting', ownerName: 'Carol' }),
    ]
    const file = createImportFile(nodes, [])

    const event = {
      target: { files: [file] },
    } as unknown as Event

    await new Promise<void>((resolve) => {
      onImportFileChange(event)
      setTimeout(() => {
        expect(importError.value).toBeNull()
        expect(importPayload.value).not.toBeNull()
        expect(importPayload.value?.nodes).toHaveLength(3)
        resolve()
      }, 100)
    })
  })

  it('rejects goal with sourceGoalId referencing non-existent goal', async () => {
    const { onImportFileChange, importError, importPayload } = createComposable()

    const nodes = [makeNode({ id: 'n1' })]
    const goals = [
      makeGoal({ id: 'g1', nodeId: 'n1', type: 'Refined', sourceGoalId: 'non-existent' }),
    ]
    const file = createImportFile(nodes, goals)

    const event = {
      target: { files: [file] },
    } as unknown as Event

    await new Promise<void>((resolve) => {
      onImportFileChange(event)
      setTimeout(() => {
        expect(importError.value).toContain('sourceGoalId references unknown goal')
        expect(importPayload.value).toBeNull()
        resolve()
      }, 100)
    })
  })

  it('rejects Refined goal without sourceGoalId', async () => {
    const { onImportFileChange, importError, importPayload } = createComposable()

    const nodes = [makeNode({ id: 'n1' })]
    const goals = [
      makeGoal({ id: 'g1', nodeId: 'n1', type: 'Refined', sourceGoalId: undefined }),
    ]
    const file = createImportFile(nodes, goals)

    const event = {
      target: { files: [file] },
    } as unknown as Event

    await new Promise<void>((resolve) => {
      onImportFileChange(event)
      setTimeout(() => {
        expect(importError.value).toContain('Refined goals must have a sourceGoalId')
        expect(importPayload.value).toBeNull()
        resolve()
      }, 100)
    })
  })

  it('rejects Root goal with sourceGoalId', async () => {
    const { onImportFileChange, importError, importPayload } = createComposable()

    const nodes = [makeNode({ id: 'n1' })]
    const goals = [
      makeGoal({ id: 'g1', nodeId: 'n1', type: 'Root' }),
      makeGoal({ id: 'g2', nodeId: 'n1', type: 'Root', sourceGoalId: 'g1' }),
    ]
    const file = createImportFile(nodes, goals)

    const event = {
      target: { files: [file] },
    } as unknown as Event

    await new Promise<void>((resolve) => {
      onImportFileChange(event)
      setTimeout(() => {
        expect(importError.value).toContain('Root goals should not have a sourceGoalId')
        expect(importPayload.value).toBeNull()
        resolve()
      }, 100)
    })
  })

  it('rejects goal chain with cycle', async () => {
    const { onImportFileChange, importError, importPayload } = createComposable()

    const nodes = [makeNode({ id: 'n1' })]
    const goals = [
      makeGoal({ id: 'g1', nodeId: 'n1', type: 'Refined', sourceGoalId: 'g2' }),
      makeGoal({ id: 'g2', nodeId: 'n1', type: 'Refined', sourceGoalId: 'g3' }),
      makeGoal({ id: 'g3', nodeId: 'n1', type: 'Refined', sourceGoalId: 'g1' }), // Cycle
    ]
    const file = createImportFile(nodes, goals)

    const event = {
      target: { files: [file] },
    } as unknown as Event

    await new Promise<void>((resolve) => {
      onImportFileChange(event)
      setTimeout(() => {
        expect(importError.value).toContain('sourceGoalId chain contains a cycle')
        expect(importPayload.value).toBeNull()
        resolve()
      }, 100)
    })
  })

  it('accepts valid goal hierarchy', async () => {
    const { onImportFileChange, importError, importPayload } = createComposable()

    const nodes = [
      makeNode({ id: 'n1' }),
      makeNode({ id: 'n2', parentId: 'n1', title: 'Frontend', ownerName: 'Bob' }),
    ]
    const goals = [
      makeGoal({ id: 'g1', nodeId: 'n1', type: 'Root' }),
      makeGoal({ 
        id: 'g2', 
        nodeId: 'n2', 
        type: 'Refined', 
        sourceGoalId: 'g1',
        description: 'Frontend goal'
      }),
    ]
    const file = createImportFile(nodes, goals)

    const event = {
      target: { files: [file] },
    } as unknown as Event

    await new Promise<void>((resolve) => {
      onImportFileChange(event)
      setTimeout(() => {
        expect(importError.value).toBeNull()
        expect(importPayload.value).not.toBeNull()
        expect(importPayload.value?.nodes).toHaveLength(2)
        expect(importPayload.value?.goals).toHaveLength(2)
        resolve()
      }, 100)
    })
  })
})

import type { OrgNode } from '@/models/OrgNode'
import type { AppError } from '@/models/AppError'
import type { Result } from '@/models/Result'
import type { PersistenceAdapter } from '@/adapters/PersistenceAdapter'
import { AdapterError } from '@/adapters/PersistenceAdapter'
import type { useNodeStore } from '@/stores/nodeStore'
import type { useGoalStore } from '@/stores/goalStore'
import { sanitizer } from './Sanitizer'
import {
  validateCreateNodeInput,
  validateUpdateNodeInput,
} from './ValidationService'
import type { CreateNodeInput, UpdateNodeInput } from './ValidationService'

/**
 * Business-logic service for OrgNode operations.
 * Validates, sanitizes, persists, and updates the Pinia store.
 *
 * Requirements: 1.1–1.8, 3.1–3.7
 */
export class NodeService {
  constructor(
    private adapter: PersistenceAdapter,
    private nodeStore: ReturnType<typeof useNodeStore>,
    private goalStore: ReturnType<typeof useGoalStore>,
  ) {}

  // -------------------------------------------------------------------------
  // createNode
  // -------------------------------------------------------------------------

  /**
   * Creates a new OrgNode.
   *
   * 1. Validates input fields.
   * 2. Sanitizes text fields.
   * 3. Verifies parent exists (if parentId provided).
   * 4. Persists via adapter.
   * 5. Updates nodeStore.
   *
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8
   */
  async createNode(input: CreateNodeInput): Promise<Result<OrgNode, AppError>> {
    // Step 1: validate
    const errors = validateCreateNodeInput(input)
    if (errors.length > 0) {
      return { ok: false, error: errors[0] }
    }

    // Step 2: sanitize text fields
    const titleResult = sanitizer.sanitizeAndValidate(input.title)
    if (!titleResult.ok) return titleResult

    const ownerResult = sanitizer.sanitizeAndValidate(input.ownerName)
    if (!ownerResult.ok) return ownerResult

    let sanitizedCustomRoleLabel: string | undefined
    if (input.customRoleLabel !== undefined) {
      const labelResult = sanitizer.sanitizeAndValidate(input.customRoleLabel)
      if (!labelResult.ok) return labelResult
      sanitizedCustomRoleLabel = labelResult.value
    }

    // Step 3: verify parent exists
    if (input.parentId != null) {
      const parent = await this.adapter.readNodeById(input.parentId)
      if (parent === null) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Parent node ${input.parentId} does not exist.`,
          },
        }
      }
    }

    // Step 4: build and persist the node
    const now = new Date().toISOString()
    const node: OrgNode = {
      id: crypto.randomUUID(),
      parentId: input.parentId ?? null,
      title: titleResult.value,
      ownerName: ownerResult.value,
      roleLevel: input.roleLevel,
      ...(sanitizedCustomRoleLabel !== undefined
        ? { customRoleLabel: sanitizedCustomRoleLabel }
        : {}),
      createdAt: now,
      updatedAt: now,
    }

    try {
      const persisted = await this.adapter.createNode(node)

      // Step 5: update store
      this.nodeStore.$patch((state) => {
        state.nodes[persisted.id] = persisted
      })

      return { ok: true, value: persisted }
    } catch (err) {
      if (err instanceof AdapterError) {
        return {
          ok: false,
          error: {
            code: 'ADAPTER_ERROR',
            message: err.message,
          },
        }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // updateNode
  // -------------------------------------------------------------------------

  /**
   * Updates an existing OrgNode's mutable fields.
   *
   * Requirements: 1.4, 1.7, 1.8
   */
  async updateNode(id: string, input: UpdateNodeInput): Promise<Result<OrgNode, AppError>> {
    // Step 1: validate
    const errors = validateUpdateNodeInput(input)
    if (errors.length > 0) {
      return { ok: false, error: errors[0] }
    }

    // Step 2: sanitize text fields present in input
    const sanitizedPatch: Partial<OrgNode> = {}

    if (input.title !== undefined) {
      const r = sanitizer.sanitizeAndValidate(input.title)
      if (!r.ok) return r
      sanitizedPatch.title = r.value
    }

    if (input.ownerName !== undefined) {
      const r = sanitizer.sanitizeAndValidate(input.ownerName)
      if (!r.ok) return r
      sanitizedPatch.ownerName = r.value
    }

    if (input.roleLevel !== undefined) {
      sanitizedPatch.roleLevel = input.roleLevel
    }

    if (input.customRoleLabel !== undefined) {
      const r = sanitizer.sanitizeAndValidate(input.customRoleLabel)
      if (!r.ok) return r
      sanitizedPatch.customRoleLabel = r.value
    }

    sanitizedPatch.updatedAt = new Date().toISOString()

    // Step 3: persist
    try {
      const updated = await this.adapter.updateNode(id, sanitizedPatch)

      // Step 4: update store
      this.nodeStore.$patch((state) => {
        state.nodes[id] = updated
      })

      return { ok: true, value: updated }
    } catch (err) {
      if (err instanceof AdapterError) {
        const isNotFound = err.message.toLowerCase().includes('not found')
        return {
          ok: false,
          error: {
            code: isNotFound ? 'NOT_FOUND' : 'ADAPTER_ERROR',
            message: err.message,
          },
        }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // deleteNode
  // -------------------------------------------------------------------------

  /**
   * Deletes a node and its entire subtree, including all associated goals.
   *
   * Requirements: 1.5
   */
  async deleteNode(id: string): Promise<Result<void, AppError>> {
    // Step 1: check node exists
    if (!this.nodeStore.nodes[id]) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Node ${id} does not exist.`,
        },
      }
    }

    // Step 2: collect full subtree
    const subtree = this.nodeStore.subtreeOf(id)

    // Step 3: collect all goals for every node in the subtree
    const goalsToDelete = subtree.flatMap((node) =>
      this.goalStore.goalsForNode(node.id),
    )

    try {
      // Step 4a: delete all goals from adapter
      for (const goal of goalsToDelete) {
        await this.adapter.deleteGoal(goal.id)
      }

      // Step 4b: delete all nodes from adapter (children before parents to
      // avoid FK issues in real adapters; BFS order from subtreeOf gives
      // parent-first, so we reverse)
      for (const node of [...subtree].reverse()) {
        await this.adapter.deleteNode(node.id)
      }

      // Step 5: update stores
      this.goalStore.$patch((state) => {
        for (const goal of goalsToDelete) {
          delete state.goals[goal.id]
        }
      })

      this.nodeStore.$patch((state) => {
        for (const node of subtree) {
          delete state.nodes[node.id]
        }
      })

      return { ok: true, value: undefined }
    } catch (err) {
      if (err instanceof AdapterError) {
        return {
          ok: false,
          error: {
            code: 'ADAPTER_ERROR',
            message: err.message,
          },
        }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // reparentNode
  // -------------------------------------------------------------------------

  /**
   * Moves a node to a new parent, with cycle detection.
   *
   * Requirements: 3.2, 3.3, 3.5, 3.6
   */
  async reparentNode(nodeId: string, newParentId: string): Promise<Result<void, AppError>> {
    // Step 1: check nodeId exists
    if (!this.nodeStore.nodes[nodeId]) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Node ${nodeId} does not exist.`,
        },
      }
    }

    // Step 2: check newParentId exists
    if (!this.nodeStore.nodes[newParentId]) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Node ${newParentId} does not exist.`,
        },
      }
    }

    // Step 3: cycle detection — walk ancestors of newParentId
    // If nodeId appears anywhere in that chain (including newParentId itself),
    // the move would create a cycle.
    let cursor: string | null = newParentId
    while (cursor !== null) {
      if (cursor === nodeId) {
        return {
          ok: false,
          error: {
            code: 'CYCLE_DETECTED',
            message: 'Cannot move a node to one of its own descendants.',
          },
        }
      }
      cursor = this.nodeStore.nodes[cursor]?.parentId ?? null
    }

    // Step 4: persist
    try {
      await this.adapter.updateNode(nodeId, { parentId: newParentId })

      // Step 5: update store
      this.nodeStore.$patch((state) => {
        state.nodes[nodeId] = { ...state.nodes[nodeId], parentId: newParentId }
      })

      return { ok: true, value: undefined }
    } catch (err) {
      if (err instanceof AdapterError) {
        return {
          ok: false,
          error: {
            code: 'ADAPTER_ERROR',
            message: err.message,
          },
        }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // promoteToRoot
  // -------------------------------------------------------------------------

  /**
   * Detaches a node from its parent, making it a root-level node.
   */
  async promoteToRoot(nodeId: string): Promise<Result<void, AppError>> {
    if (!this.nodeStore.nodes[nodeId]) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Node ${nodeId} does not exist.` },
      }
    }
    try {
      await this.adapter.updateNode(nodeId, { parentId: null })
      this.nodeStore.$patch((state) => {
        state.nodes[nodeId] = { ...state.nodes[nodeId], parentId: null }
      })
      return { ok: true, value: undefined }
    } catch (err) {
      if (err instanceof AdapterError) {
        return {
          ok: false,
          error: { code: 'ADAPTER_ERROR', message: err.message },
        }
      }
      throw err
    }
  }
}

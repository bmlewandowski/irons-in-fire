import type { Goal } from '@/models/Goal'
import type { OrgNode } from '@/models/OrgNode'
import { AdapterError } from './PersistenceAdapter'
import type { PersistenceAdapter } from './PersistenceAdapter'

/**
 * PersistenceAdapter that delegates all operations to a REST API.
 *
 * The base URL is passed in via the constructor (typically sourced from
 * `import.meta.env.VITE_API_URL` by the adapter factory).
 *
 * Endpoint conventions:
 *   GET    {baseUrl}/nodes          → readAllNodes
 *   GET    {baseUrl}/nodes/{id}     → readNodeById  (null on 404)
 *   POST   {baseUrl}/nodes          → createNode
 *   PATCH  {baseUrl}/nodes/{id}     → updateNode
 *   DELETE {baseUrl}/nodes/{id}     → deleteNode
 *   (same pattern for /goals)
 *
 * HTTP errors (non-2xx) reject with AdapterError including the status code.
 *
 * Requirements: 7.3
 */
export class ApiAdapter implements PersistenceAdapter {
  constructor(private readonly baseUrl: string) {}

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Performs a fetch request and returns the parsed JSON body.
   * Throws AdapterError for network failures or non-2xx responses.
   * Returns null when `allowNull` is true and the response is 404.
   */
  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    allowNull = false,
  ): Promise<T | null> {
    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (err) {
      throw new AdapterError(`Network error: ${String(err)}`)
    }

    if (allowNull && response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new AdapterError(
        `HTTP ${response.status} ${response.statusText} — ${method} ${url}`,
      )
    }

    // DELETE returns 204 No Content — nothing to parse
    if (response.status === 204) {
      return null
    }

    try {
      return (await response.json()) as T
    } catch (err) {
      throw new AdapterError(`Failed to parse response JSON: ${String(err)}`)
    }
  }

  // -------------------------------------------------------------------------
  // Nodes
  // -------------------------------------------------------------------------

  async readAllNodes(): Promise<OrgNode[]> {
    const result = await this.request<OrgNode[]>('GET', `${this.baseUrl}/nodes`)
    return result ?? []
  }

  async readNodeById(id: string): Promise<OrgNode | null> {
    return this.request<OrgNode>('GET', `${this.baseUrl}/nodes/${id}`, undefined, true)
  }

  async createNode(node: OrgNode): Promise<OrgNode> {
    const result = await this.request<OrgNode>('POST', `${this.baseUrl}/nodes`, node)
    if (!result) throw new AdapterError('createNode: empty response from server')
    return result
  }

  async updateNode(id: string, patch: Partial<OrgNode>): Promise<OrgNode> {
    const result = await this.request<OrgNode>('PATCH', `${this.baseUrl}/nodes/${id}`, patch)
    if (!result) throw new AdapterError('updateNode: empty response from server')
    return result
  }

  async deleteNode(id: string): Promise<void> {
    await this.request<void>('DELETE', `${this.baseUrl}/nodes/${id}`)
  }

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------

  async readAllGoals(): Promise<Goal[]> {
    const result = await this.request<Goal[]>('GET', `${this.baseUrl}/goals`)
    return result ?? []
  }

  async readGoalById(id: string): Promise<Goal | null> {
    return this.request<Goal>('GET', `${this.baseUrl}/goals/${id}`, undefined, true)
  }

  async createGoal(goal: Goal): Promise<Goal> {
    const result = await this.request<Goal>('POST', `${this.baseUrl}/goals`, goal)
    if (!result) throw new AdapterError('createGoal: empty response from server')
    return result
  }

  async updateGoal(id: string, patch: Partial<Goal>): Promise<Goal> {
    const result = await this.request<Goal>('PATCH', `${this.baseUrl}/goals/${id}`, patch)
    if (!result) throw new AdapterError('updateGoal: empty response from server')
    return result
  }

  async deleteGoal(id: string): Promise<void> {
    await this.request<void>('DELETE', `${this.baseUrl}/goals/${id}`)
  }
}

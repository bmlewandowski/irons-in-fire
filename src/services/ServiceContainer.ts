/**
 * Service Container - Dependency injection for services
 * 
 * Provides a cleaner alternative to module-level service variables.
 * Services are provided at app level and accessed via inject/provide.
 */

import { inject, type InjectionKey, type App } from 'vue'
import type { NodeService } from '@/services/NodeService'
import type { GoalService } from '@/services/GoalService'
import type { ProgressService } from '@/services/ProgressService'

// Injection keys
export const NodeServiceKey: InjectionKey<NodeService> = Symbol('NodeService')
export const GoalServiceKey: InjectionKey<GoalService> = Symbol('GoalService')
export const ProgressServiceKey: InjectionKey<ProgressService> = Symbol('ProgressService')

export interface ServiceContainer {
  nodeService: NodeService
  goalService: GoalService
  progressService: ProgressService
}

/**
 * Install services into Vue app for provide/inject
 */
export function installServices(app: App, services: ServiceContainer): void {
  app.provide(NodeServiceKey, services.nodeService)
  app.provide(GoalServiceKey, services.goalService)
  app.provide(ProgressServiceKey, services.progressService)
}

/**
 * Composable to access services from anywhere in the app
 */
export function useServices() {
  const nodeService = inject(NodeServiceKey)
  const goalService = inject(GoalServiceKey)
  const progressService = inject(ProgressServiceKey)

  if (!nodeService || !goalService || !progressService) {
    throw new Error(
      'Services not provided. Call installServices(app, services) in main.ts before mounting.'
    )
  }

  return {
    nodeService,
    goalService,
    progressService,
  }
}

/**
 * Optional: Access individual service (useful when you only need one)
 */
export function useNodeService(): NodeService {
  const service = inject(NodeServiceKey)
  if (!service) {
    throw new Error('NodeService not provided')
  }
  return service
}

export function useGoalService(): GoalService {
  const service = inject(GoalServiceKey)
  if (!service) {
    throw new Error('GoalService not provided')
  }
  return service
}

export function useProgressService(): ProgressService {
  const service = inject(ProgressServiceKey)
  if (!service) {
    throw new Error('ProgressService not provided')
  }
  return service
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from './uiStore'
import type { Notification } from '@/models'
import type { ViewportRect } from '@/models'

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    nodeId: 'node-1',
    message: 'Goal updated',
    sourceGoalId: 'g1',
    read: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('uiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ── drillDown ────────────────────────────────────────────────────────────

  describe('drillDown', () => {
    it('starts with null drillDownGoalId', () => {
      const store = useUiStore()
      expect(store.drillDownGoalId).toBeNull()
    })
    it('activateDrillDown sets the goalId', () => {
      const store = useUiStore()
      store.activateDrillDown('g1')
      expect(store.drillDownGoalId).toBe('g1')
    })
    it('activateDrillDown replaces an existing drillDownGoalId', () => {
      const store = useUiStore()
      store.activateDrillDown('g1')
      store.activateDrillDown('g2')
      expect(store.drillDownGoalId).toBe('g2')
    })
    it('deactivateDrillDown resets to null', () => {
      const store = useUiStore()
      store.activateDrillDown('g1')
      store.deactivateDrillDown()
      expect(store.drillDownGoalId).toBeNull()
    })
  })

  // ── notifications ────────────────────────────────────────────────────────

  describe('notifications', () => {
    it('starts with an empty notifications list', () => {
      const store = useUiStore()
      expect(store.notifications).toHaveLength(0)
    })
    it('addNotification appends a notification', () => {
      const store = useUiStore()
      store.addNotification(makeNotification({ id: 'n1' }))
      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].id).toBe('n1')
    })
    it('addNotification appends multiple notifications independently', () => {
      const store = useUiStore()
      store.addNotification(makeNotification({ id: 'n1' }))
      store.addNotification(makeNotification({ id: 'n2', message: 'Second' }))
      expect(store.notifications).toHaveLength(2)
    })
    it('addNotification auto-dismisses after exactly 5 seconds', () => {
      const store = useUiStore()
      store.addNotification(makeNotification({ id: 'n1' }))
      vi.advanceTimersByTime(5000)
      expect(store.notifications).toHaveLength(0)
    })
    it('addNotification does not auto-dismiss before 5 seconds', () => {
      const store = useUiStore()
      store.addNotification(makeNotification({ id: 'n1' }))
      vi.advanceTimersByTime(4999)
      expect(store.notifications).toHaveLength(1)
    })
    it('dismissNotification removes by id', () => {
      const store = useUiStore()
      store.addNotification(makeNotification({ id: 'n1' }))
      store.addNotification(makeNotification({ id: 'n2', message: 'Other' }))
      store.dismissNotification('n1')
      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].id).toBe('n2')
    })
    it('dismissNotification is a no-op for an unknown id', () => {
      const store = useUiStore()
      store.addNotification(makeNotification({ id: 'n1' }))
      store.dismissNotification('ghost')
      expect(store.notifications).toHaveLength(1)
    })
  })

  // ── viewport ─────────────────────────────────────────────────────────────

  describe('viewport', () => {
    it('starts with a zeroed rect', () => {
      const store = useUiStore()
      expect(store.viewport).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    })
    it('updateViewport replaces the rect', () => {
      const store = useUiStore()
      const rect: ViewportRect = { x: 10, y: 20, width: 800, height: 600 }
      store.updateViewport(rect)
      expect(store.viewport).toEqual(rect)
    })
    it('updateViewport overwrites a previous rect', () => {
      const store = useUiStore()
      store.updateViewport({ x: 1, y: 2, width: 3, height: 4 })
      store.updateViewport({ x: 100, y: 200, width: 1920, height: 1080 })
      expect(store.viewport).toEqual({ x: 100, y: 200, width: 1920, height: 1080 })
    })
  })
})

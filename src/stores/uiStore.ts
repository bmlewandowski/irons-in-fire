import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Notification, ViewportRect } from '@/models'

/**
 * Pinia store for UI state: drill-down mode, notifications, and viewport.
 * All actions are fully implemented — no service dependency.
 * Requirements: 8.3, 8.4, 6.3
 */
export const useUiStore = defineStore('ui', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const drillDownGoalId = ref<string | null>(null)
  const notifications = ref<Notification[]>([])
  const viewport = ref<ViewportRect>({ x: 0, y: 0, width: 0, height: 0 })

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Enter drill-down mode for the given goal. */
  function activateDrillDown(goalId: string): void {
    drillDownGoalId.value = goalId
  }

  /** Exit drill-down mode and restore the full tree view. */
  function deactivateDrillDown(): void {
    drillDownGoalId.value = null
  }

  /** Push a new notification into the list. */
  function addNotification(notification: Notification): void {
    notifications.value.push(notification)
  }

  /** Remove a notification by its ID. */
  function dismissNotification(id: string): void {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  /** Replace the current viewport rectangle. */
  function updateViewport(rect: ViewportRect): void {
    viewport.value = rect
  }

  return {
    // state
    drillDownGoalId,
    notifications,
    viewport,
    // actions
    activateDrillDown,
    deactivateDrillDown,
    addNotification,
    dismissNotification,
    updateViewport,
  }
})

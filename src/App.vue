<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUiStore } from '@/stores/uiStore'
import { useNodeStore } from '@/stores/nodeStore'
import OrgChartContainer from '@/components/OrgChartContainer.vue'
import ExecutiveDashboard from '@/components/ExecutiveDashboard.vue'

const uiStore = useUiStore()
const nodeStore = useNodeStore()

type Tab = 'orgchart' | 'dashboard'
const activeTab = ref<Tab>('orgchart')

const orgChartRef = ref<InstanceType<typeof OrgChartContainer> | null>(null)
const hasNodes = computed(() => Object.keys(nodeStore.nodes).length > 0)
</script>

<template>
  <div id="app-root">
    <header class="app-header">
      <h1>Irons in Fire</h1>
      <nav class="tab-bar" role="tablist" aria-label="Main navigation">
        <button
          role="tab"
          :aria-selected="activeTab === 'orgchart'"
          :class="['tab-btn', { active: activeTab === 'orgchart' }]"
          @click="activeTab = 'orgchart'"
        >Org Chart</button>
        <button
          role="tab"
          :aria-selected="activeTab === 'dashboard'"
          :class="['tab-btn', { active: activeTab === 'dashboard' }]"
          @click="activeTab = 'dashboard'"
        >Dashboard</button>
      </nav>

      <!-- Org chart toolbar (right-justified) -->
      <div v-if="activeTab === 'orgchart'" class="header-toolbar">
        <button v-if="hasNodes" class="header-btn" aria-label="Go to home position" @click="orgChartRef?.goHome()">
          ⌂ Home
        </button>
        <button v-if="hasNodes" class="header-btn" aria-label="Zoom in" @click="orgChartRef?.zoomIn()">+ Zoom</button>
        <button v-if="hasNodes" class="header-btn" aria-label="Zoom out" @click="orgChartRef?.zoomOut()">− Zoom</button>
        <div v-if="hasNodes" class="header-divider"></div>
        <button class="header-btn" aria-label="Add node" @click="orgChartRef?.openCreateRoot()">
          + Add Node
        </button>
        <button v-if="hasNodes" class="header-btn" aria-label="Clean up layout" @click="orgChartRef?.relayoutNodes()">
          ⬜ Clean Up
        </button>
        <button
          v-if="orgChartRef?.canUndo"
          class="header-btn"
          aria-label="Undo last action (Ctrl+Z)"
          @click="orgChartRef?.undo()"
        >↩ Undo</button>

        <button
          v-if="hasNodes"
          class="header-btn"
          aria-label="Collapse all goal cards"
          @click="orgChartRef?.collapseAllGoals()"
        >Collapse All</button>
        <button
          v-if="hasNodes"
          class="header-btn"
          aria-label="Expand all goal cards"
          @click="orgChartRef?.expandAllGoals()"
        >Expand All</button>
        <button v-if="hasNodes" class="header-btn header-btn--muted" aria-label="Reset layout" @click="orgChartRef && (orgChartRef.showResetConfirm = true)">
          ↺ Reset Layout
        </button>
        <div class="header-divider"></div>
        <button class="header-btn" aria-label="Export data as JSON" @click="orgChartRef?.exportData()">
          ↓ Export
        </button>
        <button class="header-btn" aria-label="Import data from JSON" @click="orgChartRef?.triggerImport()">
          ↑ Import
        </button>
      </div>
    </header>

    <main class="app-main">
      <!-- Executive Dashboard tab -->
      <section
        v-show="activeTab === 'dashboard'"
        class="tab-section dashboard-section"
        role="tabpanel"
        aria-label="Executive Dashboard"
      >
        <ExecutiveDashboard />
      </section>

      <!-- Org Chart tab -->
      <section
        v-show="activeTab === 'orgchart'"
        class="tab-section chart-section"
        role="tabpanel"
        aria-label="Organization Chart"
      >
        <OrgChartContainer ref="orgChartRef" />
      </section>
    </main>

    <!-- Toast notifications -->
    <div
      class="notifications-container"
      aria-live="polite"
      aria-label="Notifications"
      role="status"
    >
      <div
        v-for="notification in uiStore.notifications"
        :key="notification.id"
        class="notification-toast"
        :class="{ unread: !notification.read }"
        role="alert"
      >
        <span class="notification-message">{{ notification.message }}</span>
        <button
          class="notification-dismiss"
          :aria-label="`Dismiss notification: ${notification.message}`"
          @click="uiStore.dismissNotification(notification.id)"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
#app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  font-family: sans-serif;
}

.app-header {
  padding: 0.25rem 1.5rem;
  min-height: 3rem;
  background: #1a1a2e;
  color: #fff;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.app-header h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  white-space: nowrap;
}

.tab-bar {
  display: flex;
  gap: 0;
}

.header-toolbar {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  row-gap: 4px;
}

.header-btn {
  padding: 5px 12px;
  height: 2rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.header-btn--muted {
  color: rgba(255, 255, 255, 0.65);
  border-color: rgba(255, 255, 255, 0.15);
}

.header-btn--muted:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}

.header-divider {
  width: 1px;
  height: 1.25rem;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
}

.tab-btn {
  padding: 0 1.25rem;
  height: 3rem;
  background: none;
  border: none;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  border-bottom: 3px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  color: rgba(255,255,255,0.9);
}

.tab-btn.active {
  color: #fff;
  border-bottom-color: #6ea8fe;
}

.app-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.tab-section {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.dashboard-section {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.chart-section {
  overflow: hidden;
}

.notifications-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 2000;
  max-width: 360px;
}

.notification-toast {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  font-size: 0.875rem;
}

.notification-toast.unread {
  border-left: 3px solid #0d6efd;
}

.notification-message {
  flex: 1;
  color: #212529;
}

.notification-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1;
  flex-shrink: 0;
}

.notification-dismiss:hover {
  color: #212529;
}
</style>

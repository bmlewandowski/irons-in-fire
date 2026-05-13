import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { createAdapter, ConfigurationError } from '@/adapters'
import { NodeService, GoalService, ProgressService } from '@/services'
import { setNodeService } from '@/stores/nodeStore'
import { setGoalService } from '@/stores/goalStore'
import { useNodeStore } from '@/stores/nodeStore'
import { useGoalStore } from '@/stores/goalStore'
import { useUiStore } from '@/stores/uiStore'

// 1. Create adapter (may throw ConfigurationError)
let adapter
try {
  adapter = createAdapter()
} catch (err) {
  if (err instanceof ConfigurationError) {
    document.body.innerHTML = `
      <div style="padding:2rem;font-family:sans-serif;color:#c00">
        <h1>Configuration Error</h1>
        <p>${err.message}</p>
        <p>Set the <code>VITE_PERSISTENCE_ADAPTER</code> environment variable to <code>local</code> or <code>api</code>.</p>
      </div>
    `
    throw err  // prevent further execution
  }
  throw err
}

// 2. Create Pinia and app
const pinia = createPinia()
const app = createApp(App)
app.use(pinia)

// 3. Get store instances (must be after pinia is installed)
const nodeStore = useNodeStore()
const goalStore = useGoalStore()
const uiStore = useUiStore()

// 4. Instantiate services with DI
const progressService = new ProgressService(goalStore)
const nodeService = new NodeService(adapter, nodeStore, goalStore)
const goalService = new GoalService(adapter, nodeStore, goalStore, uiStore, progressService)

// 5. Wire services into stores
setNodeService(nodeService)
setGoalService(goalService)

// 6. Mount app
app.mount('#app')

// 7. Load persisted data into stores
;(async () => {
  try {
    const [allNodes, allGoals] = await Promise.all([
      adapter.readAllNodes(),
      adapter.readAllGoals(),
    ])
    nodeStore.$patch({
      nodes: Object.fromEntries(allNodes.map((n) => [n.id, n])),
    })
    goalStore.$patch({
      goals: Object.fromEntries(allGoals.map((g) => [g.id, g])),
    })
  } catch (err) {
    uiStore.addNotification({
      id: crypto.randomUUID(),
      nodeId: '',
      message: 'Failed to load saved data.',
      sourceGoalId: '',
      read: false,
      createdAt: new Date().toISOString(),
    })
  }
})()

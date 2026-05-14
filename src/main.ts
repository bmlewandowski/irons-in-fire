import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { createAdapter, ConfigurationError } from '@/adapters'
import { NodeService, GoalService, ProgressService } from '@/services'
import { installServices } from '@/services/ServiceContainer'
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
    const errDiv = document.createElement('div')
    errDiv.style.cssText = 'padding:2rem;font-family:sans-serif;color:#c00'
    const errH1 = document.createElement('h1')
    errH1.textContent = 'Configuration Error'
    const errP1 = document.createElement('p')
    errP1.textContent = err.message
    const errP2 = document.createElement('p')
    errP2.textContent = 'Set the VITE_PERSISTENCE_ADAPTER environment variable to local or api.'
    errDiv.append(errH1, errP1, errP2)
    document.body.appendChild(errDiv)
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

// 5. Install services into Vue app (new pattern - provide/inject)
installServices(app, { nodeService, goalService, progressService })

// 6. Wire services into stores (legacy pattern - module variables)
setNodeService(nodeService)
setGoalService(goalService)

// 7. Mount app
app.mount('#app')

// 8. Load persisted data into stores
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

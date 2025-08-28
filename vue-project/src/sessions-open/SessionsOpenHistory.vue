<template>
  <div class="tabs-open-history-container">
    <div class="virtual-window">
      <div class="virtual-window-header">
        <div class="virtual-window-title">Windows Overview</div>
        <div class="virtual-window-description">Active, Selected & Recent tabs from all windows</div>
      </div>
      
      <!-- For Each Open Window-->
      <div class="window-content-virtual">
        <div 
          v-for="window in sessionsOpen"
          :key="`virtual-${window.id}`"
          class="virtual-window-section"
          :class="{ 'current-window-section': window.id === windowCurrentId }"
        >
          <div class="section-header">
            <div class="section-title">
              {{ `Window ${window.id}` }}
              <span class="virtual-section-count">({{ window.tabs.length }} tabs)</span>
            </div>
          </div>
          
          <!-- Line 1: Active & Selected tabs in browser -->
          <div class="tab-virtual-line">
            <div class="virtual-line-label">Active & Selected:</div>
            <div class="tabs-virtual-row">
              <div
                v-for="tab in getActiveAndSelectedTabs(window.id)"
                :key="`active-selected-${tab.id}`"
                v-memo="[tab.id, tab.isActive, tab.isLastActive, tab.isBrowserSelected, tab.isUiSelected, tab.title, tab.favIconUrl]"
                class="tab-item-virtual"
                :class="{
                  'browser-active-tab': tab.isActive,
                  'browser-last-active-tab': tab.isLastActive,
                  'browser-selected-tab': tab.isBrowserSelected,
                  'ui-selected-tab': tab.isUiSelected,
                }"
                :title="`${tab.title || 'No title'}\n${tab.url}`"
                @click="handleActiveOrSelectedTabClick(tab)"
                @contextmenu="(e) => showContextMenu(e, tab)"
              >
                <img
                  :src="tab.favIconUrl || defaultIcon" 
                  :alt="tab.title || 'Tab icon'"
                  class="tab-virtual-icon"
                  @error="(e) => e.target.src = defaultIcon"
                />
                <span class="tab-virtual-title">{{ tab.title || 'Untitled' }}</span>
              </div>
            </div>
          </div>

          <!-- Line 2: Recent tabs -->
          <div class="tab-virtual-line">
            <div class="virtual-line-label">Recent:</div>
            <div class="tabs-virtual-row">
              <div
                v-for="tab in getRecentTabs(window.id)"
                :key="`recent-${tab.id}`"
                v-memo="[tab.id, tab.title, tab.favIconUrl]"
                class="tab-item-virtual virtual-recent-tab"
                :title="`${tab.title || 'No title'}\n${tab.url}`"
                @click="onTabRecentClick(tab)"
                @contextmenu="(e) => showContextMenu(e, tab)"
              >
                <img 
                  :src="tab.favIconUrl || defaultIcon" 
                  :alt="tab.title || 'Tab icon'"
                  class="tab-virtual-icon"
                  @error="(e) => e.target.src = defaultIcon"
                />
                <span class="tab-virtual-title">{{ tab.title || 'Untitled' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onUpdated, watch } from 'vue'
import { useSessionsOpen } from '@/sessions-open/SessionsOpen'
import { useTabsSelect } from '@/tabs/TabsSelect.js'
import { storeToRefs } from 'pinia'

// Props
const props = defineProps({
  onContextMenu: {
    type: Function,
    default: () => {}
  }
})

defineEmits([
  'show-context-menu'
])

// Use Pinia store
const sessionStore = useSessionsOpen()
const tabsSelectStore = useTabsSelect()

const { 
  sessionsOpen, 
  windowCurrentId, 
  tabsOpenHistory 
} = storeToRefs(sessionStore)

// Get methods from store
const { activateTab } = sessionStore

// Default icon
const defaultIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>'

// Computed property for active and selected tabs with caching
const getActiveAndSelectedTabs = computed(() => {
  // console.log('SessionsOpenHistory.vue: getActiveAndSelectedTabs computed executing')
  
  // Cache for window results
  const cache = new Map()
  
  return (windowId) => {
    // Check cache first
    if (cache.has(windowId)) {
      const cached = cache.get(windowId)
      const currentActive = tabsOpenHistory.value.get(windowId)?.active || []
      const currentSelected = tabsOpenHistory.value.get(windowId)?.selected || []
      
      // Check if data has changed
      if (cached.activeLength === currentActive.length && 
          cached.selectedLength === currentSelected.length &&
          cached.activeIds === JSON.stringify(currentActive.map(t => t.id)) &&
          cached.selectedIds === JSON.stringify(currentSelected.map(t => t.id))) {
        // console.log(`SessionsOpenHistory.vue: Using cached result for window ${windowId}`)
        return cached.result
      }
    }
    
    // console.log(`SessionsOpenHistory.vue: Computing for window ${windowId}`)
    const activeTabs = tabsOpenHistory.value.get(windowId)?.active || []
    const selectedTabs = tabsOpenHistory.value.get(windowId)?.selected || []
    const combinedTabs = [...activeTabs, ...selectedTabs]
    const uniqueTabs = combinedTabs.filter((tab, index, self) =>
      index === self.findIndex((t) => t.id === tab.id)
    )
    
    // Cache the result
    cache.set(windowId, {
      result: uniqueTabs,
      activeLength: activeTabs.length,
      selectedLength: selectedTabs.length,
      activeIds: JSON.stringify(activeTabs.map(t => t.id)),
      selectedIds: JSON.stringify(selectedTabs.map(t => t.id))
    })
    
    // console.log(`SessionsOpenHistory.vue: Window ${windowId} - active: ${activeTabs.length}, selected: ${selectedTabs.length}, combined: ${uniqueTabs.length}`)
    return uniqueTabs
  }
})

const getRecentTabs = computed(() => {
  // the first tab is tabActive in this window, so we skip it
  return (windowId) => {
    const recentTabs = tabsOpenHistory.value.get(windowId)?.recent || []
    // console.log('SessionsOpenHistory.vue: getRecentTabs', recentTabs)
    // If empty or only has one element, return empty array
    if (recentTabs.length <= 1) {
      return []
    }
    
    // Otherwise, return all elements starting from the first (skip first element)
    return recentTabs.slice(1)
  }
})

// Event handlers
const handleActiveOrSelectedTabClick = async (tab) => {
  // console.log('SessionsOpenHistory.vue: handleActiveOrSelectedTabClick', tab.id)
  try {
    await activateTab(tab)
    props.onTabActivated(tab)
  } catch (error) {
    console.error('Error activating tab:', error)
  }
}

const onTabRecentClick = async (tab) => {
  try {
    await activateTab(tab)
    props.onTabActivated(tab)
  } catch (error) {
    console.error('Error activating tab:', error)
  }
}

const showContextMenu = (event, tab) => {
  console.log('SessionsOpenHistory.vue: showContextMenu. tab:', tab)
  emit('show-context-menu', { event, tab })
}

// Lifecycle hooks with detailed logging
onMounted(() => {
  // console.log('SessionsOpenHistory.vue: Component mounted')
})

onUnmounted(() => {
  // console.log('SessionsOpenHistory.vue: Component unmounted')
})

onUpdated(() => {
  // console.log('SessionsOpenHistory.vue: Component updated')
})

// Watch for changes to debug re-renders
// watch(tabsOpenHistory, (newHistory, oldHistory) => {
//   console.log('SessionsOpenHistory.vue: tabsOpenHistory changed', {
//     newSize: newHistory?.size || 0,
//     oldSize: oldHistory?.size || 0
//   })
// }, { deep: true })

watch(windowCurrentId, (newId, oldId) => {
  console.log('SessionsOpenHistory.vue: windowCurrentId changed', { newId, oldId })
})

// Only watch sessionsOpen structure changes, not deep tab property changes
watch(sessionsOpen, (newWindows, oldWindows) => {
  console.log('SessionsOpenHistory.vue: sessionsOpen structure changed', {
    newCount: newWindows?.length || 0,
    oldCount: oldWindows?.length || 0
  })
}, { shallow: true }) // Use shallow instead of deep

console.log('SessionsOpenHistory.vue: Script setup completed')
</script>

<style scoped>
.tabs-open-history-container {
  margin-bottom: 20px;
}

.virtual-window {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  overflow: hidden;
  margin-bottom: 16px;
}

.virtual-window-header {
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dadce0;
}

.virtual-window-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.virtual-window-description {
  font-size: 12px;
  color: var(--text-secondary);
}

.window-content-virtual {
  padding: 8px;
}

.virtual-window-section {
  margin-bottom: 6px;
  padding: 6px;
  border: 1px solid #e8eaed;
  border-radius: 6px;
  background-color: #fafbfc;
}

.virtual-window-section.current-window-section {
  border-color: #1a73e8;
  background-color: #e8f0fe;
}

.section-header {
  margin-bottom: 4px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.virtual-section-count {
  font-weight: normal;
  color: var(--text-secondary);
}

.tab-virtual-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.virtual-line-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 100px;
  text-align: right;
}

.tabs-virtual-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.virtual-recent-tab {
  opacity: 0.8;
}
</style>

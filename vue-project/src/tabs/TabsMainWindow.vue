<template>
  <div class="tabs-main-window">
    <!-- Left Sidebar: Session Groups -->
    <div class="session-sidebar">
      <!-- Open Sessions Group -->
      <div class="session-group" :class="{ 'current': sessionGroupNameCurrent === 'open' }">
        <div class="session-group-header">
          <div class="session-group-title">Active Sessions</div>
          <div class="session-group-counts">
            <div v-if="searchState.isSearchActive" class="search-result-count">
              {{ openSessionSearchCount }}
            </div>
            <div class="session-group-count">{{ openWindows.length }} window{{ openWindows.length !== 1 ? 's' : '' }}</div>
          </div>
        </div>
        
        <div class="session-cards">
          <SessionCard
            v-for="window in openWindows" 
            :key="window.id"
            :session-name="getSessionDisplayName(window.id)"
            :tab-count="window.tabs.length"
            :session-card-id="getSessionCardId(window.id)"
            :is-current="sessionCardIdCurrent === getSessionCardId(window.id)"
            :is-current-window="window.id === windowCurrentId"
            :should-display-search-result="searchState.isSearchActive"
            :search-result-tab-num="openWindowSearchCounts[window.id] || 0"
            @click="selectSession('open', window.id)"
            @contextmenu="handleSessionContextMenu($event, window)"
          />
        </div>
      </div>
      
      <!-- Remote Sessions Group -->
      <div class="session-group" :class="{ 'current': sessionGroupNameCurrent === 'remote' }">
        <div class="session-group-header">
          <div class="session-group-title">Remote Sessions</div>
          <div class="session-group-counts">
            <div v-if="searchState.isSearchActive" class="search-result-count">
              {{ remoteSessionSearchCount }}
            </div>
            <div class="session-group-count">
              {{ isFetchAllTabsFromRemoteOnInit ? `${sessionsRemoteNum} session${sessionsRemoteNum !== 1 ? 's' : ''}` : 'Search Only' }}
            </div>
          </div>
        </div>
        
        <!-- Server Subgroups -->
        <div class="session-subgroups">
          <div class="session-subgroup">
            <div class="session-subgroup-header">
              <div class="session-subgroup-title">Default Server</div>
              <div class="session-subgroup-counts">
                <div v-if="searchState.isSearchActive" class="search-result-count">
                  {{ remoteSessionSearchCount }}
                </div>
                <div class="session-subgroup-count">
                  {{ sessionsRemoteNum }} session{{ sessionsRemoteNum !== 1 ? 's' : '' }}
                </div>
              </div>
            </div>
            
            <div class="session-cards">
              <SessionCard
                v-for="(sessionTabs, sessionId) in remoteSessionsList"
                :key="sessionId"
                :session-name="sessionTabs.name || `List ${sessionId}`"
                :tab-count="Object.keys(sessionTabs.tabs || {}).length"
                :session-card-id="`remote-${sessionId}`"
                :is-current="sessionCardIdCurrent === `remote-${sessionId}`"
                :is-current-window="false"
                :should-display-search-result="searchState.isSearchActive"
                :search-result-tab-num="remoteSessionSearchCounts[sessionId] || 0"
                @click="selectSession('remote', sessionId)"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div class="session-group disabled" :class="{ 'current': sessionGroupNameCurrent === 'local' }">
        <div class="session-group-header">
          <div class="session-group-title">Local Sessions</div>
          <div class="session-group-count">Coming Soon</div>
        </div>
      </div>
      
      <div class="session-group disabled" :class="{ 'current': sessionGroupNameCurrent === 'bookmarks' }">
        <div class="session-group-header">
          <div class="session-group-title">Bookmarks</div>
          <div class="session-group-count">Coming Soon</div>
        </div>
      </div>
    </div>

    <!-- Right Panel: Tab Content -->
    <div class="content-panel">
      <div class="content-header">
        <!-- Search Panel -->
        <TabsSearch ref="tabsSearchRef" />
        
        <!-- Display Settings Panel -->
        <PanelDisplaySetting
          ref="panelDisplayRef"
          :is-loading="isLoading"
          :boolean-items="booleanItemsConfig"
          :range-items="rangeItemsConfig"
          :select-items="selectItemsConfig"
          :trigger-items="triggerItemsConfig"
        />
      </div>
      
      <div class="content-body" :class="{ 'search-mode': searchState.isSearchActive }">
        <!-- Search Mode Headers -->
        <template v-if="searchState.isSearchActive">
          <!-- Open Tabs Search Results Header -->
          <div v-if="searchState.sessionsOpenSearchResults.length > 0" class="search-section-header">
            <h3>Open Tabs</h3>
            <div class="search-section-count">
              {{ searchState.sessionsOpenSearchResults.length }} result{{ searchState.sessionsOpenSearchResults.length !== 1 ? 's' : '' }}
            </div>
          </div>
        </template>
        
        <!-- Open Tabs Content -->
        <div 
          v-show="(searchState.isSearchActive && searchState.sessionsOpenSearchResults.length > 0) || (!searchState.isSearchActive && sessionGroupNameCurrent === 'open')" 
          class="tabs-content"
          :class="{ 'search-section': searchState.isSearchActive && searchState.sessionsOpenSearchResults.length > 0 }"
        >
          <TabsOpen
            ref="tabsOpenRef"
            :panel-display-ref="panelDisplayRef"
            :search-mode="searchState.isSearchActive"
            :search-results="searchState.sessionsOpenSearchResults"
            @tab-activated="$emit('tab-activated', $event)"
            @tab-closed="$emit('tab-closed', $event)"
            @show-context-menu="$emit('show-context-menu', $event)"
            @upload-single-tab="$emit('upload-single-tab', $event)"
            @upload-selected-tabs="$emit('upload-selected-tabs', $event)"
          />
        </div>
        
        <!-- Search Mode Headers -->
        <template v-if="searchState.isSearchActive">
          <!-- Remote Tabs Search Results Header -->
          <div v-if="searchState.sessionsRemoteSearchResults.length > 0" class="search-section-header">
            <h3>Remote Tabs</h3>
            <div class="search-section-count">
              {{ searchState.sessionsRemoteSearchResults.length }} result{{ searchState.sessionsRemoteSearchResults.length !== 1 ? 's' : '' }}
            </div>
          </div>
        </template>
        
        <!-- Remote Tabs Content -->
        <div 
          v-show="(searchState.isSearchActive && searchState.sessionsRemoteSearchResults.length > 0) || (!searchState.isSearchActive && sessionGroupNameCurrent === 'remote')" 
          class="tabs-content"
          :class="{ 'search-section': searchState.isSearchActive && searchState.sessionsRemoteSearchResults.length > 0 }"
        >
          <TabsRemote
            ref="tabsRemoteRef"
            :panel-display-ref="panelDisplayRef"
            :search-mode="searchState.isSearchActive"
            :search-results="searchState.sessionsRemoteSearchResults"
            @openSettings="$emit('openSettings')"
          />
        </div>
        
        <!-- No Results Message -->
        <div v-if="searchState.isSearchActive && searchState.sessionsOpenSearchResults.length === 0 && searchState.sessionsRemoteSearchResults.length === 0" class="no-search-results">
          <div class="no-results-icon">🔍</div>
          <div class="no-results-message">No tabs found matching your search criteria</div>
        </div>
      </div>
    </div>

    <!-- Session Context Menu -->
    <div 
      v-if="contextMenu.show"
      class="session-context-menu"
      :style="{ 
        position: 'fixed',
        left: contextMenu.x + 'px',
        top: contextMenu.y + 'px',
        zIndex: 1000
      }"
    >
      <div class="context-menu-item" @click="handleRenameSession">
        <span class="context-menu-icon">✏️</span>
        <span class="context-menu-text">Rename Session</span>
      </div>
    </div>

    <!-- Rename Session Modal -->
    <SessionRenameModal
      :is-visible="renameModal.isVisible"
      :window-id="renameModal.windowId"
      :default-name="renameModal.defaultName"
      :current-nickname="renameModal.currentNickname"
      @close="closeRenameModal"
      @confirm="confirmRename"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useTabsOpen } from '@/stores/TabsOpen'
import { useTabsRemote } from '@/stores/TabsRemote'
import { useTabsSearch } from '@/stores/TabsSearch'
import { storeToRefs } from 'pinia'
import TabsOpen from '@/tab-browser/TabsOpen.vue'
import TabsRemote from '@/sessions/TabsRemote.vue'
import PanelDisplaySetting from '@/panel/PanelDisplaySetting.vue'
import SessionRenameModal from '@/sessions/SessionRenameModal.vue'
import SessionCard from '@/sessions/SessionCard.vue'
import TabsSearch from '@/components/TabsSearch.vue'

// define emits
const emit = defineEmits([
  'tab-activated', 
  'tab-closed', 
  'show-context-menu', 
  'upload-single-tab', 
  'upload-selected-tabs',
  'openSettings'
])

// use stores
const tabsOpenStore = useTabsOpen()
const tabsRemoteStore = useTabsRemote()
const tabsSearchStore = useTabsSearch()
const { sessionsOpen, windowCurrentId, tabsOpenNumTotal, isLoading } = storeToRefs(tabsOpenStore)
const { isFetchAllTabsFromRemoteOnInit, sessionRemoteTabNumTotal, sessionsRemoteNum, sessionsRemote } = storeToRefs(tabsRemoteStore)
const { searchState } = storeToRefs(tabsSearchStore)
const { setSessionNickname, getSessionNickname, getSessionDisplayName } = tabsOpenStore

// refs
const tabsOpenRef = ref(null)
const panelDisplayRef = ref(null)

// focused session tracking
const sessionGroupNameCurrent = ref('open') // current session group name
const sessionCardIdCurrent = ref(null) // current session card id

// configuration for PanelDisplaySetting
const booleanItemsConfig = ref([
  { name: 'showIcon', label: 'Icon', value: true, title: 'Toggle icon display' },
  { name: 'showTitle', label: 'Title', value: true, title: 'Toggle title display' },
  { name: 'showUrl', label: 'URL', value: false, title: 'Toggle URL display' },
  { name: 'useResponsiveGrid', label: 'AutoColNum', value: true, title: 'Auto-fit responsive grid' }
])

const rangeItemsConfig = ref([
  { name: 'columnsPerRow', value: 2, min: 1, max: 4, step: 1, default: 2, title: 'Columns per row' },
  { name: 'overviewIconSize', value: 20, min: 12, max: 48, step: 1, default: 20, title: 'Icon size' }
])

const selectItemsConfig = ref([
  { 
    name: 'displayMode', 
    value: 'TabsBased', 
    title: 'Display Mode',
    options: [
      { value: 'TabsBased', label: 'TabsBased', title: 'Show all tabs with full details' },
      { value: 'WindowsBased', label: 'WindowsBased', title: 'Window/list overview with tab icons' }
    ]
  },
  {
    name: 'overviewIconMode',
    value: 'all',
    title: 'Tab Icons',
    options: [
      { value: 'all', label: 'All', title: 'Show all tab icons' },
      { value: 'limited', label: 'Limited', title: 'Show first/last 10 icons with count' }
    ]
  }
])

const triggerItemsConfig = ref([
  { name: 'refresh', icon: '↻', title: 'Refresh', disabled: false }
])

// Generate unique session card IDs
const sessionCardIds = ref(new Map()) // windowId -> sessionCardId

// Function to get or generate session card ID
const getSessionCardId = (windowId) => {
  if (!sessionCardIds.value.has(windowId)) {
    sessionCardIds.value.set(windowId, `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  }
  return sessionCardIds.value.get(windowId)
}

// Context menu and modal state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  window: null
})

const renameModal = ref({
  isVisible: false,
  windowId: null,
  defaultName: '',
  currentNickname: ''
})

// Computed
const openWindows = computed(() => sessionsOpen.value || [])
const remoteSessionsList = computed(() => sessionsRemote.value || {})

// Search result counts
const openSessionSearchCount = computed(() => {
  return searchState.value.isSearchActive ? searchState.value.sessionsOpenSearchResults.length : 0
})

const remoteSessionSearchCount = computed(() => {
  return searchState.value.isSearchActive ? searchState.value.sessionsRemoteSearchResults.length : 0
})

const totalSearchCount = computed(() => {
  return openSessionSearchCount.value + remoteSessionSearchCount.value
})

// Search results by remote session
const remoteSessionSearchCounts = computed(() => {
  if (!searchState.value.isSearchActive) return {}
  
  const counts = {}
  searchState.value.sessionsRemoteSearchResults.forEach(tab => {
    const sessionId = tab.sessionId || tab.session_id
    if (sessionId) {
      counts[sessionId] = (counts[sessionId] || 0) + 1
    }
  })
  return counts
})

// Search results by open window
const openWindowSearchCounts = computed(() => {
  if (!searchState.value.isSearchActive) return {}
  
  const counts = {}
  searchState.value.sessionsOpenSearchResults.forEach(tab => {
    const windowId = tab.windowId
    if (windowId) {
      counts[windowId] = (counts[windowId] || 0) + 1
    }
  })
  return counts
})

// Methods
const selectSession = async (type, id) => {
  // Update session group and card tracking
  sessionGroupNameCurrent.value = type
  
  if (type === 'open') {
    sessionCardIdCurrent.value = getSessionCardId(id)
    if (tabsOpenRef.value) {
      // Wait for next tick to ensure DOM is updated
      await nextTick()
      tabsOpenRef.value.scrollToWindow(id)
    }
  } else if (type === 'remote') {
    sessionCardIdCurrent.value = `remote-${id}` // Use remote- prefixed id for remote sessions
  }
}



// Context menu methods
const handleSessionContextMenu = (event, window) => {
  event.preventDefault()
  
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    window: window
  }
}

const closeContextMenu = () => {
  contextMenu.value.show = false
}

const handleRenameSession = () => {
  const window = contextMenu.value.window
  if (!window) return
  
  const defaultName = `Window ${window.id}`
  
  renameModal.value = {
    isVisible: true,
    windowId: window.id,
    defaultName: defaultName,
    currentNickname: getSessionNickname(window.id) || ''
  }
  
  closeContextMenu()
}

const closeRenameModal = () => {
  renameModal.value.isVisible = false
}

const confirmRename = (data) => {
  setSessionNickname(data.windowId, data.nickname)
  closeRenameModal()
}



// Click outside to close context menu
const handleClickOutside = (event) => {
  if (contextMenu.value.show) {
    const menuElement = document.querySelector('.session-context-menu')
    if (!menuElement || !menuElement.contains(event.target)) {
      closeContextMenu()
    }
  }
}

// Watch for window changes and auto-select current window if nothing is selected
watch(openWindows, (newWindows) => {
  if (newWindows.length > 0 && !sessionCardIdCurrent.value) {
    // Auto-select current window if available, otherwise first window
    const currentWindow = newWindows.find(w => w.id === windowCurrentId.value)
    const targetWindow = currentWindow || newWindows[0]
    selectSession('open', targetWindow.id)
  }
}, { immediate: true })

// watch for visible window changes from scroll monitoring  
watch(() => tabsOpenRef.value?.windowIdVisible, (newWindowId) => {
  if (newWindowId && sessionGroupNameCurrent.value === 'open') {
    // Update current session card to match visible window
    sessionCardIdCurrent.value = getSessionCardId(newWindowId)
    console.log('TabsMainWindow: Updated current session card based on scroll, windowId:', newWindowId)
  }
})

// watch refresh count to trigger refresh when button is clicked
watch(() => panelDisplayRef.value?.triggerItems?.find?.(item => item.name === 'refresh')?.count, (newCount, oldCount) => {
  if (newCount > oldCount) {
    tabsOpenStore.refreshData()
  }
})

// Initialize on mount
onMounted(async () => {
  // Initialize TabsOpen store if needed
  if (!isLoading.value && openWindows.value.length === 0) {
    await tabsOpenStore.initTabsOpen()
  }
  
  // Add click outside listener
  document.addEventListener('click', handleClickOutside)
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Expose methods for parent components
defineExpose({
  selectSession,
})
</script>

<style scoped>
.tabs-main-window {
  display: flex;
  height: 100%;
  width: 100%;
  background-color: #f8f9fa;
  gap: 1px;
}

/* Left Sidebar */
.session-sidebar {
  width: 280px;
  background-color: white;
  border-right: 1px solid #e1e3e1;
  overflow-y: auto;
  flex-shrink: 0;
}

.session-group {
  border-bottom: 1px solid #e1e3e1;
}

.session-group.current {
  background-color: #e8f0fe;
  border-left: 3px solid #1a73e8;
}

.session-group.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.session-group-header {
  padding: 4px 8px;
  border-bottom: 1px solid #e1e3e1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-group-counts,
.session-subgroup-counts {
  display: flex;
  align-items: flex-end;
  gap: 2px;
}

.search-result-count {
  font-size: 10px;
  color: #0d652d;
  font-weight: 600;
  background-color: #e6f4ea;
  padding: 2px 6px;
  border-radius: 8px;
  border: 1px solid #c4e7d1;
}

.session-group-title {
  font-size: 14px;
  font-weight: 600;
  color: #202124;
}

.session-group-count {
  font-size: 12px;
  color: var(--text-secondary);
  background-color: #e8f0fe;
  padding: 2px 8px;
  border-radius: 12px;
}

.session-cards {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-subgroups {
  padding: 0;
}

.session-subgroup {
  border-top: 1px solid #f1f3f4;
  margin-top: 4px;
}

.session-subgroup:first-child {
  border-top: none;
  margin-top: 0;
}

.session-subgroup-header {
  padding: 8px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e1e3e1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-subgroup-title {
  font-size: 12px;
  font-weight: 500;
  color: #5f6368;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-subgroup-count {
  font-size: 11px;
  color: var(--text-secondary);
  background-color: #e8f0fe;
  padding: 2px 6px;
  border-radius: 8px;
}



/* Right Panel */
.content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
  overflow: hidden;
}

.content-header {
  padding: 8px 12px;
  border-bottom: 1px solid #e1e3e1;
  background-color: white;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex-shrink: 0;
}

.content-header:empty {
  display: none;
}

.content-title {
  font-size: 18px;
  font-weight: 600;
  color: #202124;
}

.content-stats {
  font-size: 14px;
  color: var(--text-secondary);
}

.content-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Search mode: Enable scrolling in content-body */
.content-body.search-mode {
  overflow-y: auto;
  padding: 8px;
  gap: 16px;
}

/* Search section styling */
.search-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  margin-bottom: 16px;
}

.search-section:last-child {
  margin-bottom: 0;
}

.search-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dadce0;
  border-radius: 8px 8px 0 0;
  margin-bottom: 8px;
}

.search-section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #202124;
}

.search-section-count {
  font-size: 12px;
  color: #5f6368;
  background: #e8f0fe;
  padding: 4px 8px;
  border-radius: 12px;
}

.search-section-content {
  /* Remove any container constraints to allow full content display */
  height: auto;
  overflow: visible;
}

/* No search results styling */
.no-search-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: #5f6368;
}

.no-results-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-results-message {
  font-size: 16px;
  font-weight: 500;
}

.tabs-content {
  flex: 1;
  overflow: hidden;
}


/* Override TabsOpen styles when embedded */
.tabs-content :deep(.tabs-open-container) {
  height: 100% !important;
}

.tabs-content :deep(.tabs-open-header) {
  display: none; /* Hide the header since we have our own */
}

.tabs-content :deep(.windows-container) {
  height: 100%;
  padding: 8px;
}

/* Search mode specific overrides */
.content-body.search-mode .tabs-content :deep(.tabs-open-container),
.content-body.search-mode .tabs-content :deep(.tabs-remote-container) {
  height: auto !important; /* Allow auto-sizing in search mode */
}

.content-body.search-mode .tabs-content :deep(.tabs-open-header),
.content-body.search-mode .tabs-content :deep(.tabs-remote-header) {
  display: none; /* Hide headers in search mode */
}

.content-body.search-mode .tabs-content :deep(.windows-container),
.content-body.search-mode .tabs-content :deep(.lists-container) {
  height: auto !important; /* Allow auto-sizing in search mode */
  overflow: visible !important; /* Remove scroll constraints */
  padding: 8px;
}

/* Add data attribute for window containers to enable scrolling */
.tabs-content :deep(.window-container[data-window-id]) {
  scroll-margin-top: 20px;
}

/* Context Menu Styles */
.session-context-menu {
  background: white;
  border: 1px solid #dadce0;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 160px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.context-menu-item:hover {
  background-color: #f1f3f4;
}

.context-menu-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.context-menu-text {
  font-size: 14px;
  color: #202124;
}
</style>

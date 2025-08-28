<template>
  <div class="tabs-remote-container" :class="{ 'search-mode': isSearchMode }">
    <!-- Header with stats -->
    <div class="tabs-remote-header">
      <div class="stats">
        <span v-if="isFetchingFromServer">
          Initializing...
        </span>
        <span v-else-if="!isSessionsRemoteLoading">
          {{ tabsRemoteStore.isFetchAllTabsFromRemoteOnInit ? 'Fetch All Mode' : 'Search Only Mode' }} | 
          {{ Object.keys(displayData || {}).length }} list{{ Object.keys(displayData || {}).length !== 1 ? 's' : '' }},
          <span v-if="isSearchMode" class="search-indicator">(search)</span>
          <span v-else-if="isFilterMode && filterList.length > 0" class="filter-indicator">(filtered)</span>
          {{ sessionRemoteTabNumTotal }} tab{{ sessionRemoteTabNumTotal !== 1 ? 's' : '' }}
        </span>
        <span v-else>Loading...</span>
      </div>
      
      <!-- Filter component -->
      <SessionsRemoteFilter
        v-model="filterList"
        @update:modelValue="handleFiltersChange"
      />
    </div>



    <!-- Initialization state -->
    <div v-if="isFetchingFromServer || (!isSessionsRemoteLoaded)" class="initialization-state">
      <div class="initialization-message">
        <div class="spinner">↻</div>
        <div v-if="isFetchingFromServer">Connecting to server...</div>
        <div v-else>Loading remote tabs...</div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error && !isFetchingFromServer && !(!isSessionsRemoteLoaded)" class="error-state">
      <div class="error-message">{{ error }}</div>
      <div class="error-actions">
        <button @click="() => fetchRemoteTabs(true)" class="retry-btn">Retry</button>
        <button 
          v-if="error.includes('No server URL configured')" 
          @click="openSettings" 
          class="settings-btn"
        >Open Settings</button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!isSessionsRemoteLoading && !isFetchingFromServer && Object.keys(displayData || {}).length === 0" class="empty-state">
      <div class="empty-message">
        {{ tabsRemoteStore.isFetchAllTabsFromRemoteOnInit ? 'No remote tabs found' : 'Use search to find remote tabs' }}
      </div>
      <button 
        v-if="tabsRemoteStore.isFetchAllTabsFromRemoteOnInit"
        @click="() => fetchRemoteTabs(true)" 
        class="retry-btn"
      >
        Refresh
      </button>
    </div>

    <!-- Lists container with scroll -->
    <div v-else-if="!isFetchingFromServer && !(isSessionsRemoteLoading && !isSessionsRemoteLoaded)" class="lists-container">
      <!-- TabsBased Mode -->
      <div v-if="displayMode === 'TabsBased'" class="panel-container">
        <!-- Remote Sessions Lists -->
        <div 
          v-for="(sessionTabs, sessionId) in displayData" 
          :key="sessionId"
          class="list-container"
          :data-session-id="sessionId"
        >
          <div class="session-remote-header">
            <div class="remote-divider">
              <div class="remote-title">
                {{ sessionTabs.name || `List ${sessionId}` }}
              </div>
              <div class="tab-count">
                {{ Object.keys(sessionTabs.tabs || {}).length }} tab{{ Object.keys(sessionTabs.tabs || {}).length !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>

          <!-- Tab Grid with Context Menu -->
          <div 
            class="tab-grid" 
            :style="{
              display: 'grid',
              gridTemplateColumns: gridTemplateColumns,
              gap: gridGap,
              gridAutoRows: 'min-content'
            }"
            @click="handleGridClick"
            @dblclick="handleGridDoubleClick"
            @contextmenu="handleGridContextMenu"
          >
            <!-- Tab Cards -->
            <TabCard
              v-for="(tab, tabId) in sessionTabs.tabs || {}"
              :key="tabId"
              :tab="tab"
              :show-icon="showIcon"
              :show-title="showTitle"
              :show-url="showUrl"
              :show-remove-button="true"
              :source="'remote'"
              :default-icon="defaultIcon"
              :remove-button-title="'Remove from cache'"
              :data-parent-class="'tab-grid'"
              :data-tab-id="tabId"
              :data-list-id="sessionId"
            />


          </div>
        </div>
        <!-- Context Menu -->
        <TabsContextMenu
          :show="contextMenu.show"
          :x="contextMenu.x"
          :y="contextMenu.y"
          :tab="contextMenu.tab"
          :selected-count="remoteSelectionCount"
          :has-selection="remoteSelectionCount > 0"
          :selected-tabs="selectedRemoteTabs"
          :menu-items="contextMenuItems"
          :is-loading="contextMenuLoading.isLoading"
          :loading-action="contextMenuLoading.action"
          @menu-item-clicked="handleContextMenuAction"
        />
      </div>

      <!-- WindowsBased Mode -->
      <div v-else-if="displayMode === 'WindowsBased'" class="overview-container">
        <div 
          v-for="(sessionTabs, sessionId) in displayData" 
          :key="sessionId"
          class="overview-list"
        >
          <div class="overview-session-remote-header">
            <div class="overview-list-title">
              {{ sessionTabs.name || `List ${sessionId}` }}
            </div>
            <div class="tab-count">
              {{ Object.keys(sessionTabs.tabs || {}).length }} tab{{ Object.keys(sessionTabs.tabs || {}).length !== 1 ? 's' : '' }}
            </div>
          </div>

          <div class="overview-icons-container">
            <!-- All icons mode -->
            <div v-if="overviewIconMode === 'all'" 
              class="tab-icons-grid"
              :style="{ 
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, ${overviewIconSize}px)`,
                justifyContent: 'start'
              }"
            >
              <div
                v-for="(tab, tabId) in sessionTabs.tabs || {}"
                :key="tabId"
                class="tab-icon-item"
                :class="{ 'ui-selected-tab-icon': tab.isUiSelected }"
                :title="`${tab.text || 'No title'}\n${tab.url}`"
                @click="(e) => handleTabClick({ ...tab, tabId }, e, 'remote')"
                @contextmenu="(e) => handleContextMenuShow(e, tab)"
                :style="{ width: `${overviewIconSize}px`, height: `${overviewIconSize}px` }"
              >
                <img 
                  :src="tab.icon || defaultIcon" 
                  :alt="tab.text || 'Tab icon'"
                  class="tab-icon"
                  @error="(e) => e.target.src = defaultIcon"
                />
              </div>
            </div>

            <!-- Limited icons mode -->
            <div v-else-if="overviewIconMode === 'limited'" class="limited-icons-container">
                             <div 
                 class="tab-icons-grid"
                 :style="{ 
                   display: 'grid',
                   gridTemplateColumns: `repeat(auto-fit, ${overviewIconSize}px)`,
                   justifyContent: 'start'
                 }"
               >
                <!-- First 10 tabs -->
                <div
                  v-for="(tab, tabId) in getFirstTabs(sessionTabs.tabs || {}, 10)"
                  :key="tabId"
                  class="tab-icon-item"
                  :class="{ 'ui-selected-tab-icon': tab.isUiSelected }"
                  :title="`${tab.text || 'No title'}\n${tab.url}`"
                  @click="(e) => handleTabClick({ ...tab, tabId }, e, 'remote')"
                  @dblclick="handleTabActivate({ ...tab, tabId })"
                  @contextmenu="(e) => handleContextMenuShow(e, tab)"
                  :style="{ width: `${overviewIconSize}px`, height: `${overviewIconSize}px` }"
                >
                  <img 
                    :src="tab.icon || defaultIcon" 
                    :alt="tab.text || 'Tab icon'"
                    class="tab-icon"
                    @error="(e) => e.target.src = defaultIcon"
                  />
                </div>

                <!-- Count indicator if more than 20 tabs -->
                <div 
                  v-if="Object.keys(sessionTabs.tabs || {}).length > 20"
                  class="tab-count-indicator"
                  :title="`${Object.keys(sessionTabs.tabs || {}).length - 20} more tabs`"
                >
                  ...{{ Object.keys(sessionTabs.tabs || {}).length - 20 }}...
                </div>

                <!-- Last 10 tabs -->
                <div
                  v-for="(tab, tabId) in getLastTabs(sessionTabs.tabs || {}, 10)"
                  :key="tabId"
                  class="tab-icon-item"
                  :class="{ 'ui-selected-tab-icon': tab.isUiSelected }"
                  :title="`${tab.text || 'No title'}\n${tab.url}`"
                  @click="(e) => handleTabClick({ ...tab, tabId }, e, 'remote')"
                  @dblclick="handleTabActivate({ ...tab, tabId })"
                  @contextmenu="(e) => handleContextMenuShow(e, tab)"
                  :style="{ width: `${overviewIconSize}px`, height: `${overviewIconSize}px` }"
                >
                  <img 
                    :src="tab.icon || defaultIcon" 
                    :alt="tab.text || 'Tab icon'"
                    class="tab-icon"
                    @error="(e) => e.target.src = defaultIcon"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTabsRemote } from '@/sessions-remote/SessionsRemote'
import { useTabsSelect } from '@/tabs/TabsSelect'
import { useNetworkRequest } from '@/network/NetworkRequest'
import { useTagsEdit } from '@/tags/TagsEdit'
import { useTags } from '@/tags/Tags'

import { useTabClickDelegation } from '../composables/useTabClickDelegation'
import { calculateContextMenuPos } from '../utils/contextMenuPosition'

import TabCard from '@/tabs/TabCard.vue'
import TabsContextMenu from '@/tabs/TabsContextMenu.vue'
import SessionsRemoteFilter from '@/sessions-remote/SessionsRemoteFilter.vue'

import { storeToRefs } from 'pinia'

// props
const props = defineProps({
  searchMode: {
    type: Boolean,
    default: false
  },
  searchResults: {
    type: Array,
    default: () => []
  },
  panelDisplayRef: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['openSettings'])

const tabsRemoteStore = useTabsRemote()
const tabsSelectStore = useTabsSelect()
const networkRequest = useNetworkRequest()
const tagsEditStore = useTagsEdit()
const tagsStore = useTags()

// Get reactive references from the TabsRemote store
const { 
  sessionsRemote, 
  isSessionsRemoteLoaded, 
  isSessionsRemoteLoading, 
  lastError,
  sessionRemoteTabNumTotal,
  tabsRemoteRecent,
  isFilterMode,
  filterList,
  sessionsRemoteFiltered
} = storeToRefs(tabsRemoteStore)

// Note: Selection state is now stored directly in tab.isUiSelected property for efficiency

// Use passed panelDisplayRef from parent
const panelDisplayRef = computed(() => props.panelDisplayRef)

// computed values that reactively access panel display settings
const displayMode = computed(() => panelDisplayRef.value?.selectItems?.displayMode?.value || 'TabsBased')
const showIcon = computed(() => panelDisplayRef.value?.booleanItems?.showIcon?.value || true)
const showTitle = computed(() => panelDisplayRef.value?.booleanItems?.showTitle?.value || true)
const showUrl = computed(() => panelDisplayRef.value?.booleanItems?.showUrl?.value || true)
const useResponsiveGrid = computed(() => panelDisplayRef.value?.booleanItems?.useResponsiveGrid?.value || true)
const columnsPerRow = computed(() => panelDisplayRef.value?.rangeItems?.columnsPerRow?.value || 2)
const overviewIconMode = computed(() => panelDisplayRef.value?.selectItems?.overviewIconMode?.value || 'all')
const overviewIconSize = computed(() => panelDisplayRef.value?.rangeItems?.overviewIconSize?.value || 20)
const refreshCount = computed(() => {
  const refreshItem = panelDisplayRef.value?.triggerItems?.find?.(item => item.name === 'refresh')
  return refreshItem?.count || 0
})

// computed grid template columns based on settings
const gridTemplateColumns = computed(() => {
  if (useResponsiveGrid.value) {
    return `repeat(auto-fit, minmax(${minItemWidth.value}px, 1fr))`
  } else {
    return `repeat(${columnsPerRow.value}, 1fr)`
  }
})

// computed grid gap
const gridGap = computed(() => '8px')

// computed minimum item width
const minItemWidth = computed(() => 200)

// Use tab click delegation composable
const { createGridEventHandlers, initShiftKeyTracking, updateTabsMap } = useTabClickDelegation()

// State
const isFetchingFromServer = ref(true)
const isSearchMode = ref(false)
const error = computed(() => lastError.value || '')

// Scroll monitoring (component-specific)
const isScrollReportPaused = ref(false)
const sessionIdVisible = ref(null) // currently visible session id
const scrollEventTimeout = ref(null) // throttling timeout
const sessionPositions = ref(new Map()) // sessionId -> { top: number, height: number }

// Initialize shift key tracking to prevent text selection during shift-click
let cleanupShiftTracking = null

// Default icon for tabs (since remote tabs don't have favicons)
const defaultIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23e8f0fe" rx="2"/><path d="M4 6h8v1H4V6zm0 2h6v1H4V8z" fill="%231a73e8"/></svg>'

// Context menu state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  tab: null
})

const contextMenuLoading = ref({
  action: null,
  isLoading: false
})

// Computed for selection count
const remoteSelectionCount = computed(() => tabsSelectStore.getSelectedCount('remote'))
const selectedRemoteTabs = computed(() => tabsSelectStore.getSelectedTabs('remote'))

// Context menu items for remote tabs
const contextMenuItems = computed(() => {
  const items = []
  
  // Open action
  items.push({ 
    name: 'open', 
    text: 'Open in new tab', 
    icon: '🔗',
    loadingText: 'Opening...'
  })
  
  // Edit tags (only for single tab selection)
  if (remoteSelectionCount.value <= 1) {
    items.push({ 
      name: 'edit-tags', 
      text: 'Edit Tags', 
      icon: '🏷️'
    })
  }
  
  // Change type to url (only for single tab selection)
  if (remoteSelectionCount.value <= 1) {
    items.push({ 
      name: 'change-type-to-url', 
      text: 'Change to URL type', 
      icon: '🔄',
      loadingText: 'Changing type...'
    })
  }
  
  // Remove action
  items.push({ 
    name: 'close', 
    text: 'Remove from cache',
    icon: '✕',
    loadingText: 'Removing...'
  })
  
  // Clear selection (only if there's a selection)
  if (remoteSelectionCount.value > 0) {
    items.push({ 
      name: 'clear-selection', 
      text: 'Clear selection', 
      icon: '🔄'
    })
  }
  
  return items
})

const tabsRemoteRecentCount = computed(() => {
  return tabsRemoteRecent.value.length
})

// grouped search results by list
const searchResultsByList = computed(() => {
  if (!isSearchMode.value || !props.searchResults) return {}
  
  const groupedResults = {}
  props.searchResults.forEach(tab => {
    const sessionId = tab.session_id || 'default'
    if (!groupedResults[sessionId]) {
      groupedResults[sessionId] = {
        name: `List ${sessionId}`,
        tabs: {}
      }
    }
    groupedResults[sessionId].tabs[tab.id] = tab
  })
  return groupedResults
})

// display data - search results in search mode, filtered sessions in filter mode, regular sessions otherwise
const displayData = computed(() => {
  // Search mode takes priority over filter mode
  if (isSearchMode.value) {
    return searchResultsByList.value
  }
  
  // Filter mode
  if (isFilterMode.value) {
    return sessionsRemoteFiltered.value
  }
  
  // Regular mode
  return sessionsRemote.value
})

// Helper functions
// Note: getAllRemoteTabsFlat removed - now handled internally by TabsSelect store for better performance

// filter change handler
const handleFiltersChange = async (newFilters) => {
  await tabsRemoteStore.handleFilterChange(newFilters)
}

// Methods
const fetchRemoteTabs = async (forceRefresh = false) => {
  try {
    await tabsRemoteStore.loadRemoteTabs(forceRefresh)
  } catch (err) { console.error('fetchRemoteTabs(): :', err) }
}

// Event handlers for individual tab actions
const handleTabClick = (tab, event, source) => {
  // Hide context menu on any click
  contextMenu.value.show = false
  tabsSelectStore.handleTabClick(tab, event, source)
}

const handleTabActivate = (tab) => {
  // Open tab URL in new tab
  chrome.tabs.create({ url: tab.url })
}

const handleTabRemove = async (tab) => {
  try {
    // remove from server
    const result = await tabsRemoteStore.removeTabRemote(tab)
    if (!result.is_success) {
      console.error('Failed to remove tab:', result.message)
    }else{
      console.warn(`handleTabRemove(): tabId: ${tab.id}. about to remove from panel`)
      // tabsSelectStore.removeClosedTab(tab.id, 'remote')
      // remove from local store
      tabsRemoteStore.removeTabRemoteFromLocalCache(tab)
    }
  } catch (error) {
    console.error('Error removing tab:', error)
  }
}

const handleContextMenuShow = (event, tab, parentClass) => {
  console.log('SessionsRemote.vue: handleContextMenuShow(): parentClass:', parentClass)
  const containerSelector = '.panel-container'
  const scrollContainerSelector = '.lists-container'
  // Calculate position using the utility function
  const { x, y } = calculateContextMenuPos({
    event,
    containerSelector,
    scrollContainerSelector,
    defaultMenuWidth: 150,
    defaultMenuHeight: 120,
    accountForScroll: false // TabsRemote uses scroll-aware positioning
  })

  // Update context menu state
  contextMenu.value = { show: true, x, y, tab }

  event.preventDefault()
}

// Single context menu action handler
const handleContextMenuAction = async (event) => {
  const { action, tab, tabs, selectedCount, hasSelection } = event
  
  contextMenuLoading.value = { action, isLoading: true }
  
  try {
    switch (action) {
      case 'open':
        // Open all provided tabs
        for (const tab of tabs) {
          chrome.tabs.create({ url: tab.url })
        }
        break
        
      case 'edit-tags':
        // Get current tag IDs for the tab
        const tagsInitId = tab.tags_id || []
        
        // Convert tag IDs to tag names for display
        const tagsInit = []
        
        if (tagsInitId.length > 0) {
          try {
            // Fetch all tags in a single request
            const result = await tagsStore.getTagsById(tagsInitId)
            if (!result.is_success) {
              console.warn('Failed to get tags:', result.message)
            } else {
              // Add all returned tags to tagsInit
              tagsInit.push(...result.data)
            }
          } catch (error) {
            console.error('Error loading initial tags:', error)
          }
        }
        console.log('SessionsRemote.vue: handleContextMenuEditTags: tagsInit:', tagsInit)
        tagsEditStore.openTagsEdit(tab, tagsInit)
        break
      case 'change-type-to-url':
        // change tab type from tab_remote to url
        try {
          const result = await networkRequest.changeNoteType(tab.id, 'url')
          if (result.is_success) {
            console.log(`SessionsRemote.vue: Successfully changed tab ${tab.id} type to url`)
            // Remove the tab locally since it's no longer tab_remote type
            tabsRemoteStore.removeTabRemoteFromLocalCache(tab, false, true)
          } else {
            console.error('SessionsRemote.vue: Failed to change tab type:', result.message)
          }
        } catch (error) {
          console.error('SessionsRemote.vue: Error changing tab type:', error)
        }
        break
        
      case 'close':
        // Remove all provided tabs
        for (const tab of tabs) {
          await handleTabRemove(tab)
          // Small delay between removes for better UX
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        break
        
      case 'clear-selection':
        tabsSelectStore.clearSelection('remote')
        break
        
      default:
        console.warn('SessionsRemote.vue: Unknown context menu action:', action)
    }
  } catch (error) {
    console.error('SessionsRemote.vue: Context menu action error:', error)
  } finally {
    contextMenuLoading.value = { action: null, isLoading: false }
    contextMenu.value.show = false
  }
}

const removeSelectedTabs = async () => {
  // Get all selected remote tabs
  const tabsRemoteSelected = tabsSelectStore.getSelectedTabs('remote')
  
  if (tabsRemoteSelected.length === 0) {
    console.log('removeSelectedTabs(): No remote tabs selected for removal')
    return
  }  
  console.log(`removeSelectedTabs(): Removing ${tabsRemoteSelected.length} selected tabs...`)

  // remove from selection before removing to avoid issues
  tabsSelectStore.clearSelection('remote')
  
  // remove each selected tab
  for (const tab of tabsRemoteSelected) {
    try {
      await handleTabRemove(tab)
      // Small delay between removes for better UX
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error('Error removing tab:', tab.text, error)
    }
  }
}

// Add click handler to close context menu when clicking outside
const handleClickOutside = (event) => {
  const menu = event.target.closest('.context-menu')
  if (!menu && contextMenu.value.show) {
    contextMenu.value.show = false
  }
}

// Create delegated event handlers
const { handleGridClick, handleGridDoubleClick, handleGridContextMenu } = createGridEventHandlers({
  onTabClick: handleTabClick,
  onTabDoubleClick: handleTabActivate,
  onTabRightClick: (event, tab, tabEl) => {
    // Get tab ID and find tab object
    const parentClass = tab.cache.parentClass || 'tab-grid'
    console.log('SessionsRemote.vue: onTabRightClick(): parentClass:', parentClass)
    // const tab = sessionsRemote.value[sessionId]?.tabs?.[tabId]
    
    if(event.shiftKey || event.ctrlKey) {}else{
      tabsSelectStore.clearSelection('remote')
    }
    tabsSelectStore.selectTab(tab, 'remote')
    if (tab) {
      handleContextMenuShow(event, tab, parentClass)
    }
  },
  onTabRemove: handleTabRemove,
  tabsData: displayData,
  source: 'remote'
})

// Optimized event handlers for virtual window
const handleVirtualGridClick = async (event) => {
  const tabItem = event.target.closest('.tab-item-virtual')
  if (!tabItem) return
  
  const tabId = tabItem.dataset.tabId
  const tab = tabsRemoteRecent.value.find(t => t.id === tabId)
  if (tab) {
    handleTabClick(tab, event, 'remote')
  }
}

const handleVirtualGridDoubleClick = async (event) => {
  const tabItem = event.target.closest('.tab-item-virtual')
  if (!tabItem) return
  
  const tabId = tabItem.dataset.tabId
  const tab = tabsRemoteRecent.value.find(t => t.id === tabId)
  if (tab) {
    handleTabActivate(tab)
  }
}

const handleVirtualGridContextMenu = async (event) => {
  const tabItem = event.target.closest('.tab-item-virtual')
  if (!tabItem) return
  
  const tabId = tabItem.dataset.tabId
  const tab = tabsRemoteRecent.value.find(t => t.id === tabId)
  if (tab) {
    event.preventDefault()
    handleContextMenuShow(event, tab)
  }
}

// Cached relative time function for better performance
const relativeTimeCache = new Map()
const getRelativeTime = (timestamp) => {
  if (!timestamp) return ''
  
  // Check cache first
  if (relativeTimeCache.has(timestamp)) {
    return relativeTimeCache.get(timestamp)
  }
  
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  let result
  if (minutes < 1) result = 'Just now'
  else if (minutes < 60) result = `${minutes}m ago`
  else if (hours < 24) result = `${hours}h ago`
  else if (days < 7) result = `${days}d ago`
  else {
    const date = new Date(timestamp)
    result = date.toLocaleDateString()
  }
  
  // Cache the result (cache will be cleared periodically)
  relativeTimeCache.set(timestamp, result)
  return result
}

const openSettings = () => {
  emit('openSettings')
}

// Helper methods for overview mode
const getFirstTabs = (tabs, count) => {
  const tabArray = Object.entries(tabs || {}).map(([tabId, tab]) => ({ ...tab, tabId }))
  return tabArray.slice(0, count)
}

const getLastTabs = (tabs, count) => {
  const tabArray = Object.entries(tabs || {}).map(([tabId, tab]) => ({ ...tab, tabId }))
  if (tabArray.length <= count * 2) return [] // Don't show last tabs if total is small
  return tabArray.slice(-count)
}

// Update fast lookup map when displayData changes
const updateRemoteTabsMap = () => {
  updateTabsMap(displayData, 'remote')
}

// watch refresh count to trigger refresh when button is clicked
watch(refreshCount, (newCount, oldCount) => {
  if (newCount > oldCount) {
    fetchRemoteTabs(true)
  }
})

// Watch for changes in displayData to update the fast lookup map
watch(displayData, updateRemoteTabsMap, { immediate: true })

// Watch for search mode changes from parent
watch(() => props.searchMode, (newSearchMode) => {
  isSearchMode.value = newSearchMode
})

// Watch for search results from parent
watch(() => props.searchResults, (newSearchResults) => {
  if (isSearchMode.value && newSearchResults) {
    console.log('TabsRemote: Received search results:', newSearchResults.length)
  }
})

// Scroll monitoring functions (component-specific)
const getVisibleSessionAreaId = () => {
  if (typeof document === 'undefined') return null
  
  // Choose scroll container based on search mode
  const scrollContainer = isSearchMode.value 
    ? document.querySelector('.content-body') 
    : document.querySelector('.lists-container')
  if (!scrollContainer) return null
  
  const scrollTop = scrollContainer.scrollTop
  
  // Find the first session whose top is at or above the scroll position
  let sessionAreaId = null
  let minDistance = Infinity
  
  for (const [sessionId, position] of sessionPositions.value.entries()) {
    if (position.top <= scrollTop + 10) { // 10px tolerance
      const distance = scrollTop - position.top
      if (distance < minDistance) {
        minDistance = distance
        sessionAreaId = sessionId
      }
    }
  }
  
  // If no session is above scroll position, return the first session
  if (sessionAreaId === null && sessionPositions.value.size > 0) {
    const firstEntry = sessionPositions.value.entries().next().value
    sessionAreaId = firstEntry[0]
  }
  
  return sessionAreaId
}

const onScrollEvent = () => {
  if (isScrollReportPaused.value) return
  
  // Throttle scroll events to max 0.1s frequency
  if (scrollEventTimeout.value) return
  
  scrollEventTimeout.value = setTimeout(() => {
    const newVisibleSessionId = getVisibleSessionAreaId()
    if (newVisibleSessionId !== sessionIdVisible.value) {
      sessionIdVisible.value = newVisibleSessionId
      console.log('TabsRemote: Visible session changed to:', newVisibleSessionId)
    }
    scrollEventTimeout.value = null
  }, 100) // 0.1s = 100ms
}

// Scroll to specific session
const scrollToSession = (sessionId) => {
  const sessionContainer = document.querySelector(`.list-container[data-session-id="${sessionId}"]`)
  if (!sessionContainer) {
    console.warn(`scrollToSession(): Session container not found for sessionId: ${sessionId}`)
    return
  }
  
  // Choose scroll container based on search mode
  const scrollContainer = isSearchMode.value 
    ? document.querySelector('.content-body') 
    : document.querySelector('.lists-container')
  if (!scrollContainer) {
    console.warn('scrollToSession(): Scroll container not found')
    return
  }
  
  // Pause scroll reporting during programmatic scroll
  isScrollReportPaused.value = true
  
  // Calculate scroll position relative to the scroll container
  const containerRect = scrollContainer.getBoundingClientRect()
  const sessionRect = sessionContainer.getBoundingClientRect()
  const currentScrollTop = scrollContainer.scrollTop
  
  // Calculate the target scroll position
  const targetScrollTop = currentScrollTop + (sessionRect.top - containerRect.top) + 3 // 3px offset from top
  
  // Smooth scroll to the session
  scrollContainer.scrollTo({
    top: targetScrollTop,
    behavior: 'smooth'
  })
  
  // Resume scroll reporting after scroll animation completes
  setTimeout(() => {
    isScrollReportPaused.value = false
    // Trigger position update and check visible session
    updateSessionPositions()
    onScrollEvent()
  }, 500) // 500ms should be enough for smooth scroll animation
  
  console.log(`scrollToSession(): Scrolled to session ${sessionId}`)
}

// Update session positions for scroll monitoring
const updateSessionPositions = () => {
  if (typeof document === 'undefined') return
  
  const sessionContainers = document.querySelectorAll('.list-container[data-session-id]')
  sessionPositions.value.clear()
  
  sessionContainers.forEach(container => {
    const sessionId = container.dataset.sessionId
    const rect = container.getBoundingClientRect()
    
    // Choose scroll container based on search mode
    const scrollContainer = isSearchMode.value 
      ? document.querySelector('.content-body') 
      : document.querySelector('.lists-container')
    if (scrollContainer) {
      const scrollRect = scrollContainer.getBoundingClientRect()
      const relativeTop = rect.top - scrollRect.top + scrollContainer.scrollTop
      sessionPositions.value.set(sessionId, {
        top: relativeTop,
        height: rect.height
      })
    }
  })
}

// Watch for changes in the fetchAllRemoteTabsOnInit setting
watch(
  () => tabsRemoteStore.isFetchAllTabsFromRemoteOnInit,
  (newVal) => {
    console.log('SessionsRemote.vue: Setting changed to:', newVal)
    // The TabsRemote store will handle the mode change logic
  },
  { immediate: true }
)



// Initialize
onMounted(async () => {
  // Initialize shift key tracking
  cleanupShiftTracking = initShiftKeyTracking()
  
  // Add click listener to close context menu
  document.addEventListener('click', handleClickOutside)
  
  // Add scroll listener for session position tracking
  // Choose scroll container based on search mode
  const scrollContainer = isSearchMode.value 
    ? document.querySelector('.content-body') 
    : document.querySelector('.lists-container')
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', onScrollEvent)
    // Initial position update
    setTimeout(() => {
      updateSessionPositions()
      onScrollEvent()
    }, 100)
  }
  
  // Clear relative time cache periodically (every 5 minutes)
  const cacheClearInterval = setInterval(() => {
    relativeTimeCache.clear()
  }, 5 * 60 * 1000)
  
  try {
    isFetchingFromServer.value = true
    // Add a small delay to ensure stores are fully initialized
    await new Promise(resolve => setTimeout(resolve, 100))

    // Initialize the fetch all tabs mode setting
    await tabsRemoteStore.initFetchAllTabsMode()
    
    // configuration is now set declaratively in booleanItemsConfig above
    // showUrl is already set to true in the config
    
    // Load remote tabs using the new store (only if in fetch-all mode)
    await fetchRemoteTabs()
  } catch (error) {
    console.error('Error during initialization:', error)
  } finally {
    isFetchingFromServer.value = false
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (cleanupShiftTracking) {
    cleanupShiftTracking()
  }
  
  // Remove click listener
  document.removeEventListener('click', handleClickOutside)
  
  // Remove scroll listener
  // Choose scroll container based on search mode
  const scrollContainer = isSearchMode.value 
    ? document.querySelector('.content-body') 
    : document.querySelector('.lists-container')
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', onScrollEvent)
  }
  
  // Cleanup scroll event timeout
  if (scrollEventTimeout.value) {
    clearTimeout(scrollEventTimeout.value)
    scrollEventTimeout.value = null
  }
  
  // Clear the relative time cache
  relativeTimeCache.clear()
})

// Expose methods for parent components
defineExpose({
  scrollToSession,
  sessionIdVisible,
  getVisibleSessionAreaId,
  onScrollEvent,
  isScrollReportPaused,
  isFilterMode,
  filterList
})
</script>

<style scoped>
.tabs-remote-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative; /* Enable relative positioning for context menu */
}

.tabs-remote-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 8px 12px;
  background-color: #f0f8ff;
  border-bottom: 1px solid #1a73e8;
  width: 100%;
  box-sizing: border-box;
}

.panel-container {
  position: relative;
}

.stats {
  font-size: 14px;
  color: #1a73e8;
  font-weight: 500;
}

.search-indicator {
  color: #0d652d;
  font-weight: 600;
}

.filter-indicator {
  color: #1a73e8;
  font-weight: 600;
}

.initialization-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 32px;
}

.initialization-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  font-size: 16px;
  color: var(--text-secondary);
}

.spinner {
  font-size: 24px;
  animation: spin 1s linear infinite;
}

.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 32px;
}

.error-message,
.empty-message {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.error-actions {
  display: flex;
  gap: 12px;
}

.retry-btn,
.settings-btn {
  padding: 8px 16px;
  border: 1px solid #1a73e8;
  border-radius: 4px;
  background: white;
  color: #1a73e8;
  cursor: pointer;
  /* transition: background-color 0.2s; */
}

.retry-btn:hover,
.settings-btn:hover {
  background-color: #e8f0fe;
}

.settings-btn {
  background-color: #1a73e8;
  color: white;
}

.settings-btn:hover {
  background-color: #1557b0;
}

.lists-container {
  position: relative;
  flex: 1;
  overflow-y: auto;
  height: 100%;
  padding-bottom: 200px; /* Extra space for context menus */
}

/* Search mode: remove scroll from lists-container */
.tabs-remote-container.search-mode .lists-container {
  overflow-y: visible;
  height: auto;
  padding-bottom: 0; /* No padding in search mode - handled by content-body */
}

.list-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.12), 0 1px 2px rgba(26, 115, 232, 0.24);
  overflow: hidden;
  margin-bottom: 16px;
}

.session-remote-header {
  padding: 6px 0;
  background-color: transparent;
}

.remote-divider {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.remote-divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background-color: #dadce0;
  z-index: 1;
}

.remote-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  background-color: white;
  padding: 0 8px;
  z-index: 2;
  position: relative;
}

.tab-virtual-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;
}

.tab-virtual-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.tab-virtual-title {
  font-size: 13px;
  font-weight: 500;
  color: #202124;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-virtual-time {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.1;
  margin-top: 2px;
}

@media (max-width: 768px) {
  .tab-virtual-grid {
    grid-template-columns: 1fr;
  }
  
  .tab-virtual-title {
    font-size: 12px;
  }
  
  .tab-virtual-time {
    font-size: 10px;
  }
}

/* Virtual Window Styles for Recently Uploaded */
.virtual-window {
  background-color: #f8f9fa;
  border: 1px solid #dadce0;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.virtual-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #dadce0;
}

.virtual-window-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a73e8;
}

.virtual-window-description {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.window-content-virtual {
  display: flex;
  flex-direction: column;
}

.tab-virtual-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2px;
  padding: 2px 8px;
  overflow: auto;
}

.tab-icons-grid {
  gap: 4px;
}
</style>

<template>
  <div class="tabs-remote-container">
    <!-- Header with stats -->
    <div class="tabs-remote-header">
      <div class="stats">
        <span v-if="isFetchingFromServer">
          Initializing...
        </span>
        <span v-else-if="!isWinRemoteLoading">
          {{ tabsRemoteStore.isFetchAllTabsFromRemoteOnInit ? 'Fetch All Mode' : 'Search Only Mode' }} | 
          {{ Object.keys(tabsRemoteList || {}).length }} list{{ Object.keys(tabsRemoteList || {}).length !== 1 ? 's' : '' }},
          {{ tabsRemoteNumTotal }} tab{{ tabsRemoteNumTotal !== 1 ? 's' : '' }}
        </span>
        <span v-else>Loading...</span>
      </div>
    </div>

    <!-- Display Controls -->
    <PanelDisplaySetting
      ref="panelDisplayRef"
      :is-loading="isWinRemoteLoading"
      :boolean-items="booleanItemsConfig"
      :range-items="rangeItemsConfig"
      :select-items="selectItemsConfig"
      :trigger-items="triggerItemsConfig"
    />

    <!-- Initialization state -->
    <div v-if="isFetchingFromServer || (!isWinRemoteLoaded)" class="initialization-state">
      <div class="initialization-message">
        <div class="spinner">↻</div>
        <div v-if="isFetchingFromServer">Connecting to server...</div>
        <div v-else>Loading remote tabs...</div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error && !isFetchingFromServer && !(!isWinRemoteLoaded)" class="error-state">
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
    <div v-else-if="!isWinRemoteLoading && !isFetchingFromServer && Object.keys(tabsRemoteList || {}).length === 0" class="empty-state">
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
    <div v-else-if="!isFetchingFromServer && !(isWinRemoteLoading && !isWinRemoteLoaded)" class="lists-container">
      <!-- TabsBased Mode -->
      <div v-if="displayMode === 'TabsBased'" class="panel-container">
        <!-- Virtual Window: Recently Uploaded Tabs -->
        <div class="virtual-window">
          <div class="virtual-window-header">
            <div class="virtual-window-title">Recently Uploaded</div>
            <div class="virtual-window-description">
              Last {{ tabsRemoteRecent.length }} tabs uploaded
          </div>
          </div>
          <div class="window-content-virtual">
            <div class="tab-virtual-grid"
              @click="handleGridClick"
              @dblclick="handleGridDoubleClick"
              @contextmenu="handleGridContextMenu"
            >
              <TabCard
                v-for="tab in tabsRemoteRecent"
                :key="tab.id"
                :tab="tab"
                :show-icon="showIcon"
                :show-title="showTitle"
                :show-url="showUrl"
                :data-parent-class="'tab-virtual-grid'"
                :data-tab-id="tab.id"
                :data-list-id="tab.listId"
                :source="'remote'"
                :default-icon="defaultIcon"
                :remove-button-title="'Remove from cache'"
              />

              <!-- Context Menu -->
              <!-- <TabsContextMenu
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
              /> -->
            </div>
          </div>
        </div>

        <!-- Actual Lists -->
        <div 
          v-for="(listData, listId) in tabsRemoteList" 
          :key="listId"
          class="list-container"
        >
          <div class="list-header">
            <div class="list-title">
              {{ listData.name || `List ${listId}` }}
            </div>
            <div class="tab-count">
              {{ Object.keys(listData.tabs || {}).length }} tab{{ Object.keys(listData.tabs || {}).length !== 1 ? 's' : '' }}
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
              v-for="(tab, tabId) in listData.tabs || {}"
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
              :data-list-id="listId"
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
          v-for="(listData, listId) in tabsRemoteList" 
          :key="listId"
          class="overview-list"
        >
          <div class="overview-list-header">
            <div class="overview-list-title">
              {{ listData.name || `List ${listId}` }}
            </div>
            <div class="tab-count">
              {{ Object.keys(listData.tabs || {}).length }} tab{{ Object.keys(listData.tabs || {}).length !== 1 ? 's' : '' }}
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
                v-for="(tab, tabId) in listData.tabs || {}"
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
                  v-for="(tab, tabId) in getFirstTabs(listData.tabs || {}, 10)"
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
                  v-if="Object.keys(listData.tabs || {}).length > 20"
                  class="tab-count-indicator"
                  :title="`${Object.keys(listData.tabs || {}).length - 20} more tabs`"
                >
                  ...{{ Object.keys(listData.tabs || {}).length - 20 }}...
                </div>

                <!-- Last 10 tabs -->
                <div
                  v-for="(tab, tabId) in getLastTabs(listData.tabs || {}, 10)"
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
import { useTabsRemote } from '../stores/TabsRemote'
import { useTabsSelect } from '../stores/TabsSelect'
import { useNetworkRequest } from '../stores/NetworkRequest'
import { useTagsEdit } from '../stores/TagsEdit'
import { useTags } from '../stores/Tags'

import { useTabClickDelegation } from '../composables/useTabClickDelegation'
import { calculateContextMenuPos } from '../utils/contextMenuPosition'
import PanelDisplaySetting from '@/panel/PanelDisplaySetting.vue'
import TabCard from './TabCard.vue'
import TabsContextMenu from './TabsContextMenu.vue'

import { storeToRefs } from 'pinia'

// Define emits
const emit = defineEmits(['openSettings'])

const tabsRemoteStore = useTabsRemote()
const tabsSelectStore = useTabsSelect()
const networkRequest = useNetworkRequest()
const tagsEditStore = useTagsEdit()
const tagsStore = useTags()

// Get reactive references from the TabsRemote store
const { 
  tabsRemoteList, 
  isWinRemoteLoaded, 
  isWinRemoteLoading, 
  lastError,
  tabsRemoteNumTotal,
  tabsRemoteRecent 
} = storeToRefs(tabsRemoteStore)

// Note: Selection state is now stored directly in tab.isUiSelected property for efficiency

// ref to PanelDisplaySetting component
const panelDisplayRef = ref(null)

// configuration for PanelDisplaySetting - remote tabs specific
const booleanItemsConfig = ref([
  { name: 'showIcon', label: 'Icon', value: true, title: 'Toggle icon display' },
  { name: 'showTitle', label: 'Title', value: true, title: 'Toggle title display' },
  { name: 'showUrl', label: 'URL', value: true, title: 'Toggle URL display' },
  { name: 'useResponsiveGrid', label: 'Auto', value: true, title: 'Auto-fit responsive grid' }
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
const error = computed(() => lastError.value || '')

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

// Helper functions
// Note: getAllRemoteTabsFlat removed - now handled internally by TabsSelect store for better performance

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
      tabsRemoteStore.removeTabRemoteInLocal(tab)
    }
  } catch (error) {
    console.error('Error removing tab:', error)
  }
}

const handleContextMenuShow = (event, tab, parentClass) => {
  console.log('TabsRemote.vue: handleContextMenuShow(): parentClass:', parentClass)
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
        console.log('TabsRemote.vue: handleContextMenuEditTags: tagsInit:', tagsInit)
        tagsEditStore.openTagsEdit(tab, tagsInit)
        break
        
      case 'change-type-to-url':
        // Change tab type from url_cache to url
        try {
          const result = await networkRequest.changeNoteType(tab.id, 'url')
          if (result.is_success) {
            console.log(`TabsRemote.vue: Successfully changed tab ${tab.id} type to url`)
            // Remove the tab locally since it's no longer url_cache type
            tabsRemoteStore.removeTabRemoteInLocal(tab, false, true)
          } else {
            console.error('TabsRemote.vue: Failed to change tab type:', result.message)
          }
        } catch (error) {
          console.error('TabsRemote.vue: Error changing tab type:', error)
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
        console.warn('TabsRemote.vue: Unknown context menu action:', action)
    }
  } catch (error) {
    console.error('TabsRemote.vue: Context menu action error:', error)
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

  // Remove from selection before removing to avoid issues
  tabsSelectStore.clearSelection('remote')
  
  // Remove each selected tab
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
    console.log('TabsRemote.vue: onTabRightClick(): parentClass:', parentClass)
    // const tab = tabsRemoteList.value[listId]?.tabs?.[tabId]
    
    if(event.shiftKey || event.ctrlKey) {}else{
      tabsSelectStore.clearSelection('remote')
    }
    tabsSelectStore.selectTab(tab, 'remote')
    if (tab) {
      handleContextMenuShow(event, tab, parentClass)
    }
  },
  onTabRemove: handleTabRemove,
  tabsData: tabsRemoteList,
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

// Update fast lookup map when tabsRemoteList changes
const updateRemoteTabsMap = () => {
  updateTabsMap(tabsRemoteList, 'remote')
}

// watch refresh count to trigger refresh when button is clicked
watch(refreshCount, (newCount, oldCount) => {
  if (newCount > oldCount) {
    fetchRemoteTabs(true)
  }
})

// Watch for changes in tabsRemoteList to update the fast lookup map
watch(tabsRemoteList, updateRemoteTabsMap, { immediate: true })

// Watch for changes in the fetchAllRemoteTabsOnInit setting
watch(
  () => tabsRemoteStore.isFetchAllTabsFromRemoteOnInit,
  (newVal) => {
    console.log('TabsRemote.vue: Setting changed to:', newVal)
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
  
  // Clear the relative time cache
  relativeTimeCache.clear()
})

// Expose methods for parent components
defineExpose({})
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
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
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
}

.list-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.12), 0 1px 2px rgba(26, 115, 232, 0.24);
  overflow: hidden;
  margin-bottom: 16px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #e8f0fe;
  border-bottom: 1px solid #1a73e8;
}

.list-title {
  font-size: 16px;
  font-weight: 500;
  color: #1a73e8;
}

.tab-count {
  font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  font-weight: bold;
  color: #87ceeb;
  background-color: #666;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #999;
  letter-spacing: 1px;
  min-width: 20px;
  text-align: center;
  display: inline-block;
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

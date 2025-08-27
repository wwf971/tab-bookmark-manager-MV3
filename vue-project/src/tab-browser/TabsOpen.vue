<template>
  <div class="tabs-open-container">
    <!-- Header with stats -->
    <div class="tabs-open-header">
      <div class="stats">
        <span v-if="isLoading">Loading...</span>
        <span v-else>
          {{ (sessionsOpen || []).length }} window{{ (sessionsOpen || []).length !== 1 ? 's' : '' }},
          {{ tabsOpenNumTotal }} tab{{ tabsOpenNumTotal !== 1 ? 's' : '' }}
        </span>
      </div>
    </div>

    <!-- Display Controls -->
    <PanelDisplaySetting
      ref="panelDisplayRef"
      :is-loading="isLoading"
      :boolean-items="booleanItemsConfig"
      :range-items="rangeItemsConfig"
      :select-items="selectItemsConfig"
      :trigger-items="triggerItemsConfig"
    />

    <!-- Error state -->
    <div v-if="lastError && !isLoading" class="error-state">
      <div class="error-message">{{ lastError }}</div>
      <button @click="refreshData" class="retry-btn">Retry</button>
    </div>

    <!-- Windows container with scroll -->
    <div v-else class="windows-container">
      <!-- TabsBased Mode -->
      <div v-if="(panelDisplayRef?.selectItems?.displayMode?.value ?? 'TabsBased') === 'TabsBased'" class="tabs-panel">
        <!-- Virtual Window: Overview of all windows with active/selected and recent tabs -->
        <TabsOpenHistory
          @tab-activated="handleTabActivated"
          @show-context-menu="requestContextMenuShow"
        />

        <!-- chrome windows, each window contains tabs -->
        <div 
          v-for="window in sessionsOpen" 
          :key="window.id"
          class="window-container"
          :class="{ 'current-window': window.id === windowCurrentId }"
          :data-window-id="window.id"
        >
          <div class="window-header">
            <div class="window-title">
              {{ window.id === windowCurrentId ? 'Current Window' : `Window ${window.id}` }}
            </div>
            <div class="tab-count">
              {{ window.tabs.length }} tab{{ window.tabs.length !== 1 ? 's' : '' }}
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
              v-for="tab in window.tabs"
              :key="tab.id"
              :tab="tab"
              :show-icon="panelDisplayRef?.booleanItems?.showIcon?.value ?? true"
              :show-title="panelDisplayRef?.booleanItems?.showTitle?.value ?? true"
              :show-url="panelDisplayRef?.booleanItems?.showUrl?.value ?? false"
              :show-remove-button="true"
              :remove-button-title="'Close tab'"
              :data-tab-id="tab.id || tab.tabId"
              :data-window-id="tab.windowId"
              :source="'open'"
              :default-icon="defaultIcon"
            />
          </div>

        </div>
        <!-- Context Menu -->
        <TabsContextMenu
          ref="contextMenuRef"
          :show="contextMenu.show"
          :x="contextMenu.x"
          :y="contextMenu.y"
          :tab="contextMenu.tab"
          :selected-count="openSelectionCount"
          :has-selection="openSelectionCount > 0"
          :selected-tabs="tabsOpenSelected"
          :menu-items="contextMenuItems"
          :is-loading="contextMenuLoading.isLoading"
          :loading-action="contextMenuLoading.action"
          @menu-item-clicked="handleContextMenuAction"
          />

      </div>

      <!-- WindowsBased Mode -->
      <div v-else-if="(panelDisplayRef?.selectItems?.displayMode?.value ?? 'TabsBased') === 'WindowsBased'" class="overview-container">
        <div 
          v-for="window in sessionsOpen" 
          :key="window.id"
          class="overview-window"
          :class="{ 'current-window': window.id === windowCurrentId }"
        >
          <div class="overview-window-header">
            <div class="overview-window-title">
              {{ window.id === windowCurrentId ? 'Current Window' : `Window ${window.id}` }}
            </div>
            <div class="tab-count">
              {{ window.tabs.length }} tab{{ window.tabs.length !== 1 ? 's' : '' }}
            </div>
          </div>

          <div class="overview-icons-container">
            <!-- All icons mode -->
            <div v-if="(panelDisplayRef?.selectItems?.overviewIconMode?.value ?? 'all') === 'all'" 
              class="tab-icons-grid"
              :style="{ 
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, ${panelDisplayRef?.rangeItems?.overviewIconSize?.value ?? 20}px)`,
                gap: '4px',
                justifyContent: 'start'
              }"
            >
              <div
                v-for="tab in window.tabs"
                :key="tab.id"
                class="tab-icon-item"
                :class="{
                  'browser-active-tab-icon': tab.isActive,        // Browser's current active tab
                  'browser-last-active-tab-icon': tab.isLastActive,   // Browser's previous active tab
                  'browser-selected-tab-icon': tab.isBrowserSelected, // Browser-selected tabs (highlighted)
                  'ui-selected-tab-icon': tab.isUiSelected         // User-selected in UI for operations
                }"
                :title="`${tab.title || 'No title'}\n${tab.url}`"
                :style="{ width: `${panelDisplayRef?.rangeItems?.overviewIconSize?.value ?? 20}px`, height: `${panelDisplayRef?.rangeItems?.overviewIconSize?.value ?? 20}px` }"
              >
                <img 
                  :src="tab.favIconUrl || defaultIcon" 
                  :alt="tab.title || 'Tab icon'"
                  class="tab-icon"
                  @error="(e) => e.target.src = defaultIcon"
                />
              </div>
            </div>

            <!-- Limited icons mode -->
            <div v-else-if="(panelDisplayRef?.selectItems?.overviewIconMode?.value ?? 'all') === 'limited'" class="limited-icons-container">
              <div 
                class="tab-icons-grid"
                :style="{ 
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, ${panelDisplayRef?.rangeItems?.overviewIconSize?.value ?? 20}px)`,
                  gap: '4px',
                  justifyContent: 'start'
                }"
              >
                <!-- First 10 tabs -->
                <div
                  v-for="tab in getFirstTabs(window.tabs, 10)"
                  :key="tab.id"
                  class="tab-icon-item"
                  :class="{
                    'browser-active-tab-icon': tab.isActive,        // Browser's current active tab
                    'browser-last-active-tab-icon': tab.isLastActive,   // Browser's previous active tab
                    'browser-selected-tab-icon': tab.isBrowserSelected, // Browser-selected tabs (highlighted)
                    'ui-selected-tab-icon': tab.isUiSelected         // User-selected in UI for operations
                  }"
                  :title="`${tab.title || 'No title'}\n${tab.url}`"
                  :style="{ width: `${panelDisplayRef?.rangeItems?.overviewIconSize?.value ?? 20}px`, height: `${panelDisplayRef?.rangeItems?.overviewIconSize?.value ?? 20}px` }"
                >
                  <img 
                    :src="tab.favIconUrl || defaultIcon" 
                    :alt="tab.title || 'Tab icon'"
                    class="tab-icon"
                    @error="(e) => e.target.src = defaultIcon"
                  />
                </div>

                <!-- Count indicator if more than 20 tabs -->
                <div 
                  v-if="window.tabs.length > 20"
                  class="tab-count-indicator"
                  :title="`${window.tabs.length - 20} more tabs`"
                >
                  ...{{ window.tabs.length - 20 }}...
                </div>

                <!-- Last 10 tabs -->
                <div
                  v-for="tab in getLastTabs(window.tabs, 10)"
                  :key="tab.id"
                  class="tab-icon-item"
                  :class="{
                    'browser-active-tab-icon': tab.isActive,        // Browser's current active tab
                    'browser-last-active-tab-icon': tab.isLastActive,   // Browser's previous active tab
                    'browser-selected-tab-icon': tab.isBrowserSelected, // Browser-selected tabs (highlighted)
                    'ui-selected-tab-icon': tab.isUiSelected         // User-selected in UI for operations
                  }"
                  :title="`${tab.title || 'No title'}\n${tab.url}`"
                  :style="{ width: `${panelDisplayRef?.rangeItems?.overviewIconSize?.value ?? 20}px`, height: `${panelDisplayRef?.rangeItems?.overviewIconSize?.value ?? 20}px` }"
                >
                  <img 
                    :src="tab.favIconUrl || defaultIcon" 
                    :alt="tab.title || 'Tab icon'"
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
import { ref, computed, onMounted, onUnmounted, onUpdated, watch, nextTick } from 'vue'

import { useTabClickDelegation } from '@/composables/useTabClickDelegation'
import { useTabsOpen } from '@/stores/TabsOpen'
import { useTabsSelect } from '@/stores/TabsSelect'
import { useServerStore } from '@/stores/Server'
import { useCommunicateStore } from '@/stores/Communicate'
import { storeToRefs } from 'pinia'
import { calculateContextMenuPos } from '@/utils/contextMenuPosition'
import PanelDisplaySetting from '@/panel/PanelDisplaySetting.vue'
import TabCard from '@/components/TabCard.vue'
import TabsOpenHistory from './TabsOpenHistory.vue'
import TabsContextMenu from '@/components/TabsContextMenu.vue'

// No more props needed - data comes from store
const emit = defineEmits([
  'tab-activated',
  'show-context-menu',
  'upload-selected-tabs',
  'upload-single-tab'
])

// Use Pinia store
const tabsStore = useTabsOpen()
const tabsSelectStore = useTabsSelect()
const serverStore = useServerStore()
const communicateStore = useCommunicateStore()

const {
  sessionsOpen, 
  windowCurrentId, 
  tabsOpenNumTotal, 
  isLoading, 
  lastError,
  tabsOpenHistory 
} = storeToRefs(tabsStore)

const {tabsMapOpen} = storeToRefs(tabsStore)

// Note: Selection state is now stored directly in tab.isUiSelected property for efficiency

// Get methods from store
const {
  activateTab, 
  closeTab, 
  refreshData, 
  cleanupTabsOpen,
  updateWinPos,
} = tabsStore

const { windowPositions } = storeToRefs(tabsStore)

// scroll monitoring (component-specific)
const isScrollReportPaused = ref(false)
const windowIdVisible = ref(null) // currently visible window id
const scrollEventTimeout = ref(null) // throttling timeout

// ref to PanelDisplaySetting component
const panelDisplayRef = ref(null)

// configuration for PanelDisplaySetting - completely semantic and configurable
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

// Use tab click delegation composable
const { createGridEventHandlers, initShiftKeyTracking, updateTabsMap } = useTabClickDelegation()

// computed grid template columns based on settings
const gridTemplateColumns = computed(() => {
  // Only use fallback if panel hasn't loaded yet, not for actual false values
  const useResponsive = panelDisplayRef.value?.booleanItems?.useResponsiveGrid?.value ?? true
  const columns = panelDisplayRef.value?.rangeItems?.columnsPerRow?.value ?? 2
  console.warn('=== TABS OPEN: gridTemplateColumns:', useResponsive, columns, 'panelLoaded:', !!panelDisplayRef.value)
  if (useResponsive) {
    return `repeat(auto-fit, minmax(${minItemWidth.value}px, 1fr))`
  } else {
    return `repeat(${columns}, 1fr)`
  }
})

// computed grid gap
const gridGap = computed(() => '8px')

// computed minimum item width
const minItemWidth = computed(() => 200)

// Initialize shift key tracking to prevent text selection during shift-click
let cleanupShiftTracking = null

// Default icon
const defaultIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>'

// Context menu state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  tab: null
})

const contextMenuRef = ref(null)

const contextMenuLoading = ref({
  action: null,
  isLoading: false
})

// Computed for selection count
const openSelectionCount = computed(() => tabsSelectStore.getSelectedCount('open'))
const tabsOpenSelected = computed(() => tabsSelectStore.getSelectedTabs('open'))

// Context menu items for open tabs
const contextMenuItems = computed(() => {
  const items = []
  // Switch to tab action
  items.push({ 
    name: 'switch', 
    text: 'Switch to tab', 
    icon: '🔗',
    loadingText: 'Switching...'
  })
  
  // Upload action
  items.push({ 
    name: 'upload', 
    text: openSelectionCount.value > 1 ? 'Upload selected tabs' : 'Upload tab',
    icon: '☁️',
    loadingText: 'Uploading...'
  })
  
  // Extract and upload via SingleFile extension
  items.push({
    name: 'extract-upload-singlefile',
    text: 'Extract & Upload (SingleFile)',
    icon: '📄',
    loadingText: 'Extracting...'
  })
  
  // Close action
  items.push({ 
    name: 'close', 
    text: 'Close tab',
    icon: '✕',
    loadingText: 'Closing...'
  })
  
  // Clear selection (only if there's a selection)
  if (openSelectionCount.value > 0) {
    items.push({ 
      name: 'clear-selection', 
      text: 'Clear selection', 
      icon: '🔄'
    })
  }
  
  return items
})

// Event handlers for individual tab actions
const handleTabClick = (tab, event, source) => {
  // Hide context menu on any click
  contextMenu.value.show = false
  
  tabsSelectStore.handleTabClick(tab, event, source)
}

const handleTabDoubleClick = async (tab) => {
  try {
    await activateTab(tab)
    emit('tab-activated', tab)
  } catch (error) {
    console.error('Error activating tab:', error)
  }
}

const handleTabClose = async (tab) => {
  try {
    await closeTab(tab)

    // chrome.tabs.onRemoved event listeners will handle the rest
    // Remove from selection before closing
    // tabsSelectStore.removeClosedTab(tab.id, 'open')
  } catch (error) {
    console.error('Error closing tab:', error)
  }
}

const requestContextMenuShow = async (event, tab) => {
  // First show the menu to make it measurable
  contextMenu.value = {
    show: true,
    x: -1000, // Temporary position
    y: -1000, // Temporary position
    tab
  }
  
  // Wait for Vue to update the DOM
  await nextTick()
  
  // Calculate position using the utility function
  const { x, y } = calculateContextMenuPos({
    event,
    containerSelector: '.tabs-panel',
    scrollContainerSelector: '.windows-container',
    contextMenuRef,
    defaultMenuWidth: 150,
    defaultMenuHeight: 120,
    accountForScroll: false // TabsOpen uses viewport bounds approach
  })

  // Update context menu state with final position
  contextMenu.value = {
    show: true,
    x,
    y,
    tab
  }

  event.preventDefault()
}

// Single context menu action handler
const handleContextMenuAction = async (event) => {
  const { action, tab, tabs, selectedCount, hasSelection } = event
  
  contextMenuLoading.value = { action, isLoading: true }
  
  try {
    switch (action) {
      case 'switch':
        // Switch to the first tab (usually single selection)
        if (tabs.length > 0) {
          await handleTabDoubleClick(tabs[0])
        }
        break
        
      case 'upload':
        emit('upload-selected-tabs', 'open')
        break
        
      case 'close':
        await closeSelectedTabs()
        break
        
      case 'clear-selection':
        handleClearSelection()
        break
        
      case 'extract-upload-singlefile':
        await handleExtractAndUploadTab(tab)
        break
        
      default:
        console.warn('TabsOpen.vue: Unknown context menu action:', action)
    }
  } catch (error) {
    console.error('TabsOpen.vue: Context menu action error:', error)
  } finally {
    contextMenuLoading.value = { action: null, isLoading: false }
    contextMenu.value.show = false
  }
}

const handleClearSelection = () => {
  tabsSelectStore.clearSelection('open')
  contextMenu.value.show = false
}

// Handle extract and upload via SingleFile extension
const handleExtractAndUploadTab = async (tab) => {
  console.log('=== TABS OPEN: handleExtractAndUploadTab called for tab:', tab.id, tab.url)
  
  try {
    // Get current server URL
    const urlCurrent = serverStore.getUrlCurrent()
    if (!urlCurrent) {
      console.error('=== TABS OPEN: No server URL configured')
      alert('Please configure a server URL in settings before extracting and uploading.')
      return
    }
    
    const serverUrl = urlCurrent.url
    console.log('=== TABS OPEN: Using server URL:', serverUrl)
    
    // Prepare tab info
    const tabInfo = {
      url: tab.url,
      title: tab.title,
      windowId: tab.windowId
    }
    
    // Use communicate store to send message
    const response = await communicateStore.sendExtractAndUploadMessage(tab.id, serverUrl, tabInfo)
    
    if (response && response.success) {
      console.log('=== TABS OPEN: Extract and upload initiated successfully')
      // Success feedback is handled by the communicate store
    } else {
      console.error('=== TABS OPEN: Extract and upload failed:', response?.message)
      alert(`Failed to start extraction: ${response?.message || 'Unknown error'}`)
    }
    
  } catch (error) {
    console.error('=== TABS OPEN: Error sending extract-and-upload message:', error)
    alert(`Error: ${error.message}`)
  } finally {
    contextMenu.value.show = false
  }
}

const closeSelectedTabs = async () => {
  // Get all selected open tabs
  const tabsOpenSelected = tabsSelectStore.getSelectedTabs('open')
  
  if (tabsOpenSelected.length === 0) {
    console.log('closeSelectedTabs(): No open tabs selected for closing')
    return
  }
  
  console.log(`closeSelectedTabs(): Closing ${tabsOpenSelected.length} selected tabs...`)
  
  try {
    const tabIds = tabsOpenSelected.map(tab => tab.id)
    console.log(`closeSelectedTabs(): Bulk closing ${tabIds.length} tabs with IDs:`, tabIds)
    
    // Remove from selection before closing to avoid issues
    tabsSelectStore.clearSelection('open')
    
    // Close all tabs at once
    await chrome.tabs.remove(tabIds)
    
    console.log(`closeSelectedTabs(): Successfully closed ${tabIds.length} tabs`)
  } catch (error) {
    console.error('closeSelectedTabs(): Error bulk closing tabs:', error)
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
  onTabDoubleClick: handleTabDoubleClick,
  onTabRightClick: (event, tab, tabEl) => {
    console.log('TabsOpen.vue: onTabRightClick() tab:', tab)
    // const tabId = parseInt(tabCard.dataset.tabId)
    if(event.shiftKey || event.ctrlKey) {}else{
      tabsSelectStore.clearSelection('open')
    }
    tabsSelectStore.selectTab(tab, 'open')
    if (tab) {
      requestContextMenuShow(event, tab)
    }
  },
  onTabRemove: handleTabClose,
  tabsData: sessionsOpen,
  source: 'open'
})

const handleTabActivated = (tab) => {
  emit('tab-activated', tab)
}

// Helper methods for overview mode
const getFirstTabs = (tabs, count) => {
  return tabs.slice(0, count)
}

const getLastTabs = (tabs, count) => {
  if (tabs.length <= count * 2) return [] // Don't show last tabs if total is small
  return tabs.slice(-count)
}

// scroll monitoring functions (component-specific)
const getVisibleWindowId = () => {
  if (typeof document === 'undefined') return null
  
  const scrollContainer = document.querySelector('.windows-container')
  if (!scrollContainer) return null
  
  const scrollTop = scrollContainer.scrollTop
  
  // find the first window whose top is at or above the scroll position
  let visibleWindowId = null
  let minDistance = Infinity
  
  for (const [windowId, position] of windowPositions.value.entries()) {
    if (position.top <= scrollTop + 10) { // 10px tolerance
      const distance = scrollTop - position.top
      if (distance < minDistance) {
        minDistance = distance
        visibleWindowId = windowId
      }
    }
  }
  
  // if no window is above scroll position, return the first window
  if (visibleWindowId === null && windowPositions.value.size > 0) {
    const firstEntry = windowPositions.value.entries().next().value
    visibleWindowId = firstEntry[0]
  }
  
  return visibleWindowId
}

const onScrollEvent = () => {
  if (isScrollReportPaused.value) return
  
  // throttle scroll events to max 0.1s frequency
  if (scrollEventTimeout.value) return
  
  scrollEventTimeout.value = setTimeout(() => {
    const newVisibleWindowId = getVisibleWindowId()
    if (newVisibleWindowId !== windowIdVisible.value) {
      windowIdVisible.value = newVisibleWindowId
      console.log('TabsOpen: Visible window changed to:', newVisibleWindowId)
    }
    scrollEventTimeout.value = null
  }, 100) // 0.1s = 100ms
}

// Update fast lookup map when sessionsOpen changes
const updateTabsMapOpen = () => {
  // console.log('TabsOpen.vue: updateTabsMapOpen()')
  updateTabsMap(sessionsOpen, 'open')
}

// Watch for changes in sessionsOpen to update the fast lookup map
watch(sessionsOpen, updateTabsMapOpen, { immediate: true })

// watch refresh count to trigger refresh when button is clicked
watch(() => panelDisplayRef.value?.triggerItems?.find?.(item => item.name === 'refresh')?.count, (newCount, oldCount) => {
  if (newCount > oldCount) {
    refreshData()
  }
})

// Lifecycle hooks with detailed logging
onMounted(() => {
  // console.log('TabsOpen.vue: Component mounted')
})

onUnmounted(() => {
  // console.log('TabsOpen.vue: Component unmounted')
})

onUpdated(() => {
  // console.log('TabsOpen.vue: Component updated')
})

watch(windowCurrentId, (newId, oldId) => {
  console.log('TabsOpen.vue: windowCurrentId changed', { 
    newId, 
    oldId,
    trigger: new Error().stack?.split('\n')[2]?.trim() || 'unknown'
  })
})
// Lifecycle
onMounted(async () => {
  // Initialize shift key tracking
  cleanupShiftTracking = initShiftKeyTracking()
  
  // Add click listener to close context menu
  document.addEventListener('click', handleClickOutside)

  // Add scroll listener for window position tracking
  const scrollContainer = document.querySelector('.windows-container')
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', onScrollEvent)
    // initial position update
    setTimeout(() => {
      updateWinPos()
      onScrollEvent()
    }, 100)
  }
  // configuration is already set in booleanItemsConfig above
  // no need to manually set values since they're configured declaratively

  // await initTabsOpen() // called by TabsColumns.vue
})

onUnmounted(() => {
  // cleanup shift key tracking
  if (cleanupShiftTracking) {
    cleanupShiftTracking()
  }
  
  // remove click listener
  document.removeEventListener('click', handleClickOutside)
  
  // remove scroll listener
  const scrollContainer = document.querySelector('.windows-container')
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', onScrollEvent)
  }
  
  // cleanup scroll event timeout
  if (scrollEventTimeout.value) {
    clearTimeout(scrollEventTimeout.value)
    scrollEventTimeout.value = null
  }
  
  // cleanup store event listeners
  cleanupTabsOpen()
})

// Helper method to get active and selected tabs
const getActiveAndSelectedTabs = computed(() => {
  console.log('getActiveAndSelectedTabs() computed')
  return (windowId) => {
    const activeTabs = tabsOpenHistory.value.get(windowId)?.active || []
    const selectedTabs = tabsOpenHistory.value.get(windowId)?.selected || []
    const combinedTabs = [...activeTabs, ...selectedTabs]
    const uniqueTabs = combinedTabs.filter((tab, index, self) =>
      index === self.findIndex((t) => t.id === tab.id)
    )
    return uniqueTabs
  }
})

// scroll to specific window
const scrollToWindow = (windowId) => {
  const windowContainer = document.querySelector(`.window-container[data-window-id="${windowId}"]`)
  if (!windowContainer) {
    console.warn(`scrollToWindow(): Window container not found for windowId: ${windowId}`)
    return
  }
  
  const scrollContainer = document.querySelector('.windows-container')
  if (!scrollContainer) {
    console.warn('scrollToWindow(): Windows container not found')
    return
  }
  
  // pause scroll reporting during programmatic scroll
  isScrollReportPaused.value = true
  
  // calculate scroll position relative to the scroll container
  const containerRect = scrollContainer.getBoundingClientRect()
  const windowRect = windowContainer.getBoundingClientRect()
  const currentScrollTop = scrollContainer.scrollTop
  
  // calculate the target scroll position
  const targetScrollTop = currentScrollTop + (windowRect.top - containerRect.top) + 3; // 3px offset from top
  
  // smooth scroll to the window
  scrollContainer.scrollTo({
    top: targetScrollTop,
    behavior: 'smooth'
  })
  
  // resume scroll reporting after scroll animation completes
  setTimeout(() => {
    isScrollReportPaused.value = false
    // trigger position update and check visible window
    updateWinPos()
    onScrollEvent()
  }, 500) // 500ms should be enough for smooth scroll animation
  
  console.log(`scrollToWindow(): Scrolled to window ${windowId}`)
}

// Expose methods for parent components
defineExpose({
  scrollToWindow,
  windowIdVisible,
  getVisibleWindowId,
  onScrollEvent,
  isScrollReportPaused
})

</script>

<style scoped>
.tabs-open-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px); /* Account for header and padding */
  overflow: hidden;
  position: relative; /* Enable relative positioning for context menu */
}

.tabs-open-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dadce0;
}

.tabs-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 32px;
}

.error-message {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.retry-btn {
  padding: 8px 16px;
  border: 1px solid #1a73e8;
  border-radius: 4px;
  background: white;
  color: #1a73e8;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: #e8f0fe;
}

.windows-container {
  position: relative;
  flex: 1;
  overflow-y: auto;
  height: 100%;
}

.window-container {
  position: relative;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  overflow: hidden;
  margin-bottom: 0px;
}

.window-container.current-window {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.3);
  border: 1px solid #1a73e8;
}

.window-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dadce0;
}

.current-window .window-header {
  background-color: #e8f0fe;
}

.window-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}

.current-window .window-title {
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


/* WindowsBased Mode Styles */
.overview-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.overview-window {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.overview-window.current-window {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.3);
  border: 1px solid #1a73e8;
}

.overview-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dadce0;
}

.overview-window.current-window .overview-window-header {
  background-color: #e8f0fe;
}

.overview-window-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.overview-window.current-window .overview-window-title {
  color: #1a73e8;
}

.overview-icons-container {
  padding: 12px;
}

/* tab-icons-grid styles are applied inline via :style binding */

.tab-icon-item {
  cursor: pointer;
  /* transition: transform 0.2s ease; */
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.tab-icon-item:hover {
  transform: scale(1.2);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.tab-icon-item.browser-active-tab-icon {
  border: 2px solid #1a73e8 !important;        /* Blue border for browser's active tab */
  border-radius: 4px;
}

.tab-icon-item.browser-last-active-tab-icon {
  border: 2px dashed #1a73e8 !important;      /* Dashed blue border for browser's last active tab */
  border-radius: 4px;
}

.tab-icon-item.browser-selected-tab-icon {
  border: 2px solid #fd8001;
  border-top: 2px solid #fd8001 !important;   /* Orange top border for browser-selected tabs (highlighted) */
}

.tab-icon-item.ui-selected-tab-icon {
  border-bottom: 3px solid #34a853; /* Green bottom border for UI-selected tabs */
}

.tab-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: #f5f5f5;
  border-radius: 2px;
}

.tab-count-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-secondary);
  background-color: #f1f3f4;
  border-radius: 2px;
  text-align: center;
  padding: 2px;
  min-height: 16px;
  cursor: default;
}

.limited-icons-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Make containers relative for absolute positioning of context menu */
.windows-container,
.tabs-open-container {
  position: relative;
}
</style>

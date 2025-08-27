<template>
  <div class="tabs-open-virtual-container">
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

    <!-- Error State -->
    <div v-if="lastError && !isLoading" class="error-state">
      <div class="error-message">{{ lastError }}</div>
      <button @click="refreshData" class="retry-btn">Retry</button>
    </div>

    <!-- Virtual Scroller Container -->
    <div v-else class="virtual-container">
      <RecycleScroller
        v-if="flattenedItems.length > 0"
        class="virtual-scroller"
        :items="flattenedItems"
        :item-size="estimatedItemHeight"
        :buffer="bufferSize"
        key-field="uniqueId"
        v-slot="{ item, index }"
        @resize="handleResize"
      >
        <!-- Window Header Item -->
        <div
          v-if="item.type === 'window-header'"
          :key="`header-${item.uniqueId}`"
          class="window-header-item"
          :class="{ 'current-window': item.windowId === windowCurrentId }"
        >
          <div class="window-title">
            {{ item.windowId === windowCurrentId ? 'Current Window' : `Window ${item.windowId}` }}
          </div>
          <div class="tab-count">
            {{ item.tabCount }} tab{{ item.tabCount !== 1 ? 's' : '' }}
          </div>
        </div>

        <!-- Tab Row Item (Multiple tabs per row) -->
        <div
          v-else-if="item.type === 'tab-row'"
          :key="`row-${item.uniqueId}`"
          class="tab-row-item"
          :style="{ 
            display: 'grid',
            gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)`,
            gap: gridGap,
            padding: '0 16px',
            marginBottom: '4px'
          }"
          @click="handleRowClick"
          @dblclick="handleRowDoubleClick"
          @contextmenu="handleRowContextMenu"
        >
          <TabCard
            v-for="tab in item.tabs"
            :key="tab.id"
            :tab="tab"
            :show-icon="showIcon"
            :show-title="showTitle"
            :show-url="showUrl"
            :show-remove-button="true"
            :remove-button-title="'Close tab'"
            :data-tab-id="tab.id || tab.tabId"
            :data-window-id="tab.windowId"
            :source="'open'"
            :default-icon="defaultIcon"
          />
        </div>
      </RecycleScroller>

      <!-- Context Menu (positioned absolutely) -->
      <TabsContextMenu
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'

import { useTabClickDelegation } from '../composables/useTabClickDelegation'
import { useTabsOpen } from '../stores/TabsOpen'
import { useTabsSelect } from '../stores/TabsSelect'
import { storeToRefs } from 'pinia'
import { calculateContextMenuPos } from '../utils/contextMenuPosition'
import PanelDisplaySetting from '@/panel/PanelDisplaySetting.vue'
import TabCard from '@/tabs/TabCard.vue'
import TabsContextMenu from '@/tabs/TabsContextMenu.vue'

// Import virtual scroller styles
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

console.log('TabsOpenVirtual.vue: Script setup executing')

const emit = defineEmits([
  'tab-activated',
  'show-context-menu',
  'upload-selected-tabs',
  'upload-single-tab'
])

// Use Pinia store
const tabsStore = useTabsOpen()
const tabsSelectStore = useTabsSelect()

const {
  sessionsOpen, 
  windowCurrentId, 
  tabsOpenNumTotal, 
  isLoading, 
  lastError
} = storeToRefs(tabsStore)

const {tabsMapOpen} = storeToRefs(tabsStore)

// Get methods from store
const {
  activateTab, 
  closeTab, 
  refreshData, 
} = tabsStore

// ref to PanelDisplaySetting component
const panelDisplayRef = ref(null)

// configuration for PanelDisplaySetting - virtual tabs specific
const booleanItemsConfig = ref([
  { name: 'showIcon', label: 'Icon', value: true, title: 'Toggle icon display' },
  { name: 'showTitle', label: 'Title', value: true, title: 'Toggle title display' },
  { name: 'showUrl', label: 'URL', value: false, title: 'Toggle URL display' },
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
const showUrl = computed(() => panelDisplayRef.value?.booleanItems?.showUrl?.value || false)
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

// Virtual scroller configuration
const bufferSize = ref(5) // Number of items to render outside visible area
const estimatedItemHeight = ref(80) // Estimated height per row

// Default icon
const defaultIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>'

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
    text: openSelectionCount.value > 1 ? '☁️ Upload selected tabs' : '☁️ Upload tab',
    icon: '☁️',
    loadingText: 'Uploading...'
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

// Convert windows and tabs data into a flat array for virtual scrolling
const flattenedItems = computed(() => {
  const items = []
  let itemCounter = 0

  if (!sessionsOpen.value || !Array.isArray(sessionsOpen.value)) {
    return items
  }

  sessionsOpen.value.forEach(window => {
    // Add window header
    items.push({
      type: 'window-header',
      uniqueId: `window-header-${window.id}`,
      windowId: window.id,
      tabCount: window.tabs.length
    })

    // Group tabs into rows based on columnsPerRow
    const tabs = window.tabs || []
    const tabRows = []
    
    for (let i = 0; i < tabs.length; i += columnsPerRow.value) {
      const rowTabs = tabs.slice(i, i + columnsPerRow.value)
      tabRows.push({
        type: 'tab-row',
        uniqueId: `tab-row-${window.id}-${Math.floor(i / columnsPerRow.value)}`,
        windowId: window.id,
        tabs: rowTabs,
        rowIndex: Math.floor(i / columnsPerRow.value)
      })
    }

    items.push(...tabRows)
  })

  return items
})

// Event handlers for row-based interactions
const handleRowClick = async (event) => {
  const tab = await findTabFromRowEvent(event)
  if (tab) {
    if (event.target.closest('.tab-remove-button')) {
      requestTabClose(tab)
    } else {
      handleTabClick(tab, event, 'open')
    }
  }
}

const handleRowDoubleClick = async (event) => {
  const tab = await findTabFromRowEvent(event)
  if (tab) {
    handleTabDoubleClick(tab)
  }
}

const handleRowContextMenu = async (event) => {
  const tab = await findTabFromRowEvent(event)
  if (tab) {
    handleContextMenuShow(event, tab)
  }
}

// Helper function to find tab from row event
const findTabFromRowEvent = async (event) => {
  const tabCard = event.target.closest('.tab-card')
  if (!tabCard) return null
  const tabId = parseInt(tabCard.dataset.tabId)
  if (!tabId) return null
  let tabInfo = tabsMapOpen.value.get(tabId)
  if(tabInfo){
    return tabInfo.tab
  }else{
    console.error(`findTabFromRowEvent(): Tab ${tabId} not found in tabsMapOpen`)
    return null
  }
}

// Event handlers for individual tab actions
const handleTabClick = (tab, event, source) => {
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

const requestTabClose = async (tab) => {
  try {
    await closeTab(tab) // the rest will be handled by chrome.tabs.onRemoved listener
  } catch (error) { console.error('TabsOpenVirtual.vue: requestTabClose(): Error closing tab:', error) }
}

const handleContextMenuShow = (event, tab) => {
  // Calculate position using the utility function
  const { x, y } = calculateContextMenuPos({
    event,
    containerSelector: '.virtual-container',
    scrollContainerSelector: '.virtual-container',
    defaultMenuWidth: 150,
    defaultMenuHeight: 120,
    accountForScroll: true // TabsOpenVirtual uses scroll-aware positioning
  })

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
        
      default:
        console.warn('TabsOpenVirtual.vue: Unknown context menu action:', action)
    }
  } catch (error) {
    console.error('TabsOpenVirtual.vue: Context menu action error:', error)
  } finally {
    contextMenuLoading.value = { action: null, isLoading: false }
    contextMenu.value.show = false
  }
}

const handleClearSelection = () => {
  tabsSelectStore.clearSelection('open')
  contextMenu.value.show = false
}

const closeSelectedTabs = async () => {
  const tabsOpenSelected = tabsSelectStore.getSelectedTabs('open')
  
  if (tabsOpenSelected.length === 0) {
    return
  }
  
  try {
    const tabIds = tabsOpenSelected.map(tab => tab.id)
    tabsSelectStore.clearSelection('open')
    await chrome.tabs.remove(tabIds)
  } catch (error) {
    console.error('Error closing tabs:', error)
  }
}

// Handle virtual scroller resize events
const handleResize = () => {
  // Update estimated height based on actual rendered items
  // This can be enhanced to measure actual heights
}

// Click handler to close context menu when clicking outside
const handleClickOutside = (event) => {
  const menu = event.target.closest('.context-menu')
  if (!menu && contextMenu.value.show) {
    contextMenu.value.show = false
  }
}

// Update fast lookup map when sessionsOpen changes
const updateTabsMapOpen = () => {
  updateTabsMap(sessionsOpen, 'open')
}

// Watch for changes in sessionsOpen to update the fast lookup map
watch(sessionsOpen, updateTabsMapOpen, { immediate: true })

// watch refresh count to trigger refresh when button is clicked
watch(refreshCount, (newCount, oldCount) => {
  if (newCount > oldCount) {
    refreshData()
  }
})

// Watch columns per row to recalculate flattened items
watch(columnsPerRow, () => {
  // Force reactivity update for flattenedItems
  console.log('Columns per row changed, items will recalculate')
})

// Lifecycle
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  
  // configuration is now set declaratively in booleanItemsConfig above
  // showUrl is already set to false in the config
  
  // await initTabsOpen() // called by TabsOpen.vue
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.tabs-open-virtual-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  overflow: hidden;
  position: relative;
}

.tabs-open-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dadce0;
  flex-shrink: 0;
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

.virtual-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.virtual-scroller {
  height: 100%;
}

.window-header-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dadce0;
  margin-bottom: 8px;
  border-radius: 8px 8px 0 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.window-header-item.current-window {
  background-color: #e8f0fe;
  border-bottom-color: #1a73e8;
}

.window-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  flex: 1;
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

.tab-row-item {
  min-height: 60px; /* Ensure consistent row height */
  align-items: stretch;
}

:deep(.tab-card.browser-active-tab) {
  border: 3px solid #1a73e8 !important;
  background-color: #e8f0fe !important;
}

:deep(.tab-card.browser-last-active-tab) {
  border: 3px dashed #1a73e8 !important;
  background-color: #e8f0fe !important;
}

:deep(.tab-card.browser-selected-tab) {
  border: 3px solid #fd8001;
  border-top: 3px solid #fd8001 !important;
}

/* Ensure virtual scroller works properly */
:deep(.vue-recycle-scroller) {
  height: 100%;
}

:deep(.vue-recycle-scroller__item-wrapper) {
  overflow: visible;
}

:deep(.vue-recycle-scroller__item-view) {
  overflow: visible;
}
</style> 
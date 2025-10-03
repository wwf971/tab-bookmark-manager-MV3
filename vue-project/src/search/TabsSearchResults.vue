<template>
  <div class="tabs-search-results">
    <!-- Empty state -->
    <div v-if="tabs.length === 0" class="empty-results">
      <div class="empty-icon">🔍</div>
      <div class="empty-message">No {{ source }} tabs found matching your search</div>
    </div>

    <!-- Search results grid -->
    <div v-else class="search-results-grid" 
         :style="{ 
           display: 'grid',
           gridTemplateColumns: gridTemplateColumns,
           gap: gridGap,
           gridAutoRows: 'min-content'
         }"
         @click="handleGridClick"
         @dblclick="handleGridDoubleClick"
         @contextmenu="handleGridContextMenu">
      
      <TabCard
        v-for="tab in tabs"
        :key="`${source}-search-${tab.id}`"
        :tab="tab"
        :show-icon="showIcon"
        :show-title="showTitle"
        :show-url="showUrl"
        :show-remove-button="true"
        :source="source"
        :remove-button-title="source === 'open' ? 'Close tab' : 'Remove from remote'"
        :data-source="source"
        :data-tab-id="tab.id"
        :data-window-id="tab.windowId"
      />
    </div>
    <!-- Search results summary -->
    <div v-if="tabs.length > 0" class="search-summary">
      {{ tabs.length }} result{{ tabs.length !== 1 ? 's' : '' }}
      <span v-if="selectedCount > 0">
        • {{ selectedCount }} selected
      </span>
    </div>
  </div>

  <!-- Context Menu -->
  <TabsContextMenu
    ref="contextMenuRef"
    :show="contextMenu.show"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :tab="contextMenu.tab"
    :selected-count="selectedCount"
    :has-selection="selectedCount > 0"
    :selected-tabs="tabsSelected"
    :menu-items="contextMenuItems"
    :is-loading="contextMenuLoading.isLoading"
    :loading-action="contextMenuLoading.action"
    @menu-item-clicked="handleContextMenuAction"
  />

</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useTabClickDelegation } from '../composables/useTabClickDelegation'
import { useSessionsOpen } from '@/sessions-open/SessionsOpen'
import { useTabsSelect } from '@/tabs/TabsSelect'
import { useTabsRemote } from '@/sessions-remote/SessionsRemote'
import { useNetworkRequest } from '@/network/NetworkRequest'
import { useTagsEdit } from '@/tags/TagsEdit'
import { useTags } from '@/tags/Tags'
import { useTabsSearch } from '@/seach/TabsSearch'
import { calculateContextMenuPos } from '@/utils/contextMenuPosition'
import TabCard from '@/tabs/TabCard.vue'
import TabsContextMenu from '@/tabs/TabsContextMenu.vue'

// props
const props = defineProps({
  tabs: { // search results
    type: Array,
    required: true
  },
  source: {
    type: String,
    required: true,
    validator: (value) => ['open', 'remote'].includes(value)
  }
})

// emits
const emit = defineEmits([
  'tab-activated',
  'tab-closed',
  'show-context-menu',
  'open-settings',
  'upload-selected-tabs',
  'close-selected-tabs'
])

// use stores
const sessionStore = useSessionsOpen()
const tabsSelectStore = useTabsSelect()
const tabsRemoteStore = useTabsRemote()
const networkRequest = useNetworkRequest()
const tagsEditStore = useTagsEdit()
const tagsStore = useTags()
const tabsSearchStore = useTabsSearch()
const { activateTab, closeTab } = sessionStore

// fixed display settings for search results - show all info by default
const showIcon = ref(true)
const showTitle = ref(true)
const showUrl = ref(true)
const columnsPerRow = ref(2)
const useResponsiveGrid = ref(true)

// computed grid styles
const gridTemplateColumns = computed(() => {
  if (useResponsiveGrid.value) {
    return 'repeat(auto-fit, minmax(250px, 1fr))'
  } else {
    return `repeat(${columnsPerRow.value}, 1fr)`
  }
})

const gridGap = computed(() => '8px')

// use tab click delegation composable
const { createGridEventHandlers, initShiftKeyTracking, updateTabsMap } = useTabClickDelegation()

// context menu state
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

// Computed
const selectedCount = computed(() => {
  return props.tabs.filter(tab => tab.isUiSelected).length
})

const tabsSelected = computed(() => {
  return props.tabs.filter(tab => tab.isUiSelected)
})

// Context menu items based on source and selection state
const contextMenuItems = computed(() => {
  const items = []
  
  // Open/Activate action
  if (props.source === 'open') {
    items.push({ 
      name: 'activate', 
      text: 'Activate tab', 
      icon: '🔗',
      loadingText: 'Activating...'
    })
  } else {
    items.push({ 
      name: 'open', 
      text: 'Open in new tab', 
      icon: '🔗',
      loadingText: 'Opening...'
    })
  }
  
  // Upload action (only for open tabs)
  if (props.source === 'open') {
    items.push({ 
      name: 'upload', 
      text: selectedCount.value > 1 ? '☁️ Upload selected tabs' : '☁️ Upload tab',
      icon: '☁️',
      loadingText: 'Uploading...'
    })
  }
  
  // Edit tags (only for remote tabs, single tab only)
  if (props.source === 'remote' && selectedCount.value <= 1) {
    items.push({ 
      name: 'edit-tags', 
      text: 'Edit Tags',
      icon: '🏷️'
    })
  }
  
  // Change type to url (only for remote tabs, single tab only)
  if (props.source === 'remote' && selectedCount.value <= 1) {
    items.push({ 
      name: 'change-type-to-url', 
      text: 'Change to URL type', 
      icon: '🔄',
      loadingText: 'Changing type...'
    })
  }
  
  // Close/Remove action
  items.push({ 
    name: 'close', 
    text: props.source === 'open' ? 'Close tab' : 'Remove from remote',
    icon: '✕',
    loadingText: props.source === 'open' ? 'Closing...' : 'Removing...'
  })
  
  // Clear selection (only if there's a selection)
  if (selectedCount.value > 0) {
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
  // tabsSelectStore.handleTabClick(tab, event, source)
  const allTabs = props.tabs;
  tabsSelectStore.handleTabClick(tab, event, source, allTabs)
}

const handleTabDoubleClick = async (tab) => {
  try {
    if (props.source === 'open') {
      await activateTab(tab)
      emit('tab-activated', tab)
    } else if (props.source === 'remote') {
      // Open remote tab in a new browser tab
      chrome.tabs.create({ url: tab.url })
      // TODO: detect if the tab is already open in a browser tab and activate it
    }
  } catch (error) {
    console.error('TabsSearchResults.vue: Error handling tab double-click:', error)
  }
}

const requestTabCloseInSearchResults = async (tab) => {
  // console.log('TabsSearchResults.vue: requestTabCloseInSearchResults(): tabs.length:', props.tabs.length)
  try {
    if (props.source === 'open') {
      await closeTab(tab) // chrome.tabs.onRemoved listener will remote tab from search results
    }
    else if (props.source === 'remote') { // Remove from server and local state
      const result = await tabsRemoteStore.removeTabRemote(tab)  
      if (!result.is_success) {
        console.error('TabsSearchResults.vue: Failed to remove tab:', result.message)
      } else {
        console.warn(`TabsSearchResults.vue: requestTabCloseInSearchResults(): tabId: ${tab.id}. about to remove from search results`)
        // tabsSearchStore.onTabsRemoteRemoved(tab)
        // // Remove from search results
        // const index = props.tabs.indexOf(tab)
        // if (index > -1) {
        //   props.tabs.splice(index, 1)
        // }
        // Update local state
        tabsRemoteStore.removeTabRemoteFromLocalCache(
          tab,
          true, // refreshTabsRemoteRecent
          true // removeFromSearchResults
        )
      }
    }
  } catch (error) {
    console.log('TabsSearchResults.vue: Error closing tab:', error, error.stack)
  } finally {
    // console.error('TabsSearchResults.vue: requestTabCloseInSearchResults(): tabs.length:', props.tabs.length)
  }
}

const requestContextMenuShow = async (event, tab, tabEl) => {
  console.error('TabsSearchResults.vue: requestContextMenuShow(): tabs.length:', props.tabs.length)
  tabsSelectStore.clearSelection(props.source)
  tab.isUiSelected = true;

  // First show the menu to make it measurable
  contextMenu.value = {
    show: true,
    x: 0, // Temporary position
    y: 0, // Temporary position
    tab
  }
  
  // Wait for Vue to update the DOM
  await nextTick()

  // Calculate position using the utility function
  const { x, y } = calculateContextMenuPos({
    event,
    containerSelector: '.search-results-container',
    scrollContainerSelector: '.column-content',
    contextMenuRef,
    defaultMenuWidth: 180,
    defaultMenuHeight: 150,
    accountForScroll: false
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
      case 'activate':
      case 'open':
        for (const tab of tabs) {
          await handleTabDoubleClick(tab)
        }
        break
        
      case 'upload':
        emit('upload-selected-tabs', props.source)
        break
        
      case 'edit-tags':
        // Get current tag IDs for the tab
        const tagsIdInit = tab.tags_id || []
        
        // Convert tag IDs to tag objects for display
        const result = await tagsStore.getTagsById(tagsIdInit)
        console.log('TabsSearchResults.vue: handleContextMenuEditTags: result:', result)
        if(!result.is_success) {
          console.error('TabsSearchResults.vue: handleContextMenuEditTags: error getting tags:', result.message)
          return
        }
        const tagsInit = result.data
        tagsEditStore.openTagsEdit(tab, tagsInit)
        break
        
      case 'change-type-to-url':
        // Change tab type from tab_remote to url
        try {
          const result = await networkRequest.changeNoteType(tab.id, 'url')
          if (result.is_success) {
            console.log(`TabsSearchResults.vue: Successfully changed tab ${tab.id} type to url`)
            // Remove the tab locally since it's no longer tab_remote type
            tabsRemoteStore.removeTabRemoteFromLocalCache(tab, false, true)
          } else {
            console.error('TabsSearchResults.vue: Failed to change tab type:', result.message)
          }
        } catch (error) {
          console.error('TabsSearchResults.vue: Error changing tab type:', error)
        }
        break
        
      case 'close':
        // For search results, we need to close each tab individually
        for (const tab of tabs) {
          await requestTabCloseInSearchResults(tab)
        }
        break
        
      case 'clear-selection':
        handleClearSelection()
        break
        
      default:
        console.warn('TabsSearchResults.vue: Unknown context menu action:', action)
    }
  } catch (error) {
    console.error('TabsSearchResults.vue: Context menu action error:', error)
  } finally {
    contextMenuLoading.value = { action: null, isLoading: false }
    contextMenu.value.show = false
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
  onTabRightClick: requestContextMenuShow,
  onTabRemove: requestTabCloseInSearchResults,
  tabsData: computed(() => [{ tabs: props.tabs }]), // Wrap in window-like structure for compatibility
  source: props.source
})

// Initialize shift key tracking
let cleanupShiftTracking = null

onMounted(() => {
  cleanupShiftTracking = initShiftKeyTracking()
  
  // Add click listener to close context menu
  document.addEventListener('click', handleClickOutside)
  
  // Update tabs map for click delegation
  updateTabsMap(computed(() => [{ tabs: props.tabs }]), props.source)
})

onUnmounted(() => {
  if (cleanupShiftTracking) {
    cleanupShiftTracking()
  }
  
  // Remove click listener
  document.removeEventListener('click', handleClickOutside)
})


// Updated handleClearSelection to close context menu
const handleClearSelection = () => {
  tabsSelectStore.clearSelection(props.source)
  contextMenu.value.show = false
}


</script>

<style scoped>
.tabs-search-results {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #5f6368;
  text-align: center;
  flex: 1;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-message {
  font-size: 16px;
  font-style: italic;
}

.search-results-grid {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
  flex: 1;
  overflow: auto;
}

.search-summary {
  padding: 8px 16px;
  font-size: 12px;
  color: #5f6368;
  border-top: 1px solid #e8eaed;
  background-color: #f8f9fa;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style> 
<template>
  <div class="tabs-columns-container">
    <!-- Search Component (only show when there are active columns) -->
    <div v-if="activeColumns.length > 0" class="search-section">
      <TabsSearch 
        @search-state-changed="handleSearchStateChange"
        ref="tabsSearchRef"
      />
    </div>

    <!-- show message if no types are selected -->
    <div v-if="activeColumns.length === 0" class="no-selection-message">
      <div class="message-content">
        <div class="icon">📂</div>
        <h3>No Tab Types Selected</h3>
        <p>Please select at least one tab or bookmark type from the toggles above to view content.</p>
      </div>
    </div>

    <!-- Show columns based on active types -->
    <div v-else class="columns-grid" :style="{ gridTemplateColumns: gridTemplate }">
      <!-- Open Tabs Column -->
      <div v-if="activeTabTypes.includes('open')" class="column">
        <div class="column-header">
          <h3>Open Tabs</h3>
          <div class="column-stats">
            <span v-show="!searchState.isSearchActive">
            {{ totalOpenTabs || 0 }} tab{{ (totalOpenTabs || 0) !== 1 ? 's' : '' }} in {{ (sessionsOpen || []).length }} window{{ (sessionsOpen || []).length !== 1 ? 's' : '' }}
            </span>
            <span v-show="searchState.isSearchActive">
              {{ searchState.sessionsOpenSearchResults.length }} search result{{ searchState.sessionsOpenSearchResults.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>
        <div class="column-content">
          <!-- Normal tabs view -->
          <div v-show="!searchState.isSearchActive">
          <TabsOpen
            @tab-activated="$emit('tab-activated', $event)"
            @tab-closed="$emit('tab-closed', $event)"
            @show-context-menu="$emit('show-context-menu', $event)"
              @upload-single-tab="handleUploadSingleTab"
              @upload-selected-tabs="handleUploadSelectedTabs"
            ref="tabsOpenRef"
          />
          </div>

          <!-- Search results of open tabs-->
          <div class="search-results-container" v-show="searchState.isSearchActive">
            <TabsSearchResults 
              :tabs="searchState.sessionsOpenSearchResults"
              source="open"
              @tab-activated="$emit('tab-activated', $event)"
              @tab-closed="$emit('tab-closed', $event)"
              @show-context-menu="$emit('show-context-menu', $event)"
              @upload-selected-tabs="handleUploadSelectedTabs"
              @close-selected-tabs="handleCloseSelectedTabs"
              ref="tabsSearchResultsRef"
            />
          </div>
        </div>
      </div>

      <!-- Local Tabs Column (Future) -->
      <div v-if="activeTabTypes.includes('local')" class="column">
        <div class="column-header">
          <h3>Local Tabs</h3>
          <div class="column-stats">Coming Soon</div>
        </div>
        <div class="column-content">
          <div class="coming-soon-content">
            <div class="coming-soon-icon">🚧</div>
            <p>Local tab storage feature will be available in a future update.</p>
          </div>
        </div>
      </div>

      <!-- Remote Tabs Column -->
      <div v-if="activeTabTypes.includes('remote')" class="column">
        <div class="column-header">
          <h3>Remote Tabs</h3>
          <div class="column-stats">
            <span v-show="!searchState.isSearchActive">
            <span v-if="remoteTabsLoaded">{{ sessionRemoteTabNumTotal }} tab{{ sessionRemoteTabNumTotal !== 1 ? 's' : '' }}</span>
            <span v-else>Loading...</span>
            </span>
            <span v-show="searchState.isSearchActive">
              {{ searchState.sessionsRemoteSearchResults.length }} search result{{ searchState.sessionsRemoteSearchResults.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>
        <div class="column-content">
          <!-- Normal remote tabs view -->
          <div v-show="!searchState.isSearchActive">
          <TabsRemote 
            @openSettings="$emit('openSettings')"
            ref="tabsRemoteRef"
          />
          </div>
          
          <!-- search results of remote tabs-->
          <div v-show="searchState.isSearchActive" class="search-results-container">
            <TabsSearchResults
              :tabs="searchState.sessionsRemoteSearchResults"
              source="remote"
            />
          </div>
        </div>
      </div>

      <!-- Open Bookmarks Column (Future) -->
      <div v-if="activeBookmarkTypes.includes('open')" class="column">
        <div class="column-header">
          <h3>Open Bookmarks</h3>
          <div class="column-stats">Coming Soon</div>
        </div>
        <div class="column-content">
          <div class="coming-soon-content">
            <div class="coming-soon-icon">🔖</div>
            <p>Open bookmarks feature will be available in a future update.</p>
          </div>
        </div>
      </div>

      <!-- Local Bookmarks Column (Future) -->
      <div v-if="activeBookmarkTypes.includes('local')" class="column">
        <div class="column-header">
          <h3>Local Bookmarks</h3>
          <div class="column-stats">Coming Soon</div>
        </div>
        <div class="column-content">
          <div class="coming-soon-content">
            <div class="coming-soon-icon">📚</div>
            <p>Local bookmarks storage feature will be available in a future update.</p>
          </div>
        </div>
      </div>

      <!-- Remote Bookmarks Column (Future) -->
      <div v-if="activeBookmarkTypes.includes('remote')" class="column">
        <div class="column-header">
          <h3>Remote Bookmarks</h3>
          <div class="column-stats">Coming Soon</div>
        </div>
        <div class="column-content">
          <div class="coming-soon-content">
            <div class="coming-soon-icon">☁️</div>
            <p>Remote bookmarks feature will be available in a future update.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add TabsUploadModal component -->
    <TabsUploadModal
      v-model:is-visible="showUploadModal"
      :tabs="tabsToUpload"
      :server-url="serverUrlDisplay"
      @upload-complete="handleUploadComplete"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import TabsOpen from '@/tab-browser/TabsOpen.vue'
import TabsRemote from './TabsRemote.vue'
import TabsSearch from './TabsSearch.vue'
import TabsSearchResults from './TabsSearchResults.vue'
import TabsUploadModal from './TabsUploadModal.vue'
import { useTabsRemote } from '@/stores/TabsRemote'
import { useNetworkRequest } from '@/stores/NetworkRequest'
import { useTabsSearch } from '@/stores/TabsSearch'
import { storeToRefs } from 'pinia'
import { useTabsOpen } from '@/stores/TabsOpen'

// Props
const props = defineProps({
  activeTabTypes: {
    type: Array,
    default: () => []
  },
  activeBookmarkTypes: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits(['tab-activated', 'tab-closed', 'show-context-menu', 'openSettings'])

// Refs
const tabsOpenRef = ref(null)
const tabsRemoteRef = ref(null)
const tabsSearchRef = ref(null)

// Stores
const tabsRemoteStore = useTabsRemote()
const tabsSearchStore = useTabsSearch()
const networkRequest = useNetworkRequest()
// Use TabsOpen store for open tabs data
const tabsOpenStore = useTabsOpen()
const { tabsOpenNumTotal: totalOpenTabs, sessionsOpen } = storeToRefs(tabsOpenStore)

// Use TabsSearch store for search state
const { searchState } = storeToRefs(tabsSearchStore)

// Debug: log the values to see what's happening
console.log('TabsColumns - totalOpenTabs:', totalOpenTabs.value, 'sessionsOpen:', sessionsOpen.value?.length)

// Computed
const activeColumns = computed(() => {
  return [...props.activeTabTypes, ...props.activeBookmarkTypes]
})

const gridTemplate = computed(() => {
  const columnCount = activeColumns.value.length
  if (columnCount === 0) return 'none'
  if (columnCount === 1) return '1fr'
  if (columnCount === 2) return '1fr 1fr'
  if (columnCount === 3) return '1fr 1fr 1fr'
  // For more than 3 columns, make them smaller
  return `repeat(${columnCount}, 1fr)`
})

const sessionRemoteTabNumTotal = computed(() => {
  return tabsRemoteStore.sessionRemoteTabNumTotal
})

const remoteTabsLoaded = computed(() => {
  return tabsRemoteStore.isSessionsRemoteLoaded
})

// Watch for tab types being activated
watch(() => props.activeTabTypes, async (newTypes, oldTypes) => {
  // Load remote tabs if they just got activated
  if (newTypes.includes('remote') && !oldTypes?.includes('remote')) {
    // Remote tabs just got activated, load them
    // Use nextTick to ensure component is fully mounted
    nextTick(() => {
      loadRemoteTabsData()
    })
  }
}, { immediate: true })

const loadRemoteTabsData = async () => {
  if (!props.activeTabTypes.includes('remote')) return
  
  try {
    // Use TabsRemote store method
    await tabsRemoteStore.loadRemoteTabs()
  } catch (error) {
    console.error('Error loading remote tabs data:', error)
  }
}

// Expose methods for parent component
defineExpose({})

// Initialize
onMounted(async () => {
  // Initialize TabsOpen store if it hasn't been initialized yet
  if (props.activeTabTypes.includes('open')) {
    try {
      await tabsOpenStore.initTabsOpen()
    } catch (error) {
      console.error('Error initializing TabsOpen store:', error)
    }
  }
  
  if (props.activeTabTypes.includes('remote')) {
    // Use nextTick to ensure all stores are initialized
    nextTick(() => {
      loadRemoteTabsData()
    })
  }
})

// Search state handling - now handled by TabsSearch store
const handleSearchStateChange = (newState) => {
  console.log('TabsColumns.vue: handleSearchStateChange:', newState)
  // tabsSearchStore.updateSearchState(newState)
}

// Component setup
const tabsToUpload = [];
const showUploadModal = ref(false)

const handleCloseSelectedTabs = async (source) => {
  if(!source === 'open'){
    console.error('TabsColumns.vue: handleCloseSelectedTabs(): source is not open')
    return;
  }
  emit('close-selected-tabs', source)
}

const handleUploadSelectedTabs = async (source) => {
  console.log('TabsColumns.vue: handleUploadSelectedTabs(): source:', source)
  if(!source === 'open'){
    console.error('TabsColumns.vue: handleUploadSelectedTabs(): source is not open')
    return;
  }
  // get selected tabs in open tabs
  const tabs = tabsOpenStore.tabsOpenUiSelected;
  tabsToUpload.value = tabs;
  emit('upload-selected-tabs', source)
}

const handleUploadSingleTab = async (_tab, source) => {
  // Delegate to the open tabs component if available    
  try {
    const result = await networkRequest.uploadTabToRemote(_tab)
    if (result.is_success) {
      // tabsOpenRef.value.showTabStatus(_tab.id, 'success')
      // No need to refresh remote tabs - they update automatically via store
      setTimeout(() => emit('tab-closed', tab), 1000)
    } else {
      console.error('TabsColumns.vue: handleUploadTabs(): Error uploading tab info:', result.message)
    }
  } catch (error) {
    console.error('TabsColumns.vue: handleUploadTabs(): Error uploading tab info:', error)
  }
}

const handleUploadComplete = () => {
  // Refresh data after upload is complete
  refreshData()
}

import { useServerStore } from '@/stores/Server.js'
const serverStore = useServerStore()

const serverUrlDisplay = computed(() => {
  const urlCurrent = serverStore.getUrlCurrent()
  if (!urlCurrent) return 'No URL configured'
  const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
  if (!serverUrlResult.is_success) {
    return `${urlCurrent.name}: ${serverUrlResult.message}`
  }
  return `${urlCurrent.name}: ${serverUrlResult.data}`
})
</script>

<style scoped>
.tabs-columns-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.search-section {
  padding: 8px;
  background: white;
  border-bottom: 1px solid #e8eaed;
  flex-shrink: 0;
  border-radius: 6px;
}

.no-selection-message {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px;
}

.message-content {
  text-align: center;
  color: var(--text-secondary);
}

.message-content .icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.message-content h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  color: #202124;
}

.message-content p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

.column {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  min-width: 0; /* Prevent grid overflow */
}

.column-header {
  padding: 8px;
  background: #f8f9fa;
  border-bottom: 1px solid #e1e3e1;
  flex-shrink: 0;
}

.column-header h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #202124;
}

.column-stats {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.column-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.column-content > div {
  height: 100%;
  overflow: auto; /* Ensure both normal and search views can scroll */
}

/* Special styling for embedded components */
.column-content :deep(.tabs-open-container),
.column-content :deep(.tabs-remote-container) {
  height: 100% !important;
  overflow: hidden;
}

.column-content :deep(.tabs-open-header),
.column-content :deep(.tabs-remote-header) {
  display: none; /* Hide headers since we have column headers */
}

.column-content :deep(.windows-container) {
  padding: 0; /* Remove extra padding in column context */
  height: 100%;
  overflow-y: auto;
}

.column-content :deep(.lists-container) {
  padding: 0; /* Remove extra padding in column context */
  height: 100%;
  overflow-y: auto;
}

.coming-soon-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-secondary);
  height: 100%;
}

.coming-soon-icon {
  font-size: 36px;
  margin-bottom: 16px;
}

.coming-soon-content p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .column-header {
    padding: 6px;
  }
  
  .column-header h3 {
    font-size: 8px;
  }
  
  .coming-soon-content {
    padding: 30px 15px;
  }
  
  .coming-soon-icon {
    font-size: 28px;
  }
}

</style>

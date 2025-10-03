<template>
  <div class="tabs-columns-virtual">
    <!-- Search Section -->
    <div v-if="searchState.isActive" class="search-section">
      <div class="search-results-container">
        <TabsSearchResults 
          v-if="searchState.hasResults"
          :tabs="searchState.results"
          :source="searchState.source"
          @tab-activated="handleTabActivated"
          @tab-closed="handleTabClosed"
          @show-context-menu="handleShowContextMenu"
          @upload-selected-tabs="handleUploadSelectedTabs"
          @close-selected-tabs="handleCloseSelectedTabs"
        />
        <div v-else class="no-results">
          <div class="message-content">
            <div class="icon">🔍</div>
            <h3>No results found</h3>
            <p>Try adjusting your search terms</p>
          </div>
        </div>
      </div>
    </div>

    <!-- No Selection Message -->
    <div v-else-if="activeColumns.length === 0" class="no-selection-message">
      <div class="message-content">
        <div class="icon">📱</div>
        <h3>Choose Your View</h3>
        <p>Select tab types and bookmarks to display from the settings above.</p>
      </div>
    </div>

    <!-- Columns Grid with Virtual Scrolling -->
    <div v-else class="columns-grid" :style="{ gridTemplateColumns: gridTemplate }">
      <!-- Open Tabs Column (Virtual) -->
      <div v-if="activeColumns.includes('open')" class="column">
        <div class="column-header">
          <h3>Open Tabs 🌐</h3>
          <div class="column-stats">{{ totalOpenTabs }} tabs</div>
        </div>
        <div class="column-content">
          <TabsOpenVirtual 
            ref="tabsOpenRef"
            @tab-activated="handleTabActivated"
            @tab-closed="handleTabClosed"
            @show-context-menu="handleShowContextMenu"
            @upload-selected-tabs="handleUploadSelectedTabs"
          />
        </div>
      </div>

      <!-- Remote Tabs Column -->
      <div v-if="activeColumns.includes('remote')" class="column">
        <div class="column-header">
          <h3>Remote Tabs ☁️</h3>
          <div class="column-stats">
            <span v-if="remoteTabsLoaded">{{ sessionRemoteTabNumTotal }} tabs</span>
            <span v-else>Loading...</span>
          </div>
        </div>
        <div class="column-content">
          <TabsRemote 
            ref="tabsRemoteRef"
            @tab-activated="handleTabActivated"
            @show-context-menu="handleShowContextMenu"
            @upload-selected-tabs="handleUploadSelectedTabs"
          />
        </div>
      </div>

      <!-- Bookmarks columns would go here -->
      <div v-for="bookmarkType in activeBookmarkTypes" :key="bookmarkType" class="column">
        <div class="column-header">
          <h3>{{ getBookmarkTitle(bookmarkType) }}</h3>
          <div class="column-stats">Coming soon</div>
        </div>
        <div class="column-content">
          <div class="coming-soon-content">
            <div class="coming-soon-icon">🔖</div>
            <p>Bookmark management coming soon</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <TabsUploadModal 
      v-if="showUploadModal"
      :tabs="tabsToUpload"
      :is-uploading="isUploading"
      @upload="handleUpload"
      @cancel="handleCancelUpload"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TabsOpenVirtual from './TabsOpenVirtual.vue'
import TabsRemote from './SessionsRemote.vue'

import TabsUploadModal from './TabsUploadModal.vue'
import { useTabsRemote } from '@/sessions-remote/SessionsRemote'
import { useNetworkRequest } from '@/network/NetworkRequest.js'
import { useTabsSearch } from '@/search/TabsSearch'
import TabsSearchResults from '@/search/TabsSearchResults.vue'
import { storeToRefs } from 'pinia'
import { useSessionsOpen } from '@/sessions-open/SessionsOpen'

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
const { urlListsLoaded } = storeToRefs(tabsRemoteStore)

// Use TabsOpen store for open tabs data
const tabsOpenStore = useSessionsOpen()
const { tabsOpenNumTotal: totalOpenTabs, sessionsOpen } = storeToRefs(tabsOpenStore)

// Use TabsSearch store for search state
const { searchState } = storeToRefs(tabsSearchStore)

// Debug: log the values to see what's happening
console.log('TabsColumnsVirtual - totalOpenTabs:', totalOpenTabs.value, 'sessionsOpen:', sessionsOpen.value?.length)

// Upload modal state
const showUploadModal = ref(false)
const tabsToUpload = ref([])
const isUploading = ref(false)

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

// Methods
const getBookmarkTitle = (type) => {
  const titles = {
    bookmarks: 'Bookmarks 🔖',
    history: 'History 📚',
    reading_list: 'Reading List 📖'
  }
  return titles[type] || 'Bookmarks'
}

// Event handlers
const handleTabActivated = (tab) => {
  console.log('TabsColumnsVirtual: Tab activated:', tab.title)
  emit('tab-activated', tab)
}

const handleTabClosed = (tab) => {
  console.log('TabsColumnsVirtual: Tab closed:', tab.title)
  emit('tab-closed', tab)
}

const handleShowContextMenu = (event, tab) => {
  console.log('TabsColumnsVirtual: Show context menu for tab:', tab.title)
  emit('show-context-menu', event, tab)
}

const handleUploadSelectedTabs = async (source) => {
  console.log('TabsColumnsVirtual: Upload selected tabs from source:', source)
  
  let selectedTabs = []
  
  if (source === 'open') {
    const tabsSelectStore = await import('@/tabs/TabsSelect.js').then(m => m.useTabsSelect())
    selectedTabs = tabsSelectStore.getSelectedTabs('open')
  } else if (source === 'remote') {
    const tabsSelectStore = await import('@/tabs/TabsSelect.js').then(m => m.useTabsSelect())
    selectedTabs = tabsSelectStore.getSelectedTabs('remote')
  }
  
  if (selectedTabs.length === 0) {
    console.log('No tabs selected for upload')
    return
  }
  
  tabsToUpload.value = selectedTabs
  showUploadModal.value = true
}

const handleCloseSelectedTabs = async () => {
  console.log('TabsColumnsVirtual: Close selected tabs')
  // This would be handled by the individual components
}

const handleUpload = async (uploadData) => {
  isUploading.value = true
  try {
    console.log('TabsColumnsVirtual: Uploading tabs:', uploadData)
    // Handle upload logic here
    await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate upload
    showUploadModal.value = false
    tabsToUpload.value = []
  } catch (error) {
    console.error('Upload failed:', error)
  } finally {
    isUploading.value = false
  }
}

const handleCancelUpload = () => {
  showUploadModal.value = false
  tabsToUpload.value = []
  isUploading.value = false
}
</script>

<style scoped>
.tabs-columns-virtual {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.search-section {
  padding: 16px;
  background: white;
  border-bottom: 1px solid #e8eaed;
  flex-shrink: 0;
  border-radius: 6px;
}

.search-results-container {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.no-results {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px;
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
.column-content :deep(.tabs-open-virtual-container),
.column-content :deep(.tabs-remote-container) {
  height: 100% !important;
  overflow: hidden;
}

.column-content :deep(.tabs-open-header),
.column-content :deep(.tabs-remote-header) {
  display: none; /* Hide headers since we have column headers */
}

.column-content :deep(.virtual-container) {
  padding: 0; /* Remove extra padding in column context */
  height: 100%;
  overflow: hidden;
}

.column-content :deep(.sessions-container) {
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
    font-size: 16px;
  }
  
  .coming-soon-content {
    padding: 30px 15px;
  }
  
  .coming-soon-icon {
    font-size: 28px;
  }
}


</style> 
<template>
  <div class="tab-manager">
    <div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="page-title">Tab Manager</div>
        <TabsPin />
      </div>
    </div>

    <!-- Content Views -->
    <div class="content-views">
      <!-- Tabs View with Main Window -->
      <div v-show="mainView === 'tabs'" class="content-view">
        <TabsMainWindow
          @tab-activated="handleTabActivate"
          @tab-closed="handleTabClose"
          @show-context-menu="handleShowContextMenu"
          @upload-single-tab="handleUploadSingleTab"
          @upload-selected-tabs="openUploadModal"
          ref="tabsMainWindowRef"
        />
      </div>

      <!-- Other Functions View -->
      <div v-show="mainView === 'other'" class="content-view">
        <!-- Sub-navigation for other functions -->
        <div class="sub-content-switcher">
          <div class="switcher-track">
            <div 
              class="switcher-slider"
              :style="{ transform: `translateX(${otherViewIndex * 100}%)` }"
            ></div>
            <button 
              v-for="(view, index) in otherViews" 
              :key="view.id"
              class="switcher-button"
              :class="{ active: otherView === view.id }"
              @click="switchOtherView(view.id)"
            >
              {{ view.label }}
            </button>
          </div>
        </div>

        <!-- Snapshots View -->
        <div v-show="otherView === 'snapshots'" class="sub-content-view">
          <SnapshotManager
            v-if="hasLoadedSnapshots"
            :windows="windows"
            :current-window-id="windowCurrentId"
          />
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <TabsUploadModal
      :is-visible="showUploadModal"
      :tabs="tabsToUpload"
      :server-url="currentServerUrl"
      @close="closeUploadModal"
      @upload-complete="handleUploadComplete"
      @open-tags-manager="handleOpenTagsManager"
    />

    <!-- Centralized Tags Edit Modal -->
    <TagsEdit
      @close="tagsEditStore.closeTagsEdit"
      @tags-saved="handleTabTagsSaved"
      @tag-renamed="handleTagRenamed"
      @tag-merged="handleTagMerged"
      @open-tags-manager="handleOpenTagsManager"
    />

    <!-- Centralized Tags Manager Modal -->
    <TagsManager
      :visible="showTagsManager"
      :tab-initial="tagsManagerInitialTab"
      :tag-to-rename="tagsManagerTagToRename"
      @close="closeTagsManager"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useNetworkRequest } from '@/network/NetworkRequest'
import { useSessionsOpen } from '@/sessions-open/SessionsOpen'
import { useTabsSelect } from '@/tabs/TabsSelect.js'
import { useTagsEdit } from '@/tags/TagsEdit'
import { useTabsRemote } from '@/sessions-remote/SessionsRemote'
import TabsMainWindow from '@/TabsMainWindow.vue'
import SnapshotManager from '@/snapshot/SnapshotManager.vue'
import TabsUploadModal from '@/tabs/TabsUploadModal.vue'
import TabsPin from '@/tabs/TabsPin.vue'
import TagsEdit from '@/tags/TagsEdit.vue'
import TagsManager from '@/tags/TagsManager.vue'


// main views configuration (Level 1)
const mainViews = [
  { id: 'tabs', label: 'Tabs' },
  { id: 'other', label: 'Other Functions' }
]

// Other functions views (Level 2)
const otherViews = [
  { id: 'snapshots', label: 'Snapshots' }
]

// Tab types (Level 2)
const tabTypes = [
  { id: 'open', label: 'Open Tabs', shortLabel: 'Open' },
  { id: 'local', label: 'Local Tabs', shortLabel: 'Local', disabled: true }, // Future feature
  { id: 'remote', label: 'Remote Tabs', shortLabel: 'Remote' }
]

// Bookmark types (Level 2) 
const bookmarkTypes = [
  { id: 'open', label: 'Open Bookmarks', shortLabel: 'Open', disabled: true }, // Future feature
  { id: 'local', label: 'Local Bookmarks', shortLabel: 'Local', disabled: true }, // Future feature
  { id: 'remote', label: 'Remote Bookmarks', shortLabel: 'Remote', disabled: true } // Future feature
]

// State
const tabMode = ref(0) // 0: Free, 1: Always First, 2: Always Last
const tabsMainWindowRef = ref(null)


// View state
const mainView = ref('tabs')
const otherView = ref('snapshots')
const hasLoadedSnapshots = ref(false)

// Active types (toggleable)
const activeTabTypes = ref(new Set(['open', 'remote'])) // Default: show open and remote tabs
const activeBookmarkTypes = ref(new Set()) // Default: no bookmarks shown

// Store
const networkRequest = useNetworkRequest()
const tabsOpenStore = useSessionsOpen()
const tabsSelectStore = useTabsSelect()
const tagsEditStore = useTagsEdit()
const tabsRemoteStore = useTabsRemote()

// Cached selection counts to avoid repeated function calls
const openSelectionCount = computed(() => tabsSelectStore.getSelectedCount('open'))
const remoteSelectionCount = computed(() => tabsSelectStore.getSelectedCount('remote'))

// Computed
import { useServerStore } from '@/network/Server.js'
const serverStore = useServerStore()

const currentServerUrl = computed(() => {
  const urlCurrent = serverStore.getUrlCurrent()
  if (!urlCurrent) return ''
  const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
  return serverUrlResult.is_success ? serverUrlResult.data : ''
})

const mainViewIndex = computed(() => 
  mainViews.findIndex(view => view.id === mainView.value)
)

const otherViewIndex = computed(() => 
  otherViews.findIndex(view => view.id === otherView.value)
)

const handleTabActivate = async (tab) => {
  try {
    await tabsOpenStore.activateTab(tab)
  } catch (error) {
    console.error('Error activating tab:', error)
  }
}

const handleTabClose = async (tab) => {
  try {
    await tabsOpenStore.closeTab(tab)
  } catch (error) {
    console.error('Error closing tab:', error)
  }
}

const handleShowContextMenu = (event) => {
  // context menu events are handled by the TabsMainWindow component internally
  console.log('TabsManager.vue: handleShowContextMenu:', event)
}

const handleUploadSingleTab = async (tab) => {
  // Delegate to upload single tab functionality
  try {
    const result = await networkRequest.uploadTabToServer(tab)
    if (result.is_success) {
      console.log('TabsManager.vue: Single tab uploaded successfully')
      // Optionally show success notification
    } else {
      console.error('TabsManager.vue: Error uploading single tab:', result.message)
    }
  } catch (error) {
    console.error('TabsManager.vue: Error uploading single tab:', error)
  }
}

const onOpenSettings = () => {
  console.error('TabsManager.vue: onOpenSettings()')
}


// Upload modal state
const showUploadModal = ref(false)
const tabsToUpload = ref([])

// Tags Manager state
const showTagsManager = ref(false)
const tagsManagerInitialTab = ref('sets')
const tagsManagerTagToRename = ref(null)
const openUploadModal = () => {
  tabsToUpload.value = tabsOpenStore.tabsOpenUiSelected
  // console.log('TabsManager.vue: openUploadModal(): tabsToUpload.length:', tabsToUpload.value.length)
  showUploadModal.value = true
}

// Upload modal event handlers
const closeUploadModal = () => {
  showUploadModal.value = false
  tabsToUpload.value = []
}

const handleUploadComplete = (result) => {
  console.log('Upload completed:', result)
  
  // Clear selection after successful upload
  if (result.success > 0) {
    tabsSelectStore.clearSelection('open')
  }
  
  // Show notification or update UI as needed
  // You could add a toast notification here
}

// Tags Edit event handlers
const handleTabTagsSaved = (data) => {
  console.log('Tags saved:', data)

  // update the tab object in TabsRemote store with the new tags
  if (data.tab && data.tab.id) {
    tabsRemoteStore.updateTabInLocalCache(data.tab.id, {
      tags_id: data.tags_id,
      tags_name: data.tags_name
    })
    console.log(`Updated tab ${data.tab.id} with new tags:`, { tags_id: data.tags_id, tags_name: data.tags_name })
  }
}

const handleTagRenamed = (result) => {
  console.log('Tag renamed:', result)
  // Could trigger a refresh of tag lists if needed
}

const handleTagMerged = (result) => {
  console.log('Tag merged:', result)
}

// Tags Manager event handlers
const handleOpenTagsManager = (data) => {
  tagsManagerInitialTab.value = data.initialTab || 'sets'
  tagsManagerTagToRename.value = data.tag || null
  showTagsManager.value = true
  // console.log('TabsManager.vue: handleOpenTagsManager(): data:', data)
}

const closeTagsManager = () => {
  showTagsManager.value = false
  tagsManagerInitialTab.value = 'sets'
  tagsManagerTagToRename.value = null
}


</script>

<style scoped>
.tab-manager {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 100vh;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0;
  width: 100%;
  box-sizing: border-box;
}

h1 {
  margin: 0;
  color: #202124;
}

.controls {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-success {
  background-color: #34a853;
  color: white;
}

.btn-success:hover {
  background-color: #2d8745;
}

.btn-secondary {
  background-color: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background-color: #4b5563;
}

/* Level 1: Main Content Switcher */
.main-content-switcher {
  margin: 0 0;
  padding: 0;
}

.switcher-track {
  background: #f1f3f4;
  border-radius: 20px;
  height: 40px;
  position: relative;
  display: flex;
  padding: 0;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.switcher-slider {
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 100%;
  background: white;
  border-radius: 20px;
  transition: transform 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.switcher-button {
  flex: 1;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  z-index: 1;
  transition: color 0.3s ease;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.switcher-button.active {
  color: #1a73e8;
}

/* Level 2: Tab Type Toggles */
.tab-type-toggles {
  margin: 8px 0;
  padding: 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.toggle-buttons-container {
  display: flex;
  gap: 32px;
  align-items: flex-start;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.buttons-row {
  display: flex;
  gap: 0;
}

/* Sub-content switcher for other functions */
.sub-content-switcher {
  margin: 20px 0;
  padding: 0;
}

.sub-content-switcher .switcher-track {
  max-width: 300px;
}

/* Content Views */
.content-views {
  position: relative;
  min-height: 200px;
  padding: 0;
  width: 100%;
  box-sizing: border-box;
  flex: 1;
  display: flex;
}

.content-view,
.sub-content-view {
  width: 100%;
  padding: 0;
  box-sizing: border-box;
  flex: 1;
  display: flex;
  flex-direction: column;
}


</style>
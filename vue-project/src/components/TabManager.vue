<template>
  <div class="tab-manager">
    <header>
      <h1>Tab Manager</h1>
      <div class="controls">
        <button 
          class="btn btn-primary"
          @click="toggleTabMode"
        >
          Current Tab: {{ tabModeText }}
        </button>
      </div>

      <!-- Level 1: Main Content Switcher -->
      <div class="main-content-switcher">
        <div class="switcher-track">
          <div 
            class="switcher-slider"
            :style="{ transform: `translateX(${mainViewIndex * 100}%)` }"
          ></div>
          <button 
            v-for="(view, index) in mainViews" 
            :key="view.id"
            class="switcher-button"
            :class="{ active: mainView === view.id }"
            @click="switchMainView(view.id)"
          >
            <span v-html="view.label"></span>
          </button>
        </div>
      </div>

      <!-- Level 2: Tab Type Toggles (only shown when mainView is 'tabs') -->
      <div v-if="mainView === 'tabs'" class="tab-type-toggles">
        <div class="toggle-buttons-container">
          <!-- Tabs Section -->
          <div class="button-group">
            <div class="group-label">Tabs</div>
            <div class="buttons-row">
              <button 
                v-for="tabType in tabTypes" 
                :key="tabType.id"
                class="tab-toggle-btn"
                :class="{ active: activeTabTypes.has(tabType.id), disabled: tabType.disabled }"
                @click="toggleTabType(tabType.id)"
                :disabled="tabType.disabled"
              >
                {{ tabType.shortLabel }}
                <span v-if="tabType.disabled" class="coming-soon-small">*</span>
              </button>
            </div>
          </div>
          
          <!-- Bookmarks Section -->
          <div class="button-group">
            <div class="group-label">Bookmarks</div>
            <div class="buttons-row">
              <button 
                v-for="bookmarkType in bookmarkTypes" 
                :key="bookmarkType.id"
                class="tab-toggle-btn"
                :class="{ active: activeBookmarkTypes.has(bookmarkType.id), disabled: bookmarkType.disabled }"
                @click="toggleBookmarkType(bookmarkType.id)"
                :disabled="bookmarkType.disabled"
              >
                {{ bookmarkType.shortLabel }}
                <span v-if="bookmarkType.disabled" class="coming-soon-small">*</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Content Views -->
    <div class="content-views">
      <!-- Tabs View with Columns -->
      <div v-show="mainView === 'tabs'" class="content-view">
        <TabsColumns
          :active-tab-types="Array.from(activeTabTypes)"
          :active-bookmark-types="Array.from(activeBookmarkTypes)"
          @tab-activated="handleTabActivate"
          @tab-closed="handleTabClose"
          @openSettings="onOpenSettings"
          @upload-selected-tabs="openUploadModal"
          ref="tabsColumnsRef"
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
            :current-window-id="currentWindowId"
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
      @saved="handleTagsEditSaved"
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
import { useNetworkRequest } from '../stores/NetworkRequest'
import { useTabsOpen } from '../stores/TabsOpen'
import { useTabsSelect } from '../stores/TabsSelect'
import { useTagsEdit } from '../stores/TagsEdit'
import { useTabsRemote } from '../stores/TabsRemote'
import TabsColumns from './TabsColumns.vue'
import SettingsRemote from '@/setting/SettingsRemote.vue'
import SnapshotManager from './snapshot/SnapshotManager.vue'
import TabsUploadModal from './TabsUploadModal.vue'
import TagsEdit from './tag/TagsEdit.vue'
import TagsManager from './TagsManager.vue'

// Main views configuration (Level 1)
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
const tabsColumnsRef = ref(null)


// View state
const mainView = ref('tabs')
const otherView = ref('snapshots')
const hasLoadedSnapshots = ref(false)

// Active types (toggleable)
const activeTabTypes = ref(new Set(['open', 'remote'])) // Default: show open and remote tabs
const activeBookmarkTypes = ref(new Set()) // Default: no bookmarks shown

// Store
const networkRequest = useNetworkRequest()
const tabsOpenStore = useTabsOpen()
const tabsSelectStore = useTabsSelect()
const tagsEditStore = useTagsEdit()
const tabsRemoteStore = useTabsRemote()

// Cached selection counts to avoid repeated function calls
const openSelectionCount = computed(() => tabsSelectStore.getSelectedCount('open'))
const remoteSelectionCount = computed(() => tabsSelectStore.getSelectedCount('remote'))

// Computed
const tabModeText = computed(() => {
  switch (tabMode.value) {
    case 0: return 'Free'
    case 1: return 'Always First'
    case 2: return 'Always Last'
    default: return 'Free'
  }
})

import { useServerStore } from '@/stores/Server.js'
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

// Methods
const refreshTabs = () => {
  // Refresh is now handled by the TabsOpen store automatically
  console.log('Tab refresh triggered')
}

const toggleTabMode = () => {
  tabMode.value = (tabMode.value + 1) % 3
  applyTabMode()
}

const applyTabMode = async () => {
  if (tabMode.value === 0) return

  const currentWindow = await chrome.windows.getCurrent()
  const tabs = await chrome.tabs.query({ windowId: currentWindow.id })
  const activeTab = tabs.find(tab => tab.active)

  if (!activeTab) return

  switch (tabMode.value) {
    case 1: // Always first
      if (tabs[0].id !== activeTab.id) {
        await chrome.tabs.move(activeTab.id, { index: 0 })
      }
      break
    case 2: // Always last
      if (tabs[tabs.length - 1].id !== activeTab.id) {
        await chrome.tabs.move(activeTab.id, { index: -1 })
      }
      break
  }
}

const switchMainView = (viewId) => {
  mainView.value = viewId
}

const switchOtherView = (viewId) => {
  if (viewId === 'snapshots' && !hasLoadedSnapshots.value) {
    hasLoadedSnapshots.value = true
  }
  otherView.value = viewId
}

const toggleTabType = (typeId) => {
  const tabType = tabTypes.find(t => t.id === typeId)
  if (tabType?.disabled) return
  
  if (activeTabTypes.value.has(typeId)) {
    activeTabTypes.value.delete(typeId)
  } else {
    activeTabTypes.value.add(typeId)
  }
}

const toggleBookmarkType = (typeId) => {
  const bookmarkType = bookmarkTypes.find(t => t.id === typeId)
  if (bookmarkType?.disabled) return
  
  if (activeBookmarkTypes.value.has(typeId)) {
    activeBookmarkTypes.value.delete(typeId)
  } else {
    activeBookmarkTypes.value.add(typeId)
  }
}

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

const onOpenSettings = () => {
  console.error('TabManager.vue: onOpenSettings()')
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
  // console.log('TabManager.vue: openUploadModal(): tabsToUpload.length:', tabsToUpload.value.length)
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
const handleTagsEditSaved = (data) => {
  console.log('Tags saved:', data)
  
  // Update the tab object in TabsRemote store with the new tags
  if (data.tab && data.tab.id) {
    tabsRemoteStore.updateTabInLocal(data.tab.id, {
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
  // console.log('TabManager.vue: handleOpenTagsManager(): data:', data)
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

.btn-primary {
  background-color: #1a73e8;
  color: white;
}

.btn-primary:hover {
  background-color: #1557b0;
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

.tab-toggle-btn {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 2px;
  background: white;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  position: relative;
  border-right: none;
}

.tab-toggle-btn:first-child {
  border-radius: 2px 0 0 2px;
}

.tab-toggle-btn:last-child {
  border-radius: 0 2px 2px 0;
  border-right: 1px solid #e0e0e0;
}

.tab-toggle-btn:hover:not(.disabled) {
  background: #f5f5f5;
  color: #1a73e8;
  z-index: 1;
}

.tab-toggle-btn.active {
  background: #1a73e8;
  border-color: #1a73e8;
  color: white;
  z-index: 2;
}

.tab-toggle-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f9f9f9;
  color: #9e9e9e;
}

.coming-soon-small {
  font-size: 10px;
  font-weight: normal;
  opacity: 0.7;
  margin-left: 2px;
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
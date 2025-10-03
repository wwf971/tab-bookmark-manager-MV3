<template>
  <div class="container">
    <!-- Close Button -->
    <button class="close-button" @click="closePopup" title="Close">
      &times;
    </button>

    <!-- URL Display Group -->
    <div class="url-display-group">
      <div class="url-header">
        <div class="url-label">Server:</div>
        <span class="url-display" :class="{ 'invalid': !isUrlCurerntValid }" :title="urlCurrentDisplay">{{ urlCurrentDisplay }}</span>
        <div class="url-actions">
          <button class="server-button" @click="pingServer" :disabled="isPinging">{{ isPinging ? '🔄' : '📡' }}</button>
          <button class="server-button" @click="checkSession" title="Check Session">🍪</button>
          <button 
            class="logout-button" 
            @click="handleLogout" 
            :disabled="!isLoggedIn"
            title="Logout"
          >
            LogOut
          </button>
          <button class="settings-button" @click="showSettingsRemote = true" title="Server Settings">⚙️</button>
        </div>
      </div>
      <div v-if="serverStatus" :class="['server-status', serverStatus.type]" @click="handleServerStatusClick">
        {{ serverStatus.message }}
      </div>
    </div>

        <!-- URL selection -->
    <div class="tabs-selection-section">
      <div class="tabs-selection-header">
        <h3>Select Tabs to Upload</h3>
        <div class="upload-mode-indicator">
          <span class="mode-badge" :class="operationType">{{ operationTypeText }}</span>
        </div>
      </div>
      
      <div class="tabs-container">
        <!-- Active and Selected Tabs from Browser -->
        <div class="browser-tabs-section">
          <h4 class="tab-type">Browser Tabs</h4>
          <div class="tabs-list">
            <!-- Active Tab -->
            <div
              v-if="tabActive" 
              class="tab-item browser-tab active-tab"
              :class="{ selected: shouldTabBeSelected('browser-active', tabActive) }"
              @click="() => onUserClickedTab('browser-active', tabActive)"
            >
              <div class="tab-icon-and-title">
                <div class="tab-favicon">
                  <img v-if="tabActive.favIconUrl" :src="tabActive.favIconUrl" :alt="tabActive.title" />
                  <span v-else>🌐</span>
                </div>
                <div class="tab-title">{{ tabActive.title }}</div>
              </div>
              <div class="tab-type-and-url">
                <div class="tab-badge">Active</div>
                <div class="tab-url">{{ tabActive.url }}</div>
              </div>
            </div>
            <!-- Selected Tabs -->
            <div
              v-for="tab in tabsBrowserSelectedForDisplay" 
              :key="tab.id"
              class="tab-item browser-tab selected-tab"
              :class="{ selected: shouldTabBeSelected('browser-selected', tab) }"
              @click="() => onUserClickedTab('browser-selected', tab)"
            >
              <div class="tab-icon-and-title">
                <div class="tab-favicon">
                  <img v-if="tab.favIconUrl" :src="tab.favIconUrl" :alt="tab.title" />
                  <span v-else>🌐</span>
                </div>
                <div class="tab-title">{{ tab.title }}</div>
              </div>
              <div class="tab-type-and-url">
                <div class="tab-badge">Selected</div>
                <div class="tab-url">{{ tab.url }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Similar Tabs from Server -->
        <div class="tabs-similar-section">
          <h4 class="tab-type">Similar Tabs on Server</h4>
          <div class="tabs-list">
            <div v-if="isLoadingSimilar" class="loading-indicator">
              🔄 Loading similar tabs...
            </div>
            <div v-else-if="tabsSimilar.length === 0" class="no-tabs-message">
              No similar tabs found
            </div>
            <div 
              v-else
              v-for="tab in tabsSimilar" 
              :key="tab.id"
              class="tab-item"
              :class="{ selected: shouldTabBeSelected('server', tab) }"
              @click="() => onUserClickedTab('server', tab)"
            >
              <div class="tab-favicon">
                <span>📄</span>
              </div>
              <div class="tab-type-and-url">
                <div class="tab-title">{{ tab.title }}</div>
                <div class="tab-url">{{ tab.url }}</div>
                <div class="tab-meta">
                  <span class="tab-id">ID: {{ tab.id }}</span>
                  <span class="tab-date">{{ formatDate(tab.time_create) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Update Options for Update Mode -->
    <div v-if="operationType === 'update-server-tab'" class="update-options-section">
      <h4>Select What to Update:</h4>
      
      <div class="update-checkboxes">
        <label class="checkbox-label">
          <input type="checkbox" v-model="updateTags" />
          <span>Update Tags</span>
        </label>
        
        <label class="checkbox-label">
          <input type="checkbox" v-model="updateComment" />
          <span>Update Comment</span>
        </label>
        
        <label class="checkbox-label">
          <input type="checkbox" v-model="updateTitle" />
          <span>Update Title</span>
        </label>
      </div>
      
      <!-- Title Comparison -->
      <div v-if="userSelectedTabInfo && userSelectedTabInfo.tab" class="title-comparison">
        <div class="title-comparison-item">
          <label>Current Tab Title:</label>
          <div class="title-display current">{{ tabActive?.title || 'N/A' }}</div>
        </div>
        <div class="title-comparison-item">
          <label>Existing Tab Title:</label>
          <div class="title-display existing">{{ userSelectedTabInfo.tab.title || 'N/A' }}</div>
        </div>
      </div>
    </div>

    <!-- Tags Section -->
    <TagsSelect
      ref="tagsSelectRef"
      @status="status = $event"
      @authRequired="handleAuthRequired"
      @open-tags-manager="handleOpenTagsManager"
    />

    <!-- Options Group -->
    <div class="options-group">
      <label>
        <input
          type="checkbox"
          v-model="closeTabAfterUpload"
        />
        Close tab after successful upload
      </label>
      <label>
        <input
          type="checkbox"
          v-model="closePopupAfterUpload"
        />
        Close popup window after upload (uncheck for debugging)
      </label>
    </div>

    <!-- Comment Input -->
    <div class="comment-input-container">
      <input
        type="text"
        v-model="comment"
        placeholder="Add a comment (optional)"
      />
    </div>

    <!-- Upload Buttons -->
    <div class="upload-buttons">
      <button
        class="cache-button"
        :disabled="isUploadButtonsDisabled"
        @click="requestUploadTabs('url')"
      >
        Upload {{ uploadTabsNum }} Tab(s) As Url
      </button>
      <button 
        class="cache-button" 
        :disabled="isUploadButtonsDisabled"
        @click="requestUploadTabs('tab_remote')"
      >
        Upload {{ uploadTabsNum }} Tab(s) As TabRemote
      </button>
      <button 
        class="cache-button" 
        :disabled="isUpdateButtonDisabled"
        @click="requestUpdateTab()"
      >
        Update Tab
      </button>
    </div>

    <!-- Status -->
    <div
      v-if="status"
      :class="['status', statusClass]"
    ><span v-html="status"></span></div>


    <!-- URL Settings Modal -->
    <div 
      v-if="showSettingsRemote" 
      class="modal-backdrop"
      @click.self="showSettingsRemote = false"
    >
      <div class="modal-container">
        <div class="modal-header">
          <h3>Server Settings</h3>
          <button class="modal-close-btn" @click="showSettingsRemote = false">×</button>
        </div>
        <div class="modal-content">
          <SettingsRemote
            v-model="showSettingsRemote"
          />
        </div>
      </div>
    </div>

    <!-- Login Modal -->
    <Login
      v-model="showLoginModal"
      :message="loginMessage"
      @loginSuccess="handleLoginSuccess"
    />

    <!-- Tags Edit Modal for Rename -->
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useNetworkRequest } from '@/network/NetworkRequest'
import { useTagsEdit } from '@/tags/TagsEdit'
import { useTabsRemote } from '@/sessions-remote/SessionsRemote'
import TagsSelect from '@/tags/TagsSelect.vue'
import TagsEdit from '@/tags/TagsEdit.vue'
import TagsManager from '@/tags/TagsManager.vue'
import SettingsRemote from '@/settings/SettingsRemote.vue'
import Login from '@/auth/Login.vue'

// store
const networkRequest = useNetworkRequest()
const tagsEditStore = useTagsEdit()
const tabsRemoteStore = useTabsRemote()

// state
const closeTabAfterUpload = ref(true)
const closePopupAfterUpload = ref(false)
const comment = ref('')
const status = ref('')
const showSettingsRemote = ref(false)
const showLoginModal = ref(false)
const loginMessage = ref('')
const tagsSelectRef = ref(null)
const statusClass = ref('')

const operationType = ref('upload-browser-active-tab')
  // 'upload-browser-active-tab'.
    // only deal with current/focused/active tab on this browser window, and it tab as completely new
  // 'upload-browser-selected-tabs'.
    // deal with all selected tabs, and treat them as completely new
  // 'update-server-tab'.
    // treat current tab as a tab existing on server. its attributes(like tags, comment) can be modified

const tabActive = ref(null); // active tab in browser
const tabsBrowserSelected = ref([]); // selected tabs in browser
const tabsSimilar = ref([]);
  // tabs existing on server, that are considered similar to current tab
  // by clicking on one of tabsSimilar, the user confirm that current tab is same as/corresponding to one tab existing on server
    // user can update/delete modify this tab

const tabsSelected = ref([])
  // click on one of similar tabs:
    // tabsBrowserSelected --> []
    // operationType --> 'exist'
  // click on active tab:
    // tabsBrowserSelected --> [tabActive]
    // operationType --> active
  // click on one of selected tabs:
    // tabsBrowserSelected --> [...tabsBrowserSelected]
    // operationType --> 'selected'

const isLoadingSimilar = ref(false)
const userSelectedTabInfo = ref(null) // Store info about currently selected tab for upload

// Update checkboxes for exist mode
const updateTags = ref(false)
const updateComment = ref(false)
const updateTitle = ref(false)

// Store original values for comparison
const commentOriginal = ref('')
const tagsOriginal = ref([])
const originalTitle = ref('')

// Tags Manager state
const showTagsManager = ref(false)
const tagsManagerInitialTab = ref('sets')
const tagsManagerTagToRename = ref(null)

// Computed
const urlCurrentDisplay = computed(() => {
  const urlCurrent = serverStore.getUrlCurrent()
  if (!urlCurrent) return 'No URL configured'
  return `${urlCurrent.name}: ${urlCurrent.url}`
})

const isUrlCurerntValid = computed(() => {
  return !!serverStore.getUrlCurrent()
})

const operationTypeText = computed(() => {
  switch (operationType.value) {
    case 'upload-browser-active-tab': return 'Upload Active Tab'
    case 'update-server-tab': return 'Update Existing Tab'
    case 'upload-browser-selected-tabs': return 'Upload Selected Tabs'
    default: return 'Select Tab Mode'
  }
})

const serverStatus = computed(() => {
  const status = serverStore.getServerStatusCurrent()
  if (!status) return null
  
  return {
    type: status.type,
    message: `${status.icon} ${status.text}`
  }
})

const isPinging = computed(() => {
  const status = serverStore.getServerStatusCurrent()
  return status?.isPinging || false
})


const isLoggedIn = computed(() => {
  return serverStore.isCurrentUrlLoggedIn()
})

// Methods
// Tab selection and management functions
const fetchBrowserTabs = async () => {
  try {
    // Get active tab
    const [_tabActive] = await chrome.tabs.query({ active: true, currentWindow: true })
    tabActive.value = _tabActive

    // Get all selected tabs (highlighted tabs include the active tab)
    const selectedTabs = await chrome.tabs.query({ highlighted: true, currentWindow: true })
    // Store ALL selected tabs (including active tab) for upload logic
    tabsBrowserSelected.value = selectedTabs
    
    // Fetch similar tabs for the active tab
    if (_tabActive) {
      await fetchSimilarTabs(_tabActive.url, _tabActive.title)
    }
  } catch (error) {
    console.error('Error fetching browser tabs:', error)
  }
}

const fetchSimilarTabs = async (url, title) => {
  if (!url || !title) return

  isLoadingSimilar.value = true
  try {
    const result = await networkRequest.getSimilarTabsRemote(url, title)
    
    if (result.is_success) {
      tabsSimilar.value = result.data || []
    } else {
      console.error('Failed to fetch similar tabs:', result.message)
      tabsSimilar.value = []
    }
  } catch (error) {
    console.error('Error fetching similar tabs:', error)
    tabsSimilar.value = []
  } finally {
    isLoadingSimilar.value = false
  }
}

const onUserClickedTab = async (type, tab) => {
  if (type === 'browser-active') {
    tabsSelected.value = [tabActive.value]
    operationType.value = 'upload-browser-active-tab'
    userSelectedTabInfo.value = { type: 'active', tab: tabActive.value }
    
    // clear tags when selecting active tab (new upload)
    if (tagsSelectRef.value) {
      await tagsSelectRef.value.setTagsFromIds([])
    }
  } else if (type === 'browser-selected') {
    tabsSelected.value = tabsBrowserSelected.value
    operationType.value = 'upload-browser-selected-tabs'
    userSelectedTabInfo.value = { type: 'browser', tabs: tabsBrowserSelected.value }
    
    // clear tags when selecting browser tabs (new upload)
    if (tagsSelectRef.value) {
      await tagsSelectRef.value.setTagsFromIds([])
    }
  } else if (type === 'server') {
    tabsSelected.value = []
    operationType.value = 'update-server-tab'
    userSelectedTabInfo.value = { type: 'similar', tab: tab, tabActive: tabActive.value }
    
    // Store original values for comparison
    commentOriginal.value = tab.comment || ''
    tagsOriginal.value = tab.tags_id || []
    originalTitle.value = tab.title || ''
    
    // Set tags from the existing tab's tags_id
    if (tagsSelectRef.value && tab.tags_id) {
      await tagsSelectRef.value.setTagsFromIds(tab.tags_id)
    }
    
    // Set the comment from the existing tab
    comment.value = tab.comment || ''
    
    // Reset checkboxes
    updateTags.value = false
    updateComment.value = false
    updateTitle.value = false
  }
}

const shouldTabBeSelected = (type, tab) => {
  if (type === 'browser-active') {
    return operationType.value === 'upload-browser-active-tab' || operationType.value === 'upload-browser-selected-tabs'
  } else if (type === 'browser-selected') {
    return operationType.value === 'upload-browser-selected-tabs'
  } else if (type === 'server') {
    return operationType.value === 'update-server-tab' && userSelectedTabInfo.value?.tab?.id === tab.id
  }
  return false
}

const updateExistingNote = async (noteId, updateDict) => {
  try {
    const result = await noteStore.updateNote(noteId, updateDict)
    return result
  } catch (error) {
    console.error('Error updating note:', error)
    return { is_success: false, message: error.message }
  }
}

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  // Convert microseconds to milliseconds
  const date = new Date(timestamp / 1000)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

// Auto-check boxes when user modifies items
watch(comment, (newComment) => {
  if (operationType.value === 'update-server-tab' && newComment !== commentOriginal.value) {
    updateComment.value = true
  }
})

// Watch for tag changes (we'll need to check this when tags are modified)
const checkTagsChanged = () => {
  if (operationType.value === 'update-server-tab' && tagsSelectRef.value) {
    const tagsSelected = tagsSelectRef.value.getCurrentTags()
    const tagsSelectedId = tagsSelected.tags_id || []
    
    // Compare arrays
    const tagsChanged = tagsOriginal.value.length !== tagsSelectedId.length ||
      !tagsOriginal.value.every(id => tagsSelectedId.includes(id))
    
    if (tagsChanged) {
      updateTags.value = true
    }
  }
}

// Periodically check for tag changes when in exist mode
let tagCheckInterval = null

watch(operationType, (newMode) => {
  if (newMode === 'update-server-tab') {
    // Start checking for tag changes every 2 seconds
    tagCheckInterval = setInterval(checkTagsChanged, 2000)
  } else {
    // Stop checking when not in update mode
    if (tagCheckInterval) {
      clearInterval(tagCheckInterval)
      tagCheckInterval = null
    }
  }
})

import { useServerStore } from '@/network/Server.js'
const serverStore = useServerStore()
import { useNoteStore } from '@/network/Note.js'
const noteStore = useNoteStore()

const pingServer = async () => {
  const urlCurrent = serverStore.getUrlCurrent()
  if (!urlCurrent) {
    // Set error status if no URL is configured
    serverStore.setServerStatus('no-url', {
      icon: '❌',
      text: 'No URL configured',
      type: 'error',
      isPinging: false
    })
    return
  }
  
  await serverStore.testServerConnection(urlCurrent.id)
  
  // Check if login is required and show modal
  const status = serverStore.getServerStatusCurrent()
  if (status?.requiresLogin) {
    loginMessage.value = 'Login required to access server features'
    showLoginModal.value = true
  }
}

const handleAuthRequired = (message) => {
  loginMessage.value = message
  showLoginModal.value = true
}

const handleLoginSuccess = async () => {
  // Refresh server status after successful login
  const urlCurrent = serverStore.getUrlCurrent()
  if (urlCurrent) {
    await serverStore.testServerConnection(urlCurrent.id)
  }
  
  // Refresh tags after successful login
  if (tagsSelectRef.value) {
    await tagsSelectRef.value.refreshTags(false)
  }
}

const handleTagsEditSaved = (data) => {
  console.log('Tags saved:', data)
  
  // Update the tab object in TabsRemote store with the new tags
  if (data.tab && data.tab.id) {
    tabsRemoteStore.updateTabInLocalCache(data.tab.id, {
      tags_id: data.tags_id,
      tags_name: data.tags_name
    })
    console.log(`Updated tab ${data.tab.id} with new tags:`, { tags_id: data.tags_id, tags_name: data.tags_name })
  }
}

const handleTagRenamed = (result) => {
  // Refresh tags in TagsSelect component after rename
  if (tagsSelectRef.value) {
    tagsSelectRef.value.refreshTags(false)
  }
  
  console.log('Tag renamed:', result)
}

const handleTagMerged = (result) => {
  // Refresh tags in TagsSelect component after merge
  if (tagsSelectRef.value) {
    tagsSelectRef.value.refreshTags(false)
  }
  
  console.log('Tag merged:', result)
}


// Tags Manager event handlers
const handleOpenTagsManager = (data) => {
  tagsManagerInitialTab.value = data.initialTab || 'sets'
  tagsManagerTagToRename.value = data.tag || null
  showTagsManager.value = true
  
  console.log('UploadTab.vue: handleOpenTagsManager(): data:', data)
}

const closeTagsManager = () => {
  showTagsManager.value = false
  tagsManagerInitialTab.value = 'sets'
  tagsManagerTagToRename.value = null
}

const checkAuthenticationAndProceed = async (action) => {
  // Get the current URL and test server connection
  const urlCurrent = serverStore.getUrlCurrent()
  if (!urlCurrent) {
    return false
  }
  
  // Test the current URL if we don't have recent status
  const status = serverStore.getServerStatusCurrent()
  if (!status || Date.now() - status.lastChecked > 30000) { // Refresh if older than 30 seconds
    await serverStore.testServerConnection(urlCurrent.id)
  }
  
  const currentStatus = serverStore.getServerStatusCurrent()
  if (!currentStatus) {
    return false
  }
  
  if (currentStatus.type === 'error') {
    return false
  }
  
  if (currentStatus.requiresLogin) {
    loginMessage.value = 'Please login to continue with this action'
    showLoginModal.value = true
    return false
  }
  
  return currentStatus.type === 'success'
}



const uploadTabsNum = computed(() => {
  if(operationType.value === 'upload-browser-active-tab'){
    return 1
  } else if(operationType.value === 'upload-browser-selected-tabs'){
    return tabsBrowserSelected.value.length
  } else{
    return 1
  }
})

// Computed properties for button states
const isUploadButtonsDisabled = computed(() => {
  return operationType.value === 'update-server-tab'
})

const isUpdateButtonDisabled = computed(() => {
  return operationType.value !== 'update-server-tab'
})

// Computed property to show only non-active tabs in the selected tabs section
const tabsBrowserSelectedForDisplay = computed(() => {
  if (!tabActive.value) return tabsBrowserSelected.value
  // Filter out the active tab for display purposes (we show it separately in Active Tab section)
  return tabsBrowserSelected.value.filter(tab => tab.id !== tabActive.value.id)
})

const requestUploadSingleTab = async (destination='url') => {
    // Check authentication first
    const canProceed = await checkAuthenticationAndProceed()
    if (!canProceed) {
      status.value = 'Authentication failed. Please login to continue.'
      statusClass.value = 'error'
      return
    }

    status.value = 'Start upload...'
    statusClass.value = ''
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        let task = 'create_url'
        if(destination === 'tab_remote'){
            task = 'create_tab_remote'
        }
        // console.log('UploadTab.vue: requestUploadSingleTab(): tab:', tab)
        
        // Get current tags from TagsSelect component
        const tagsSelected = tagsSelectRef.value?.getCurrentTags() || { tags_id: [], tags_name: [] }
        
        const result = await networkRequest.uploadTabToServer(tab, {
            task,
            tags_id: tagsSelected.tags_id,
            tags_name: tagsSelected.tags_name,
            comment: comment.value
        })

        if (result.is_success) {
            status.value = 'Upload successful!'
            statusClass.value = 'success'
            
            if (closeTabAfterUpload.value) {
                setTimeout(() => {
                    chrome.tabs.remove(tab.id)
                }, 1000)
            }
            
            if (closePopupAfterUpload.value) {
            setTimeout(() => {
                window.close()
            }, 1000)
            }
        } else {
            // Check if login is required
            if (result.message && result.message.toLowerCase().includes('login')) {
                loginMessage.value = result.message
                showLoginModal.value = true
        } else {
            status.value = `Upload failed. Please try again.\n${result.message}`
                statusClass.value = 'error'
            }
        }
    } catch (error) {
        console.error('Error uploading tab info:', error)
        status.value = `Error uploading. Please try again.\n${error}`
        statusClass.value = 'error'
    }
}


const requestUpdateTab = async () => {
    if (!userSelectedTabInfo.value || !userSelectedTabInfo.value.tab) {
        status.value = 'No existing tab selected for update!'
        statusClass.value = 'error'
        return
    }
    
    // Check if user selected anything to update
    if (!updateTags.value && !updateComment.value && !updateTitle.value) {
        status.value = 'Please select at least one item to update!'
        statusClass.value = 'error'
        return
    }
    
    status.value = 'Updating existing tab...'
    statusClass.value = ''
    
    try {
        const updateDict = {}
        
        // Only include fields that user wants to update
        if (updateTags.value) {
            const tagsSelected = tagsSelectRef.value?.getCurrentTags() || { tags_id: [], tags_name: [] }
            updateDict.tags_id = tagsSelected.tags_id
            updateDict.tags_name = tagsSelected.tags_name
        }
        
        if (updateComment.value) {
            updateDict.comment = comment.value
        }
        
        if (updateTitle.value) {
            updateDict.title = tabActive.value?.title || ''
        }
        
        const result = await updateExistingNote(userSelectedTabInfo.value.tab.id, updateDict)
        
        if (result.is_success) {
            const updatedFields = []
            if (updateTags.value) updatedFields.push('tags')
            if (updateComment.value) updatedFields.push('comment')
            if (updateTitle.value) updatedFields.push('title')
            
            status.value = `SUCCESS. Updated: ${updatedFields.join(', ')}`
            statusClass.value = 'success'
        } else {
            status.value = `FAILED. ${result.message || 'Unknown error'}`
            statusClass.value = 'error'
        }
    } catch (error) {
        console.error('Error updating existing tab:', error)
        status.value = `ERROR. ${error.message}`
        statusClass.value = 'error'
    }
}

const getTabsToUpload = async () => {
  let tabsToUpload = []
  
  if (operationType.value === 'upload-browser-active-tab' && tabActive.value) {
      // Only upload the active tab
      tabsToUpload = [tabActive.value]
  } else if (operationType.value === 'upload-browser-selected-tabs' && tabsBrowserSelected.value.length > 0) {
      // Upload all selected tabs (which includes the active tab)
      tabsToUpload = tabsBrowserSelected.value
  } else {
      // Fallback to browser query for backward compatibility
      const browserTabs = await chrome.tabs.query({ 
          highlighted: true,
          currentWindow: true
      })
      tabsToUpload = browserTabs
  }

  if (tabsToUpload.length === 0) {
      status.value = 'No tabs selected!'
      statusClass.value = 'error'
      return
  }
  return tabsToUpload
}

import {
  uploadTabToServer,
  uploadTabsToRemote
} from '@/sessions-remote/SessionsRemoteRequest'

const requestUploadTabs = async (upload_as_type='url', upload_manner='one_by_one') => {
  // check authentication first
  const canProceed = await checkAuthenticationAndProceed()
  if (!canProceed){
    status.value = 'Authentication failed. Please login to continue.'
    statusClass.value = 'error'
    return
  }

  // handle different upload modes
  if (operationType.value === 'update-server-tab') {
    status.value = 'This button is for upload, not update.'
    statusClass.value = 'error'
    return
  }

  status.value = 'Uploading tabs...'
  statusClass.value = ''
  const tabsToUpload = await getTabsToUpload()

  try {
      // Get current tags from TagsSelect component
      const tagsSelected = tagsSelectRef.value?.getCurrentTags() || { tags_id: [], tags_name: [] }
      console.warn('_requestUploadTabs(): tagsSelected:', tagsSelected)

      // upload tabs one by one
      if(upload_manner === 'one_by_one'){
          let successCount = 0
          let failCount = 0
          const tabsOpenNumTotal = tabsToUpload.length
          const successfulTabs = []
          const failedTabs = []
          
          for(let i = 0; i < tabsToUpload.length; i++){
              const tab = tabsToUpload[i]
              const currentTabNum = i + 1
              
              // Update status to show current progress
              // status.value = `Uploading tab ${currentTabNum}/${tabsOpenNumTotal}: ${tab.title.substring(0, 50)}...`
              // statusClass.value = ''

              try {
                  let task = 'create_url'
                  if(upload_as_type === 'tab_remote'){
                    task = 'create_tab_remote'
                  }

                  // Get current tags from TagsSelect component
                  const tagsSelected = tagsSelectRef.value?.getCurrentTags() || { tags_id: [], tags_name: [] }
                  
                  const result = await uploadTabToServer(tab, {
                      task,
                      tags_id: tagsSelected.tags_id,
                      tags_name: tagsSelected.tags_name,
                      comment: comment.value
                  })

                  if (result.is_success) {
                      successCount++
                      successfulTabs.push(tab)
                      
                      // Update intermediate status
                      status.value = `SUCCESS: ${successCount}/${tabsOpenNumTotal} FAIL: ${failCount}/${tabsOpenNumTotal}`
                      statusClass.value = successCount > 0 ? 'success' : ''
                  } else {
                      failCount++
                      failedTabs.push({ tab, error: result.message })
                      
                      // Update intermediate status
                      status.value = `Progress: ${successCount}/${tabsOpenNumTotal} uploaded, ${failCount}/${tabsOpenNumTotal} failed`
                      statusClass.value = failCount > 0 ? 'error' : ''
                  }
              } catch (error) {
                  failCount++
                  failedTabs.push({ tab, error: error.message })
                  
                  // Update intermediate status
                  status.value = `Progress: ${successCount}/${tabsOpenNumTotal} uploaded, ${failCount}/${tabsOpenNumTotal} failed`
                  statusClass.value = 'error'
              }
              
              // Small delay between uploads to avoid overwhelming the server
              if (i < tabsToUpload.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 200))
              }
          }
          
          // Final status update
          if (failCount === 0) {
              status.value = `SUCCESS: ${successCount}/${tabsOpenNumTotal} tabs uploaded successfully!`
              statusClass.value = 'success'
              
              if (closeTabAfterUpload.value) {
                  setTimeout(() => {
                      successfulTabs.forEach(tab => chrome.tabs.remove(tab.id))
                  }, 1000)
              }
              
              if (closePopupAfterUpload.value) {
                  setTimeout(() => {
                      window.close()
                  }, 1000)
              }
          } else if (successCount === 0) {
              status.value = `FAILED: 0/${tabsOpenNumTotal} tabs uploaded. All uploads failed.`
              statusClass.value = 'error'
          } else {
              status.value = `PARTIAL SUCCESS: ${successCount}/${tabsOpenNumTotal} tabs uploaded, ${failCount}/${tabsOpenNumTotal} failed.`
              statusClass.value = 'error'
              
              // Close only successful tabs
              if (closeTabAfterUpload.value) {
                  setTimeout(() => {
                      successfulTabs.forEach(tab => chrome.tabs.remove(tab.id))
                  }, 1000)
              }
              
              // Only close popup if there were some successful uploads
              if (successCount > 0 && closePopupAfterUpload.value) {
                  setTimeout(() => {
                      window.close()
                  }, 2000) // Give user more time to read the mixed results
              }
          }
          
          return;
      }
      // upload all tabs at once
      const results = await uploadTabsToRemote(tabsToUpload, {
          tags_id: tagsSelected.tags_id,
          tags_name: tagsSelected.tags_name,
          comment: comment.value
      })

      const successCount = results.success.length
      const failCount = results.failed.length

      if (failCount === 0) {
          status.value = `SUCCESS. ${successCount}/${tabsToUpload.length} uploaded.`
          statusClass.value = 'success'
          
          if (closeTabAfterUpload.value) {
              setTimeout(() => {
                  results.success.forEach(tab => chrome.tabs.remove(tab.id))
              }, 1000)
          }
          
          if (closePopupAfterUpload.value) {
            setTimeout(() => {
              window.close()
            }, 1000)
          }
      } else {
          if(successCount > 0){
              status.value = `HALF FAILED. ${successCount}/${tabsToUpload.length} uploaded.`
          } else {
              status.value = `FAILED. 0/${tabsToUpload.length} tabs uploaded.`
          }
          statusClass.value = 'error'

          // close only successful tabs
          if (closeTabAfterUpload.value) {
              setTimeout(() => {
                  results.success.forEach(tab => chrome.tabs.remove(tab.id))
              }, 1000)
          }

          // Only close popup if there were some successful uploads
          if (successCount > 0 && closePopupAfterUpload.value) {
              setTimeout(() => {
                  window.close()
              }, 2000) // Give user more time to read the mixed results
          }
      }
  } catch (error) {
      console.error('Error in batch upload:', error)
      status.value = `Error in batch upload: ${error.message || error}`
      statusClass.value = 'error'
  }
}

const checkSession = async () => {
  try {
    const sessionStatus = await networkRequest.checkSessionStatus()
    console.log('🍪 Session check results:', sessionStatus)
    
    serverStatus.value = {
      type: sessionStatus.cookieCount > 0 ? 'success' : 'warning',
      message: `🍪 ${sessionStatus.cookieCount} cookies found`
    }
    
    // Also ping server to check if logged in
    setTimeout(async () => {
      await pingServer()
    }, 500)
  } catch (error) {
    console.error('Session check error:', error)
    serverStatus.value = {
      type: 'error',
      message: '❌ Session check failed'
    }
  }
}

const handleServerStatusClick = () => {
  // If server status shows login required, open the login modal
  const status = serverStore.getServerStatusCurrent()
  if (status?.requiresLogin) {
    loginMessage.value = 'Login required to access server features'
    showLoginModal.value = true
  }
}

const handleLogout = async () => {
  try {
    const result = await serverStore.logoutFromServer()
    
    if (result.is_success) {
      // Show success message briefly
      status.value = 'Logged out successfully'
      statusClass.value = 'success'
      setTimeout(() => {
        status.value = ''
        statusClass.value = ''
      }, 2000)
    } else {
      // Show error message
      status.value = `Logout failed: ${result.message}`
      statusClass.value = 'error'
    }
  } catch (error) {
    console.error('Logout error:', error)
    status.value = 'Logout request failed'
    statusClass.value = 'error'
  }
}

const closePopup = () => {
  window.close()
}

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    closePopup()
    }
}

// Initialize when component is mounted
onMounted(async () => {
    // Add keyboard event listener
    document.addEventListener('keydown', handleKeydown)
    
    try {
        // Load URL settings
        await serverStore.getSettingsServer()
    } catch (error) {
        console.error('Error initializing:', error)
        status.value = 'Error initializing settings'
        statusClass.value = 'error'
        throw error
    }

    console.log('onMounted(): ping_server start')
    // Automatically ping server on startup
    await pingServer()
    console.log('onMounted(): ping_server success')
    
    // Initialize browser tabs and similar tabs
    await fetchBrowserTabs()
    
    // Automatically select the active tab by default
    if (tabActive.value) {
      await onUserClickedTab('browser-active', tabActive.value)
    }

    // Initialize tags after URL is set
    if (tagsSelectRef.value) {
        const currentStatus = serverStore.getServerStatusCurrent()
        
        if (currentStatus && currentStatus.type === 'success') {
            await tagsSelectRef.value.refreshTags(false)
        }
    }
})

// Cleanup when component is unmounted
onUnmounted(() => {
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleKeydown)
    
    // Clear tag check interval
    if (tagCheckInterval) {
        clearInterval(tagCheckInterval)
        tagCheckInterval = null
    }
})
</script>

<style scoped>
@import '../assets/base.css';

.close-button {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6c757d;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
  z-index: 10;
}

.close-button:hover {
  background-color: #f8f9fa;
  color: #333;
}

.url-display-group {
  width: 100%;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.url-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.url-label {
  font-size: 12px;
  font-weight: bold;
  color: #495057;
}

.url-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.server-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  font-size: 16px;
  transition: transform 0.2s;
}

.server-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.server-button:not(:disabled):hover {
  transform: scale(1.1);
}

.logout-button {
  background: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 3px;
  transition: background-color 0.2s, opacity 0.2s;
}

.logout-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.logout-button:not(:disabled):hover {
  background-color: #c82333;
}

.settings-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  font-size: 16px;
}

.server-status {
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.server-status.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.server-status.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.server-status.warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
  cursor: pointer;
  transition: background-color 0.2s;
}

.server-status.warning:hover {
  background-color: #ffeaa7;
}

.url-display {
  background-color: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  font-family: monospace;
  font-size: 12px;
  color: #6c757d;
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.url-display.invalid {
  background-color: #fce8e6;
  border-color: #ea4335;
  color: #721c24;
}

.radio-group {
  display: flex;
  gap: 16px;
  margin: 2px 0;
}

.radio-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.options-group {
  margin: 2px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.options-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.comment-input-container {
  width: 100%;
  margin: 8px 0;
  user-select: none;
}

.comment-input-container input {
  width: 100%;
  padding: 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 14px;
}

.upload-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  width: 100%;
  margin: 8px 0;
  font-size: 10px;
}

.upload-buttons button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.upload-buttons button:hover {
  background-color: #0056b3;
}

.upload-buttons button:disabled {
  background-color: #e9ecef !important;
  color: #6c757d !important;
  cursor: not-allowed !important;
  opacity: 0.6;
}

.upload-buttons button:disabled:hover {
  background-color: #e9ecef !important;
  transform: none;
}

.cache-button {
  background-color: #6c757d !important;
}

.cache-button:hover {
  background-color: #545b62 !important;
}

.cache-button:disabled {
  background-color: #e9ecef !important;
  color: #6c757d !important;
}

.cache-button:disabled:hover {
  background-color: #e9ecef !important;
}

.status {
  margin-top: 8px;
  padding: 12px;
  border-radius: 4px;
  width: 100%;
  font-size: 12px;
  line-height: 1.4;
}

.status.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* Tabs Selection Styles */
.tabs-selection-section {
  margin: 4px 0;
  padding: 4px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tabs-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tabs-selection-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.upload-mode-indicator {
  display: flex;
  align-items: center;
}

.mode-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.mode-badge.upload-browser-active-tab {
  background-color: #28a745;
  color: white;
}

.mode-badge.update-server-tab {
  background-color: #ffc107;
  color: #333;
}

.mode-badge.upload-browser-selected-tabs {
  background-color: #007bff;
  color: white;
}

.tabs-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.browser-tabs-section,
.tabs-similar-section {
  width: 100%;
}

.browser-tabs-section h4,
.tabs-similar-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
  font-weight: 600;
}

.tabs-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 4px;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 2px;
  border: 1px solid #dee2e6;
  border-radius: 2px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
}

.tab-item.selected {
  border-color: #007bff;
  background-color: #e3f2fd;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

.tab-icon-and-title {
  display: flex;
  flex-direction: row;
  gap: 4px;
  align-items: center;
  justify-content: flex-start;
}

.tab-favicon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-favicon img {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.tab-type-and-url {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  align-items: center;
  gap: 2px;
}

.tab-title {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-url {
  font-size: 11px;
  color: #666;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
  text-transform: uppercase;
  align-self: flex-start;
}

.active-tab .tab-badge {
  background-color: #28a745;
  color: white;
}

.selected-tab .tab-badge {
  background-color: #17a2b8;
  color: white;
}

.tab-meta {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: #999;
}

.tab-id {
  font-family: monospace;
}

.tab-date {
  font-style: italic;
}

.loading-indicator,
.no-tabs-message {
  text-align: center;
  color: #666;
  font-style: italic;
}

/* Custom scrollbar for tabs list */
.tabs-list::-webkit-scrollbar {
  width: 6px;
}

.tabs-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.tabs-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.tabs-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Update Options Styles */
.update-options-section {
  margin: 16px 0;
  padding: 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: #fff8dc;
}

.update-options-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.update-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.title-comparison {
  border-top: 1px solid #dee2e6;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-comparison-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-comparison-item label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.title-display {
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.3;
  word-break: break-word;
}

.title-display.current {
  background-color: #e3f2fd;
  border: 1px solid #2196f3;
  color: #1565c0;
}

.title-display.existing {
  background-color: #f3e5f5;
  border: 1px solid #9c27b0;
  color: #7b1fa2;
}

h4.tab-type{
  margin: 0;
  margin-bottom: 0px !important;
}

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: calc(100vw - 15px); /* account forscrollbar width */
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  padding: 0 !important;
}

.modal-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 20px;
  animation: modalFadeIn 0.2s ease-out;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  background-color: #f0f0f0;
  color: #333;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .modal-container {
    min-width: auto;
    width: 95vw;
    margin: 10px;
    max-height: 95vh;
  }
  
  .modal-header {
    padding: 12px 16px;
  }
  
  .modal-header h3 {
    font-size: 16px;
  }
}
</style>
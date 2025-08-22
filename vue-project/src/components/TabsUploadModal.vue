<template>
  <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-container" @click.stop>
      <!-- Modal Header -->
      <div class="modal-header">
        <h3>Upload Tabs to Remote</h3>
        <button class="header-close-button" @click="closeModal">×</button>
      </div>

      <!-- Modal Content -->
      <div class="modal-content">
        <!-- Tabs to Upload -->
        <div class="section">
          <h4>Tabs to Upload ({{ tabs.length }})</h4>
          <div class="tabs-list">
            <div 
              v-for="tab in tabs" 
              :key="tab.id"
              class="tab-item"
              :class="{ 
                'upload-success': tabsOpenUploadResults[tab.id]?.success, 
                'upload-error': tabsOpenUploadResults[tab.id]?.error,
                'upload-completed': tabsOpenUploadResults[tab.id]?.success
              }"
            >
              <img 
                :src="tab.favIconUrl || defaultIcon" 
                :alt="tab.title || 'Tab icon'"
                class="tab-icon"
                @error="(e) => e.target.src = defaultIcon"
              />
              <div class="tab-info">
                <div class="tab-title">{{ tab.title || 'Untitled' }}</div>
                <div class="tab-url">{{ tab.url }}</div>
              </div>
              <div class="tab-status">
                <div v-if="tabsOpenUploadResults[tab.id]?.uploading" class="status-uploading">Uploading...</div>
                <div v-else-if="tabsOpenUploadResults[tab.id]?.success" class="status-success">✓ Uploaded</div>
                <div v-else-if="tabsOpenUploadResults[tab.id]?.error" class="status-error">✗ Failed</div>
                <div v-else class="status-pending">Pending</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Server URL Display -->
        <div class="section">
          <h4>Upload Server</h4>
          <div class="server-info">
            <div class="server-url">{{ serverUrl || 'No server configured' }}</div>
            <div v-if="!serverUrl" class="server-warning">
              Please configure server URL in Remote Settings
            </div>
          </div>
        </div>

        <!-- Tags Selection -->
        <div class="section">
          <h4>Tags</h4>
          <TagsSelect
            ref="tagsSelectRef"
                :disabled="isUploading"
            @status="handleTagsStatus"
            @open-tags-manager="handleOpenTagsManager"
          />
        </div>

        <!-- Comment Input -->
        <div class="section">
          <h4>Comment (Optional)</h4>
          <textarea
            v-model="comment"
            placeholder="Add a comment for these uploads..."
            rows="3"
            :disabled="isUploading"
          ></textarea>
        </div>

        <!-- Upload Options -->
        <div class="section">
          <h4>Options</h4>
          <div class="options-container">
            <label class="option-item">
              <input
                type="checkbox"
                v-model="closeTabsAfterUpload"
                :disabled="isUploading"
              />
              Close tabs after successful upload
            </label>
            <label class="option-item">
              <input
                type="checkbox"
                v-model="closeModalAfterUpload"
                :disabled="isUploading"
              />
              Close modal after upload completes
            </label>
          </div>
        </div>

        <!-- Upload Progress -->
        <div v-if="isUploading" class="section">
          <h4>Upload Progress</h4>
          <div class="progress-container">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: `${uploadProgress}%` }"
              ></div>
            </div>
            <div class="progress-text">
              {{ uploadedCount }}/{{ tabs.length }} tabs uploaded
            </div>
          </div>
        </div>

        <!-- Upload Results -->
        <div v-if="uploadCompleted" class="section">
          <h4>Upload Results</h4>
          <div class="results-summary">
            <div class="result-item success">
              ✓ {{ successCount }} successful
            </div>
            <div class="result-item error" v-if="errorCount > 0">
              ✗ {{ errorCount }} failed
            </div>
          </div>
        </div>

        <!-- Error Messages -->
        <div v-if="errorMessage" class="section">
          <div class="error-message">{{ errorMessage }}</div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button 
          class="cancel-button" 
          @click="closeModal"
          :disabled="isUploading"
        >
          {{ isUploading ? 'Uploading...' : 'Cancel' }}
        </button>
        <button 
          class="upload-button" 
          @click="startUpload"
          :disabled="isUploading || !serverUrl || tabs.length === 0 || allTabsUploaded"
        >
          {{ 
            isUploading ? 'Uploading...' : 
            allTabsUploaded ? 'All Tabs Uploaded' :
            `Upload ${hasUnuploadedTabs ? props.tabs.filter(tab => !tabsOpenUploadResults[tab.id]?.success).length : tabs.length} Tab${(hasUnuploadedTabs ? props.tabs.filter(tab => !tabsOpenUploadResults[tab.id]?.success).length : tabs.length) !== 1 ? 's' : ''}`
          }}
        </button>
        <button 
          class="close-button" 
          @click="closeModal"
          :disabled="isUploading"
        >
          Close
        </button>
      </div>
    </div>
  </div>


</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useNetworkRequest } from '../stores/NetworkRequest'
import { useTabsRemote } from '../stores/TabsRemote'
import { useTabsOpen } from '../stores/TabsOpen'
import { useTagsEdit } from '../stores/TagsEdit'
import TagsSelect from './tag/TagsSelect.vue'


// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  tabs: {
    type: Array,
    default: () => []
  },
  serverUrl: {
    type: String,
    default: ''
  }
})

// Emits
const emit = defineEmits([
  'update:is-visible',
  'upload-complete',
  'close',
  'open-tags-manager'
])

// Stores
const networkRequest = useNetworkRequest()
const tabsRemoteStore = useTabsRemote()
const tabsOpenStore = useTabsOpen()
const tagsEditStore = useTagsEdit()

// Refs
const tagsSelectRef = ref(null)

// State
const comment = ref('')
const closeTabsAfterUpload = ref(true)
const closeModalAfterUpload = ref(false)

// Upload state
const isUploading = ref(false)
const tabsOpenUploadResults = ref({}) // tabId -> { uploading, success, error, message }
const uploadCompleted = ref(false)
const errorMessage = ref('')

// Default icon
const defaultIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>'

// Computed
const uploadProgress = computed(() => {
  if (props.tabs.length === 0) return 0
  return Math.round((uploadedCount.value / props.tabs.length) * 100)
})

const uploadedCount = computed(() => {
  return Object.values(tabsOpenUploadResults.value).filter(result => result.success || result.error).length
})

const successCount = computed(() => {
  return Object.values(tabsOpenUploadResults.value).filter(result => result.success).length
})

const errorCount = computed(() => {
  return Object.values(tabsOpenUploadResults.value).filter(result => result.error).length
})

const allTabsUploaded = computed(() => {
  return props.tabs.length > 0 && props.tabs.every(tab => tabsOpenUploadResults.value[tab.id]?.success)
})

const hasUnuploadedTabs = computed(() => {
  return props.tabs.some(tab => !tabsOpenUploadResults.value[tab.id]?.success)
})

// Methods
const closeModal = () => {
  if (!isUploading.value) {
    emit('close')
  }
}

const handleOverlayClick = (event) => {
  if (event.target === event.currentTarget) {
    closeModal()
  }
}

const handleTagsStatus = (message) => {
  if (message && !message.includes('SUCCESS')) {
    errorMessage.value = message
  }
}

// Rename handlers
const handleOpenTagsManager = (data) => {
  emit('open-tags-manager', data)
}

const startUpload = async () => {
  if (isUploading.value || !props.serverUrl || props.tabs.length === 0) return

  isUploading.value = true
  uploadCompleted.value = false
  tabsOpenUploadResults.value = {}
  errorMessage.value = ''

  // Initialize upload results
  props.tabs.forEach(tab => {
    tabsOpenUploadResults.value[tab.id] = { uploading: false, success: false, error: false, message: '' }
  })

  const tabsRemoteCreated = []
  const tabsOpenUploadedId = []

  try {
    // Upload tabs one by one (skip already successfully uploaded tabs)
    for (const tab of props.tabs) {
      // Skip tabs that have already been successfully uploaded
      if (tabsOpenUploadResults.value[tab.id]?.success) {
        console.log(`Skipping already uploaded tab: ${tab.title}`)
        continue
      }
      
      tabsOpenUploadResults.value[tab.id].uploading = true
      try { // Get tags from TagsSelect component
        const tagsCurrent = tagsSelectRef.value?.getCurrentTags() || { tags_id: [], tags_name: [] }
        // console.log('TabsUploadModal.vue: startUpload(): tagsCurrent:', tagsCurrent)
        let post_dict = {
          task: 'create_url_cache',
          tags_id: tagsCurrent.tags_id,
          tags_name: tagsCurrent.tags_name,
        }
        // console.log('TabsUploadModal.vue: startUpload(): tagsCurrent:', tagsCurrent)

        if (comment.value.trim() !== '') {
          post_dict.comment = comment.value.trim()
        }
        // console.log('TabsUploadModal.vue: startUpload(): post_dict:', post_dict)
        const result = await networkRequest.uploadTabToRemote(
          tab,
          post_dict,
          false // fetchTabsRemoteRecent
        )

        if (result.is_success) {
          tabsOpenUploadResults.value[tab.id] = { uploading: false, success: true, error: false, message: 'Uploaded successfully' }
          
          let tab_remote = result.data;
          tabsRemoteCreated.push(tab_remote);
          let tab_open_id = tab.id; // the id of successfully uploaded tab in tabsOpen
        //   let tab_remote_id = result.data.id;
        //   let list_id = result.data.list_id;
          tabsOpenUploadedId.push(tab_open_id);

        } else {
          tabsOpenUploadResults.value[tab.id] = { uploading: false, success: false, error: true, message: result.message || 'Upload failed' }
        }
      } catch (error) {
        console.error('Error uploading tab:', tab.title, error)
        tabsOpenUploadResults.value[tab.id] = { uploading: false, success: false, error: true, message: error.message || 'Network error' }
      }

      // Small delay between uploads to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Call the update function for successfully uploaded tabs
    if (tabsRemoteCreated.length > 0) {
      await tabsRemoteStore.onTabsOpenUploadedToRemote(tabsRemoteCreated)
    }

    // set uploadCompletes state
    uploadCompleted.value = true
    // empty comment
    comment.value = ''

    // close successfully uploaded tabs if option is enabled
    if (closeTabsAfterUpload.value && tabsOpenUploadedId.length > 0) {
      console.log(`Closing ${tabsOpenUploadedId.length} tabs`)
      setTimeout(() => {
        tabsOpenUploadedId.forEach(tabId => {
          console.log(`Closing tab: ${tabId}`)
          try {
            chrome.tabs.remove(tabId)
          } catch (error) {
            console.error('Error closing tab:', error)
          }
        })
      }, 1000)
    }

    // Close modal if option is enabled
    if (closeModalAfterUpload.value) {
      setTimeout(() => {
        emit('upload-complete', {
          uploaded: tabsRemoteCreated,
          total: props.tabs.length,
          success: successCount.value,
          errors: errorCount.value
        })
        closeModal()
      }, 2000)
    } else {
      emit('upload-complete', {
        uploaded: tabsRemoteCreated,
        total: props.tabs.length,
        success: successCount.value,
        errors: errorCount.value
      })
    }

  } catch (error) {
    console.error('Upload process error:', error)
    errorMessage.value = `Upload process failed: ${error.message}`
  } finally {
    isUploading.value = false
  }
}

// Watchers
watch(() => props.isVisible, (newVisible) => {
  if (newVisible) {
    // Reset state when modal opens
    tabsOpenUploadResults.value = {}
    uploadCompleted.value = false
    errorMessage.value = ''
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}


.header-close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #5f6368;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.header-close-button:hover {
  background-color: #f1f3f4;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.section {
  margin-bottom: 24px;
}

.section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #202124;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section h5 {
  margin: 12px 0 8px 0;
  font-size: 13px;
  font-weight: 500;
  color: #5f6368;
}

/* Tabs List */
.tabs-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e1e5e9;
  border-radius: 4px;
}

.tab-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f1f3f4;
  gap: 12px;
}

.tab-item:last-child {
  border-bottom: none;
}

.tab-item.upload-success {
  background-color: #e8f5e8;
  border-left: 4px solid #34a853;
}

.tab-item.upload-error {
  background-color: #fce8e6;
  border-left: 4px solid #ea4335;
}

.tab-item.upload-completed {
  opacity: 0.6;
  background-color: #f8f9fa;
}

.tab-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tab-info {
  flex: 1;
  min-width: 0;
}

.tab-title {
  font-size: 14px;
  font-weight: 500;
  color: #202124;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-url {
  font-size: 12px;
  color: #5f6368;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.tab-status {
  flex-shrink: 0;
}

.status-pending {
  color: #5f6368;
  font-size: 12px;
}

.status-uploading {
  color: #1a73e8;
  font-size: 12px;
  font-weight: 500;
}

.status-success {
  color: #34a853;
  font-size: 12px;
  font-weight: 500;
}

.status-error {
  color: #ea4335;
  font-size: 12px;
  font-weight: 500;
}

/* Server Info */
.server-info {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e1e5e9;
}

.server-url {
  font-family: monospace;
  font-size: 13px;
  color: #202124;
  word-break: break-all;
}

.server-warning {
  color: #ea4335;
  font-size: 12px;
  margin-top: 4px;
}

/* Comment */
textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
}

/* Options */
.options-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.option-item input[type="checkbox"] {
  margin: 0;
}

/* Progress */
.progress-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #f1f3f4;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #1a73e8;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: #5f6368;
  text-align: center;
}

/* Results */
.results-summary {
  display: flex;
  gap: 16px;
}

.result-item {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

.result-item.success {
  background-color: #e8f5e8;
  color: #34a853;
}

.result-item.error {
  background-color: #fce8e6;
  color: #ea4335;
}

/* Error Message */
.error-message {
  padding: 12px;
  background-color: #fce8e6;
  border: 1px solid #ea4335;
  border-radius: 4px;
  color: #ea4335;
  font-size: 14px;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e1e5e9;
  background-color: #f8f9fa;
}

.cancel-button,
.upload-button,
.close-button {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
}

.cancel-button {
  background: white;
  color: #5f6368;
  border-color: #dadce0;
}

.cancel-button:hover:not(:disabled) {
  background-color: #f1f3f4;
}

.upload-button {
  background-color: #1a73e8;
  color: white;
  border-color: #1a73e8;
}

.upload-button:hover:not(:disabled) {
  background-color: #1557b0;
}

.close-button {
  background-color: #34a853;
  color: white;
  border-color: #34a853;
}

.close-button:hover:not(:disabled) {
  background-color: #2d8745;
}

.upload-button:disabled,
.cancel-button:disabled,
.close-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
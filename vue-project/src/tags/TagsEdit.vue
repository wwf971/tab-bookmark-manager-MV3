<!-- Edit tags of a tab -->

<template>
  <div class="tags-edit-modal" v-if="showModal" @click.self="handleCancel">
    <div class="tags-edit-content">
      <!-- Header -->
      <div class="modal-header">
        <h3>Edit Tags</h3>
        <button class="modal-close-button" @click="handleCancel" title="Close">
          &times;
        </button>
      </div>

      <!-- Tab Info -->
      <div class="tab-info-section">
        <div class="tab-info-row">
          <img :src="tab.icon" class="tab-icon" @error="handleIconError" />
          <div class="tab-details">
            <div class="tab-title">{{ tab.title }}</div>
            <div class="tab-url">{{ tab.url }}</div>
          </div>
        </div>
      </div>

      <!-- Tags Selection (edit mode) -->
      <div class="tags-selection-section">
        <TagsSelect
          ref="tagsSelectRef"
          :tags-init="tagsInit"
          :disabled="isLoading"
          @status="handleTagsStatus"
          @open-tags-manager="handleOpenTagsManagerFromTagsSelect"
        />
      </div>

      <!-- Status Message -->
      <div v-if="status" :class="['status-message', statusClass]">
        {{ status }}
      </div>

      <!-- Actions -->
      <div class="tags-edit-actions">
        <button 
          class="change-type-button" 
          @click="handleChangeTypeToUrl"
          :disabled="isLoading"
          title="Change tab type from tab_remote to url"
        >
          {{ isLoading ? 'Changing...' : 'Change to URL type' }}
        </button>
        <button 
          class="cancel-button" 
          @click="handleCancel"
          :disabled="isLoading"
        >
          Cancel
        </button>
        <button 
          class="save-button" 
          @click="handleSaveTags"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Saving...' : 'Save Tags' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useNetworkRequest } from '@/network/NetworkRequest'
import TagsSelect from './TagsSelect.vue'
import { useTagsEdit } from '@/tags/TagsEdit'

const tagsEditStore = useTagsEdit()
const { showModal, tab, tagsInit, renameMode, tagToRename } = storeToRefs(tagsEditStore)

// Emits
const emit = defineEmits([
  'close',
  'tags-saved',
  'tag-renamed',
  'tag-merged',
  'open-tags-manager'
])

// Store
const networkRequest = useNetworkRequest()

// State
const tagsSelectRef = ref(null)
const isLoading = ref(false)
const status = ref('')
const statusClass = ref('')
// Default icon
const defaultIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23e8f0fe" rx="2"/><path d="M4 6h8v1H4V6zm0 2h6v1H4V8z" fill="%231a73e8"/></svg>'

// Methods
const handleIconError = (event) => {
  event.target.src = defaultIcon
}

const handleTagsStatus = (message) => {
  status.value = message
  statusClass.value = 'error'
}

const setStatus = (message, type = 'info') => {
  status.value = message
  statusClass.value = type
  
  // Clear status after 3 seconds for success messages
  if (type === 'success') {
    setTimeout(() => {
      status.value = ''
      statusClass.value = ''
    }, 3000)
  }
}

onMounted(() => {
  // console.warn('TagsEdit.vue: onMounted(): showModal:', showModal.value)
  console.warn('TagsEdit.vue: onMounted(): tagsInit:', tagsInit.value)
  // console.warn('TagsEdit.vue: onMounted(): tab:', tab.value)
  tagsInit.value; // force retrival from pinia
})

// Watch for changes in store values
watch(showModal, (newValue) => {
  console.warn('TagsEdit.vue: showModal changed to:', newValue)
})

watch(tagsInit, (newValue) => {
  console.warn('TagsEdit.vue: tagsInit changed to:', newValue)
}, { deep: true })

const handleCancel = () => {
  emit('close')
}

// Test function to manually trigger the modal
const testModal = () => {
  console.warn('TagsEdit.vue: testModal() called')
  tagsEditStore.openTagsEdit(
    { id: 'test', title: 'Test Tab', url: 'https://example.com' },
    [{ id: 1, name: 'test-tag' }]
  )
}

// Expose test function to window for debugging
if (typeof window !== 'undefined') {
  window.testTagsEdit = testModal
}

const handleOpenTagsManagerFromTagsSelect = (data) => {
  // rename tag
  emit('open-tags-manager', data)
  // emit('open-tags-manager', { tag: tag, initialTab: 'rename' })
}

import { setTagsForTabRemote } from '@/sessions-remote/SessionsRemoteRequest.js'
const handleSaveTags = async () => {
  if (!tagsSelectRef.value) {
    setStatus('Tags component not available', 'error')
    return
  }

  try {
    isLoading.value = true
    setStatus('Saving tags...', 'info')

    // get current tags from TagsSelect component
    const currentTags = tagsSelectRef.value.getCurrentTags()
    
    // console.log('TagsEdit.vue: Saving tags for tab:', tab.value.id)
    // console.log('TagsEdit.vue: Current tags:', currentTags)

    // Call API to set tags for the remote tab
    const result = await setTagsForTabRemote({
      tab_id: tab.value.id,
      tags_id: currentTags.tags_id,
      tags_name: currentTags.tags_name
    })

    if (result.is_success) {
      setStatus('Tags saved successfully!', 'success')
      let tags_id = result.data.tags_id
      let tags_name = result.data.tags_name
      // emit saved event with the updated tags
      emit('tags-saved', {
        tab: tab.value,
        tags_id: tags_id,
        tags_name: tags_name
      })
      // close modal after a short delay
      // setTimeout(() => {emit('close')}, 1500)
    }else{
      setStatus(`Failed to save tags: ${result.message}`, 'error')
    }
  }catch (error) {
    console.error('TagsEdit.vue: Error saving tags:', error)
    setStatus(`Error saving tags: ${error.message || error}`, 'error')
  }finally {
    isLoading.value = false
  }
}

import { useTabsRemote } from '@/sessions-remote/SessionsRemote.js'
const tabsRemoteStore = useTabsRemote()

const handleChangeTypeToUrl = async () => {
  try {
    isLoading.value = true
    setStatus('Changing tab type to URL...', 'info')
    console.log('TagsEdit.vue: Changing tab type for tab:', tab.value.id)

    // Call API to change tab type from tab_remote to url
    const result = await networkRequest.changeNoteType(tab.value.id, 'url')

    if (result.is_success) {
      setStatus('Tab type changed successfully!', 'success')
      console.log(`TagsEdit.vue: Successfully changed tab ${tab.value.id} type to url`)
      
      // Remove the tab locally since it's no longer tab_remote type
      tabsRemoteStore.removeTabRemoteFromLocalCache(tab.value, false, true)
      // Close modal after a short delay since the tab no longer exists as tab_remote
      setTimeout(() => {
        emit('close')
      }, 1500)
    } else {
      setStatus(`Failed to change tab type: ${result.message}`, 'error')
    }
  } catch (error) {
    console.error('TagsEdit.vue: Error changing tab type:', error)
    setStatus(`Error changing tab type: ${error.message || error}`, 'error')
  } finally {
    isLoading.value = false
  }
}

// Clear status when modal opens/closes
watch(showModal, (showModalNew) => {
  if (showModalNew) { // the modal is opened
    status.value = ''
    statusClass.value = ''
  }
})

</script>

<style scoped>
.tags-edit-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.tags-edit-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}



.mode-switcher {
  display: flex;
  align-items: center;
  margin-right: 12px;
}

.mode-button {
  padding: 6px 12px;
  border: 1px solid #1a73e8;
  border-radius: 4px;
  background-color: white;
  color: #1a73e8;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.mode-button:hover {
  background-color: #f1f3f4;
}



.tab-info-section {
  padding: 16px 20px;
  border-bottom: 1px solid #e8eaed;
}

.tab-info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tab-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 2px;
}

.tab-details {
  flex: 1;
  min-width: 0;
}

.tab-title {
  font-size: 14px;
  font-weight: 500;
  color: #202124;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.tab-url {
  font-size: 12px;
  color: #5f6368;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags-selection-section {
  padding: 10px;
  flex: 1;
}

.status-message {
  padding: 12px 20px;
  margin: 0 20px;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 16px;
}

.status-message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status-message.info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.tags-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e8eaed;
  background-color: #f8f9fa;
  border-radius: 0 0 8px 8px;
}

.change-type-button,
.cancel-button,
.save-button {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #dadce0;
}

.change-type-button {
  background: #ff9800;
  color: white;
  border-color: #ff9800;
  margin-right: auto;
}

.change-type-button:hover:not(:disabled) {
  background-color: #f57c00;
  border-color: #f57c00;
}

.cancel-button {
  background: white;
  color: #5f6368;
}

.cancel-button:hover:not(:disabled) {
  background-color: #f8f9fa;
}

.save-button {
  background-color: #1a73e8;
  color: white;
  border-color: #1a73e8;
}

.save-button:hover:not(:disabled) {
  background-color: #1557b0;
}

.change-type-button:disabled,
.cancel-button:disabled,
.save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.rename-redirect-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.rename-redirect-message {
  text-align: center;
  color: #5f6368;
}

.rename-redirect-message p {
  margin: 8px 0;
  font-size: 14px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .tags-edit-content {
    width: 95%;
    max-height: 90vh;
    margin: 20px;
  }
  
  .modal-header,
  .tab-info-section,
  .tags-selection-section,
  .tags-edit-actions {
    padding: 12px 16px;
  }
  
  .tags-edit-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .change-type-button,
  .cancel-button,
  .save-button {
    width: 100%;
  }
}
</style>

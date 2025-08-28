<template>
  <div class="tags-rename-section">
    <!-- Row 1: Tag Selection -->
    <div class="rename-row">
      <h4>Select Tag to Rename</h4>
      <div class="tag-search-container">
        <input
          type="text"
          v-model="tagSearchInput"
          @input="updateTagSearchSuggestions"
          @keydown="handleTagSearchKeydown"
          placeholder="Search for tag to rename..."
          :disabled="isLoading"
        />
        
        <!-- Tag Search Results -->
        <div v-if="showTagSearchResults && tagSearchResults.length > 0" class="tag-search-results">
          <div
            v-for="(tag, index) in tagSearchResults"
            :key="tag.id"
            class="tag-item"
            @click="selectTagToRename(tag)"
            :class="{ 'selected-suggestion': index === tagSelectedSearchIndex }"
          >
            <span class="tag-name" v-html="highlightSearchMatch(tag)"></span>
            <span v-if="tag.id" class="tag-id-corner">{{ tag.id }}</span>
          </div>
        </div>
      </div>
      
      <!-- Selected Tag Display -->
      <div v-if="tagSelected" class="tag-selected-display">
        <span class="tag-selected">
          <span class="tag-name">{{ tagSelected.name }}</span>
          <span class="tag-id-corner">{{ tagSelected.id }}</span>
          <button class="clear-selection" @click="clearSelection">×</button>
        </span>
      </div>
    </div>

    <!-- Row 2: Rename Input -->
    <div class="rename-row rename-input-row">
      <h4>New Tag Name</h4>
      <div class="rename-input-container">
        <input
          type="text"
          v-model="newTagName"
          @input="updateMergeSuggestions"
          placeholder="Enter new tag name..."
          :disabled="!tagSelected || isLoading"
        />
        <button 
          class="rename-button"
          @click="performRename"
          :disabled="!tagSelected || !newTagName.trim() || isLoading"
        >
          {{ isLoading ? 'Renaming...' : 'Rename' }}
        </button>
      </div>
    </div>

    <!-- Row 3: Merge Suggestions -->
    <div class="rename-row merge-suggestions-row">
      <h4>
        {{ !newTagName.trim() && autoAddedMergeSuggestions.length > 0 
           ? 'Related Tags (Merge Instead?)' 
           : 'Similar Tags (Merge Instead?)' }}
      </h4>
      <div class="merge-suggestions-container">
        <div v-if="isSearchingMerge" class="loading-indicator">
          Searching for similar tags...
        </div>
        
        <div v-else-if="displayedMergeSuggestions.length > 0" class="merge-suggestions-list">
          <div
            v-for="tag in displayedMergeSuggestions"
            :key="tag.id"
            class="tag-item merge-tag-item"
            @click="performMerge(tag)"
            :disabled="isLoading"
          >
            <span class="tag-name" v-html="highlightSearchMatch(tag)"></span>
            <span v-if="tag.id" class="tag-id-corner">{{ tag.id }}</span>
            <span class="merge-indicator">Click to merge</span>
          </div>
        </div>
        
        <div v-else-if="newTagName.trim() && !isSearchingMerge" class="no-suggestions">
          No similar tags found
        </div>
        
        <div v-else-if="!newTagName.trim() && autoAddedMergeSuggestions.length === 0 && tagSelected" class="no-suggestions">
          Select a tag from search results to see related tags here
        </div>
      </div>
    </div>

    <!-- Status Messages -->
    <div v-if="statusMessage" class="status-message" :class="statusType">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useTags } from '@/tags/Tags'

const props = defineProps({
  tagToRename: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'tag-rename-success',
  'tag-rename-fail', 
  'tag-rename-cancel',
  'tag-merge-success'
])

// Store
const tagsStore = useTags()

// State
const tagSelected = ref(props.tagToRename)
const newTagName = ref('')
const tagSearchInput = ref('')
const tagSearchResults = ref([])
const showTagSearchResults = ref(false)
const tagSelectedSearchIndex = ref(-1)
const mergeSuggestions = ref([])
const autoAddedMergeSuggestions = ref([]) // Tags auto-added from Row 1 search results
const isLoading = ref(false)
const isSearchingMerge = ref(false)
const statusMessage = ref('')
const statusType = ref('info')

// Timers
let tagSearchTimeout = null
let mergeSearchTimeout = null

// Computed
const isTagSelected = computed(() => !!tagSelected.value)

const displayedMergeSuggestions = computed(() => {
  // If no new tag name entered, show auto-added suggestions from Row 1 selection
  if (!newTagName.value.trim() && autoAddedMergeSuggestions.value.length > 0) {
    return autoAddedMergeSuggestions.value
  }
  // Otherwise show merge suggestions from search
  return mergeSuggestions.value
})

// Watch for prop changes
watch(() => props.tagToRename, (newTag) => {
  if (newTag) {
    tagSelected.value = newTag
    tagSearchInput.value = newTag.name
    showTagSearchResults.value = false
    autoAddedMergeSuggestions.value = [] // Clear auto-added suggestions when prop changes
    
    // Auto-initialize background search for pre-set tag
    performBackgroundSearch(newTag.name)
  }
}, { immediate: true })

// Helper functions
const showStatus = (message, type = 'info', duration = 3000) => {
  statusMessage.value = message
  statusType.value = type
  if (duration > 0) {
    setTimeout(() => {
      statusMessage.value = ''
    }, duration)
  }
}

const highlightSearchMatch = (tag) => {
  if (tag.start_index !== undefined && tag.end_index !== undefined) {
    const before = tag.name.substring(0, tag.start_index)
    const match = tag.name.substring(tag.start_index, tag.end_index)
    const after = tag.name.substring(tag.end_index)
    return `${before}<mark class="search-match">${match}</mark>${after}`
  }
  return tag.name
}

// Tag search functionality
const searchTagsForRename = async (searchStr) => {
  if (!searchStr.trim()) {
    tagSearchResults.value = []
    showTagSearchResults.value = false
    return
  }

  try {
    const results = await tagsStore.searchTags(searchStr.trim())
    tagSearchResults.value = results
    showTagSearchResults.value = results.length > 0
    tagSelectedSearchIndex.value = -1
  } catch (error) {
    console.error('Error searching tags:', error)
    showStatus(`Search error: ${error.message}`, 'error')
  }
}

// Background search for pre-set tags (doesn't show search results dropdown)
const performBackgroundSearch = async (searchStr) => {
  if (!searchStr.trim()) {
    return
  }

  try {
    const results = await tagsStore.searchTags(searchStr.trim())
    // Don't show search results dropdown, but populate auto-suggestions
    // Filter out the selected tag itself
    const otherTags = results.filter(tag => tag.id !== tagSelected.value?.id)
    if (otherTags.length > 0) {
      autoAddedMergeSuggestions.value = otherTags
    }
  } catch (error) {
    console.error('Error performing background search:', error)
  }
}

const updateTagSearchSuggestions = () => {
  if (tagSearchTimeout) {
    clearTimeout(tagSearchTimeout)
  }
  
  // Clear auto-added suggestions when user starts a new search
  autoAddedMergeSuggestions.value = []
  
  tagSearchTimeout = setTimeout(() => {
    searchTagsForRename(tagSearchInput.value)
  }, 200)
}

const handleTagSearchKeydown = (event) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (showTagSearchResults.value && tagSearchResults.value.length > 0) {
        tagSelectedSearchIndex.value = Math.min(
          tagSelectedSearchIndex.value + 1,
          tagSearchResults.value.length - 1
        )
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (showTagSearchResults.value && tagSearchResults.value.length > 0) {
        tagSelectedSearchIndex.value = Math.max(tagSelectedSearchIndex.value - 1, 0)
      }
      break
    case 'Enter':
      event.preventDefault()
      if (showTagSearchResults.value && tagSelectedSearchIndex.value >= 0) {
        selectTagToRename(tagSearchResults.value[tagSelectedSearchIndex.value])
      }
      break
    case 'Escape':
      tagSearchResults.value = []
      showTagSearchResults.value = false
      tagSelectedSearchIndex.value = -1
      break
  }
}

const selectTagToRename = (tag) => {
  tagSelected.value = tag
  tagSearchInput.value = tag.name
  showTagSearchResults.value = false
  tagSelectedSearchIndex.value = -1
  
  // Auto-populate Row 2 with remaining search results (excluding the selected tag)
  autoAddedMergeSuggestions.value = tagSearchResults.value.filter(result => 
    result.id !== tag.id
  )
}

const clearSelection = () => {
  tagSelected.value = null
  tagSearchInput.value = ''
  newTagName.value = ''
  mergeSuggestions.value = []
  autoAddedMergeSuggestions.value = []
}

// Merge suggestions functionality
const searchMergeSuggestions = async (searchStr) => {
  if (!searchStr.trim() || !tagSelected.value) {
    mergeSuggestions.value = []
    return
  }

  try {
    isSearchingMerge.value = true
    const results = await tagsStore.searchTags(searchStr.trim())
    
    // Filter out the currently selected tag and get only similar tags
    mergeSuggestions.value = results.filter(tag => 
      tag.id !== tagSelected.value.id && 
      tag.name.toLowerCase().includes(searchStr.toLowerCase())
    )
  } catch (error) {
    console.error('Error searching merge suggestions:', error)
    mergeSuggestions.value = []
  } finally {
    isSearchingMerge.value = false
  }
}

const updateMergeSuggestions = () => {
  if (mergeSearchTimeout) {
    clearTimeout(mergeSearchTimeout)
  }
  
  // Clear auto-added suggestions when user starts typing in Row 2
  if (newTagName.value.trim()) {
    autoAddedMergeSuggestions.value = []
  }
  
  mergeSearchTimeout = setTimeout(() => {
    searchMergeSuggestions(newTagName.value)
  }, 500)
}

// Actions
const performRename = async () => {
  if (!tagSelected.value || !newTagName.value.trim()) {
    return
  }

  try {
    isLoading.value = true
    const result = await tagsStore.renameTag(tagSelected.value.id, newTagName.value.trim())
    
    if (result.is_success) {
      showStatus('Tag renamed successfully!', 'success', 2000)
      emit('tag-rename-success', {
        oldTag: tagSelected.value,
        newName: newTagName.value.trim()
      })
      
      // Reset form
      clearSelection()
    } else {
      showStatus(`Rename failed: ${result.message}`, 'error')
      emit('tag-rename-fail', result.message)
    }
  } catch (error) {
    console.error('Error renaming tag:', error)
    showStatus(`Rename failed: ${error.message}`, 'error')
    emit('tag-rename-fail', error.message)
  } finally {
    isLoading.value = false
  }
}

const performMerge = async (destTag) => {
  if (!tagSelected.value || !destTag) {
    return
  }

  try {
    isLoading.value = true
    const result = await tagsStore.mergeTag(tagSelected.value.id, destTag.id)
    if (result.is_success) {
      showStatus(`Tag merged successfully with "${destTag.name}"!`, 'success', 2000)
      emit('tag-merged', {
        sourceTag: tagSelected.value,
        destTag: destTag
      })

      // Reset form
      clearSelection()
    } else {
      showStatus(`Merge failed: ${result.message}`, 'error')
      emit('tag-rename-fail', result.message)
    }
  } catch (error) {
    console.error('Error merging tag:', error)
    showStatus(`Merge failed: ${error.message}`, 'error')
    emit('tag-rename-fail', error.message)
  } finally {
    isLoading.value = false
  }
}

// Expose methods
defineExpose({
  setTagToRename: (tag) => {
    tagSelected.value = tag
    if (tag) {
      tagSearchInput.value = tag.name
      showTagSearchResults.value = false
    }
  },
  clearSelection
})
</script>

<style scoped>
.tags-rename-section {
  padding: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rename-row {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px;
  background: white;
}

.rename-row h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 16px;
}

/* Tag Selection Row */
.tag-search-container {
  position: relative;
}

.tag-search-container input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
}

.tag-search-results {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
}

/* .tag-item { ... } is in base.css */

.selected-suggestion {
  background-color: #e8f0fe;
  color: #1a73e8;
  border-color: #1a73e8;
}

.merge-tag-item {
  background-color: #fce8e6;
  color: #d93025;
  border-color: #d93025;
}

.merge-tag-item:hover {
  background-color: #fad2cf;
  color: #d93025;
  border-color: #d93025;
}

.merge-indicator {
  font-size: 10px;
  color: inherit;
  opacity: 0.8;
  margin-left: 4px;
}

/* tag-selected is in base.css */

.tag-selected-display {
  margin-top: 12px;
}

.clear-selection {
  background: none;
  border: none;
  color: #1a73e8;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.clear-selection:hover {
  background-color: rgba(26, 115, 232, 0.1);
}

/* Rename Input Row */
.rename-input-container {
  display: flex;
  gap: 8px;
  align-items: center;
}

.rename-input-container input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
}

.rename-button {
  padding: 8px 16px;
  border: 1px solid #1a73e8;
  border-radius: 4px;
  background-color: #1a73e8;
  color: white;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.rename-button:hover:not(:disabled) {
  background-color: #1557b0;
}

.rename-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Merge Suggestions Row */
.merge-suggestions-container {
  min-height: 40px;
}

.loading-indicator {
  text-align: center;
  color: #5f6368;
  font-style: italic;
  padding: 20px;
}

.merge-suggestions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.merge-suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fafafa;
}

.tag-info {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}


.merge-button {
  padding: 4px 8px;
  border: 1px solid #ea4335;
  border-radius: 4px;
  background-color: #ea4335;
  color: white;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.merge-button:hover:not(:disabled) {
  background-color: #d93025;
}

.merge-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.no-suggestions {
  text-align: center;
  color: #9aa0a6;
  font-style: italic;
  padding: 20px;
}

/* Status Messages */
.status-message {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-top: 8px;
}

.status-message.info {
  background-color: #e8f0fe;
  color: #1a73e8;
  border: 1px solid #1a73e8;
}

.status-message.success {
  background-color: #e6f4ea;
  color: #137333;
  border: 1px solid #137333;
}

.status-message.error {
  background-color: #fce8e6;
  color: #d93025;
  border: 1px solid #d93025;
}

.search-match {
  background-color: #fff176;
  padding: 0;
  border-radius: 2px;
}

/* Disabled states */
input:disabled,
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

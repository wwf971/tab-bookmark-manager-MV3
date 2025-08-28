<template>
  <div class="tags-set-section">
    <!-- Tag Set Selection -->
    <div class="tag-set-selector">
      <h4 class="text-bold">Tag Sets:</h4>
      <div class="tag-set-list">
        <div
          v-for="tagSet in tagSets"
          :key="tagSet.id"
          class="tag-set-item"
          :class="{ 'selected': tagSetSelected?.id === tagSet.id }"
          @click="selectTagSet(tagSet)"
        >
          <span class="tag-set-name">{{ tagSet.name }}</span>
          <span class="tag-count">({{ tagSet.tags_id?.length || 0 }})</span>
          <span v-if="tagSet.id" class="tag-id-corner">{{ tagSet.id }}</span>
        </div>
      </div>
      <button 
        class="refresh-tag-sets-button" 
        @click="refreshTagSets"
        :disabled="isLoadingTagSets"
        title="Refresh tag sets from server"
      >
        {{ isLoadingTagSets ? '...' : '↻' }}
      </button>
    </div>

    <!-- Tag Set Management -->
    <div v-if="tagSetSelected" class="tag-set-management">
      <div class="tag-set-header">
        <h4>{{ tagSetSelected.name }} - Tags</h4>
        <button 
          class="refresh-current-set-button" 
          @click="refreshCurrentTagSet"
          :disabled="isLoadingCurrentSet"
          title="Refresh current tag set"
        >
          {{ isLoadingCurrentSet ? '...' : '↻' }}
        </button>
      </div>

      <!-- Add Tag Input -->
      <div class="add-tag-container">
        <div style="position: relative; flex: 1;">
          <input
            type="text"
            v-model="tagSearchInput"
            @input="updateTagSuggestions"
            @keydown="handleKeydown"
            @keypress.enter.prevent="addSelectedTag"
            placeholder="Search tags to add to set..."
            :disabled="isAddingTag"
          />
          
          <!-- Tag Suggestions -->
          <div v-if="showTagSuggestions && tagSuggestions.length > 0" class="tag-suggestions">
            <div
              v-for="(tag, index) in tagSuggestions"
              :key="tag.id || tag.name"
              class="tag-item-search"
              @click="selectSuggestedTag(tag); addSelectedTag()"
              :class="{ 
                'selected-suggestion': index === selectedSuggestionIndex,
                'already-in-set': tag.isAlreadyInSet
              }"
            >
              <span class="tag-name" v-html="highlightSearchMatch(tag)"></span>
              <span v-if="tag.id" class="tag-id-corner">{{ tag.id }}</span>
              <span v-if="tag.isAlreadyInSet" class="already-in-set-indicator">✓</span>
            </div>
          </div>
        </div>
        
        <button 
          class="add-tag-button" 
          @click="addSelectedTag"
          :disabled="isAddingTag || !selectedSuggestedTag"
        >
          {{ isAddingTag ? 'Adding...' : 'Add' }}
        </button>
      </div>

      <!-- Current Tags in Set (Draggable) -->
      <div class="current-tags-container">
        <!-- Drop zone before first tag -->
        <div
          v-if="tagsInTagSetCurrent.length > 0"
          class="drop-zone"
          :class="{ 'drop-zone-active': dragOverIndex === -1 }"
          @dragover.prevent="handleDragOver($event, -1)"
          @drop="handleDropInZone($event, 0)"
          @dragleave="handleDragLeave"
        ></div>

        <template v-for="(tag, index) in tagsInTagSetCurrent" :key="tag.id">
          <!-- Tag element -->
          <div
            class="tag-item-draggable"
            :class="{ 'dragging': draggedIndex === index, 'drag-over': dragOverIndex === index }"
            :draggable="!isReordering"
            @dragstart="handleDragStart($event, index)"
            @dragover.prevent="handleDragOver($event, index)"
            @drop="handleDrop($event, index)"
            @dragenter.prevent
          >
            <span class="drag-handle">⋮⋮</span>
            <span class="tag-name">{{ tag.name }}</span>
            <span class="tag-id-corner">{{ tag.id }}</span>
            <button 
              class="tag-item-button-remove" 
              @click="removeTagFromSet(tag)"
              :disabled="isRemovingTag"
              title="Remove from set"
            >
              ×
            </button>
          </div>

          <!-- Drop zone after each tag -->
          <div
            class="drop-zone"
            :class="{ 'drop-zone-active': dragOverIndex === index + 1000 }"
            @dragover.prevent="handleDragOver($event, index + 1000)"
            @drop="handleDropInZone($event, index + 1)"
            @dragleave="handleDragLeave"
          ></div>
        </template>

        <!-- Placeholder when no tags -->
        <div v-if="tagsInTagSetCurrent.length === 0" class="empty-placeholder">
          No tags in this set. Use the search above to add tags.
        </div>
      </div>

      <!-- Status Messages -->
      <div v-if="statusMessage" class="status-message" :class="statusType">
        {{ statusMessage }}
      </div>
    </div>

    <!-- No Tag Set Selected -->
    <div v-else class="no-selection">
      <p>Select a tag set to manage its tags</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTags } from '@/tags/Tags'
import { storeToRefs } from 'pinia'

// Store
const tagsStore = useTags()
const { tagSetsAll, isLoadingTagSets, tagSetCache, tagsCache } = storeToRefs(tagsStore)

// State - only UI-specific state remains here
const tagSetSelected = ref(null)
const tagSearchInput = ref('')
const tagSuggestions = ref([])
const showTagSuggestions = ref(false)
const selectedSuggestionIndex = ref(-1)

// Loading states - only for operations not handled by store
const isLoadingCurrentSet = ref(false)
const isAddingTag = ref(false)
const isRemovingTag = ref(false)
const isReordering = ref(false)
const isSearching = ref(false)

// Status
const statusMessage = ref('')
const statusType = ref('info') // 'info', 'success', 'error'

// Drag and drop
const draggedIndex = ref(null)
const dragOverIndex = ref(null)

// Search debounce timer
let searchTimeout = null

// Computed - use store data and selected tag set
const tagSets = computed(() => tagSetsAll.value)

// Reactive ref for current tags instead of computed
const tagsInTagSetCurrent = ref([])

// Method to load tags for the current tag set
const loadTagsForTagSetCurrent = async () => {
  console.log(`TagsSet.vue: loadTagsForTagSetCurrent: tagSetSelected.value: ${tagSetSelected.value}`)
  if (!tagSetSelected.value?.id) {
    console.log(`TagsSet.vue: loadTagsForTagSetCurrent: tagSetSelected.value is null`)
    tagsInTagSetCurrent.value = []
    return
  }

  // Get the latest version from store cache
  const tagSet = tagSetCache.value[tagSetSelected.value.id]
  if (tagSet && tagSet.tags_id) {
    try {
      // Get tag objects from cache using tags_id (this is async)
      const result = await tagsStore.getTagsById(tagSet.tags_id)
      if (result.is_success) {
        tagsInTagSetCurrent.value = result.data || []
      } else {
        console.error('Failed to load tags:', result.message)
        tagsInTagSetCurrent.value = []
      }
    } catch (error) {
      console.error('Error loading tags for current set:', error)
      tagsInTagSetCurrent.value = []
    }
  } else {
    // If not in cache, set empty array
    tagsInTagSetCurrent.value = []
  }
}

watch(tagsInTagSetCurrent, async (newVal, oldVal) => {
  console.log("TagsSet.vue: tagsInTagSetCurrent: newVal:",{newVal}, "oldVal:",{oldVal})
  
  // Refresh search results to update "already in set" indicators when tag set content changes
  if (tagSearchInput.value.trim()) {
    await searchTags(tagSearchInput.value)
  }
})

// Watch for changes in the tag set cache to reload current tags
watch(
  [tagSetCache, tagSetSelected],
  async ([newCache, newSelected]) => {
    if (newSelected?.id && newCache[newSelected.id]) {
      await loadTagsForTagSetCurrent()
      
      // Also refresh search results to update "already in set" indicators
      if (tagSearchInput.value.trim()) {
        await searchTags(tagSearchInput.value)
      }
    }
  },
  { deep: true }
)

const selectedSuggestedTag = computed(() => {
  if (selectedSuggestionIndex.value >= 0 && tagSuggestions.value.length > 0) {
    return tagSuggestions.value[selectedSuggestionIndex.value]
  }
  return null
})

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

// Search result highlighting (same as TagsSelect.vue)
const highlightSearchMatch = (tag) => {
  if (tag.start_index !== undefined && tag.end_index !== undefined) {
    const before = tag.name.substring(0, tag.start_index)
    const match = tag.name.substring(tag.start_index, tag.end_index)
    const after = tag.name.substring(tag.end_index)
    return `${before}<mark class="search-match">${match}</mark>${after}`
  }
  return tag.name
}

// Store methods
const fetchTagSets = async () => {
  try {
    const tagSets = await tagsStore.gettagSetsAll(true) // Force refresh
    if (tagSets.length === 0) {
      showStatus('No tag sets found', 'info')
    }
  } catch (error) {
    console.error('Error fetching tag sets:', error)
    showStatus(`Error fetching tag sets: ${error.message}`, 'error')
  }
}

const refreshTagSets = async () => {
  await fetchTagSets()
}

const selectTagSet = async (tagSet) => {
  tagSetSelected.value = tagSet
  console.warn(`TagsSet.vue: selectTagSet: tagSet.id: ${tagSet.id} tagSet:`, tagSet)
  
  // Load tags for the selected tag set
  await loadTagsForTagSetCurrent()
}

const refreshCurrentTagSet = async () => {
  if (!tagSetSelected.value) return
  
  try {
    isLoadingCurrentSet.value = true
    const refreshedTagSet = await tagsStore.refreshTagSet(tagSetSelected.value.name)
    tagSetSelected.value = refreshedTagSet
    
    // Reload tags for the refreshed tag set
    await loadTagsForTagSetCurrent()
    
    showStatus('Tag set refreshed', 'success', 2000)
  } catch (error) {
    console.error('Error refreshing tag set:', error)
    showStatus(`Error refreshing tag set: ${error.message}`, 'error')
  } finally {
    isLoadingCurrentSet.value = false
  }
}

// Tag search functionality
const searchTags = async (searchStr) => {
  if (!searchStr.trim()) {
    tagSuggestions.value = []
    showTagSuggestions.value = false
    return
  }

  try {
    isSearching.value = true
    const results = await tagsStore.searchTags(searchStr.trim())
    
    // Don't filter out existing tags, but mark them for different styling
    const currentTagIds = new Set(tagsInTagSetCurrent.value.map(tag => tag.id))
    const suggestions = results.map(tag => ({
      ...tag,
      isAlreadyInSet: currentTagIds.has(tag.id)
    }))
    
    tagSuggestions.value = suggestions
    showTagSuggestions.value = tagSuggestions.value.length > 0
    selectedSuggestionIndex.value = tagSuggestions.value.length > 0 ? 0 : -1
  } catch (error) {
    console.error('Error searching tags:', error)
    showStatus(`Search error: ${error.message}`, 'error')
  } finally {
    isSearching.value = false
  }
}

const updateTagSuggestions = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(() => {
    searchTags(tagSearchInput.value)
  }, 200)
}

// Keyboard navigation
const handleKeydown = (event) => {
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault()
      if (showTagSuggestions.value && tagSuggestions.value.length > 0) {
        selectedSuggestionIndex.value = Math.min(
          selectedSuggestionIndex.value + 1,
          tagSuggestions.value.length - 1
        )
      }
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault()
      if (showTagSuggestions.value && tagSuggestions.value.length > 0) {
        selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, 0)
      }
      break
    case 'Enter':
      console.warn("TagsSet.vue: handleKeydown: Enter")
      event.preventDefault()
      if (showTagSuggestions.value && selectedSuggestionIndex.value >= 0) {
        selectSuggestedTag(tagSuggestions.value[selectedSuggestionIndex.value])
        addSelectedTag()
      }else{
        console.warn("TagsSet.vue: handleKeydown: Enter: no selected suggestion")
        console.log("showTagSuggestions:", showTagSuggestions.value)
        console.log("tagSuggestions:", tagSuggestions.value)
        console.log("selectedSuggestionIndex:", selectedSuggestionIndex.value)
      }
      break
    case 'Escape':
      tagSuggestions.value = []
      showTagSuggestions.value = false
      selectedSuggestionIndex.value = -1
      break
  }
}

const selectSuggestedTag = (tag) => {
  selectedSuggestionIndex.value = tagSuggestions.value.findIndex(t => t.id === tag.id)
  tagSearchInput.value = tag.name
  // Don't hide suggestions yet to allow clicking the Add button
}

const addSelectedTag = async () => {
  const tag = selectedSuggestedTag.value
  if (!tag || !tagSetSelected.value?.id || isAddingTag.value) {
    console.error("TagsSet.vue: addSelectedTag: tag or tagSetSelected is null or isAddingTag is true")
    console.log("tag:", tag)
    console.log("tagSetSelected:", tagSetSelected.value)
    console.log("isAddingTag:", isAddingTag.value)
    return
  }
  
  // Check if tag is already in the set
  if (tag.isAlreadyInSet) {
    // Clear search but show a gentle message
    tagSearchInput.value = ''
    tagSuggestions.value = []
    showTagSuggestions.value = false
    selectedSuggestionIndex.value = -1
    
    showStatus(`"${tag.name}" is already in this tag set`, 'info', 2000)
    return
  }
  
  await addTagToTagSet(tag)
}

const addTagToTagSet = async (tag) => {
  try {
    isAddingTag.value = true
    await tagsStore.addTagsToTagSet(tagSetSelected.value.id, [tag.id])
    
    // Clear search
    tagSearchInput.value = ''
    tagSuggestions.value = []
    showTagSuggestions.value = false
    selectedSuggestionIndex.value = -1
    
    showStatus(`Added "${tag.name}" to tag set`, 'success', 2000)
  } catch (error) {
    console.error('Error adding tag to set:', error)
    showStatus(`Error adding tag: ${error.message}`, 'error')
  } finally {
    isAddingTag.value = false
  }
}

// Tag removal
const removeTagFromSet = async (tag) => {
  if (!tagSetSelected.value || isRemovingTag.value) return

  try {
    isRemovingTag.value = true
    const result = await tagsStore.removeTagsFromTagSet(tagSetSelected.value.id, [tag.id])
    if(result.is_success){
      // The watcher will automatically reload tags when the cache updates
      showStatus(`Removed "${tag.name}" from tag set`, 'success', 2000)
    }else{
      showStatus(`Error removing tag: ${result.message}`, 'error')
    }
  } catch (error) {
    console.error('Error removing tag from set:', error)
    showStatus(`Error removing tag: ${error.message}`, 'error')
  } finally {
    isRemovingTag.value = false
  }
}

// Drag and drop functionality
const handleDragStart = (event, index) => {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  // Add some visual feedback
  event.dataTransfer.setData('text/plain', '')
}

const handleDragOver = (event, index) => {
  event.preventDefault()
  
  // Set visual feedback for drop zones
  if (index >= 1000) {
    // This is a drop zone after a tag (index - 1000 = actual position)
    dragOverIndex.value = index
  } else if (index === -1) {
    // This is the drop zone before the first tag
    dragOverIndex.value = -1
  } else {
    // This is a tag element
    dragOverIndex.value = index
  }
}

const handleDragLeave = () => {
  // Clear drag over state when leaving drop zones
  dragOverIndex.value = null
}

const handleDrop = async (event, dropIndex) => {
  event.preventDefault()
  await executeReorder(dropIndex)
}

const handleDropInZone = async (event, dropIndex) => {
  event.preventDefault()
  await executeReorder(dropIndex)
}

const executeReorder = async (dropIndex) => {
  // Clear visual feedback
  dragOverIndex.value = null
  
  if (draggedIndex.value === null || draggedIndex.value === dropIndex || isReordering.value) {
    draggedIndex.value = null
    return
  }

  const draggedTag = tagsInTagSetCurrent.value[draggedIndex.value]
  if (!draggedTag || !tagSetSelected.value) {
    draggedIndex.value = null
    return
  }

  // Adjust drop index if dropping after the dragged item
  let adjustedDropIndex = dropIndex
  if (dropIndex > draggedIndex.value) {
    adjustedDropIndex = dropIndex - 1
  }

  try {
    isReordering.value = true
    
    // Call store method to change order
    await tagsStore.changeTagOrderInTagSet(
      tagSetSelected.value.id,
      draggedTag.id,
      adjustedDropIndex
    )
    
    showStatus(`Moved "${draggedTag.name}" to position ${adjustedDropIndex + 1}`, 'success', 2000)
  } catch (error) {
    console.error('Error reordering tags:', error)
    showStatus(`Error reordering tags: ${error.message}`, 'error')
  } finally {
    isReordering.value = false
    draggedIndex.value = null
  }
}

// Initialize
onMounted(async () => {
  await fetchTagSets()
})

// Expose methods for parent component
defineExpose({
  refreshTagSets,
  tagSetSelected: computed(() => tagSetSelected.value)
})
</script>

<style scoped>
.tags-set-section {
  padding: 4px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 600px;
  overflow-y: auto;
}

.tag-set-selector {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  gap: 8px;
}

.tag-set-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-set-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background-color: #f8f9fa;
  border: 1px solid #dadce0;
  border-radius: 3px;
  font-size: 13px;
  color: #3c4043;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;
}

.tag-set-item:hover {
  background-color: #f1f3f4;
  border-color: #bdc1c6;
  transform: translateY(-1px);
  box-shadow: 0 1px 2px rgba(60, 64, 67, 0.1);
}

.tag-set-item.selected {
  background-color: #e8f0fe;
  border-color: #1a73e8;
  color: #1a73e8;
  font-weight: 500;
}

.tag-set-item.selected:hover {
  background-color: #d2e3fc;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.2);
}

.tag-set-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-count {
  font-size: 11px;
  color: #5f6368;
  padding: 1px 4px;
  background-color: rgba(95, 99, 104, 0.08);
  border-radius: 2px;
  min-width: fit-content;
}

.tag-set-item.selected .tag-count {
  color: #1967d2;
  background-color: rgba(26, 115, 232, 0.08);
}

.refresh-tag-sets-button,
.refresh-current-set-button {
  padding: 6px 8px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  color: #5f6368;
}

.refresh-tag-sets-button:hover:not(:disabled),
.refresh-current-set-button:hover:not(:disabled) {
  background-color: #f1f3f4;
}

.tag-set-management {
  position: relative;
}

.tag-set-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.add-tag-container {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  position: relative;
}

.add-tag-container input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
}

.add-tag-button {
  padding: 8px 16px;
  border: 1px solid #1a73e8;
  border-radius: 4px;
  background-color: #1a73e8;
  color: white;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.add-tag-button:hover:not(:disabled) {
  background-color: #1557b0;
}

.add-tag-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tag-suggestions {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 80px;
  background: white;
  border: 1px solid #dadce0;
  border-radius: 4px;
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
}

/* tag-item-search is placed in bass.css */

.selected-suggestion {
  background-color: #e8f0fe;
  border-color: #1a73e8;
  color: #1a73e8;
}

.tag-item-search.already-in-set {
  background-color: #f0f0f0;
  color: #9aa0a6;
  border-color: #e0e0e0;
  opacity: 0.7;
}

.tag-item-search.already-in-set:hover {
  background-color: #e8e8e8;
}

.already-in-set-indicator {
  font-size: 12px;
  color: #34a853;
  font-weight: bold;
  margin-left: 4px;
}

.tag-item-search.already-in-set.selected-suggestion {
  background-color: #e8e8e8;
  border-color: #bbb;
  color: #666;
}

.current-tags-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0px;
  margin-bottom: 16px;
  min-height: 40px;
  padding: 8px;
  border: 1px dashed #dadce0;
  border-radius: 4px;
  background-color: #fafafa;
}

.tag-item-draggable {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px;
  background-color: #e8f0fe;
  border-radius: 4px;
  font-size: 13px;
  color: #1a73e8;
  border: 1px solid #1a73e8;
  position: relative;
  cursor: grab;
  transition: all 0.2s ease;
}

.tag-item-draggable:hover {
  background-color: #d2e3fc;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tag-item-draggable:active {
  cursor: grabbing;
}

.tag-item-draggable.dragging {
  opacity: 0.5;
  transform: rotate(2deg);
}

.tag-item-draggable.drag-over {
  background-color: #d2e3fc;
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(26, 115, 232, 0.2);
}

.drag-handle {
  color: #9aa0a6;
  font-size: 12px;
  cursor: grab;
}

.tag-item-draggable:active .drag-handle {
  cursor: grabbing;
}

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

.no-selection {
  text-align: center;
  color: #5f6368;
  padding: 40px 20px;
  font-style: italic;
}

.search-match {
  background-color: #fff176;
  padding: 0;
  border-radius: 2px;
}

/* Drop zones */
.drop-zone {
  width: 8px;
  height: 32px;
  background-color: transparent;
  border-radius: 2px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.drop-zone-active {
  background-color: #1a73e8;
  box-shadow: 0 0 8px rgba(26, 115, 232, 0.5);
  width: 6px;
}

.empty-placeholder {
  color: #9aa0a6;
  font-style: italic;
  text-align: center;
  padding: 20px;
  flex: 1;
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  margin: 4px;
}

/* Disabled states */
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
<template>
  <div class="tags-section">
    <div style="position: relative;">
      <!-- Tag Input Container -->
      <div class="tag-input-container">
        <input
          type="text"
          v-model="tagInput"
          @input="startTagSearch"
          @keydown="handleKeydown"
          @keypress.enter.prevent="addUserInputTag"
          placeholder="Type to search or add tags..."
          :disabled="disabled"
        />
        <button 
          class="add-tag-button" 
          @click="addUserInputTag"
          :disabled="disabled || !tagInput.trim()"
        >
          Add
        </button>
        <button 
          class="refresh-tags-button" 
          @click="refreshTags"
          :disabled="isLoadingTags"
          title="Refresh tags from server"
        >
          {{ isLoadingTags ? '...' : '↻' }}
        </button>
        <button 
          class="settings-button" 
          @click="showTagsManager = true"
          :disabled="disabled"
          title="Tag management settings"
        >
          ⚙️
        </button>
      </div>

      <!-- Tag Suggestions -->
      <div v-if="showTagSearchResults && tagSearchResults.length > 0" class="tag-suggestions">
        <div
          v-for="(tag, index) in tagSearchResults"
          :key="tag.id || tag.name"
          class="tag-item-search"
          @click="selectSuggestedTag(tag)"
          :class="{ 'selected-suggestion': index === tagSearchResultSelectedIndex }"
        >
          <span class="tag-name" v-html="highlightSearchMatch(tag)"></span>
          <span v-if="tag.id" class="tag-id-corner">{{ tag.id }}</span>
        </div>
      </div>
    </div>

    <!-- Loading indicator for search -->
    <div v-if="isSearching" class="search-loading">
      Searching...
    </div>

    <!-- Available Tags -->
    <div 
      v-if="tagsAvailable.length > 0" 
      class="tags-available"
      @contextmenu="handleContainerContextMenu"
    >
      <div
        v-for="tag in tagsAvailable"
        :key="tag.id || tag.name"
        class="tag-item"
        :class="{ 'tag-selected': isTagSelected(tag) }"
        :data-tag-id="tag.id"
        :data-tag-name="tag.name"
        @click="toggleTag(tag)"
      >
        <span class="tag-name">{{ tag.name }}</span>
        <span v-if="tag.id" class="tag-id-corner">{{ tag.id }}</span>
      </div>
    </div>

    <!-- Selected Tags Display -->
    <div class="tags-selected">
      <h5>Selected Tags:</h5>
      <div
        class="tags-selected-list"
        @contextmenu="handleContainerContextMenu"
      >
        <span
          v-for="tag in tagsSelectedAll"
          :key="tag.id || tag.name"
          class="tag-selected"
          :data-tag-id="tag.id"
          :data-tag-name="tag.name"
        >
          <span class="tag-name">{{ tag.name }}</span>
          <span v-if="tag.id" class="tag-id-corner">{{ tag.id }}</span>
          <span v-else class="tag-new-corner">NEW</span>
          <button 
            class="tag-item-button-remove" 
            @click="removeTagFromSelectedTags(tag)"
            :disabled="disabled"
          >
            ×
          </button>
        </span>
      </div>
    </div>

    <!-- Tags Manager Modal -->
    <TagsManager 
      :visible="showTagsManager"
      @close="showTagsManager = false"
    />

    <!-- Context Menu -->
    <TagsContextMenu
      :show="showContextMenu"
      :x="contextMenuPosition.x"
      :y="contextMenuPosition.y"
      :tag="contextMenuTag"
      @close="closeContextMenu"
      @rename-tag="handleRenameTag"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { useNetworkRequest } from '@/network/NetworkRequest'
import { useTags } from '@/tags/Tags'
import TagsManager from '@/tags/TagsManager.vue'
import TagsContextMenu from '@/tags/TagsContextMenu.vue'

// Props
const props = defineProps({
  tagsInit: {
    type: Array,
    default: () => []
      // Array of tags to initialize with
      // each tag is a reference to tag in tagsCahce@Tags.js
  },
  tagsNew: {
    type: Array,
    default: () => [] // New tags that don't exist on server
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits([
  'update:tagsNew',
  'status',
  'authRequired',
  'open-tags-manager'
])

// Stores
const networkRequest = useNetworkRequest()
const tagsStore = useTags()

// State - simplified design
const tagsSelected = ref([]) // Array of tag objects (existing tags with IDs)
const tagsNewList = ref([...props.tagsNew]) // Array of new tag objects (no IDs)
const tagsTemp = ref([]) // Array of temporary tags from search/input (with IDs but not in tag set)
const tagInput = ref('')
const tagSearchResults = ref([]) // Array of tag objects from search
const showTagSearchResults = ref(false)
const isLoadingTags = ref(false)
const isSearching = ref(false)
const tagSearchResultSelectedIndex = ref(-1)
const showTagsManager = ref(false)
const currentTagSetId = ref('regular') // Track current tag set

// Context menu state
const showContextMenu = ref(false)
const contextMenuTag = ref(null)
const contextMenuPosition = ref({ x: 0, y: 0 })

// Search debounce timer
let searchTimeout = null

// Wait for search completion to avoid race conditions
const waitForSearchCompletion = async () => {
  // Wait for any ongoing search to complete
  while (isSearching.value) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  // If there's a pending search timeout, wait for it to complete
  if (searchTimeout) {
    return new Promise(resolve => {
      const originalTimeout = searchTimeout
      searchTimeout = setTimeout(async () => {
        await searchTags(tagInput.value)
        resolve()
      }, 200)
      clearTimeout(originalTimeout)
    })
  }
}

// Computed
const tagsAvailable = computed(() => {
  // Combine tags from tag set with temporary tags
  const tagSetTags = tagsStore.getTagsFromTagSet(currentTagSetId.value)
  const combinedTags = [...tagSetTags, ...tagsTemp.value]
  
  // Remove duplicates based on tag ID
  const uniqueTags = combinedTags.filter((tag, index, array) => 
    array.findIndex(t => t.id === tag.id) === index
  )
  
  return uniqueTags
})

const tagsSelectedAll = computed(() => {
  return [...tagsSelected.value, ...tagsNewList.value]
})

// Watchers
watch(() => props.tagsNew, (newTags) => {
  tagsNewList.value = newTags.map(name => ({ name, id: null }))
}, { deep: true })

// Helper functions
const isTagSelected = (tag) => {
  return tagsSelectedAll.value.some(selected => selected.name === tag.name)
}

// Search result highlighting
const highlightSearchMatch = (tag) => {
  if (tag.start_index !== undefined && tag.end_index !== undefined) {
    const before = tag.name.substring(0, tag.start_index)
    const match = tag.name.substring(tag.start_index, tag.end_index)
    const after = tag.name.substring(tag.end_index)
    return `${before}<mark class="search-match">${match}</mark>${after}`
  }
  return tag.name
}

// API methods
const fetchTagSet = async (emitStatus = true) => {
  try {
    isLoadingTags.value = true
    const tagSet = await tagsStore.getTagSet(currentTagSetId.value)
    if (!tagSet) {
      if (emitStatus) {
        emit('status', 'Failed to fetch tag set')
      }
      return
    }
    
    // Ensure we have all the tag objects for this tag set
    if (tagSet.tags_id && tagSet.tags_id.length > 0) {
      await tagsStore.getTagsById(tagSet.tags_id)
    }
  } catch (error) {
    console.error('Error fetching tags:', error)
    if (emitStatus) {
      emit('status', `Failed to fetch tags: ${error.message}`)
    }
  } finally {
    isLoadingTags.value = false
  }
}

const refreshTags = async (emitStatus = true) => {
  try {
    isLoadingTags.value = true
    await tagsStore.gettagSetsAll(
      true // force refresh
    )
  } catch (error) {
    console.error('Error refreshing tags:', error)
    if (emitStatus) {
      emit('status', `Failed to refresh tags: ${error.message}`)
    }
  } finally {
    isLoadingTags.value = false
  }
}

// Enhanced search functionality
const searchTags = async (searchStr) => {
  if (!searchStr.trim()) {
    tagSearchResults.value = []
    showTagSearchResults.value = false
    return
  }

  try {
    isSearching.value = true
    const searchResults = await tagsStore.searchTags(searchStr.trim())
    
    // Add discovered tags to temporary list (if they have IDs and aren't already in tag set or temporary list)
    const tagSetTags = tagsStore.getTagsFromTagSet(currentTagSetId.value)
    const newTemporaryTags = searchResults.filter(tag => 
      tag.id && 
      !tagSetTags.some(t => t.id === tag.id) && 
      !tagsTemp.value.some(t => t.id === tag.id)
    )
    tagsTemp.value.push(...newTemporaryTags)
    
    // Filter out already selected tags
    const suggestions = searchResults.filter(tag => !isTagSelected(tag))
    tagSearchResults.value = suggestions
    showTagSearchResults.value = suggestions.length > 0
    tagSearchResultSelectedIndex.value = -1
    
  } catch (error) {
    console.error('Error searching tags:', error)
    emit('status', `Search failed: ${error.message}`)
  } finally {
    isSearching.value = false
  }
}

const startTagSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    searchTags(tagInput.value)
  }, 200)
}

// Keyboard navigation
const handleKeydown = async (event) => {
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault()
      if (showTagSearchResults.value && tagSearchResults.value.length > 0) {
        tagSearchResultSelectedIndex.value = Math.min(
          tagSearchResultSelectedIndex.value + 1,
          tagSearchResults.value.length - 1
        )
      }
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault()
      if (showTagSearchResults.value && tagSearchResults.value.length > 0) {
        tagSearchResultSelectedIndex.value = Math.max(tagSearchResultSelectedIndex.value - 1, -1)
      }
      break
    case 'Enter':
      event.preventDefault()
      if (showTagSearchResults.value && tagSearchResultSelectedIndex.value >= 0) {
        selectSuggestedTag(tagSearchResults.value[tagSearchResultSelectedIndex.value])
      } else {
        await waitForSearchCompletion()
        addUserInputTag()
      }
      break
    case 'Escape':
      tagSearchResults.value = []
      showTagSearchResults.value = false
      tagSearchResultSelectedIndex.value = -1
      break
  }
}

// Tag management methods
const toggleTag = (tag) => {
  if (isTagSelected(tag)) {
    removeTagFromSelectedTags(tag)
  } else {
    addTag(tag)
  }
}

const addTag = (tag) => {
  if (!isTagSelected(tag)) {
    if (tag.id) {
      // Existing tag with ID
      tagsSelected.value = [...tagsSelected.value, tag]
    } else {
      // New tag without ID
      tagsNewList.value = [...tagsNewList.value, tag]
      emit('update:tagsNew', tagsNewList.value.map(t => t.name))
    }
  }
}

const removeTagFromSelectedTags = (tag) => {
  if (tag.id) {
    tagsSelected.value = tagsSelected.value.filter(t => t.id !== tag.id)
  } else {
    tagsNewList.value = tagsNewList.value.filter(t => t.name !== tag.name)
    emit('update:tagsNew', tagsNewList.value.map(t => t.name))
  }
}

const addUserInputTag = async () => {
  const newTagName = tagInput.value.trim()
  if (!newTagName) {
    tagInput.value = ''
    showTagSearchResults.value = false
    return
  }

  // Check if already selected
  if (tagsSelectedAll.value.some(tag => tag.name === newTagName)) {
    tagInput.value = ''
    showTagSearchResults.value = false
    return
  }

  // Check if the tag exists in current search results
  const existInSearchResults = tagSearchResults.value.find(tag => tag.name === newTagName)
  if (existInSearchResults) {
    addTag(existInSearchResults)
    tagInput.value = ''
    showTagSearchResults.value = false
    tagSearchResultSelectedIndex.value = -1
    return
  }

  // Check if the tag exists in available tags
  const existingInAvailable = tagsAvailable.value.find(tag => tag.name === newTagName)
  if (existingInAvailable) {
    addTag(existingInAvailable)
    tagInput.value = ''
    showTagSearchResults.value = false
    tagSearchResultSelectedIndex.value = -1
    return
  }

  try {
    // Check if the tag exists on server without polluting cache
    const result = await tagsStore.checkTagExist(newTagName)
    if (result.is_success) {
      // Tag exists on server - add to temporary list if not already in tag set
      const tagSetTags = tagsStore.getTagsFromTagSet(currentTagSetId.value)
      if (!tagSetTags.some(t => t.id === result.data.id) && 
          !tagsTemp.value.some(t => t.id === result.data.id)) {
        tagsTemp.value.push(result.data)
      }
      addTag(result.data)
    } else {
      // Tag doesn't exist - it's new
      addTag({ name: newTagName, id: null })
    }
  } catch (error) {
    console.warn('Error checking tag existence:', error)
    // Add as new tag if server check fails
    addTag({ name: newTagName, id: null })
  }
  
  tagInput.value = ''
  showTagSearchResults.value = false
  tagSearchResultSelectedIndex.value = -1
}

const selectSuggestedTag = (tag) => {
  addTag(tag)
  tagInput.value = ''
  showTagSearchResults.value = false
  tagSearchResultSelectedIndex.value = -1
}

// Initialize with props.tagsInit
const initWithTags = async () => {
  const tagsInit = props.tagsInit;
  console.warn('TagsSelect.vue: initWithTags(): props.tagsInit:', props.tagsInit)
  
  // Clear temporary tags on initialization
  tagsTemp.value = []
  
  // Fetch tag set first to know what's in it
  await fetchTagSet(false)
  
  // Parse initial tags into existing and new
  const existingTags = [...tagsInit]
  const newTags = []
  tagsSelected.value = existingTags
  tagsNewList.value = newTags
  emit('update:tagsNew', tagsNewList.value.map(t => t.name))
  
  // Add initial tags to temporary list if they're not in the current tag set
  const tagSetTags = tagsStore.getTagsFromTagSet(currentTagSetId.value)
  const tagsInitNotInSet = tagsInit.filter(tag => 
    tag.id && !tagSetTags.some(t => t.id === tag.id)
  )
  tagsTemp.value.push(...tagsInitNotInSet)
}

// Method to get current tags for parent component
const getCurrentTags = () => {
  const tags_id = tagsSelected.value.map(tag => tag.id).filter(id => id !== null)
  const tags_name = tagsNewList.value.map(tag => tag.name)
  return { tags_id, tags_name }
}

// Method to set tags from external tags_id (e.g., when selecting existing tab)
const setTagsFromIds = async (tags_id = []) => {
  try {
    // Clear current selections
    tagsSelected.value = []
    tagsNewList.value = []
    tagsTemp.value = []
    
    if (!tags_id || tags_id.length === 0) {
      emit('update:tagsNew', [])
      return
    }
    
    // Get tag objects by their IDs
    const tagObjects = await tagsStore.getTagsById(tags_id)
    
    if (tagObjects && tagObjects.length > 0) {
      // Get current tag set tags to determine which are temporary
      const tagSetTags = tagsStore.getTagsFromTagSet(currentTagSetId.value)
      
      // Separate tags into those in current tag set vs temporary
      const tagsInSet = []
      const tagsNotInSet = []
      
      tagObjects.forEach(tag => {
        if (tagSetTags.some(t => t.id === tag.id)) {
          tagsInSet.push(tag)
        } else {
          tagsNotInSet.push(tag)
        }
      })
      
      // Set selected tags (from tag set)
      tagsSelected.value = tagsInSet
      
      // Add tags not in set to temporary list
      tagsTemp.value = tagsNotInSet
      
      console.log('TagsSelect.vue: setTagsFromIds(): Set tags from IDs:', {
        tags_id,
        tagsInSet: tagsInSet.length,
        tagsNotInSet: tagsNotInSet.length
      })
    }
    
    emit('update:tagsNew', [])
  } catch (error) {
    console.error('Error setting tags from IDs:', error)
    emit('status', `Failed to load tags: ${error.message}`)
  }
}

// Initialize tags on mount
onMounted(async () => {
  await fetchTagSet(false)
  await initWithTags()
  
  // Add global event listeners
  document.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  // Remove global event listeners
  document.removeEventListener('click', handleGlobalClick)
})

// Expose methods for parent components
defineExpose({
  refreshTags,
  getCurrentTags,
  setTagsFromIds,
  tagsSelected: computed(() => tagsSelectedAll.value)
})

// Context menu handlers
const openContextMenu = (event, tag) => {
  console.log('TagsSelect.vue: openContextMenu(): tag:', tag)
  if (!tag.id) return // Only show context menu for existing tags
  
  // Always close existing context menu first
  showContextMenu.value = false
  contextMenuTag.value = null
  
  // Use nextTick to ensure the previous menu is completely closed
  nextTick(() => {
    contextMenuTag.value = tag
    contextMenuPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
    showContextMenu.value = true
  })
}

// Container context menu handler (similar to SessionsOpen.vue pattern)
const handleContainerContextMenu = (event) => {
  event.preventDefault()
  
  // Find the tag element that was right-clicked
  const tagElement = event.target.closest('.tag-selected') || event.target.closest('.tag-item')
  
  if (!tagElement) {
    closeContextMenu()
    return
  }
  
  // Get tag data from the element's data attributes
  const tagId = tagElement.dataset.tagId
  const tagName = tagElement.dataset.tagName
  
  console.log('TagsSelect.vue: handleContainerContextMenu(): tagId:', tagId, 'tagName:', tagName)
  
  // Only show context menu for existing tags (with IDs)
  if (!tagId || tagId === 'null') {
    return
  }
  
  // Find the tag object in our data
  const tag = tagsSelectedAll.value.find(t => t.name === tagName && t.id == tagId) ||
              tagsAvailable.value.find(t => t.name === tagName && t.id == tagId)
  
  if (tag && tag.id) {
    openContextMenu(event, tag)
  }
}

const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTag.value = null
}

// Global click handler to close context menu
const handleGlobalClick = (event) => {
  // Only close if not right-clicking (which should open new context menu)
  if (event.button !== 2 && showContextMenu.value) {
    closeContextMenu()
  }
}



const handleRenameTag = (tag) => {
  console.log('TagsSelect.vue: handleRenameTag(): tag:', tag)
  // Emit event to parent to open centralized TagsManager
  emit('open-tags-manager', { tag, initialTab: 'rename' })
  closeContextMenu()
}
</script>

<style scoped>
.tags-section {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-input-container {
  display: flex;
  gap: 8px;
}

.tag-input-container input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
}

.add-tag-button,
.refresh-tags-button,
.settings-button {
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.add-tag-button {
  background-color: #1a73e8;
  color: white;
  border-color: #1a73e8;
}

.add-tag-button:hover:not(:disabled) {
  background-color: #1557b0;
}

.refresh-tags-button:hover:not(:disabled),
.settings-button:hover:not(:disabled) {
  background-color: #f1f3f4;
}

.tag-suggestions {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 0;
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
}

.tags-available {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tags-selected {
  margin-top: 0px;
}

.tags-selected h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #5f6368;
}

.tags-selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-name {
  flex: 1;
}


.search-loading {
  position: absolute;
  top: calc(100% + 1px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dadce0;
  border-radius: 4px;
  padding: 8px 12px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 13px;
  color: #5f6368;
}

.search-match {
  background-color: #fff176;
  padding: 0;
  border-radius: 2px;
}
</style>

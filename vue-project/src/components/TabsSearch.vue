<!--
  triggerSearch -> startSearch

-->

<template>
  <div class="tabs-search-container">
    <!-- Search Input -->
    <div class="search-input-container">
      <input
        v-model="searchState.searchQuery"
        type="text"
        placeholder="Search tabs by title, URL, or domain..."
        class="search-input"
        @input="onSearchInput"
        @keydown.escape="clearSearch"
      />
      <button
        v-if="searchState.searchQuery"
        @click="clearSearch"
        class="clear-search-btn"
        title="Clear search"
      >
        ✕
      </button>
    </div>

    <!-- Tag Search Row -->
    <TagsInput
      :tags-init="searchState.tagsSelected"
      :allow-user-edit="true"
      :emit-on-edit="true"
      :lock-on-tag-modify="false"
      :allow-new-tag="false"
      :disable-internal-search="false"
      @tagAdd="handleTagAdd"
      @tagDelete="onTagSearchDelete"
      @tagUpdate="onTagSearchUpdate"
      @tagReorder="onTagSearchReorder"
    />


    <!-- Search Stats -->
    <div v-if="searchState.isSearchActive || searchState.hasSearchResults" class="search-stats">
      <div v-if="searchState.isSearching" class="is-searching-indicator">
        Searching...
      </div>
      <div v-else-if="searchState.hasSearchResults" class="search-results-count">
        Found {{ searchState.searchResultsNumTotal }} tab{{ searchState.searchResultsNumTotal !== 1 ? 's' : '' }}
        <span v-if="searchState.sessionsOpenSearchResults.length > 0">
          ({{ searchState.sessionsOpenSearchResults.length }}
            open{{ searchState.sessionsRemoteSearchResults.length > 0 ? 
            ', ' + searchState.sessionsRemoteSearchResults.length + ' remote' : ''
          }})
        </span>
        <span v-else-if="searchState.sessionsRemoteSearchResults.length > 0">
          ({{ searchState.sessionsRemoteSearchResults.length }} remote)
        </span>
        <span v-if="searchState.tagsSelected.length > 0" class="tag-filter-indicator">
          • Filtered by {{ searchState.tagsSelected.length }} tag{{ searchState.tagsSelected.length !== 1 ? 's' : '' }}
        </span>
      </div>
      <div v-else class="no-results">
        No tabs found
        <span v-if="searchState.searchQuery">matching "{{ searchState.searchQuery }}"</span>
        <span v-if="searchState.tagsSelected.length > 0">
          {{ searchState.searchQuery ? ' and ' : '' }}with selected tags
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useTabsOpen } from '../stores/TabsOpen'
import { useTabsRemote } from '../stores/TabsRemote'
import { useTabsSearch } from '../stores/TabsSearch'
import { useTags } from '../stores/Tags'
import { storeToRefs } from 'pinia'
import TagsInput from './tag/TagsInput.vue'

// Props
const props = defineProps({
  onSearchStateChange: {
    type: Function,
    default: () => {}
  }
})

// Emits
const emit = defineEmits(['search-state-changed'])

// Use Pinia stores
const tabsSearchStore = useTabsSearch()

// Reactive refs are now handled in the store
const searchState = tabsSearchStore.searchState

// Local search state
// Search task management
let searchControllerCurrent = null
let searchDebounceTimeout = null


// TagsInput event handlers
const handleTagAdd = (tag, callback) => {
  console.log('TabsSearch: handleTagAdd called with:', tag)
  
  // Check if tag is already selected
  const isUiSelected = searchState.tagsSelected.some(selectedTag => 
    selectedTag.id === tag.id || selectedTag.name === tag.name
  )
  
  if (!isUiSelected) {
    searchState.tagsSelected.push(tag)
    console.log('TabsSearch: Added tag, new tagsSelected:', searchState.tagsSelected)
    // Don't trigger search here - let tagUpdate handle it to avoid double triggering
    if (callback) callback(true)
  } else {
    if (callback) callback(false)
  }
}

const onTagSearchDelete = (data, callback) => {
  console.log('TabsSearch: onTagSearchDelete called with:', data)
  const { tag, index } = data
  
  // remove the tag from the selected tags
  searchState.tagsSelected = searchState.tagsSelected.filter((selectedTag, i) => 
    !(selectedTag.id === tag.id || selectedTag.name === tag.name)
  )
  
  console.log('TabsSearch: Removed tag, new tagsSelected:', searchState.tagsSelected)
  // don't trigger search here - let tagUpdate handle it to avoid double triggering
  if (callback) callback(true)
}

const onTagSearchUpdate = (tagsExist, callback) => {
  searchState.tagsSelected = [...tagsExist]
  if (callback) callback(true)
  // triggerSearch() // Only trigger search on update to avoid double triggering
  if (callback) callback(true)
}

const onTagSearchReorder = (data, callback) => {
  const { tag, indexOld, indexNew } = data
  triggerSearch() // Only trigger search on update to avoid double triggering
  if (callback) callback(true)
}

// search functionality - now using store methods
const startSearch = async () => {
  console.log('TabsSearch: Starting search - text:', searchState.searchQuery, 'tags:', searchState.tagsSelected)
  // cancel current search if exists
  if (searchControllerCurrent) {
    searchControllerCurrent.abort()
  }
  // create new search controller
  searchControllerCurrent = new AbortController()
  
  try {
    await tabsSearchStore.startSearch(searchControllerCurrent)
  } finally {
    searchControllerCurrent = null
  }
}

const onSearchInput = () => { triggerSearch() }
const triggerSearch = () => {
  // Clear debounce timeout
  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout)
  }
  
  console.log('TabsSearch: triggerSearch() - searchState.searchQuery:', searchState.searchQuery, 'searchState.tagsSelected:', searchState.tagsSelected)
  console.log('TabsSearch: triggerSearch() - searchState.hasSearchQuery:', searchState.hasSearchQuery, 'searchState.hasTagFilter:', searchState.hasTagFilter)

  if (!searchState.hasSearchQuery && !searchState.hasTagFilter) {
    // Clear search results only, keep query and tags intact
    clearSearchResultsOnly()
    console.log('TabsSearch: triggerSearch() - clearing search results only')
    return
  }
  
  // Shorter debounce time for better responsiveness
  // Tag-only searches are immediate, text searches have minimal delay
  const debounceTime = searchState.hasSearchQuery ? 150 : 50
  searchDebounceTimeout = setTimeout(() => {
    startSearch()
  }, debounceTime)
}


const clearSearch = () => {
  console.log('TabsSearch: Clearing search')
  searchState.searchQuery = ''
  searchState.tagsSelected = []
  clearSearchResults()
}

const clearSearchResults = () => {
  // Cancel current search
  if (searchControllerCurrent) {
    searchControllerCurrent.abort()
    searchControllerCurrent = null
  }
  
  // Clear debounce timeout
  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout)
    searchDebounceTimeout = null
  }
  
  // Clear results
  searchState.sessionsOpenSearchResults = []
  searchState.sessionsRemoteSearchResults = []
  
  // Clear search store state
  tabsSearchStore.clearSearchState()
}

const clearSearchResultsOnly = () => {
  // Cancel current search
  if (searchControllerCurrent) {
    searchControllerCurrent.abort()
    searchControllerCurrent = null
  }
  
  // Clear debounce timeout
  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout)
    searchDebounceTimeout = null
  }
  
  // Clear results only, keep query and tags
  searchState.sessionsOpenSearchResults = []
  searchState.sessionsRemoteSearchResults = []
  searchState.isSearching = false
}


// Watch for tag selection changes
watch(() => searchState.tagsSelected, (newTags, oldTags) => {
  triggerSearch()
}, { deep: true })

// Cleanup on unmount
import { onUnmounted } from 'vue'
onUnmounted(() => {
  clearSearchResults()
})

// Expose methods for parent components
defineExpose({
  clearSearch,
})
</script>

<style scoped>

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  user-select: none;
}

.search-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 1.0rem;
  outline: none;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: #5f6368;
  font-size: 16px;
  padding: 4px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.clear-search-btn:hover {
  background-color: #f1f3f4;
  color: #202124;
}

.tag-search-container {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  align-items: stretch;
}

.tag-input-section {
  position: relative;
  flex: 1;
}

.tag-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
  min-height: 40px;
}

.tag-search-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
}

.tag-search-results {
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

.selected-suggestion {
  background-color: #e8f0fe;
  border-color: #1a73e8;
}

.selected-tags-section {
  flex: 2;
}

.selected-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 40px;
  padding: 8px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  background-color: #f8f9fa;
  align-items: flex-start;
}

.search-stats {
  margin-top: 8px;
  font-size: 12px;
  color: #5f6368;
}

.is-searching-indicator {
  font-style: italic;
}

.search-results-count {
  font-weight: 500;
}

.tag-filter-indicator {
  color: #1a73e8;
  font-weight: 500;
}

.no-results {
  color: #ea4335;
  font-style: italic;
}

.search-match {
  background-color: #fff176;
  padding: 0;
  border-radius: 2px;
}
</style>
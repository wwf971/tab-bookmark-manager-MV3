<template>
  <div class="bookmarks-duplicate-panel">
    <!-- Search controls -->
    <div class="search-controls">
      <div class="criteria-selection">
        <label>Detection criteria:</label>
        <select v-model="searchCriteria" class="criteria-select">
          <option value="url">URL only</option>
          <option value="title">Title only</option>
          <option :value="['url', 'title']">URL and Title</option>
        </select>
        <button 
          @click="startSearchDuplicateBookmarks" 
          :disabled="isSearching"
          class="search-btn"
        >
          {{ isSearching ? 'Searching...' : 'Find Duplicates' }}
        </button>
      </div>
      
      <!-- Results summary -->
      <div v-if="searchResult.is_success !== null" class="search-summary">
        <span v-if="searchResult.is_success" class="success-msg">
          Found {{ duplicateGroups.length }} groups with {{ groupTabsNum }} duplicate bookmarks
        </span>
        <span v-else class="error-msg">Search failed</span>
      </div>
    </div>

    <!-- Duplicate groups display -->
    <div v-if="duplicateGroups.length > 0" class="duplicate-groups">
      <div 
        v-for="(group, groupIndex) in duplicateGroups" 
        :key="groupIndex"
        class="duplicate-group"
      >
        <div class="group-header">
          <h4>Group {{ groupIndex + 1 }} ({{ group.length }} duplicates)</h4>
          <button @click="removeGroup(groupIndex)" class="remove-group-btn">
            Remove All But First
          </button>
        </div>
        
        <div class="group-bookmarks">
          <Bookmark
            v-for="bookmark in group"
            :key="bookmark.id"
            :id="bookmark.id"
            :display-path="true"
            :display-items="{ title: true, url: true, icon: true }"
            @bookmark-removed="onBookmarkRemoved"
          />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="searchResult.is_success === true" class="empty-state">
      <p>No duplicate bookmarks found with current criteria</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBookmarkStore } from './Bookmark.js'
import Bookmark from './Bookmark.vue'

const bookmarkStore = useBookmarkStore()

const isSearching = ref(false)
const searchCriteria = ref('url')
const searchResult = ref({
  is_success: null,
  groups: {},
  groupNum: 0,
  groupTabsNum: 0,
  criteria: '',
  bookmarksDuplicate: []
    /* example:
      [(id1, id2), (id3, id4, id5) ...]
      // id1 and id2 are same bookmark
      // id3, id4, id5 are same bookmark
    */
})

// convert search result groups to array for easier iteration
const duplicateGroups = computed(() => {
  if (!searchResult.value.is_success || !searchResult.value.groups) {
    return []
  }
  return Object.values(searchResult.value.groups)
})

const groupTabsNum = computed(() => {
  return searchResult.value.groupTabsNum || 0
})

const startSearchDuplicateBookmarks = () => {
  isSearching.value = true
  
  try {
    console.log('searching for duplicates with criteria:', searchCriteria.value)
    const result = bookmarkStore.detectDuplicateBookmarksLocal(searchCriteria.value)
    
    searchResult.value = {
      is_success: true,
      ...result
    }
    
    console.log('duplicate search result:', result)
  } catch (error) {
    console.error('error searching duplicates:', error)
    searchResult.value = {
      is_success: false,
      groups: {},
      groupNum: 0,
      groupTabsNum: 0,
      criteria: searchCriteria.value
    }
  } finally {
    isSearching.value = false
  }
}

const removeGroup = async (groupIndex) => {
  const group = duplicateGroups.value[groupIndex]
  if (!group || group.length <= 1) return
  
  // keep the first bookmark, remove the rest
  const bookmarksToRemove = group.slice(1)
  
  for (const bookmark of bookmarksToRemove) {
    try {
      await bookmarkStore.removeBookmarkLocal(bookmark.id)
    } catch (error) {
      console.error('error removing duplicate bookmark:', error)
    }
  }
  
  // refresh search results
  startSearchDuplicateBookmarks()
}

const onBookmarkRemoved = (event) => {
  console.log('bookmark removed in duplicate view:', event)
  // refresh search results when a bookmark is manually removed
  setTimeout(() => {
    startSearchDuplicateBookmarks()
  }, 100)
}
</script>

<style scoped>
.bookmarks-duplicate-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 16px;
}

.search-controls {
  background-color: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
}

.criteria-selection {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.criteria-select {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.search-btn {
  padding: 6px 12px;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.search-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.search-summary {
  font-size: 14px;
}

.success-msg {
  color: #4caf50;
  font-weight: 500;
}

.error-msg {
  color: #f44336;
}

.duplicate-groups {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.duplicate-group {
  border: 1px solid #ddd;
  border-radius: 6px;
  background-color: white;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #f0f8ff;
  border-bottom: 1px solid #ddd;
}

.group-header h4 {
  margin: 0;
  color: #1a73e8;
  font-size: 14px;
}

.remove-group-btn {
  padding: 4px 8px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.remove-group-btn:hover {
  background-color: #d32f2f;
}

.group-bookmarks {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-style: italic;
}
</style>
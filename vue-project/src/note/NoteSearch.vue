<template>
  <div class="search-container">
    <div class="header">
      <h1 class="header-title">📝 Note Search</h1>
    </div>

    <!-- Search Section -->
    <div class="search-section">
      <div class="search-box">
        <div class="search-input-container">
          <input 
            type="text" 
            v-model="searchQuery" 
            @input="onSearchInput"
            placeholder="Search for notes and sets..."
            class="search-input"
          >
          
          <button 
            v-if="hasSearched" 
            @click="toggleSearchView" 
            class="view-toggle-btn"
            :title="isCardView ? 'Switch to list view' : 'Switch to card view'"
          >
            <IconToggle :is-list-view="isCardView" />
          </button>
        </div>
        
        <!-- Tag Search Row -->
        <TagsInput
          :tags-init="tagsSelected"
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

        <!-- Search Options -->
        <div class="search-options">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="isFuzzySearch" 
              @change="onSearchOptionsChange"
            />
            <span>Fuzzy Search</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Search Results Section - Always visible after first search -->
    <div v-if="hasSearched" class="search-results-section">
      <div class="results-header">
        <h2 class="results-title">
          Search Results
          <span v-if="lastSearchQuery" class="search-query">for "{{ lastSearchQuery }}"</span>
        </h2>
        <div v-if="searchResults.length > 0" class="results-count">
          {{ searchResults.length }} result{{ searchResults.length !== 1 ? 's' : '' }}
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isSearching" class="loading-state">
        <div class="loading-spinner"></div>
        <span>Searching...</span>
      </div>

      <!-- Error State - local search errors only -->
      <div v-else-if="searchError" class="error-state">
        <div class="error-message">{{ searchError }}</div>
        <button @click="() => { searchError = null; searchNotes(); }" class="retry-btn">Try Again</button>
      </div>

      <!-- No Results -->
      <div v-else-if="searchResults.length === 0 && lastSearchQuery">
        <div class="no-results">
          <div class="no-results-text">No results found for "{{ lastSearchQuery }}"</div>
        </div>
        <!-- Recent Sets -->
        <div v-if="recentSets.length > 0" class="recent-section">
          <div class="recent-title">Recent Sets:</div>
          <div :class="{ 'results-grid': isCardView, 'results-list': !isCardView }">
            <div 
              v-for="set in recentSets" 
              :key="set.id"
              @click="selectItem(set)"
              class="search-result-item recent-item"
            >
              <div class="result-content">
                <div class="result-header">
                  <div class="result-header-left">
                    <span class="type-tag">SET</span>
                    <span class="card-id">#{{ set.id }}</span>
                  </div>
                  <button @click.stop="deleteItem(set)" class="delete-btn" title="Delete this set">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3,6 5,6 21,6"></polyline>
                      <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2,2h4a2,2 0 0,1,2,2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
                <div class="result-info">
                  <strong>{{ set.name }}</strong>
                  <div class="result-meta">{{ set.children ? Object.keys(set.children).length : 0 }} items</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Search Results -->
      <div v-else-if="searchResults.length > 0" class="search-results-container">
        <div :class="{ 'results-grid': isCardView, 'results-list': !isCardView }">
          <div
            v-for="result in searchResults" 
            :key="result.id"
            @click="selectItem(result)"
            class="search-result-item"
          >
            <div class="result-content">
              <div class="result-header">
                <div class="result-header-left">
                  <span class="type-tag">{{ result.type.toUpperCase() }}</span>
                  <span class="card-id">#{{ result.id }}</span>
                </div>
                <button @click.stop="deleteItem(result)" class="delete-btn" title="Delete this note">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2,2h4a2,2 0 0,1,2,2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
              
              <!-- Display matched content -->
              <div v-if="result.matched_keys && result.matched_keys.length > 0" class="matched-content">
                <div v-for="(match, index) in result.matched_keys" :key="index" class="match-item">
                  <div class="match-key">{{ match.key }}:</div>
                  <div class="match-value" v-html="highlightText(match.value, match.start_index, match.end_index)"></div>
                </div>
              </div>
              
              <!-- Fallback display for results without matched_keys -->
              <div v-else class="result-info">
                <strong>{{ result.name || `${result.type} #${result.id}` }}</strong>
                <div v-if="result.type === 'set'" class="result-meta">
                  {{ result.children ? Object.keys(result.children).length : 0 }} items
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Display Note Modal -->
    <NoteCard 
      :isVisible="showNoteModal" 
      :noteId="selectedNoteId" 
      @close="closeNoteModal" 
    />

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="modal-backdrop">
      <div class="confirm-modal">
        <div class="confirm-header">
          <h3>Confirm Delete</h3>
        </div>
        <div class="confirm-content">
          <p>Are you sure you want to delete <strong>{{ itemToDelete?.type }} #{{ itemToDelete?.id }}</strong>?</p>
          <p class="confirm-warning">This action cannot be undone.</p>
        </div>
        <div class="confirm-actions">
          <button @click="cancelDelete" class="cancel-btn">Cancel</button>
          <button @click="confirmDelete" class="delete-confirm-btn">Delete</button>
        </div>
      </div>
    </div>

    <!-- Notification Toast -->
    <div v-if="notification.show" class="notification-toast" :class="notification.type">
      <div class="toast-content">
        <div class="toast-icon">
          <svg v-if="notification.type === 'success'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <span class="toast-message">{{ notification.message }}</span>
        <button @click="notification.show = false" class="toast-close">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useNoteStore } from '@/network/Note'
import { useNetworkRequest } from '@/network/NetworkRequest'
import NoteCard from './NoteCard.vue'
import IconToggle from '../icons/IconToggle.vue'
import TagsInput from '@/tags/TagsInput.vue'

const networkStore = useNoteStore()
const networkRequest = useNetworkRequest()

// Reactive state
const searchQuery = ref('')
const searchTimeout = ref(null)
const searchResults = ref([])
const recentSets = ref([])
const isCardView = ref(true)
const hasSearched = ref(false)
const lastSearchQuery = ref('')
const showNoteModal = ref(false)
const selectedNoteId = ref(null)
const showDeleteConfirm = ref(false)
const itemToDelete = ref(null)
const notification = ref({ show: false, message: '', type: 'success' })

// Tag search state
const tagsSelected = ref([])
const isFuzzySearch = ref(false)

// local error handling - don't use global Note.js error state
const searchError = ref(null)
const isSearching = ref(false)

// Computed properties
const hasResults = computed(() => searchResults.value.length > 0)
const shouldTriggerSearch = computed(() => {
  return searchQuery.value.trim().length > 0 || tagsSelected.value.length > 0
})

// Methods
const onSearchInput = () => {
  clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    if (shouldTriggerSearch.value) {
      searchNotes()
    } else {
      // Don't clear results when search is empty, just update query tracking
      lastSearchQuery.value = ''
    }
  }, 400)
}

const onSearchOptionsChange = () => {
  // Trigger search when fuzzy search option changes
  if (shouldTriggerSearch.value) {
    clearTimeout(searchTimeout.value)
    searchTimeout.value = setTimeout(() => {
      searchNotes()
    }, 200)
  }
}

const searchNotes = async () => {
  hasSearched.value = true
  lastSearchQuery.value = searchQuery.value.trim()
  isSearching.value = true
  searchError.value = null // clear previous errors
  console.log('SearchNote: searchNotes() called with:', searchQuery.value, 'tagsSelected:', tagsSelected.value, 'isFuzzySearch:', isFuzzySearch.value)
  try {
    let response = null;
    // If we have tags selected, use the search by text and tags API
    if (tagsSelected.value.length > 0) {
      const tagsId = tagsSelected.value.map(tag => tag.id).filter(id => id !== undefined)
      response = await networkRequest.searchNotesByTypeTextTags(
        searchQuery.value.trim(), 
        tagsId
      )
    } else {
      // Use the regular note search with fuzzy option
      response = await networkStore.searchNote(searchQuery.value, isFuzzySearch.value)
    }
    
    if (response.is_success) {
      searchResults.value = Array.isArray(response.data) ? response.data : []
      if (searchResults.value.length === 0) {
        await getRecentSets()
      }
    } else {
      searchResults.value = []
      searchError.value = response.message || 'Search failed'
      console.error('Search failed:', response.message)
    }
  } catch (error) {
    searchResults.value = []
    searchError.value = error.message || 'Network error during search'
    console.error('Search error:', error)
  } finally {
    isSearching.value = false
  }
}

const getRecentSets = async () => {
  try {
    const response = await networkStore.getRecentNote(5, 'set')
    if (response.is_success && Array.isArray(response.data)) {
      recentSets.value = response.data
    } else {
      console.error('Failed to load recent sets:', response.message)
    }
  } catch (error) {
    console.error('Failed to load recent sets:', error)
  }
}

// TagsInput event handlers
const handleTagAdd = (tag, callback) => {
  console.log('SearchNote: handleTagAdd called with:', tag)
  
  // Check if tag is already selected
  const isAlreadySelected = tagsSelected.value.some(selectedTag => 
    selectedTag.id === tag.id || selectedTag.name === tag.name
  )
  
  if (!isAlreadySelected) {
    tagsSelected.value.push(tag)
    console.log('SearchNote: Added tag, new tagsSelected:', tagsSelected.value)
    // Trigger search when tag is added
    onSearchInput()
    if (callback) callback(true)
  } else {
    if (callback) callback(false)
  }
}

const onTagSearchDelete = (data, callback) => {
  console.log('SearchNote: onTagSearchDelete called with:', data)
  const { tag, index } = data
  
  // Remove the tag from the selected tags
  tagsSelected.value = tagsSelected.value.filter((selectedTag, i) => 
    !(selectedTag.id === tag.id || selectedTag.name === tag.name)
  )
  
  console.log('SearchNote: Removed tag, new tagsSelected:', tagsSelected.value)
  // Trigger search when tag is removed
  onSearchInput()
  if (callback) callback(true)
}

const onTagSearchUpdate = (tagsExist, callback) => {
  tagsSelected.value = [...tagsExist]
  console.log('SearchNote: Updated tags:', tagsSelected.value)
  // Trigger search when tags are updated
  onSearchInput()
  if (callback) callback(true)
}

const onTagSearchReorder = (data, callback) => {
  const { tag, indexOld, indexNew } = data
  console.log('SearchNote: Tag reordered:', data)
  // Trigger search when tags are reordered
  onSearchInput()
  if (callback) callback(true)
}

const selectItem = (item) => {
  console.log('Selected item:', item)
  selectedNoteId.value = item.id
  showNoteModal.value = true
}

const closeNoteModal = () => {
  showNoteModal.value = false
  selectedNoteId.value = null
}

const deleteItem = (item) => {
  itemToDelete.value = item
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  const item = itemToDelete.value
  showDeleteConfirm.value = false
  
  try {
    const response = await networkStore.deleteNote(item.id)
    if (response.is_success) {
      // Remove from search results
      searchResults.value = searchResults.value.filter(result => result.id !== item.id)
      // Remove from recent sets if it's there
      recentSets.value = recentSets.value.filter(set => set.id !== item.id)
      showNotification(`${item.type} #${item.id} deleted successfully`, 'success')
    } else {
      showNotification('Failed to delete item: ' + (response.message || 'Unknown error'), 'error')
    }
  } catch (error) {
    console.error('Delete error:', error)
    showNotification('Error deleting item: ' + error.message, 'error')
  }
  
  itemToDelete.value = null
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  itemToDelete.value = null
}

const showNotification = (message, type = 'success') => {
  notification.value = { show: true, message, type }
  setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

const toggleSearchView = () => {
  isCardView.value = !isCardView.value
}

const highlightText = (text, startIndices, endIndices) => {
  if (!startIndices || !endIndices || !text) return text
  
  let result = ''
  let lastIndex = 0
  
  for (let i = 0; i < startIndices.length; i++) {
    const start = startIndices[i]
    const end = endIndices[i]
    
    // add text before highlight
    result += text.substring(lastIndex, start)
    // add highlighted text
    result += `<span class="highlight">${text.substring(start, end)}</span>`
    lastIndex = end
  }
  
  // Add remaining text
  result += text.substring(lastIndex)
  
  return result
}

// Lifecycle
onMounted(() => {
  // Removed getRecentSets() call - now only called when search results are empty
})
</script>

<style scoped>
.search-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #fafbfc;
  min-height: 100vh;
  box-sizing: border-box;
}

@media (min-width: 768px) {
  .search-container {
    padding: 16px 24px;
  }
}

@media (min-width: 1200px) {
  .search-container {
    padding: 20px 32px;
  }
}

.header {
  text-align: center;
  margin-bottom: 8px;
}

.header-title {
  font-size: 2rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.search-section {
  margin-bottom: 8px;
  border-radius: 4px;
}

.search-box {
  background: white;
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-input-container {
  display: flex;
  gap: 12px;
  align-items: center;
  user-select: none;
}

.search-input {
  flex: 1;
  padding: 4px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 16px;
  transition: all 0.2s;
  outline: none;
  background: #fafbfc;
}

.search-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: white;
}

.view-toggle-btn {
  background: white;
  border: 2px solid #e2e8f0;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  color: #4a5568;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.view-toggle-btn:hover {
  background-color: #f7fafc;
  border-color: #cbd5e0;
}

.search-results-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.search-results-container {
  padding: 16px 20px;
  max-height: 70vh; /* Limit height to 70% of viewport */
  overflow-y: auto; /* Enable vertical scrolling when content exceeds height */
  overflow-x: hidden; /* Prevent horizontal scrolling */
  box-sizing: border-box;
}

/* Responsive height adjustments */
@media (max-height: 600px) {
  .search-results-container {
    max-height: 60vh; /* Smaller screens get less height */
  }
}

@media (max-height: 400px) {
  .search-results-container {
    max-height: 50vh; /* Very small screens get even less height */
  }
}

.results-header {
  background: #f8fafc;
  padding: 12px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.results-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.search-query {
  font-weight: 400;
  color: #667eea;
}

.results-count {
  background: #667eea;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  box-sizing: border-box;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.search-result-item {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  position: relative;
}

.search-result-item:hover {
  background-color: #ddd;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: #9ca3af;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
  opacity: 1;
}

.search-result-item:hover .delete-btn {
  opacity: 1;
}

.type-tag {
  background-color: #e2e8f0;
  color: #4a5568;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.card-id {
  font-size: 13px;
  color: #9ca3af;
  font-weight: 500;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-meta {
  font-size: 13px;
  color: #6b7280;
}

.matched-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.match-item {
  background-color: #f8fafc;
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid #667eea;
}

.match-key {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.match-value {
  font-size: 13px;
  color: #1e293b;
  line-height: 1.4;
}

.highlight {
  background-color: #fef9c3;
  padding: 1px 3px;
  border-radius: 3px;
  font-weight: 600;
}

.recent-section {
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
}

.recent-title {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 12px;
  font-weight: 600;
}

.recent-item {
  background-color: #fafbfc;
  border-color: #f1f5f9;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: #6b7280;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  padding: 32px;
  text-align: center;
}

.error-message {
  color: #dc2626;
  margin-bottom: 12px;
  font-size: 15px;
}

.retry-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.retry-btn:hover {
  background: #5a67d8;
}

.no-results {
  padding: 32px;
  text-align: center;
  color: #6b7280;
}

.no-results-text {
  font-size: 16px;
}

/* Confirmation Modal */
.confirm-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 400px;
  overflow: hidden;
}

.confirm-header {
  padding: 4px 8px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.confirm-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #2d3748;
}

.confirm-content {
  padding: 20px;
}

.confirm-content p {
  margin: 0 0 12px 0;
  color: #4a5568;
  line-height: 1.5;
}

.confirm-warning {
  font-size: 14px;
  color: #dc2626;
  font-weight: 500;
}

.confirm-actions {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.cancel-btn {
  background: #f3f4f6;
  color: #374151;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e5e7eb;
}

.delete-confirm-btn {
  background: #dc2626;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.delete-confirm-btn:hover {
  background: #b91c1c;
}

/* Notification Toast */
.notification-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1100;
  border-radius: 6px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease-out;
  max-width: 400px;
}

.notification-toast.success {
  background: #10b981;
  color: white;
}

.notification-toast.error {
  background: #dc2626;
  color: white;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.8;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.search-options {
  display: flex;
  align-items: center;
  gap: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #4a5568;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.checkbox-label span {
  user-select: none;
}
</style>

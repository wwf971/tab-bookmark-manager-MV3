<template>
  <!-- Modal Backdrop -->
  <div v-if="isVisible" class="modal-backdrop" @click="handleBackdropClick">
    <!-- Modal Container -->
    <div class="modal-container" @click.stop>
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="modal-title">
          <span class="note-type-badge" v-if="noteData">{{ noteData.type?.toUpperCase() || 'NOTE' }}</span>
          <h2>Note #{{ noteId }}</h2>
        </div>
        <button @click="closeModal" class="close-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Modal Content -->
      <div class="modal-content">
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-container">
          <div class="loading-spinner"></div>
          <span>Loading note details...</span>
        </div>

        <!-- Error State -->
        <div v-else-if="hasError" class="error-container">
          <div class="error-icon">⚠️</div>
          <div class="error-message">{{ errorMessage }}</div>
          <button @click="fetchNoteData" class="retry-button">Try Again</button>
        </div>

        <!-- Note Data Display -->
        <div v-else-if="noteData" class="note-data-container">
          <!-- Note Properties as Key-Value Pairs -->
          <div class="properties-section">
            <div 
              v-for="(value, key) in noteDataFiltered" 
              :key="key"
              class="property-item"
              :class="{ 'expandable': isExpandableValue(value) }"
            >
              <div class="property-key">{{ key }}</div>
              <div class="property-value">
                <!-- Handle different value types -->

                <!-- Special handling for tags_id key -->
                <div v-if="key === 'tags_id' && isArray(value)" class="tags-display">
                  <TagsInput
                    :tags-init="tagsStore.getTagsRefById(value)"
                    :allow-user-edit="true"
                    :emit-on-edit="true"
                    :lock-on-tag-modify="false"
                    :allow-new-tag="true"
                    :allow-drag="true"
                    @tagAdd="onTagAdd"
                    @tagDelete="requestTagDelete"
                    @tagUpdate="requestTagUpdate"
                    @tagReorder="requestTagReorder"
                  />
                </div>

                <!-- Default object display -->
                <div v-else-if="isObject(value)" class="object-value">
                  <!-- Expandable object display -->
                  <button 
                    @click="toggleExpanded(key)" 
                    class="expand-toggle"
                    :class="{ 'expanded': expandedKeys.has(key) }"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </button>
                  <span class="object-summary">{{ getObjectSummary(value) }}</span>
                  
                  <!-- Expanded object content -->
                  <div v-if="expandedKeys.has(key)" class="expanded-content">
                    <div 
                      v-for="(subValue, subKey) in value" 
                      :key="subKey"
                      class="sub-property"
                    >
                      <span class="sub-key">{{ subKey }}:</span>
                      <span class="sub-value">{{ formatValue(subValue) }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Array display -->
                <div v-else-if="isArray(value)" class="array-value">
                    <button 
                      @click="toggleExpanded(key)" 
                      class="expand-toggle"
                      :class="{ 'expanded': expandedKeys.has(key) }"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6,9 12,15 18,9"></polyline>
                      </svg>
                    </button>
                    <span class="array-summary">Array ({{ value.length }} items)</span>
                    
                    <!-- Expanded array content -->
                    <div v-if="expandedKeys.has(key)" class="expanded-content">
                      <div 
                        v-for="(item, index) in value" 
                        :key="index"
                        class="array-item"
                      >
                        <span class="array-index">[{{ index }}]:</span>
                        <span class="array-item-value">{{ formatValue(item) }}</span>
                      </div>
                    </div>
                </div>
                
                <!-- Simple value display -->
                <div v-else class="simple-value" :class="getValueTypeClass(value)">
                    {{ formatValue(value) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Raw JSON View Toggle -->
          <div class="json-section">
            <button @click="showRawJson = !showRawJson" class="json-toggle">
              {{ showRawJson ? 'Hide' : 'Show' }} Raw JSON
            </button>
            
            <div v-if="showRawJson" class="raw-json">
              <pre><code>{{ JSON.stringify(noteData, null, 2) }}</code></pre>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-message">No note data available</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useNoteStore } from '@/stores/Note'
import { useTags } from '@/stores/Tags'
import TagsInput from '../tag/TagsInput.vue'

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  noteId: {
    type: [String, Number],
    default: null
  }
})

// Emits
const emit = defineEmits(['close'])

// Store
const networkStore = useNoteStore()
const tagsStore = useTags()

// Reactive state
const noteData = ref(null)
const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const expandedKeys = ref(new Set())
const showRawJson = ref(false)

// Computed properties
const noteDataFiltered = computed(() => {
  if (!noteData.value) return {}
  
  // Filter out empty or null values and format the data
  const filtered = {}
  const data = { ...noteData.value }
  
  // Add tags_id as empty array if shouldShowTagsInput is true
  if (shouldShowTagsInput.value) {
    data.tags_id = []
  }
  
  // Define the preferred order with tags_id before time_create
  const preferredOrder = [
    'id', 'type', 'name', 'content', 'tags_id', 'time_create', 'time_update'
  ]
  
  // Add properties in preferred order first
  for (const key of preferredOrder) {
    if (key in data && data[key] !== null && data[key] !== undefined && data[key] !== '') {
      filtered[key] = data[key]
    }
  }
  
  // Add remaining properties not in preferred order
  for (const [key, value] of Object.entries(data)) {
    if (!preferredOrder.includes(key) && value !== null && value !== undefined && value !== '') {
      filtered[key] = value
    }
  }
  
  return filtered
})

const shouldShowTagsInput = computed(() => {
  console.log('shouldShowTagsInput()', noteData.value)
  if (!noteData.value) return false
  
  // Show TagsInput if:
  // 1. Note doesn't have tags_id property at all, OR
  // 2. Note has empty tags_id array
  // AND note type is not 'tag' or 'tag_set'
  const noteType = noteData.value.type
  const hasTagsId = 'tags_id' in noteData.value && Array.isArray(noteData.value.tags_id) && noteData.value.tags_id.length > 0
  const isTagType = noteType === 'tag' || noteType === 'tag_set'
  
  return !hasTagsId && !isTagType
})

// Methods
const fetchNoteData = async () => {
  if (!props.noteId) return
  
  isLoading.value = true
  hasError.value = false
  errorMessage.value = ''
  noteData.value = null
  
  try {
    const response = await networkStore.getNoteById(props.noteId)
    
    if (response.is_success) {
      noteData.value = response.data
    } else {
      hasError.value = true
      errorMessage.value = response.message || 'Failed to fetch note data'
    }
  } catch (error) {
    hasError.value = true
    errorMessage.value = error.message || 'Network error occurred'
    console.error('Error fetching note:', error)
  } finally {
    isLoading.value = false
  }
}

const closeModal = () => {
  emit('close')
  // Reset state when closing
  noteData.value = null
  expandedKeys.value.clear()
  showRawJson.value = false
  hasError.value = false
  errorMessage.value = ''
}

const handleBackdropClick = (event) => {
  // Close modal only if clicking the backdrop, not the modal content
  if (event.target === event.currentTarget) {
    closeModal()
  }
}

const formatValue = (value) => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value.toString()
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') {
    // Handle long strings
    if (value.length > 100) {
      return value.substring(0, 100) + '...'
    }
    return value
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const isArray = (value) => {
  return Array.isArray(value)
}

const isExpandableValue = (value) => {
  return isObject(value) || isArray(value)
}

const getValueTypeClass = (value) => {
  if (typeof value === 'number') return 'type-number'
  if (typeof value === 'boolean') return 'type-boolean'
  if (typeof value === 'string') return 'type-string'
  if (value === null) return 'type-null'
  return 'type-default'
}

const getObjectSummary = (obj) => {
  if (isArray(obj)) {
    return `Array (${obj.length} items)`
  }
  const keys = Object.keys(obj)
  return `Object (${keys.length} properties)`
}

const toggleExpanded = (key) => {
  if (expandedKeys.value.has(key)) {
    expandedKeys.value.delete(key)
  } else {
    expandedKeys.value.add(key)
  }
}

// Tag handling methods are now handled by the store's getTagsRefById method

const onTagAdd = async (data, callback) => {
  const { tag, indexInsert } = data
  console.log('NoteCard: Tag add requested:', tag, 'at position:', indexInsert)
  
  if (!noteData.value || !props.noteId) {
    console.error('No note data or note ID available')
    if (callback) callback(false)
    return
  }

  try {
    // Store original tags_id for comparison
    const tagsIdOriginal = noteData.value.tags_id ? [...noteData.value.tags_id] : []
    
    // Use new positioned API if we have an insertion index and it's not at the end
    const isPositionedInsertion = indexInsert !== undefined && indexInsert < tagsIdOriginal.length
    
    console.warn('NoteCard: addTagToNoteAtPos() isPositionedInsertion:', isPositionedInsertion, 'tag.id:', tag.id, 'indexInsert:', indexInsert)
    let response
    if (isPositionedInsertion && tag.id) {
      // Use new positioned API for existing tags
      response = await networkStore.addTagToNoteAtPos(props.noteId, tag.id, indexInsert)
    } else {
      // Use original API for new tags or end insertion
      const tagsName = tag.type === 'tag_new' ? [tag.name] : []
      const tagsId = tag.id ? [tag.id] : []
      response = await networkStore.addTagsToNote(props.noteId, tagsName, tagsId)
    }
    console.warn('NoteCard: addTagsToNote() response:', response)
    if (response.is_success && response.data && response.data.tags_id) {
      // Update local note data with complete tags_id from server
      noteData.value.tags_id = response.data.tags_id
      // If it's a new tag, find which ID was newly added
      if (tag.type === 'tag_new') {
        const tagIdNew = response.data.tags_id.find(id => !tagsIdOriginal.includes(id))
        if (tagIdNew) {
          // Try to get tag data from server to update cache
          try {
            const tagData = await tagsStore.getTagById(tagIdNew)
            console.log('NoteCard: Tag added successfully with new ID:', tagIdNew)
            if (callback) callback(true, tagData)
            return
          } catch (error) {
            console.error('NoteCard: Could not fetch new tag data:', error)
            if (callback) callback(false, error)
            return
          }
        }
      }
      if (callback) callback(true)
    } else {
      console.error('NoteCard: Failed to add tag:', response.message)
      if (callback) callback(false)
    }
  } catch (error) {
    console.error('NoteCard: Error adding tag:', error)
    if (callback) callback(false)
  }
}

const requestTagDelete = async (data, callback) => {
  console.log('NoteCard: Tag delete requested:', data)
  
  if (!noteData.value || !props.noteId) {
    console.error('No note data or note ID available')
    if (callback) callback(false)
    return
  }

  try {
    const { tag } = data
    
    // Prepare data based on tag type
    const tagsName = tag.type === 'tag_new' ? [tag.name] : []
    const tagsId = tag.id ? [tag.id] : []
    
    // Remove tag from note on server
    const response = await networkStore.removeTagsFromNote(props.noteId, tagsName, tagsId)
    
    if (response.is_success) {
      // Update local note data
      if (noteData.value.tags_id && tag.id) {
        noteData.value.tags_id = noteData.value.tags_id.filter(id => id !== tag.id)
      }
      
      console.log('NoteCard: Tag removed successfully')
      if (callback) callback(true)
    } else {
      console.error('NoteCard: Failed to remove tag:', response.message)
      if (callback) callback(false)
    }
  } catch (error) {
    console.error('NoteCard: Error removing tag:', error)
    if (callback) callback(false)
  }
}

const requestTagUpdate = async (tagsExist) => {
  console.log('NoteCard: Tag update:', tagsExist)
  
  if (!noteData.value || !props.noteId) {
    console.error('No note data or note ID available')
    return
  }

  try {
    // Separate existing and new tags
    const existingTags = tagsExist.filter(tag => tag.id && tag.type !== 'tag_new')
    const newTags = tagsExist.filter(tag => tag.type === 'tag_new')
    
    const tagsId = existingTags.map(tag => tag.id)
    const tagsName = newTags.map(tag => tag.name)
    
    // Set all tags for the note (replaces existing tags)
    const response = await networkStore.setTagsForNote(props.noteId, tagsName, tagsId)
    
    if (response.is_success) {
      // Update local note data with new tag IDs
      noteData.value.tags_id = [...tagsId]
      
      // If new tags were created, update cache and add their IDs
      if (response.data && response.data.tags_created) {
        tagsStore.updateTagsCache(response.data.tags_created)
        const tagIdNews = response.data.tags_created.map(tag => tag.id)
        noteData.value.tags_id.push(...tagIdNews)
      }
      
      console.log('NoteCard: Tags updated successfully')
    } else {
      console.error('NoteCard: Failed to update tags:', response.message)
    }
  } catch (error) {
    console.error('NoteCard: Error updating tags:', error)
  }
}

const requestTagReorder = async (data, callback) => {
  console.log('NoteCard: Tag reorder requested:', data)
  
  if (!noteData.value || !props.noteId) {
    console.error('No note data or note ID available for reordering')
    if (callback) callback(false)
    return
  }

  try {
    const { tag, indexOld, indexNew } = data
    
    if (!tag.id) {
      console.error('Cannot reorder tag without ID')
      if (callback) callback(false)
      return
    }
    const response = await networkStore.changeTagOrderForNote(props.noteId, tag.id, indexNew)
    
    if (response.is_success) {
      // Update local note data if server provides updated tag order
      if (response.data && response.data.tags_id) {
        noteData.value.tags_id = response.data.tags_id
      }
      console.log('NoteCard: Tag reordered successfully')
      if (callback) callback(true)
    } else {
      console.error('NoteCard: Failed to reorder tag:', response.message)
      if (callback) callback(false, response.message)
    }
  } catch (error) {
    console.error('NoteCard: Error reordering tag:', error)
    if (callback) callback(false, error)
  }
}

// Watch for prop changes
watch(() => props.isVisible, (newVal) => {
  if (newVal && props.noteId) {
    fetchNoteData()
  }
})

watch(() => props.noteId, (newVal) => {
  if (props.isVisible && newVal) {
    fetchNoteData()
  }
})
</script>

<style scoped>


.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-title h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
}

.note-type-badge {
  background: #667eea;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
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

.error-container {
  text-align: center;
  padding: 40px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-message {
  color: #dc2626;
  margin-bottom: 20px;
  font-size: 16px;
}

.retry-button {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.retry-button:hover {
  background: #5a67d8;
}

.note-data-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.properties-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.property-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.property-item.expandable:hover {
  border-color: #cbd5e0;
}

.property-key {
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.property-value {
  color: #1f2937;
}

.object-value, .array-value {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.expand-toggle {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.expand-toggle:hover {
  background: #e5e7eb;
  color: #374151;
}

.expand-toggle.expanded svg {
  transform: rotate(180deg);
}

.expand-toggle svg {
  transition: transform 0.2s;
}

.object-summary, .array-summary {
  font-style: italic;
  color: #6b7280;
}

.expanded-content {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.sub-property, .array-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #f3f4f6;
}

.sub-property:last-child, .array-item:last-child {
  border-bottom: none;
}

.sub-key, .array-index {
  font-weight: 500;
  color: #6b7280;
  min-width: 100px;
}

.sub-value, .array-item-value {
  flex: 1;
  color: #374151;
}

.simple-value {
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  font-family: 'Courier New', monospace;
}

.type-number {
  color: #059669;
}

.type-boolean {
  color: #dc2626;
}

.type-string {
  color: #1f2937;
}

.type-null {
  color: #6b7280;
  font-style: italic;
}

.json-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
}

.json-toggle {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s;
}

.json-toggle:hover {
  background: #e5e7eb;
}

.raw-json {
  margin-top: 12px;
  background: #1f2937;
  border-radius: 8px;
  overflow-x: auto;
}

.raw-json pre {
  margin: 0;
  padding: 16px;
  color: #f9fafb;
  font-size: 12px;
  line-height: 1.5;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-message {
  font-size: 18px;
}

.tags-display {
  padding: 8px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}
</style>
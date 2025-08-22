<template>
  <div class="container">
    <!-- Delete Name Confirmation Modal -->
    <div v-if="showDeleteNameModal" class="modal-overlay">
      <div class="modal">
        <h3 class="modal-title">Confirm Name Deletion</h3>
        <p class="modal-content">
          Are you sure you want to delete the name 
          "<span class="font-medium">{{ deletingNameInfo.name }}</span>"? 
          This action cannot be undone.
        </p>
        <div class="modal-actions">
          <button 
            @click="showDeleteNameModal = false" 
            class="btn btn-secondary">
            Cancel
          </button>
          <button 
            @click="deleteBibName" 
            class="btn btn-danger-solid">
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Add New Bibliography Section -->
    <div class="bib-create">
      <div class="card-content">
        <h2 class="bib-create-title">Add New Bibliography</h2>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input 
            v-model="newBib.name" 
            type="text" 
            class="form-input"
            placeholder="e.g., smith2022quantum">
        </div>
        <div class="form-group">
          <label class="form-label">BibTeX</label>
          <textarea 
            v-model="newBib.bibtex" 
            rows="6" 
            class="form-input form-textarea"
            placeholder="@article{..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">URL (optional)</label>
          <input 
            v-model="newBib.url" 
            type="text" 
            class="form-input"
            placeholder="https://example.com/paper.pdf">
        </div>
        <div class="text-right">
          <button 
            @click="submitBib" 
            class="btn btn-primary"
            :disabled="loading">
            Add Bibliography
          </button>
        </div>
      </div>
    </div>

    <!-- Filter and Sort Section -->
    <div class="controls">
      <div class="controls-left">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search bibliographies..." 
          class="form-input search-input">
      </div>
      <div class="controls-right">
        <button 
          @click="refreshBibList" 
          class="btn btn-secondary"
          :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
        <select 
          v-model="sortOption" 
          class="select">
          <option value="nameAsc">Name (A-Z)</option>
          <option value="nameDesc">Name (Z-A)</option>
          <option value="recent">Recently Added</option>
        </select>
      </div>
    </div>

    <!-- Bibliography Cards Section -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">Loading bibliographies...</p>
    </div>
    
    <div v-else-if="filteredBibList.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="empty-title">No bibliographies found</p>
      <p class="empty-subtitle">Add a new bibliography to get started</p>
    </div>

    <transition-group name="card" tag="div" class="grid">
      <div 
        v-for="bib in filteredBibList" 
        :key="bib.name"
        class="bib-card"
        :class="{ expanded: bib.names.includes(renamingBib) || bib.names.includes(addingNameToBib)}"
        :data-bib-name="bib.name"
        @click.stop>
        <BibCard
          :bib="bib"
          :is-expanded="expandedBibCard === bib.name"
          :renaming-name="renamingBib"
          :new-name="newName"
          :is-adding-name="addingNameToBib === bib.name"
          :adding-new-name="addingNewName"
          :is-editing-bibtex="editingBibtex === bib.name"
          :new-bibtex="newBibtex"
          @toggle-details="toggleDetails(bib.name)"
          @start-rename="startRename"
          @confirm-rename="confirmRename"
          @confirm-rename-blur="confirmRenameBlur"
          @cancel-rename="cancelRename"
          @confirm-delete-name="confirmDeleteName"
          @start-add-name="startAddName(bib.name)"
          @confirm-add-name="confirmAddName(bib.name, $event)"
          @confirm-add-name-blur="confirmAddNameBlur(bib.name, $event)"
          @cancel-add-name="cancelAddName"
          @start-edit-bibtex="startEditBibtex(bib.name)"
          @confirm-edit-bibtex="confirmEditBibtex(bib.name, $event)"
          @confirm-edit-bibtex-blur="confirmEditBibtexBlur(bib.name, $event)"
          @cancel-edit-bibtex="cancelEditBibtex"
          @copy-citation="copyCitation(bib.name)"
          @confirm-delete="confirmDelete(bib.name)"
          @update:newName="newName = $event"
          @update:addingNewName="addingNewName = $event"
          @update:newBibtex="newBibtex = $event"
        />
      </div>
    </transition-group>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal">
        <h3 class="modal-title">Confirm Deletion</h3>
        <p class="modal-content">
          Are you sure you want to delete the bibliography 
          "<span class="font-medium">{{ deletingBib }}</span>"? 
          This action cannot be undone.
        </p>
        <div class="modal-actions">
          <button 
            @click="showDeleteModal = false" 
            class="btn btn-secondary">
            Cancel
          </button>
          <button 
            @click="deleteBib" 
            class="btn btn-danger-solid">
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Notification -->
    <transition name="fade">
      <div v-if="notification.show" :class="['notification', notification.type === 'success' ? 'notification-success' : 'notification-error']">
        <div class="notification-content">
          <svg v-if="notification.type === 'success'" class="notification-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <svg v-else class="notification-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
          <span>{{ notification.message }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useBibliographyStore } from '../stores/Bibliography'
import BibCard from './BibCard.vue'

const bibliographyStore = useBibliographyStore()

// Reactive state
const loading = ref(false)
const bibList = ref([])
const filteredBibList = ref([])
const newBib = reactive({
  name: '',
  bibtex: '',
  url: ''
})
const expandedBibCard = ref(null)
const bibInfoList = reactive({})
const searchQuery = ref('')
const sortOption = ref('nameAsc')
const showDeleteModal = ref(false)
const deletingBib = ref(null)
const renamingBib = ref(null)
const isConfirmingRename = ref(false)
const newName = ref('')
const notification = reactive({
  show: false,
  message: '',
  type: 'success',
  timeout: null
})
const addingNameToBib = ref(null)
const addingNewName = ref('')
const showDeleteNameModal = ref(false)
const deletingNameInfo = reactive({ bibName: null, name: null })
const isConfirmingAddName = ref(false)
const editingBibtex = ref(null)
const newBibtex = ref('')
const isConfirmingBibtexEdit = ref(false)

// Watchers
watch(searchQuery, () => {
  filterBibList()
})

watch(sortOption, () => {
  sortBibList()
})

// Methods
const handleClickOutside = (event) => {
  if (!expandedBibCard.value) return
  
  const expandedCard = document.querySelector(`[data-bib-name="${expandedBibCard.value}"]`)
  if (expandedCard && !expandedCard.contains(event.target)) {
    expandedBibCard.value = null
    nextTick(() => {
      const cards = document.querySelectorAll('.bib-card')
      cards.forEach(card => card.classList.remove('expanded'))
    })
  }
}

const showNotification = (message, type = 'success') => {
  if (notification.timeout) {
    clearTimeout(notification.timeout)
  }
  
  notification.show = true
  notification.message = message
  notification.type = type
  
  notification.timeout = setTimeout(() => {
    notification.show = false
  }, 3000)
}

const refreshBibList = async () => {
  try {
    loading.value = true
    const response = await bibliographyStore.getAllBib()
    if (response.is_success) {
      bibList.value = response.data
      bibList.value.forEach(bibInfo => bibInfo.name = bibInfo.names[0])
      filterBibList()
      sortBibList()
    } else {
      showNotification('Failed to load bibliographies', 'error')
    }
  } catch (err) {
    showNotification('Error loading bibliographies', 'error')
  } finally {
    loading.value = false
  }
}

const filterBibList = () => {
  if (!searchQuery.value) {
    filteredBibList.value = [...bibList.value]
  } else {
    const query = searchQuery.value.toLowerCase()
    filteredBibList.value = bibList.value.filter(bib => {
      return bib.name.toLowerCase().includes(query) || 
             bib.bibtex.toLowerCase().includes(query)
    })
  }
  sortBibList()
}

const sortBibList = () => {
  switch (sortOption.value) {
    case 'nameAsc':
      filteredBibList.value.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'nameDesc':
      filteredBibList.value.sort((a, b) => b.name.localeCompare(a.name))
      break
    case 'recent':
      break
  }
}

const startRename = (name) => {
  renamingBib.value = name
  newName.value = name
  nextTick(() => {
    const inputRef = 'renameInput-' + name
    const input = document.querySelector(`[ref="${inputRef}"]`)
    if (input) {
      input.focus()
    }
  })
}

const cancelRename = (timeDelayMs = 1000) => {
  isConfirmingRename.value = true
  setTimeout(() => {
    isConfirmingRename.value = false
  }, timeDelayMs)
  renamingBib.value = null
  newName.value = ''
}

const confirmRenameBlur = (oldName, eventName) => {
  if (isConfirmingRename.value === true) return
  setTimeout(() => {
    if (isConfirmingRename.value === false) {
      confirmRename(oldName, 'blur')
    }
  }, 100)
}

const confirmRename = async (oldName, eventName) => {
  if (isConfirmingRename.value === true) return
  isConfirmingRename.value = true
  
  if (!newName.value || newName.value.trim() === '') {
    showNotification('Name cannot be empty', 'error')
    cancelRename()
    return
  }
  
  if (newName.value === oldName) {
    cancelRename()
    return
  }
  
  if (bibList.value.find(bib => bib.name === newName.value)) {
    showNotification('A bibliography with this name already exists', 'error')
    cancelRename()
    return
  }
  
  try {
    const response = await bibliographyStore.renameBib(oldName, newName.value)
    if (response.is_success) {
      showNotification(`Bibliography renamed from "${oldName}" to "${newName.value}"`)
      
      const index = bibList.value.findIndex(bib => bib.name === oldName)
      if (index !== -1) {
        bibList.value[index].name = newName.value
      }
      
      if (expandedBibCard.value === oldName) {
        expandedBibCard.value = newName.value
      }
      
      if (bibInfoList[oldName]) {
        bibInfoList[newName.value] = bibInfoList[oldName]
        delete bibInfoList[oldName]
      }
      
      filterBibList()
    } else {
      showNotification(response.message || 'Failed to rename bibliography', 'error')
    }
  } catch (err) {
    showNotification('Error renaming bibliography', 'error')
  }
  
  cancelRename()
}

const submitBib = async () => {
  if (!newBib.name || !newBib.bibtex) {
    showNotification('Name and BibTeX are required', 'error')
    return
  }
  
  try {
    loading.value = true
    const response = await bibliographyStore.addBib(newBib.name, newBib.bibtex, newBib.url || null)
    if (response.is_success) {
      showNotification('Bibliography added successfully')
      newBib.name = ''
      newBib.bibtex = ''
      newBib.url = ''
      refreshBibList()
    } else {
      showNotification('Failed to add bibliography', 'error')
    }
  } catch (err) {
    showNotification('Error adding bibliography', 'error')
  } finally {
    loading.value = false
  }
}

const confirmDelete = (name) => {
  deletingBib.value = name
  showDeleteModal.value = true
}

const deleteBib = async () => {
  try {
    const response = await bibliographyStore.removeBib(deletingBib.value)
    if (response.is_success) {
      showNotification('Bibliography deleted successfully')
      refreshBibList()
    } else {
      showNotification('Failed to delete bibliography', 'error')
    }
  } catch (err) {
    showNotification('Error deleting bibliography', 'error')
  }
  
  showDeleteModal.value = false
  deletingBib.value = null
}

const toggleDetails = (name) => {
  if (expandedBibCard.value === name) {
    expandedBibCard.value = null
    nextTick(() => {
      const cards = document.querySelectorAll('.bib-card')
      cards.forEach(card => card.classList.remove('expanded'))
    })
  } else {
    expandedBibCard.value = name
    nextTick(() => {
      const cards = document.querySelectorAll('.bib-card')
      cards.forEach(card => card.classList.remove('expanded'))
      const expandedCard = document.querySelector(`[data-bib-name="${name}"]`)
      if (expandedCard) {
        expandedCard.classList.add('expanded')
      }
    })

    if (!bibInfoList[name]) {
      getBibDetails(name)
    }
  }
}

const getBibDetails = async (name) => {
  try {
    const response = await bibliographyStore.getBib(name)
    if (response.is_success) {
      const bib = response.data
      
      if (bib.citation) {
        bibInfoList[name] = bib.citation
      }
      
      const index = bibList.value.findIndex(b => b.name === name)
      if (index !== -1) {
        bibList.value[index] = { ...bibList.value[index], ...bib }
        filterBibList()
      }
    }
  } catch (err) {
    console.error(err)
  }
}



const copyCitation = async (name) => {
  const bib = bibList.value.find(b => b.name === name)
  if (bib && bib.metadata && bib.metadata.citation) {
    copyToClipboard(bib.metadata.citation)
    showNotification('Citation copied to clipboard')
    return
  }
  
  try {
    const response = await bibliographyStore.getCitation(name, 'plain')
    if (response.is_success) {
      const citation = response.data
      
      const index = bibList.value.findIndex(b => b.name === name)
      if (index !== -1) {
        if (!bibList.value[index].metadata) {
          bibList.value[index].metadata = {}
        }
        bibList.value[index].metadata.citation = citation
      }
      
      copyToClipboard(citation)
      showNotification('Citation copied to clipboard')
    } else {
      showNotification('Failed to get citation', 'error')
    }
  } catch (err) {
    showNotification('Error getting citation', 'error')
  }
}

const copyToClipboard = (text) => {
  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

const confirmDeleteName = (bibName, name) => {
  deletingNameInfo.bibName = bibName
  deletingNameInfo.name = name
  showDeleteNameModal.value = true
}

const deleteBibName = async () => {
  const { name } = deletingNameInfo
  try {
    const response = await bibliographyStore.removeName(name)
    if (response.is_success) {
      showNotification(`Name "${name}" removed successfully`)
      refreshBibList()
    } else {
      showNotification('Failed to remove name', 'error')
    }
  } catch (err) {
    showNotification('Error removing name', 'error')
  }
  
  showDeleteNameModal.value = false
  deletingNameInfo.bibName = null
  deletingNameInfo.name = null
}

const startAddName = (bibName) => {
  addingNameToBib.value = bibName
  addingNewName.value = ''
  nextTick(() => {
    const input = document.querySelector(`[ref="addNameInput-${bibName}"]`)
    if (input) {
      input.focus()
    }
  })
}

const cancelAddName = () => {
  setTimeout(() => {
    isConfirmingAddName.value = false
  }, 1000)
  addingNameToBib.value = null
  addingNewName.value = ''
}

const confirmAddNameBlur = async (bibName, eventName) => {
  if (isConfirmingAddName.value === true) return
  setTimeout(async () => {
    if (isConfirmingAddName.value === false) {
      await confirmAddName(bibName, 'blur')
      cancelAddName()
    }
  }, 100)
}

const confirmAddName = async (bibName, eventName) => {
  if (isConfirmingAddName.value === true) return
  isConfirmingAddName.value = true
  
  if (!addingNewName.value || addingNewName.value.trim() === '') {
    if (eventName !== 'cancel_click') {
      // Don't show error for cancel/blur events
    }
    cancelAddName()
    return
  }
  
  const bib = bibList.value.find(b => b.name === bibName)
  if (bib && bib.names.includes(addingNewName.value.trim())) {
    showNotification('This name already exists for this bibliography', 'error')
    cancelAddName()
    return
  }
  
  const existsInOtherBib = bibList.value.some(b => 
    b.name !== bibName && b.names.includes(addingNewName.value.trim())
  )
  if (existsInOtherBib) {
    showNotification('This name is already used by another bibliography', 'error')
    cancelAddName()
    return
  }
  
  try {
    const response = await bibliographyStore.appendName(bibName, addingNewName.value.trim())
    if (response.is_success) {
      showNotification(`Name "${addingNewName.value.trim()}" added successfully`)
      refreshBibList()
    } else {
      showNotification('Failed to add name', 'error')
    }
  } catch (err) {
    showNotification('Error adding name', 'error')
  }
  
  cancelAddName()
}

const startEditBibtex = (name) => {
  const bib = bibList.value.find(b => b.name === name)
  editingBibtex.value = name
  newBibtex.value = bib.bibtex
  nextTick(() => {
    const input = document.querySelector(`[ref="editBibtexInput-${name}"]`)
    if (input) {
      input.focus()
    }
  })
}

const cancelEditBibtex = () => {
  isConfirmingBibtexEdit.value = true
  setTimeout(() => {
    isConfirmingBibtexEdit.value = false
  }, 1000)
  editingBibtex.value = null
  newBibtex.value = ''
}

const confirmEditBibtexBlur = async (name, eventName) => {
  if (isConfirmingBibtexEdit.value === true) return
  setTimeout(async () => {
    if (isConfirmingBibtexEdit.value === false) {
      await confirmEditBibtex(name, 'blur')
    }
  }, 100)
}

const confirmEditBibtex = async (name, eventName) => {
  if (isConfirmingBibtexEdit.value === true) return
  isConfirmingBibtexEdit.value = true
  
  if (!newBibtex.value || newBibtex.value.trim() === '') {
    showNotification('BibTeX cannot be empty', 'error')
    cancelEditBibtex()
    return
  }
  
  const bib = bibList.value.find(b => b.name === name)
  if (newBibtex.value === bib.bibtex) {
    cancelEditBibtex()
    return
  }
  
  try {
    const response = await bibliographyStore.updateBibtex(name, newBibtex.value)
    if (response.is_success) {
      showNotification('BibTeX updated successfully')
      const index = bibList.value.findIndex(bib => bib.name === name)
      if (index !== -1) {
        bibList.value[index].bibtex = newBibtex.value
        if (bibList.value[index].metadata) {
          delete bibList.value[index].metadata
        }
      }
      filterBibList()
    } else {
      showNotification(response.message || 'Failed to update BibTeX', 'error')
    }
  } catch (err) {
    showNotification('Error updating BibTeX', 'error')
  }
  
  cancelEditBibtex()
}

// Lifecycle
onMounted(() => {
  refreshBibList()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  min-height: 100vh;
  align-self: center;
  box-sizing: border-box;
  overflow-y: auto; 
}

header {
  margin-bottom: 40px;
  padding: 32px 0;
}

h1 {
  font-size: 1.875rem;
  font-weight: bold;
  text-align: center;
  color: #1f2937;
  margin: 0;
}

.bib-create {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  margin-bottom: 32px;
  overflow: hidden;
  padding: 12px;
}

.bib-create:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.bib-card.expanded {
  overflow: visible;
  background-color: #fff;
  border: solid 1px black;
}

.bib-create-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
}

/* Form styles */
.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

/* Button styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease-in-out;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-secondary {
  background-color: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #d1d5db;
}

.btn-danger {
  background-color: #fee2e2;
  color: #dc2626;
}

.btn-danger:hover:not(:disabled) {
  background-color: #fecaca;
}

.btn-danger-solid {
  background-color: #dc2626;
  color: white;
}

.btn-danger-solid:hover:not(:disabled) {
  background-color: #b91c1c;
}

.btn-blue {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.btn-blue:hover:not(:disabled) {
  background-color: #bfdbfe;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 0.75rem;
}

.btn-icon {
  width: 16px;
  height: 16px;
  margin-right: 4px;
}

/* Controls section */
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.controls-left {
  flex: 1;
  min-width: 200px;
}

.controls-right {
  display: flex;
  gap: 8px;
}

.search-input {
  width: 100%;
  max-width: 300px;
}

.select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 0.875rem;
}

.select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-rows: min-content;
}

.bib-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.15s ease-in-out;
  position: relative;
  z-index: 1;
  height: 150px;
}

.bib-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.bib-card.expanded {
  z-index: 100;
}

/* Loading and empty states */
.loading-container {
  text-align: center;
  padding: 48px 0;
}

.loading-spinner {
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 8px;
  color: #6b7280;
}

.empty-state {
  text-align: center;
  padding: 48px 0;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  color: #9ca3af;
}

.empty-title {
  font-size: 1.125rem;
  color: #6b7280;
  margin-bottom: 8px;
}

.empty-subtitle {
  color: #9ca3af;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  padding: 24px;
  width: 100%;
  max-width: 448px;
  margin: 0 16px;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
}

.modal-content {
  color: #6b7280;
  margin-bottom: 24px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Notification */
.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1100;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  max-width: 400px;
}

.notification-success {
  background-color: #dcfce7;
  color: #166534;
}

.notification-error {
  background-color: #fee2e2;
  color: #dc2626;
}

.notification-content {
  display: flex;
  align-items: center;
}

.notification-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
}

/* Animations */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter, .fade-leave-to {
  opacity: 0;
}

.card-enter-active, .card-leave-active {
  transition: all 0.5s;
}

.card-enter, .card-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

/* Utility classes */
.text-right {
  text-align: right;
}

.font-medium {
  font-weight: 500;
}



/* Responsive adjustments */
@media (max-width: 767px) {
  .container {
    padding: 0 12px;
  }
  
  .controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .controls-right {
    justify-content: center;
  }
  
  .bib-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .bib-actions-left {
    justify-content: center;
  }
}
</style>
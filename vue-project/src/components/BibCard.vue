<template>
  <div class="card-content">
    <div class="bib-header">
      <h3 class="bib-title" :class="{ 'expanded': isExpanded }">
        {{ bib.metadata ? bib.metadata.title : 'Loading...' }}
      </h3>
      <button 
        @click="$emit('toggle-details')" 
        class="bib-toggle">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="isExpanded" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
    
    <div class="bib-meta">
      <strong>Authors:</strong> {{ bib.metadata ? formatAuthors(bib.metadata.author_list) : 'Loading...' }}
    </div>

    <div class="bib-meta">
      <div class="bib-meta-row">
        <div class="bib-names-container">
          <strong style="display: inline-flex; align-items: center;">Key:</strong>
          <div v-for="(name, index) in bib.names" :key="'name-' + index" class="bib-name-item">
            <div v-if="renamingName !== name" style="display: flex; flex-direction: row; align-items: center;">
              <div class="bib-name-display" @click="$emit('start-rename', name)">
                {{ name }}
              </div>
              <div class="bib-name-display">
                <button 
                  class="btn-delete-name"
                  :disabled="bib.names.length <= 1"
                  :class="{ 'disabled-icon': bib.names.length <= 1 }"
                  @click.stop="$emit('confirm-delete-name', bib.name, name)">
                  <svg class="name-action-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <div v-else class="bib-name-container" style="display: flex; align-items: stretch;">
              <div class="bib-name-display" style="position: relative; width: 120px;">
                <input 
                  :value="newName" 
                  @input="$emit('update:newName', $event.target.value)"
                  class="bib-name-input"
                  @keyup.enter="$emit('confirm-rename', name, 'keyup')"
                  @keyup.escape="$emit('cancel-rename')"
                  :ref="'renameInput-' + name"
                  @blur="$emit('confirm-rename-blur', name, 'blur')">
              </div>
              <div class="rename-actions">
                <button class="btn-rename btn-rename-save" @mousedown="$emit('confirm-rename', name, 'mousedown')">
                  <svg class="rename-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button class="btn-rename btn-rename-cancel" @mousedown="$emit('cancel-rename')">
                  <svg class="rename-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div v-if="!isAddingName" class="bib-name-item">
            <button class="btn-add-name" @click="$emit('start-add-name')" style="margin-left: 1px;">
              <svg class="name-action-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div v-else class="add-name-container" style="display: flex; align-items: stretch;">
            <div class="bib-name-display" style="position: relative; width: 120px;">
              <input 
                :value="addingNewName" 
                @input="$emit('update:addingNewName', $event.target.value)"
                class="bib-name-input"
                placeholder="Enter new name..."
                @keyup.enter="$emit('confirm-add-name', 'keyup')"
                @keyup.escape="$emit('cancel-add-name')"
                :ref="'addNameInput-'+bib.name"
                @blur="$emit('confirm-add-name-blur', 'blur')">
            </div>
            <div class="add-name-actions">
              <button class="btn-add-name-save" @mousedown="$emit('confirm-add-name', 'confirm_click')">
                <svg class="rename-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button class="btn-add-name-cancel" @click="$emit('cancel-add-name')">
                <svg class="rename-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <span style="min-width: 65px;"><strong>Year:</strong> {{ bib.metadata ? bib.metadata.year : '' }}</span>
      </div>
    </div>

    <div v-if="isExpanded" class="bib-details">
      <div class="bib-detail-item">
        <div class="bib-detail-label">BibTeX</div>
        <div v-if="!isEditingBibtex" @click="$emit('start-edit-bibtex')" style="cursor: pointer;">
          <pre class="bib-bibtex">{{ bib.bibtex }}</pre>
        </div>
        <div v-else style="display: flex; flex-direction: column; gap: 8px;">
          <textarea 
            :value="newBibtex" 
            @input="$emit('update:newBibtex', $event.target.value)"
            class="form-input form-textarea"
            rows="8"
            :ref="'editBibtexInput-' + bib.name"
            @keyup.ctrl.enter="$emit('confirm-edit-bibtex', 'keyup')"
            @keyup.escape="$emit('cancel-edit-bibtex')"
            @blur="$emit('confirm-edit-bibtex-blur', 'blur')"
            style="font-family: monospace; font-size: 12px;">
          </textarea>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="btn btn-sm btn-secondary" @mousedown="$emit('cancel-edit-bibtex')">
              Cancel
            </button>
            <button class="btn btn-sm btn-primary" @mousedown="$emit('confirm-edit-bibtex', 'mousedown')">
              Save
            </button>
          </div>
        </div>
      </div>
                      
      <div v-if="bib.url" class="bib-detail-item">
        <div class="bib-detail-label">URL</div>
        <a :href="bib.url" target="_blank" class="bib-url">{{ bib.url }}</a>
      </div>
      
      <div v-if="bib.metadata && bib.metadata.citation" class="bib-detail-item">
        <div class="bib-detail-label">Citation</div>
        <div class="bib-citation">{{ bib.metadata.citation }}</div>
      </div>
    </div>
    
    <div class="bib-actions">
      <div class="bib-actions-left">
        <button 
          @click="$emit('copy-citation')" 
          class="btn btn-sm btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Citation
        </button>
        <a 
          v-if="bib.url" 
          :href="bib.url" 
          target="_blank"
          class="btn btn-sm btn-blue">
          <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View
        </a>
      </div>
      <button 
        @click="$emit('confirm-delete')" 
        class="btn btn-sm btn-danger">
        <svg xmlns="http://www.w3.org/2000/svg" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>
    </div>
  </div>
</template>

<script setup>
// Props
const props = defineProps({
  bib: {
    type: Object,
    required: true
  },
  isExpanded: {
    type: Boolean,
    default: false
  },
  renamingName: {
    type: String,
    default: null
  },
  newName: {
    type: String,
    default: ''
  },
  isAddingName: {
    type: Boolean,
    default: false
  },
  addingNewName: {
    type: String,
    default: ''
  },
  isEditingBibtex: {
    type: Boolean,
    default: false
  },
  newBibtex: {
    type: String,
    default: ''
  }
})

// Emits
const emit = defineEmits([
  'toggle-details',
  'start-rename',
  'confirm-rename',
  'confirm-rename-blur',
  'cancel-rename',
  'confirm-delete-name',
  'start-add-name',
  'confirm-add-name',
  'confirm-add-name-blur',
  'cancel-add-name',
  'start-edit-bibtex',
  'confirm-edit-bibtex',
  'confirm-edit-bibtex-blur',
  'cancel-edit-bibtex',
  'copy-citation',
  'confirm-delete',
  'update:newName',
  'update:addingNewName',
  'update:newBibtex'
])

// Helper methods
const formatAuthors = (authors) => {
  if (!authors || !Array.isArray(authors)) return 'Unknown'
  
  if (authors.length > 2) {
    return authors[0] + ' et al.'
  } else {
    return authors.join(' & ')
  }
}
</script>

<style scoped>
.card-content {
  padding: 8px;
}

.bib-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.bib-title {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.4rem;
  color: #1f2937;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.bib-title.expanded {
  width: 300px;
  white-space: normal;
  overflow-wrap: break-word;
}

.bib-toggle {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.bib-toggle:hover {
  color: #374151;
}

.bib-meta {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 4px;
}

.bib-meta strong {
  font-weight: 600;
}

.bib-meta-row {
  display: flex;
  justify-content: space-between;
}

.bib-details {
  margin-top: 16px;
  font-size: 0.875rem;
}

.bib-detail-item {
  margin-bottom: 12px;
}

.bib-detail-label {
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.bib-url {
  color: #2563eb;
  text-decoration: none;
  word-break: break-all;
}

.bib-url:hover {
  text-decoration: underline;
}

.bib-bibtex {
  background-color: #f3f4f6;
  padding: 8px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  overflow-x: auto;
  white-space: pre-wrap;
}

.bib-citation {
  background-color: #f3f4f6;
  padding: 8px;
  border-radius: 4px;
  font-size: 0.75rem;
}

.bib-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}

.bib-actions-left {
  display: flex;
  gap: 8px;
}

/* Form styles */
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

/* Name management styles */
.bib-names-container {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 4px;
}

.bib-name-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-add-name {
  background-color: #10b981;
  color: white;
  padding: 2px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.btn-add-name:hover {
  background-color: #059669;
}

.btn-delete-name {
  background-color: #ef4444;
  color: white;
  padding: 2px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-delete-name:hover:not(.disabled-icon) {
  background-color: #dc2626;
}

.name-action-icon {
  width: 12px;
  height: 12px;
}

.bib-name-display {
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  padding: 2px 0px;
  border-radius: 4px;
  transition: background-color 0.2s;
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.bib-name-display:hover {
  background-color: #f3f4f6;
}

.bib-name-input {
  flex: 1;
  padding: 2px 2px;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  background-color: white;
  outline: none;
  position: absolute;
  top: 1px; 
  bottom: 1px;
  left: 1px; 
  right: 1px;
}

.bib-name-input:focus {
  border-color: #1d4ed8;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.rename-actions {
  display: flex;
  gap: 4px;
}

.btn-rename {
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-rename-save {
  background-color: #10b981;
  color: white;
}

.btn-rename-save:hover {
  background-color: #059669;
}

.btn-rename-cancel {
  background-color: #6b7280;
  color: white;
}

.btn-rename-cancel:hover {
  background-color: #4b5563;
}

.rename-icon {
  width: 14px;
  height: 14px;
}

.disabled-icon {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.add-name-container {
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-name-actions {
  display: flex;
  gap: 4px;
}

.btn-add-name-save {
  background-color: #10b981;
  color: white;
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-add-name-save:hover {
  background-color: #059669;
}

.btn-add-name-cancel {
  background-color: #6b7280;
  color: white;
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-add-name-cancel:hover {
  background-color: #4b5563;
}

.bib-name-container {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
</style>
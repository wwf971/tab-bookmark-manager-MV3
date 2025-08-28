<template>
  <div class="snapshot-manager">
    <!-- Create Snapshot Panel -->
    <div class="create-snapshot-panel">
      <h2>Create Snapshot</h2>
      <div class="window-selection">
        <div 
          v-for="window in windows" 
          :key="window.id"
          class="window-item"
          :class="{ selected: selectedWindows.has(window.id) }"
          @click="toggleWindowSelection(window)"
        >
          <div class="window-info">
            <div class="window-title">
              Window {{ window.id }}
              <span v-if="window.id === windowCurrentId" class="current-tag">current window</span>
            </div>
            <div class="tab-count">
              {{ window.tabs.length }} tab{{ window.tabs.length !== 1 ? 's' : '' }}
            </div>
          </div>
          <div class="window-preview">
            <div 
              v-for="tab in window.tabs.slice(0, 5)" 
              :key="tab.id"
              class="tab-preview"
              :title="tab.title"
            >
              <img 
                :src="tab.favIconUrl || defaultIcon" 
                @error="handleIconError"
                alt="tab icon"
              />
            </div>
            <div v-if="window.tabs.length > 5" class="more-tabs">
              +{{ window.tabs.length - 5 }} more
            </div>
          </div>
        </div>
      </div>
      <div class="create-actions">
        <div class="create-options">
          <label class="checkbox-label">
            <input 
              type="checkbox"
              v-model="closeWindowAfterSnapshot"
            />
            Close window after creating snapshot
          </label>
        </div>
        <button 
          class="btn btn-primary"
          :disabled="selectedWindows.size === 0"
          @click="createSnapshot"
        >
          Create Snapshot
        </button>
      </div>
    </div>

    <!-- Snapshots List Panel -->
    <div class="snapshots-list-panel">
      <h2>Saved Snapshots</h2>
      <div v-if="loading" class="loading">Loading...</div>
      <template v-else>
        <div v-if="snapshots.length === 0" class="no-snapshots">
          No snapshots found
        </div>
        <Snapshot
          v-for="snapshot in snapshots"
          :key="snapshot.id"
          :snapshot="snapshot"
          @open="openSnapshot"
          @delete="deleteSnapshot"
        />
      </template>
    </div>

    <!-- Details Panel (placeholder) -->
    <div class="details-panel">
      <h2>Snapshot Details</h2>
      <div class="placeholder-message">
        Select a snapshot to view details
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useNetworkRequest } from '@/network/NetworkRequest'
import Snapshot from './Snapshot.vue'

const props = defineProps({
  windows: {
    type: Array,
    required: true
  },
  windowCurrentId: {
    type: Number,
    required: true
  }
})

// Store
const networkRequest = useNetworkRequest()

// State
const selectedWindows = ref(new Set())
const snapshots = ref([])
const loading = ref(false)
const closeWindowAfterSnapshot = ref(false)

// Default icon for tabs
const defaultIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>'

// Methods
const toggleWindowSelection = (window) => {
  if (selectedWindows.value.has(window.id)) {
    selectedWindows.value.delete(window.id)
  } else {
    selectedWindows.value.add(window.id)
  }
}

const handleIconError = (event) => {
  event.target.src = defaultIcon
}

const createSnapshot = async () => {
  try {
    const selectedWindowsList = props.windows.filter(w => selectedWindows.value.has(w.id))
    const result = await networkRequest.createSnapshot(selectedWindowsList)
    
    if (result.is_success) {
      // Clear selection
      selectedWindows.value.clear()
      // Refresh snapshots list
      loadSnapshots()
      // Close windows if option is selected
      if (closeWindowAfterSnapshot.value) {
        for (const window of selectedWindowsList) {
          await chrome.windows.remove(window.id)
        }
      }
    }else{
      console.error('Error creating snapshot:', result.message)
    }
  } catch (error) {
    console.error('Error creating snapshot:', error)
  }
}

const loadSnapshots = async () => {
  loading.value = true
  try {
    // This would need to be implemented in the backend
    // For now, we'll just show a mock list
    snapshots.value = []
  } catch (error) {
    console.error('loadSnapshots(): Error loading snapshots:', error)
  } finally {
    loading.value = false
  }
}

const openSnapshot = async (snapshot) => {
  try {
    const result = await networkRequest.getSnapshot(snapshot.id)
    if (result.is_success && result.data.session_snapshot) {
      // Create new window with tabs from snapshot
      const windows = result.data.session-snapshot
      for (const window of windows) {
        const tabs = window.tabs.map(tab => ({ url: tab.url }))
        await chrome.windows.create({ url: tabs[0].url })
        if (tabs.length > 1) {
          const newWindow = await chrome.windows.getCurrent()
          await Promise.all(tabs.slice(1).map(tab => 
            chrome.tabs.create({ windowId: newWindow.id, url: tab.url })
          ))
        }
      }
    }
  } catch (error) {
    console.error('Error opening snapshot:', error)
  }
}

const deleteSnapshot = async (snapshot) => {
  try {
    const result = await networkRequest.deleteSnapshot(snapshot.id)
    if (result.is_success) {
      // Remove from list
      snapshots.value = snapshots.value.filter(s => s.id !== snapshot.id)
    }
  } catch (error) {
    console.error('Error deleting snapshot:', error)
  }
}

// Load snapshots on mount
onMounted(() => {
  loadSnapshots()
})
</script>

<style scoped>
.snapshot-manager {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  width: 100%;
  min-height: calc(100vh - 180px);
  overflow: hidden;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.create-snapshot-panel,
.snapshots-list-panel,
.details-panel {
  background: white;
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
  height: 100%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  min-width: 0; /* Prevent overflow in flex/grid items */
}

.placeholder-message {
  color: var(--text-secondary);
  text-align: center;
  padding: 24px;
}

h2 {
  margin: 0 0 16px;
  color: #202124;
  font-size: 18px;
  position: sticky;
  top: 0;
  background: white;
  padding: 8px 0;
  z-index: 1;
}

.window-selection {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.window-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.window-item:hover {
  background: #f8f9fa;
}

.window-item.selected {
  border-color: #1a73e8;
  background: #e8f0fe;
}

.window-info {
  flex: 1;
}

.window-title {
  font-weight: 500;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-tag {
  background: #1a73e8;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: normal;
}

.tab-count {
  font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  font-weight: bold;
  color: #87ceeb;
  background-color: #666;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #999;
  letter-spacing: 1px;
  min-width: 20px;
  text-align: center;
  display: inline-block;
}

.window-preview {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tab-preview {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  overflow: hidden;
}

.tab-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.more-tabs {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 4px;
}

.create-actions {
  position: sticky;
  bottom: 0;
  background: white;
  padding: 16px 0 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.create-options {
  padding: 0 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  width: 100%;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #1a73e8;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1557b0;
}

.loading,
.no-snapshots {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
}
</style>
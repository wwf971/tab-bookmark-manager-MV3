<template>
  <div class="modal-content">
    <div class="modal-header">
      <h3>File Access Points</h3>
      <div class="server-info">
        <span class="server-id">Server ID: {{ serverIdDisplay }}</span>
      </div>
    </div>

    <!-- Loading and Error States -->
    <div v-if="isServerFileAccessPointsLoading" class="loading-message">
      Loading file access points...
    </div>
    
    <div v-if="serverFileAccessPointsError" class="error-message-container">
      <div class="error-message">
        {{ serverFileAccessPointsError }}
        <button class="refresh-btn" @click="loadFileAccessPoints" title="Refresh">↻</button>
      </div>
    </div>

    <!-- File Access Points List -->
    <div v-if="!isServerFileAccessPointsLoading" class="access-points-section">
      <div class="section-header">
        <span style="display: flex; align-items: center; gap: 8px;">
          <h4>Access Points</h4>
          <button class="refresh-btn" @click="loadFileAccessPoints" title="Refresh">↻</button>
        </span>


        <button class="add-btn" @click="startAddingAccessPoint">+ Add Access Point</button>
      </div>
      
      <div class="access-points-list" v-if="serverFileAccessPoints.length > 0">
        <div 
          v-for="(accessPoint, index) in serverFileAccessPoints" 
          :key="accessPoint.id"
          class="access-point-item"
        >
          <div class="access-point-header">
            <div class="access-point-info">
              <div class="access-point-info-header">
                <div class="access-point-name">{{ accessPoint.name || '(No name)' }}</div>
                <div class="access-point-id">
                  ID: {{ accessPoint.id }}
                </div>
                <div v-if="isDefaultFileAccessPoint(accessPoint)" class="default-tag">default</div>
              </div>
              <div class="access-point-type">Type: {{ getFileAccessPointType(accessPoint) }}</div>
              <div class="access-point-setting" v-if="accessPoint.setting">
                <small>{{ formatSetting(accessPoint.setting) }}</small>
              </div>
            </div>
            <div class="access-point-actions">
              <button 
                @click="setAsDefaultFileAccessPoint(accessPoint.id)" 
                :disabled="isDefaultFileAccessPoint(accessPoint)" 
                :class="{ 'disabled': isDefaultFileAccessPoint(accessPoint) }"
                title="Set as default file access point"
              >Set Default</button>
              <button @click="moveAccessPointUp(index)" :disabled="index === 0" title="Move up">Up↑</button>
              <button @click="moveAccessPointDown(index)" :disabled="index === serverFileAccessPoints.length - 1"
                title="Move down"
              >Down↓</button>
              <button @click="startEditingAccessPoint(accessPoint)" class="edit-btn" title="Rename">Edit</button>
              <button @click="deleteAccessPoint(accessPoint.id)" class="delete-btn" title="Delete">Delete</button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="no-access-points">
        No file access points configured.
      </div>
    </div>

    <!-- Add/Edit File Access Point Form -->
    <div v-if="fileAccessPointEditing" class="edit-form">
      <h3>{{ fileAccessPointEditing.isNew ? 'Add' : 'Rename' }} File Access Point</h3>
      
      <div class="form-group">
        <label>Name:</label>
        <input 
          type="text" 
          v-model="fileAccessPointEditing.name"
          placeholder="Enter access point name"
          required
        />
      </div>
      
      <div class="form-group">
        <label>Type:</label>
        <select v-model="fileAccessPointEditing.type">
          <option value="local/internal">local/internal</option>
          <option value="local/external">local/external</option>
          <option value="local/external/time">local/external/time</option>
          <option value="local/external/id">local/external/id</option>
          <!-- Future types can be added here -->
          <!-- <option value="webdav">WebDAV</option> -->
          <!-- <option value="ftp">FTP</option> -->
        </select>
        <small v-if="fileAccessPointEditing">{{ getTypeDescription(fileAccessPointEditing.type) }}</small>
      </div>
      
      <div class="form-group">
        <label>Directory Path:</label>
        <input 
          type="text" 
          v-model="fileAccessPointEditing.dir_path_base"
          placeholder="/path/to/folder"
        />
        <small>Absolute path to the folder on the server. Different types organize files differently within this path.</small>
      </div>
      
      <div class="form-actions">
        <button @click="cancelEdit">Cancel</button>
        <button class="primary" @click="saveAccessPoint">{{ fileAccessPointEditing.isNew ? 'Add' : 'Save' }}</button>
      </div>
      
      <div v-if="editFormError" class="error-message">
        {{ editFormError }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useServerStore } from '@/stores/Server.js'

const serverStore = useServerStore()
import { storeToRefs } from 'pinia'
const {
  serverInfo,
  serverId,
  fileAccessPointDefaultId,
  isServerFileAccessPointsLoading,
  serverFileAccessPointsError,
  cacheSettingsServer
} = storeToRefs(serverStore)


const serverFileAccessPoints = computed(() => {
  return serverInfo.value?.file_access_points || []
})

const fileAccessPointEditing = ref(null)
const editFormError = ref('')

// Computed properties
const serverIdDisplay = computed(() => {
  return serverId || 'Loading...'
})
// Track the current server ID to prevent unnecessary reloads
const serverIdCurrent = ref(null)

// Load data when component mounts
onMounted(async () => {
  await loadFileAccessPoints()
})

// Watch for server settings changes, but avoid circular dependency
watch(cacheSettingsServer, async (newSettings, oldSettings) => {
  // Only reload if the current server ID actually changed
  if (newSettings && newSettings.current && newSettings.current !== oldSettings?.current) {
    console.log('Server changed, reloading file access points...')
    await loadFileAccessPoints()
  }
}, { immediate: false }) // Don't trigger immediately to avoid circular dependency

// Watch for serverId changes from serverInfo
watch(serverId, async (newServerId) => {
  // Only reload if the server ID actually changed and we haven't already loaded this server
  if (newServerId && newServerId !== serverIdCurrent.value) {
    console.log('Server ID changed, reloading file access points...')
    serverIdCurrent.value = newServerId
    // Only fetch if we don't already have data for this server
    if (!serverInfo.value?.file_access_points) {
      await loadFileAccessPoints()
    }
  }
}, { immediate: false })

async function loadFileAccessPoints() {
  try {
    // Use existing settings if available, don't trigger getSettingsServer unnecessarily
    if (!cacheSettingsServer.value?.current) {
      await serverStore.getSettingsServer()
    }
    
    // Get server info (includes ID and file access points)
    await serverStore.getThisServerInfo()
    
    // Update our tracking variable
    if (serverId.value) {
      serverIdCurrent.value = serverId.value
    }
  } catch (error) {
    console.error('Error loading file access points:', error)
  }
}

function getFileAccessPointType(accessPoint) {
  if (accessPoint.setting && accessPoint.setting.type) {
    return accessPoint.setting.type
  }
  return 'UNKNOWN' // default
}

function getTypeDescription(type) {
  switch (type) {
    case 'local/internal':
      return 'Internal storage - files stored directly in the specified directory'
    case 'local/external':
      return 'External storage - files organized in subdirectories within the specified path'
    case 'local/external/time':
      return 'External storage organized by timestamp - files grouped by date/time within subdirectories'
    case 'local/external/id':
      return 'External storage organized by ID - files grouped by unique identifiers within subdirectories'
    default:
      return 'Select a type to see description'
  }
}

function formatSetting(setting) {
  if (!setting) return ''
  
  // Handle legacy 'local' type with 'path' property
  if (setting.type === 'local' && setting.path) {
    return `Path: ${setting.path}`
  }
  
  // Handle new types with 'dir_path_base' property
  if (setting.type && setting.dir_path_base) {
    return `Path: ${setting.dir_path_base}`
  }
  
  return JSON.stringify(setting)
}

function startAddingAccessPoint() {
  fileAccessPointEditing.value = {
    id: null,
    name: '',
    type: 'local/internal',
    dir_path_base: '',
    isNew: true
  }
  editFormError.value = ''
}

function startEditingAccessPoint(accessPoint) {
  fileAccessPointEditing.value = {
    id: accessPoint.id,
    name: accessPoint.name || '',
    type: getFileAccessPointType(accessPoint),
    dir_path_base: accessPoint.setting?.dir_path_base || '',
    isNew: false
  }
  editFormError.value = ''
}

function cancelEdit() {
  fileAccessPointEditing.value = null
  editFormError.value = ''
}

// Helper function to ensure path ends with "/"
function ensurePathEndsWithSlash(path) {
  if (!path) return '/'
  return path.endsWith('/') ? path : path + '/'
}

async function saveAccessPoint() {
  editFormError.value = ''
  
  if (!fileAccessPointEditing.value.name || !fileAccessPointEditing.value.name.trim()) {
    editFormError.value = 'Please enter a name'
    return
  }

  // Ensure dir_path_base ends with "/"
  const normalizedPath = ensurePathEndsWithSlash(fileAccessPointEditing.value.dir_path_base || '/default/path')

  try {
    if (fileAccessPointEditing.value.isNew) { // Create new access point
      const setting = {
        type: fileAccessPointEditing.value.type,
        dir_path_base: normalizedPath
      }
      
      const result = await serverStore.createFileAccessPoint(
        fileAccessPointEditing.value.name.trim(),
        setting
      )
      
      if (!result.is_success) {
        editFormError.value = result.message || 'Failed to create access point'
        return
      }
    } else { // Update existing access point (name, type, and dir_path_base)
      const setting = {
        type: fileAccessPointEditing.value.type,
        dir_path_base: normalizedPath
      }
      // const nameResult = await serverStore.renameFileAccessPoint(
      const result = await serverStore.updateFileAccessPoint(
        fileAccessPointEditing.value.name.trim(),
        fileAccessPointEditing.value.id,
        fileAccessPointEditing.value.type,
        setting
      )
      
      if (!result.is_success) {
        editFormError.value = result.message || 'Failed to update access point'
        return
      }
    }
    
    fileAccessPointEditing.value = null
    editFormError.value = ''
  } catch (error) {
    console.error('Error saving access point:', error)
    editFormError.value = 'Error saving access point'
  }
}

async function deleteAccessPoint(accessPointId) {
  if (!confirm('Are you sure you want to delete this file access point?')) return
  
  try {
    const result = await serverStore.deleteFileAccessPoint(accessPointId)
    
    if (!result.is_success) {
      alert(result.message || 'Failed to delete access point')
    }
  } catch (error) {
    console.error('Error deleting access point:', error)
    alert('Error deleting access point')
  }
}

async function moveAccessPointUp(index) {
  const accessPoint = serverFileAccessPoints.value[index]
  const newIndex = index - 1
  // console.log('moveAccessPointUp() accessPoint:', accessPoint, 'newIndex:', newIndex)
  // console.log('moveAccessPointUp() serverFileAccessPoints:', serverFileAccessPoints.value)
  try {
    const result = await serverStore.changeFileAccessPointOrder(accessPoint.id, newIndex)
    
    if (!result.is_success) {
      alert(result.message || 'Failed to change order')
    }
  } catch (error) {
    console.error('Error moving access point:', error)
    alert('Error moving access point')
  }
}

async function moveAccessPointDown(index) {
  const accessPoint = serverFileAccessPoints.value[index]
  const newIndex = index + 2
  
  try {
    const result = await serverStore.changeFileAccessPointOrder(accessPoint.id, newIndex)
    
    if (!result.is_success) {
      alert(result.message || 'Failed to change order')
    }
  } catch (error) {
    console.error('Error moving access point:', error)
    alert('Error moving access point')
  }
}

// Check if an access point is the default one
function isDefaultFileAccessPoint(accessPoint) {
  // console.log('SettingsFileAccessPoint.isDefaultFileAccessPoint()', accessPoint.id, fileAccessPointDefaultId.value)
  // Check if this access point's ID matches the default ID in serverInfo
  return accessPoint.id === fileAccessPointDefaultId.value
}

// Set an access point as default
async function setAsDefaultFileAccessPoint(accessPointId) {
  // console.log('setAsDefaultFileAccessPoint() accessPointId:', accessPointId)
  try {
    const result = await serverStore.setFileAccessPointDefaultId(accessPointId)
    
    if (!result.is_success) {
      alert(result.message || 'Failed to set as default')
    }
  } catch (error) {
    console.error('Error setting default access point:', error)
    alert('Error setting default access point')
  }
}
</script>

<style scoped>
.server-info {
  font-size: 12px;
  color: #5f6368;
}

.server-id {
  background: #e8f0fe;
  padding: 2px 6px;
  border-radius: 3px;
}

.access-point-id {
  background: #e8f0fe;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #5f6368;
}

.default-tag {
  font-size: 12px;
  background: #34a853;
  color: white;
  padding: 1px 4px;
  border-radius: 2px;
}

.loading-message {
  text-align: center;
  padding: 20px;
  color: #5f6368;
}

.error-message-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-message {
  color: #ea4335;
  font-size: 14px;
  padding: 8px;
  background: #fce8e6;
  border-radius: 4px;
  flex: 1;
}

.refresh-btn {
  background: #ea4335 !important;
  color: white !important;
  border: none;
  padding: 4px 8px !important;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  flex-shrink: 0;
}

.refresh-btn:hover {
  background: #c5221f !important;
  opacity: 1;
}

.access-points-section {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-header h4 {
  margin: 0;
  color: #202124;
  font-size: 14px;
}

.add-btn {
  background: #1a73e8;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.add-btn:hover {
  background: #1557b0;
}

.access-points-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.access-point-item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px;
  background: #fafafa;
}

.access-point-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.access-point-info {
  flex: 1;
  min-width: 0;
}

.access-point-info-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
}

.access-point-name {
  font-weight: 500;
  font-size: 14px;
  color: #202124;
}

.access-point-type {
  font-size: 12px;
  color: #5f6368;
}

.access-point-setting {
  font-size: 11px;
  color: #5f6368;
}

.access-point-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.access-point-actions button {
  padding: 2px 4px;
  border: none;
  background: #f1f3f4;
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
  min-width: 20px;
  height: 20px;
}

.access-point-actions button:hover:not(:disabled) {
  background: #e8eaed;
}

.access-point-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-btn {
  background: #d5e4ff !important;
  color: #1a73e8;
}

.delete-btn {
  background: #fce8e6 !important;
  color: #ea4335;
}

.delete-btn:hover {
  background: #fdd7d4 !important;
}

.no-access-points {
  text-align: center;
  padding: 20px;
  color: #5f6368;
  font-style: italic;
}

label {
  display: block;
  margin-bottom: 4px;
  color: #5f6368;
  font-weight: 500;
  font-size: 13px;
}

input[type="text"], select {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

small {
  color: #5f6368;
  font-size: 11px;
  line-height: 1.3;
  display: block;
  margin-top: 2px;
}



.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  background: #f1f3f4;
  color: #5f6368;
}

button.primary {
  background: #1a73e8;
  color: white;
}

button:hover {
  opacity: 0.9;
}
</style>


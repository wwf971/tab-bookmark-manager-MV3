<template>
  <div class="modal-content" @click.stop>
    <div class="modal-header">
      <h3>URL Management</h3>
    </div>
    
    <!-- Current URL Display -->
    <div class="url-current-section">
      <h3>Current URL</h3>
      <div class="url-current-display" :class="{ 'invalid': !isUrlCurrentValid }">
        <span class="url-text">{{ urlCurrentDisplayText }}</span>
        <span class="url-status" v-if="!isUrlCurrentValid">⚠️ URL not found</span>
      </div>
    </div>

    <!-- Server Connection Status -->
    <div class="server-status-section">
      <div class="status-line">
        <button 
          class="ping-button" 
          :class="{ 'spinning': isPinging }"
          @click="testCurrentRemoteUrl" 
          :disabled="isPinging || !isUrlCurrentValid"
          :title="isUrlCurrentValid ? 'Test server connection' : 'No valid URL selected'"
        >
          {{ isPinging ? '⟳' : 'ping' }}
        </button>
        <button 
          class="logout-button" 
          @click="handleLogout" 
          :disabled="!isLoggedIn"
          title="logout"
        >
          LogOut
        </button>
        <div class="server-status">
          <div class="status-icon">{{ serverStatusIcon }}</div>
          <div class="status-text" @click="handleStatusClick" :class="{ 'clickable': isLoginRequired }">{{ serverStatusText }}</div>
        </div>
      </div>
    </div>

    <!-- URL Lists -->
    <div class="url-lists">
      <!-- Local URLs -->
      <div class="url-section">
        <div class="section-header">
          <h3>Local URLs</h3>
          <button class="add-btn" @click="startAddingUrl('local')">+ Add Local</button>
        </div>
        
        <div class="url-list">
          <div 
            v-for="(url, index) in localUrls" 
            :key="url.id"
            class="url-item"
            :class="{ 'current': url.id === remoteSettings.current }"
          >
            <div class="url-item-header">
            <div class="url-info" @click="setUrlCurrentId(url.id)">
                <div class="url-name">{{ url.name || '(No name)' }}</div>
              <div class="url-address">{{ url.url }}</div>
            </div>
            <div class="url-actions">
              <button @click="moveUrl('local', index, -1)" :disabled="index === 0">Up↑</button>
              <button @click="moveUrl('local', index, 1)" :disabled="index === localUrls.length - 1">Down↓</button>
              <button @click="startEditingUrl(url)" class="edit-btn">Edit</button>
              <button @click="deleteUrl(url.id)" class="delete-btn">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Remote URLs -->
      <div class="url-section">
        <div class="section-header">
          <h3>Remote URLs</h3>
          <button class="add-btn" @click="startAddingUrl('remote')">+ Add Remote</button>
        </div>
        
        <div class="url-list">
          <div 
            v-for="(url, index) in urlsRemote" 
            :key="url.id"
            class="url-item"
            :class="{ 'current': url.id === remoteSettings.current }"
          >
            <div class="url-item-header">
            <div class="url-info" @click="setUrlCurrentId(url.id)">
                <div class="url-name">{{ url.name || '(No name)' }}</div>
              <div class="url-address">{{ url.url }}</div>
            </div>
            <div class="url-actions">
              <button @click="moveUrl('remote', index, -1)" :disabled="index === 0">↑</button>
              <button @click="moveUrl('remote', index, 1)" :disabled="index === urlsRemote.length - 1">↓</button>
              <button @click="startEditingUrl(url)">✏️</button>
              <button @click="deleteUrl(url.id)" class="delete-btn">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit URL Form -->
    <div v-if="urlEditing" class="edit-form">
      <h3>{{ urlEditing.isNew ? 'Add' : 'Edit' }} {{ urlEditing.type === 'local' ? 'Local' : 'Remote' }} URL</h3>
      
      <div class="form-group">
        <label>Name (optional):</label>
        <input 
          type="text" 
          v-model="urlEditing.name"
          placeholder="Enter URL name (optional)"
        />
      </div>
      
      <div class="form-group">
        <label>URL (required):</label>
        <input 
          type="text" 
          v-model="urlEditing.url"
          placeholder="https://example.com:8080"
          required
        />
        <small>Example: https://example.com:8080 (no /url_pool/ or other paths)</small>
      </div>
      
      <div class="form-actions">
        <button @click="cancelEdit">Cancel</button>
        <button class="primary" @click="saveUrl">{{ urlEditing.isNew ? 'Add' : 'Save' }}</button>
      </div>
      
      <div v-if="editFormError" class="error-message">
        {{ editFormError }}
      </div>
    </div>
  </div>

  <!-- Login Modal -->
  <Login
    v-model="showLoginModal"
    :message="loginMessage"
    @loginSuccess="handleLoginSuccess"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import Login from '@/auth/Login.vue'

// local copy of settings
const remoteSettings = ref({
  url: {
    local: [],
    remote: []
  },
  current: null
})

const urlEditing = ref(null)
const editFormError = ref('')

// Login modal state
const showLoginModal = ref(false)
const loginMessage = ref('')

// Computed properties
const localUrls = computed(() => {
  try {
    const local = remoteSettings.value?.url?.local
    return Array.isArray(local) ? local : []
  } catch (error) {
    console.error('Error in localUrls computed:', error)
    return []
  }
})

const urlsRemote = computed(() => {
  try {
    const remote = remoteSettings.value?.url?.remote
    return Array.isArray(remote) ? remote : []
  } catch (error) {
    console.error('Error in urlsRemote computed:', error)
    return []
  }
})

const serverStatusCurrent = computed(() => {
  return serverStore.getServerStatusCurrent()
})

const serverStatusIcon = computed(() => {
  return serverStatusCurrent.value?.icon || '❓'
})

const serverStatusText = computed(() => {
  return serverStatusCurrent.value?.text || 'Untested'
})

const isPinging = computed(() => {
  return serverStatusCurrent.value?.isPinging || false
})

const isLoginRequired = computed(() => {
  return serverStatusCurrent.value?.requiresLogin || false
})

const isLoggedIn = computed(() => {
  return serverStore.isCurrentUrlLoggedIn()
})

const isUrlCurrentValid = computed(() => {
  try {
    if (!remoteSettings.value?.current) return false
  const allUrls = [...localUrls.value, ...urlsRemote.value]
    return allUrls.some(url => url && url.id === remoteSettings.value.current)
  } catch (error) {
    console.error('Error in isUrlCurrentValid computed:', error)
    return false
  }
})

const urlCurrentDisplayText = computed(() => {
  try {
    if (!remoteSettings.value?.current) return 'No URL selected'
  const allUrls = [...localUrls.value, ...urlsRemote.value]
    const urlCurrent = allUrls.find(url => url && url.id === remoteSettings.value.current)
    if (!urlCurrent) return `Missing URL (${remoteSettings.value.current})`
    
    // Handle empty names gracefully
    const displayName = urlCurrent.name || '(No name)'
    return `${displayName}: ${urlCurrent.url}`
  } catch (error) {
    console.error('Error in urlCurrentDisplayText computed:', error)
    return 'Error displaying URL'
  }
})

// Load settings when modal opens
onMounted(() => {
  loadSettingsServer()
})

// Watch for current URL changes and test connection
watch(() => remoteSettings.value.current, (newCurrentId, oldCurrentId) => {
  if (newCurrentId && newCurrentId !== oldCurrentId && isUrlCurrentValid.value) {
    // Auto-test when URL changes
    setTimeout(() => {
      serverStore.testServerConnection(newCurrentId)
    }, 100)
  }
})

import { useServerStore } from '@/network/Server.js'
const serverStore = useServerStore()

async function loadSettingsServer() {
  try {
    const settings = await serverStore.getSettingsServer()
    console.warn("RemoteSettings.vue: loadSettingsServer(): settings:", settings)

    remoteSettings.value = settings // Use the plain object directly
    console.log("RemoteSettings.vue: loadSettingsServer(): remoteSettings:", remoteSettings.value)
    
    // Ensure arrays exist and convert objects to arrays if necessary
    if (!remoteSettings.value.url) {
      remoteSettings.value.url = { local: [], remote: [] }
    }
    if (!Array.isArray(remoteSettings.value.url.local)) {
      console.warn("Converting local URLs to array:", remoteSettings.value.url.local)
      remoteSettings.value.url.local = []
    }
    if (!Array.isArray(remoteSettings.value.url.remote)) {
      console.warn("Converting remote URLs to array:", remoteSettings.value.url.remote)
      remoteSettings.value.url.remote = []
    }
    
    // Auto-test server connection after loading settings
    if (isUrlCurrentValid.value) {
      setTimeout(() => {
        testCurrentRemoteUrl()
      }, 100)
    }
  } catch (error) {
    console.error('Error loading URL settings:', error)
    // Set safe defaults on error
    remoteSettings.value = {
      url: {
        local: [],
        remote: []
      },
      current: null
    }
  }
}

function startAddingUrl(type) {
  urlEditing.value = {
    id: null,
    name: '',
    url: '',
    type,
    isNew: true
  }
  editFormError.value = ''
}

function startEditingUrl(url) {
  const type = localUrls.value.includes(url) ? 'local' : 'remote'
  urlEditing.value = {
    ...url,
    type,
    isNew: false
  }
  editFormError.value = ''
}

function cancelEdit() {
  urlEditing.value = null
  editFormError.value = ''
}

async function saveUrl() {
  editFormError.value = '' // Clear previous errors
  
  if (!urlEditing.value.url || !urlEditing.value.url.trim()) {
    editFormError.value = 'Please enter a URL'
    return
  }

  try {
    if (urlEditing.value.isNew) {
      const newUrl = await serverStore.addUrl(urlEditing.value.type, {
        name: urlEditing.value.name || '', // Allow empty name
        url: urlEditing.value.url.trim()
      })
      
      // If this is the first URL, make it current
      if (!remoteSettings.value.current) {
        remoteSettings.value.current = newUrl.id
        await serverStore.setUrlCurrentId(newUrl.id)
      }
    } else {
      await serverStore.updateUrl(urlEditing.value.id, {
        name: urlEditing.value.name || '', // Allow empty name
        url: urlEditing.value.url.trim()
      })
    }
    
    await loadSettingsServer() // Refresh the display
    urlEditing.value = null
    editFormError.value = '' // Clear error on success
  } catch (error) {
    console.error('Error saving URL:', error)
    editFormError.value = 'Error saving URL'
  }
}

async function deleteUrl(urlId) {
  if (!confirm('Are you sure you want to delete this URL?')) return
  
  try {
    await serverStore.deleteUrl(urlId)
    await loadSettingsServer() // Refresh the display
  } catch (error) {
    console.error('Error deleting URL:', error)
    // Could show a toast notification here instead of alert
  }
}

async function setUrlCurrentId(urlId) {
  // console.log("RemoteSettings.vue: setUrlCurrentId(): urlId:", urlId)
  try {
    remoteSettings.value.current = urlId
    await serverStore.setUrlCurrentId(urlId)
    // Connection test will be triggered by the watcher
  } catch (error) {
    console.error('Error setting current URL:', error)
  }
}

async function moveUrl(type, index, direction) {
  const urls = type === 'local' ? [...localUrls.value] : [...urlsRemote.value]
  const newIndex = index + direction
  
  if (newIndex < 0 || newIndex >= urls.length) return
  
  // Swap items
  [urls[index], urls[newIndex]] = [urls[newIndex], urls[index]]
  
  try {
    await serverStore.reorderUrls(type, urls)
    await loadSettingsServer() // Refresh the display
  } catch (error) {
    console.error('Error reordering URLs:', error)
  }
}

const handleLoginSuccess = async () => {
  // After successful login, re-test the connection
  if (isUrlCurrentValid.value && remoteSettings.value?.current) {
    await serverStore.testServerConnection(remoteSettings.value.current)
  }
}

async function testCurrentRemoteUrl() {
  if (!isUrlCurrentValid.value || !remoteSettings.value?.current) {
    return
  }

  await serverStore.testServerConnection(remoteSettings.value.current)
  
  // Check if login is required and show modal
  const status = serverStore.getServerStatusCurrent()
  console.log("RemoteSettings.vue: testCurrentRemoteUrl(): status:", status)
  if (status?.requiresLogin) {
    loginMessage.value = 'Login required to access server features'
    showLoginModal.value = true
  }
}

const handleStatusClick = () => {
  // If status shows login required, open the login modal
  if (isLoginRequired.value) {
    loginMessage.value = 'Login required to access server features'
    showLoginModal.value = true
  }
}

const handleLogout = async () => {
  try {
    const result = await serverStore.logoutFromServer()
    
    if (result.is_success) {
      console.log("RemoteSettings.vue: logout success")
      // Refresh server status after logout
      console.log("isUrlCurrentValid.value:", isUrlCurrentValid.value)
      console.log("remoteSettings.value?.current:", remoteSettings.value?.current)
      if (isUrlCurrentValid.value && remoteSettings.value?.current) {
        await serverStore.testServerConnection(remoteSettings.value.current)
      }
    }
  } catch (error) {
    console.error('Logout error:', error)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}



h3 {
  font-size: 16px;
}

.url-current-section {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
}

.url-current-display {
  padding: 4px;
  background: white;
  border-radius: 4px;
  border: 2px solid #e8f0fe;
}

.url-current-display.invalid {
  border-color: #ea4335;
  background: #fce8e6;
}

.url-text {
  font-family: monospace;
  word-break: break-all;
}

.url-status {
  color: #ea4335;
  font-weight: 500;
  margin-left: 10px;
}

.server-status{
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #e0e0e0;
  padding: 2px 4px;
  border-radius: 4px;
}

.server-status-section {
  padding: 6px;
  background: #f8f9fa;
  border-radius: 6px;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 16px;
  min-width: 24px;
  text-align: center;
}

.ping-button {
  background: #1a73e8;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  min-width: 32px;
  transition: all 0.2s;
}

.ping-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ping-button:not(:disabled):hover {
  background: #1557b0;
}

.ping-button.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.logout-button {
  background: #dc3545;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  min-width: 60px;
  transition: all 0.2s;
}

.logout-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logout-button:not(:disabled):hover {
  background: #c82333;
}

.status-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  flex: 1;
}

.status-text.clickable {
  cursor: pointer;
  transition: color 0.2s;
}

.status-text.clickable:hover {
  color: #1a73e8;
  text-decoration: underline;
}

.url-lists {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.url-section {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.url-list {
  max-height: 200px;
  overflow-y: auto;
}

.url-item {
  display: flex;
  flex-direction: column;
  padding: 4px;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.url-item:hover {
  background: #f8f9fa;
}

.url-item.current {
  border-color: #1a73e8;
  background: #e8f0fe;
}

.url-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.url-info {
  flex: 1;
  min-width: 0;
}

.url-name {
  font-weight: 500;
  margin-bottom: 2px;
  font-size: 14px;
}

.url-address {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
  word-break: break-all;
  line-height: 1.3;
}

.url-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.url-actions button {
  padding: 2px 4px;
  border: none;
  background: #f1f3f4;
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
  min-width: 20px;
  height: 20px;
}

.url-actions button:hover:not(:disabled) {
  background: #e8eaed;
}

.url-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-btn {
  background: #d5e4ff !important; /* light blue */
  color: #1a73e8; /* light blue */
}

.delete-btn {
  background: #fce8e6 !important;
  color: #ea4335;
}

.delete-btn:hover {
  background: #fdd7d4 !important;
}

.form-group {
  margin-bottom: 12px;
}

label {
  display: block;
  margin-bottom: 4px;
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 13px;
}

input[type="text"] {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

small {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.3;
  display: block;
  margin-top: 2px;
}

.form-actions{
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
  color: var(--text-secondary);
}

button.primary {
  background: #1a73e8;
  color: white;
}

button:hover {
  opacity: 0.9;
}

.error-message {
  color: #ea4335;
  font-size: 14px;
}


</style>

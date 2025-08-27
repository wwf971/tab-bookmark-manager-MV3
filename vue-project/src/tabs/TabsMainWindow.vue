<template>
  <div class="tabs-main-window">
    <!-- Left Sidebar: Session Groups -->
    <div class="session-sidebar">
      <!-- Open Sessions Group -->
      <div class="session-group" :class="{ 'current': sessionGroupNameCurrent === 'open' }">
        <div class="session-group-header">
          <div class="session-group-title">Open Windows</div>
          <div class="session-group-count">{{ openWindows.length }} window{{ openWindows.length !== 1 ? 's' : '' }}</div>
        </div>
        
        <div class="session-cards">
          <div 
            v-for="window in openWindows" 
            :key="window.id"
            class="session-card"
            :class="{ 'current': sessionCardIdCurrent === getSessionCardId(window.id) }"
            :data-session-card-id="getSessionCardId(window.id)"
            @click="selectSession('open', window.id)"
            @contextmenu="handleSessionContextMenu($event, window)"
          >
            <div class="session-card-content">
              <div class="session-card-name">
                {{ getSessionDisplayName(window.id) }}
              </div>
              <div class="session-card-count">
                {{ window.tabs.length }} tab{{ window.tabs.length !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Placeholder for future session groups -->
      <div class="session-group disabled" :class="{ 'current': sessionGroupNameCurrent === 'remote' }">
        <div class="session-group-header">
          <div class="session-group-title">Remote Sessions</div>
          <div class="session-group-count">Coming Soon</div>
        </div>
      </div>
      
      <div class="session-group disabled" :class="{ 'current': sessionGroupNameCurrent === 'local' }">
        <div class="session-group-header">
          <div class="session-group-title">Local Sessions</div>
          <div class="session-group-count">Coming Soon</div>
        </div>
      </div>
      
      <div class="session-group disabled" :class="{ 'current': sessionGroupNameCurrent === 'bookmarks' }">
        <div class="session-group-header">
          <div class="session-group-title">Bookmarks</div>
          <div class="session-group-count">Coming Soon</div>
        </div>
      </div>
    </div>

    <!-- Right Panel: Tab Content -->
    <div class="content-panel">
      <div class="content-header">
        <!-- Reserved for future use -->
      </div>
      
      <div class="content-body">
        <!-- Open Tabs Content -->
        <div v-if="sessionGroupNameCurrent === 'open'" class="tabs-content">
          <TabsOpen
            ref="tabsOpenRef"
            @tab-activated="$emit('tab-activated', $event)"
            @tab-closed="$emit('tab-closed', $event)"
            @show-context-menu="$emit('show-context-menu', $event)"
            @upload-single-tab="$emit('upload-single-tab', $event)"
            @upload-selected-tabs="$emit('upload-selected-tabs', $event)"
          />
        </div>
        
        <!-- Placeholder for other content types -->
        <div v-else class="placeholder-content">
          <div class="placeholder-message">
            This session type is not yet implemented
          </div>
        </div>
      </div>
    </div>

    <!-- Session Context Menu -->
    <div 
      v-if="contextMenu.show"
      class="session-context-menu"
      :style="{ 
        position: 'fixed',
        left: contextMenu.x + 'px',
        top: contextMenu.y + 'px',
        zIndex: 1000
      }"
    >
      <div class="context-menu-item" @click="handleRenameSession">
        <span class="context-menu-icon">✏️</span>
        <span class="context-menu-text">Rename Session</span>
      </div>
    </div>

    <!-- Rename Session Modal -->
    <SessionRenameModal
      :is-visible="renameModal.isVisible"
      :window-id="renameModal.windowId"
      :default-name="renameModal.defaultName"
      :current-nickname="renameModal.currentNickname"
      @close="closeRenameModal"
      @confirm="confirmRename"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useTabsOpen } from '@/stores/TabsOpen'
import { storeToRefs } from 'pinia'
import TabsOpen from '@/tab-browser/TabsOpen.vue'
import SessionRenameModal from './SessionRenameModal.vue'

// Define emits
const emit = defineEmits([
  'tab-activated', 
  'tab-closed', 
  'show-context-menu', 
  'upload-single-tab', 
  'upload-selected-tabs'
])

// Use TabsOpen store
const tabsOpenStore = useTabsOpen()
const { sessionsOpen, windowCurrentId, tabsOpenNumTotal, isLoading } = storeToRefs(tabsOpenStore)
const { setSessionNickname, getSessionNickname, getSessionDisplayName } = tabsOpenStore

// Refs
const tabsOpenRef = ref(null)

// focused session tracking
const sessionGroupNameCurrent = ref('open') // current session group name
const sessionCardIdCurrent = ref(null) // current session card id

// Generate unique session card IDs
const sessionCardIds = ref(new Map()) // windowId -> sessionCardId

// Function to get or generate session card ID
const getSessionCardId = (windowId) => {
  if (!sessionCardIds.value.has(windowId)) {
    sessionCardIds.value.set(windowId, `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  }
  return sessionCardIds.value.get(windowId)
}

// Context menu and modal state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  window: null
})

const renameModal = ref({
  isVisible: false,
  windowId: null,
  defaultName: '',
  currentNickname: ''
})

// Computed
const openWindows = computed(() => sessionsOpen.value || [])

// Methods
const selectSession = async (type, id) => {
  // Update session group and card tracking
  sessionGroupNameCurrent.value = type
  sessionCardIdCurrent.value = getSessionCardId(id)
  
  if (type === 'open' && tabsOpenRef.value) {
    // Wait for next tick to ensure DOM is updated
    await nextTick()
    tabsOpenRef.value.scrollToWindow(id)
  }
}



// Context menu methods
const handleSessionContextMenu = (event, window) => {
  event.preventDefault()
  
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    window: window
  }
}

const closeContextMenu = () => {
  contextMenu.value.show = false
}

const handleRenameSession = () => {
  const window = contextMenu.value.window
  if (!window) return
  
  const defaultName = window.id === windowCurrentId.value ? 'Current Window' : `Window ${window.id}`
  
  renameModal.value = {
    isVisible: true,
    windowId: window.id,
    defaultName: defaultName,
    currentNickname: getSessionNickname(window.id) || ''
  }
  
  closeContextMenu()
}

const closeRenameModal = () => {
  renameModal.value.isVisible = false
}

const confirmRename = (data) => {
  setSessionNickname(data.windowId, data.nickname)
  closeRenameModal()
}

// Click outside to close context menu
const handleClickOutside = (event) => {
  if (contextMenu.value.show) {
    const menuElement = document.querySelector('.session-context-menu')
    if (!menuElement || !menuElement.contains(event.target)) {
      closeContextMenu()
    }
  }
}

// Watch for window changes and auto-select current window if nothing is selected
watch(openWindows, (newWindows) => {
  if (newWindows.length > 0 && !sessionCardIdCurrent.value) {
    // Auto-select current window if available, otherwise first window
    const currentWindow = newWindows.find(w => w.id === windowCurrentId.value)
    const targetWindow = currentWindow || newWindows[0]
    selectSession('open', targetWindow.id)
  }
}, { immediate: true })

// Watch for visible window changes from scroll monitoring  
watch(() => tabsOpenRef.value?.windowIdVisible, (newWindowId) => {
  if (newWindowId && sessionGroupNameCurrent.value === 'open') {
    // Update current session card to match visible window
    sessionCardIdCurrent.value = getSessionCardId(newWindowId)
    console.log('TabsMainWindow: Updated current session card based on scroll, windowId:', newWindowId)
  }
})

// Initialize on mount
onMounted(async () => {
  // Initialize TabsOpen store if needed
  if (!isLoading.value && openWindows.value.length === 0) {
    await tabsOpenStore.initTabsOpen()
  }
  
  // Add click outside listener
  document.addEventListener('click', handleClickOutside)
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Expose methods for parent components
defineExpose({
  selectSession,
})
</script>

<style scoped>
.tabs-main-window {
  display: flex;
  height: 100%;
  width: 100%;
  background-color: #f8f9fa;
  gap: 1px;
}

/* Left Sidebar */
.session-sidebar {
  width: 280px;
  background-color: white;
  border-right: 1px solid #e1e3e1;
  overflow-y: auto;
  flex-shrink: 0;
}

.session-group {
  border-bottom: 1px solid #e1e3e1;
}

.session-group.current {
  background-color: #e8f0fe;
  border-left: 3px solid #1a73e8;
}

.session-group.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.session-group-header {
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e1e3e1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-group-title {
  font-size: 14px;
  font-weight: 600;
  color: #202124;
}

.session-group-count {
  font-size: 12px;
  color: var(--text-secondary);
  background-color: #e8f0fe;
  padding: 2px 8px;
  border-radius: 12px;
}

.session-cards {
  padding: 8px;
}

.session-card {
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e1e3e1;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: white;
}

.session-card:hover {
  border-color: #1a73e8;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.2);
}

.session-card.current {
  border-color: #1a73e8;
  background-color: #e8f0fe;
  box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
}

.session-card-content {
  display: flex;
  flex-direction: row;
  gap: 4px;
}

.session-card-name {
  font-size: 14px;
  font-weight: 500;
  color: #202124;
  line-height: 1.2;
}

.session-card-count {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Right Panel */
.content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
  overflow: hidden;
}

.content-header {
  padding: 16px;
  border-bottom: 1px solid #e1e3e1;
  background-color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.content-title {
  font-size: 18px;
  font-weight: 600;
  color: #202124;
}

.content-stats {
  font-size: 14px;
  color: var(--text-secondary);
}

.content-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tabs-content {
  flex: 1;
  overflow: hidden;
}

.placeholder-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-message {
  font-size: 16px;
  color: var(--text-secondary);
  text-align: center;
}

/* Override TabsOpen styles when embedded */
.tabs-content :deep(.tabs-open-container) {
  height: 100% !important;
}

.tabs-content :deep(.tabs-open-header) {
  display: none; /* Hide the header since we have our own */
}

.tabs-content :deep(.windows-container) {
  height: 100%;
  padding: 8px;
}

/* Add data attribute for window containers to enable scrolling */
.tabs-content :deep(.window-container[data-window-id]) {
  scroll-margin-top: 20px;
}

/* Context Menu Styles */
.session-context-menu {
  background: white;
  border: 1px solid #dadce0;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 160px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.context-menu-item:hover {
  background-color: #f1f3f4;
}

.context-menu-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.context-menu-text {
  font-size: 14px;
  color: #202124;
}
</style>

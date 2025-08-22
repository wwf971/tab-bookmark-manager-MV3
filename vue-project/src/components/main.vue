<template>
  <div class="main-container">
    <!-- Top Tab Bar -->
    <div class="tabs-bar">
      <div class="tabs-list">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          class="tab-button"
          :class="{ active: tabActive === tab.id }"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Content Panels -->
    <div class="content-container">
      <!-- Tab Manager Panel -->
      <div v-show="tabActive === 'tabs'" class="content-panel">
        <TabManager />
      </div>

      <!-- Notes Panel -->
      <div v-show="tabActive === 'notes_search'" class="content-panel">
        <NoteSearch />
      </div>

      <!-- Notes Panel -->
      <div v-show="tabActive === 'notes_display'" class="content-panel">
        <Note />
      </div>

      <!-- Bookmarks Panel -->
      <div v-show="tabActive === 'bookmarks'" class="content-panel">
        <BookmarksLocal />
      </div>

      <!-- Bibliography Panel -->
      <div v-show="tabActive === 'bibliography'" class="content-panel">
        <Bibliography />
      </div>

      <!-- Settings Panel -->
      <div v-show="tabActive === 'settings'" class="content-panel">
        <Settings
          :visible="showSettings"
          @close="onSettingsTabClose"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TabManager from './TabManager.vue'
import Note from './note/Note.vue'
import NoteSearch from './note/NoteSearch.vue'
import Settings from '@/setting/Settings.vue'
import Bibliography from './bib.vue'
import BookmarksLocal from '@/boomark/BookmarksLocal.vue'


// tabs at topmost
const tabs = [
  { id: 'tabs', label: 'Tab Manager' },
  { id: 'notes_search', label: 'Notes Search' },
  { id: 'notes_display', label: 'Notes Display' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'bibliography', label: 'Bibliography' },
  { id: 'settings', label: 'Settings' }
]

// State
const tabActive = ref('tabs')
const showSettings = ref(false)

// Methods
const switchTab = (tabId) => {
  tabActive.value = tabId
  if (tabId === 'settings') {
    showSettings.value = true
  }
}

const onSettingsTabClose = () => {
  showSettings.value = false
  tabActive.value = 'tabs'
}

import { useServerStore } from '../stores/Server'
const serverStore = useServerStore()
onMounted(() => {
  serverStore.getSettingsServer(false)
  serverStore.getThisServerInfo()
})

</script>

<style scoped>
.main-container {
  width: 100%;
  height: 100vh;
  background-color: #fafbfc;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tabs-bar {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 0;
  flex-shrink: 0;
}

.tabs-list {
  display: flex;
  padding: 0 16px;
  gap: 0;
}

.tab-button {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #5f6368;
  height: 36px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  position: relative;
}

.tab-button:hover {
  background: #f1f3f4;
  color: #374151;
}

.tab-button.active {
  color: #1a73e8;
  border-bottom-color: #1a73e8;
  background: white;
}

.content-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

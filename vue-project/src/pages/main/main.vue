<template>
  <div class="main-container">
    <TabsAndPanelsLR
      title="Tab Manager"
      default-tab="tabs"
      sidebar-width="220px"
      @tab-change="onTabChange"
      @subtab-change="onSubtabChange"
    >
      <!-- Tab Manager -->
      <TabSlot id="tabs" label="Tab Manager" :hasSubtabs="false" vueDisplayMethod="v-show">
        <PanelSlot>
          <TabManager />
        </PanelSlot>
      </TabSlot>

      <!-- Notes Search -->
      <TabSlot id="notes_search" label="Notes Search" :hasSubtabs="false" vueDisplayMethod="v-show">
        <PanelSlot>
          <NoteSearch />
        </PanelSlot>
      </TabSlot>

      <!-- Notes Display -->
      <TabSlot id="notes_display" label="Notes Display" :hasSubtabs="false" vueDisplayMethod="v-show">
        <PanelSlot>
          <Note />
        </PanelSlot>
      </TabSlot>

      <!-- Bookmarks -->
      <TabSlot id="bookmarks" label="Bookmarks" :hasSubtabs="false" vueDisplayMethod="v-show">
        <PanelSlot>
          <BookmarksLocal />
        </PanelSlot>
      </TabSlot>

      <!-- Bibliography -->
      <TabSlot id="bibliography" label="Bibliography" :hasSubtabs="false" vueDisplayMethod="v-show">
        <PanelSlot>
          <Bibliography />
        </PanelSlot>
      </TabSlot>

      <!-- Settings -->
      <TabSlot id="settings" label="Settings" :hasSubtabs="false" vueDisplayMethod="v-show">
        <PanelSlot>
          <Settings
            @close="onSettingsTabClose"
          />
        </PanelSlot>
      </TabSlot>

      <!-- Test Tab with Subtabs -->
      <TabSlot id="test" label="Test" :hasSubtabs="true" vueDisplayMethod="v-show">
        <SubTabSlot id="test_server_connect" label="Server Connection" vueDisplayMethod="v-show">
          <PanelSlot>
            <TestServerConnect />
          </PanelSlot>
        </SubTabSlot>
      </TabSlot>
    </TabsAndPanelsLR>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TabsAndPanelsLR, { TabSlot, SubTabSlot, PanelSlot } from '@/layout/TabsAndPanelsLR.vue'
import TabManager from '@/tabs/TabsManager.vue'
import Note from '@/note/Note.vue'
import NoteSearch from '@/note/NoteSearch.vue'
import Settings from '@/settings/Settings.vue'
import Bibliography from '@/bib/bib.vue'
import BookmarksLocal from '@/bookmark/BookmarksLocal.vue'
import TestServerConnect from '@/network/TestServerConnect.vue'

// methods
const onTabChange = (tabId) => {
  console.log('main.vue: onTabChange:', tabId)
}

const onSubtabChange = (subtabId) => {
  console.log('main.vue: onSubtabChange:', subtabId)
}

const onSettingsTabClose = () => {
  // note: we don't need to switch tabs here since the layout handles it
}

import { useServerStore } from '@/network/Server.js'
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
  overflow: hidden;
}

.content-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

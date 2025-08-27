<template>
  <div class="controls">
    <button 
      class="btn btn-primary"
      @click="toggleTabMode"
    >
      Current Page Location: {{ tabModeText }}
    </button>
  </div>

</template>

<script setup>
import { ref, computed } from 'vue'
const tabModeText = computed(() => {
  switch (tabMode.value) {
    case 0: return 'Free'
    case 1: return 'Always First'
    case 2: return 'Always Last'
    default: return 'Free'
  }
})


const tabMode = ref(0) // 0: Free, 1: Always First, 2: Always Last
const toggleTabMode = () => {
  tabMode.value = (tabMode.value + 1) % 3
  applyTabMode()
}


const applyTabMode = async () => {
  if (tabMode.value === 0) return

  const windowCurrent = await chrome.windows.getCurrent()
  const tabs = await chrome.tabs.query({ windowId: windowCurrent.id })
  const activeTab = tabs.find(tab => tab.active)

  if (!activeTab) return

  switch (tabMode.value) {
    case 1: // Always first
      if (tabs[0].id !== activeTab.id) {
        await chrome.tabs.move(activeTab.id, { index: 0 })
      }
      break
    case 2: // Always last
      if (tabs[tabs.length - 1].id !== activeTab.id) {
        await chrome.tabs.move(activeTab.id, { index: -1 })
      }
      break
  }
}


</script>

<style scoped>
.btn-primary {
  background-color: #1a73e8;
  color: white;
}

.btn-primary:hover {
  background-color: #1557b0;
}
</style>
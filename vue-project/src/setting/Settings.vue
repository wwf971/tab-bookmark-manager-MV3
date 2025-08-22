<template>
  <div class="settings-modal" @click.stop>
    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-button"
        :class="{ active: activeTab === tab.id }"
        @click="switchTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Local Settings -->
      <div v-show="activeTab === 'local'" class="modal-content">
        <div class="modal-header">
          <h3>Local Storage Settings</h3>
        </div>
        <div class="settings-items">
          <div
            v-for="setting in settingsList"
            :key="setting.name"
            class="setting-item"
          >
            <SettingsCheckbox
              v-if="setting.displayType === 'checkbox'"
              :value="localValues[setting.name]"
              :label="setting.name"
              :disabled="loadingStates[`local_${setting.name}`]"
              @update:value="updateLocalSetting(setting.name, $event)"
            />
          </div>
        </div>
      </div>

      <!-- Synced Settings -->
      <div v-show="activeTab === 'synced'" class="modal-content">
        <h3>Synced Storage Settings</h3>
        <div class="settings-items">
          <div
            v-for="setting in settingsList"
            :key="setting.name"
            class="setting-item"
          >
            <SettingsCheckbox
              v-if="setting.displayType === 'checkbox'"
              :value="syncedValues[setting.name]"
              :label="setting.name"
              :disabled="loadingStates[`synced_${setting.name}`]"
              @update:value="updateSyncedSetting(setting.name, $event)"
            />
          </div>
        </div>
      </div>
      <!-- Computed Settings -->
      <div v-show="activeTab === 'computed'" class="modal-content">
        <h3>Computed Settings</h3>
        <div class="settings-items">
          <div
            v-for="setting in settingsList"
            :key="setting.name"
            class="setting-item"
          >
            <div class="computed-setting">
              <div class="setting-name">{{ setting.name }}</div>
              <div class="computed-value">
                <span class="value-text" :class="{ 'value-null': settingsComputed[setting.name] === null }">
                  {{ settingsComputed[setting.name] === null ? 'null' : String(settingsComputed[setting.name]) }}
                </span>
                <span class="value-source">
                  (from {{ settingsComputedSource[setting.name] || 'unknown' }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Remote Server Url Settings Modal -->
      <SettingsRemote/>
    
      <!-- Remote Server File Access Point -->
      <SettingsFileAccessPoint/>
    
    </div>
    <!-- Error Display -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>

</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useSettingStore } from '@/stores/Settings'
import { storeToRefs } from 'pinia'
import SettingsCheckbox from './SettingsCheckbox.vue'
import SettingsRemote from './SettingsRemote.vue'
import SettingsFileAccessPoint from './SettingsFileAccessPoint.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

// Get settings list from store
const settingsList = computed(() => settingStore.settingsList)

// Tab configuration
const tabs = [
  { id: 'local', label: 'Local' },
  { id: 'synced', label: 'Synced' },
  { id: 'computed', label: 'Computed' }
]

// State
const activeTab = ref('local')
const localValues = reactive({})
const syncedValues = reactive({})


const loadingStates = reactive({})
const errorMessage = ref('')

// Store
const settingStore = useSettingStore()
const { settingsComputed, settingsComputedSource } = storeToRefs(settingStore)

// Initialize settings
onMounted(async () => {
  await settingStore.initSetting()
  await loadAllSettings()
  // Set up storage listeners to detect changes
  settingStore.setupStorageListeners()
})

// Load all settings from storage
const loadAllSettings = async () => {
  for (const setting of settingsList.value) {
    await loadSetting(setting.name)
  }
}

// Load a specific setting
const loadSetting = async (settingName) => {
  try {
    // Load local value
    const localResult = await settingStore.getSettingLocal(settingName)
    if (localResult.is_success) {
      localValues[settingName] = localResult.value
    }

    // Load synced value
    const syncedResult = await settingStore.getSettingSynced(settingName)
    if (syncedResult.is_success) {
      syncedValues[settingName] = syncedResult.value
    }

    // Load computed value
    const computedResult = await settingStore.getSettingComputed(settingName, null)
    if (computedResult.is_success) {
      settingsComputed[settingName] = computedResult.value
      settingsComputedSource[settingName] = computedResult.source
    }
  } catch (error) {
    console.error(`Error loading setting ${settingName}:`, error)
    setErrorMessage(`Error loading setting ${settingName}: ${error.message}`)
  }
}

// Update local setting
const updateLocalSetting = async (settingName, newValue) => {
  const settingKey = `local_${settingName}`
  loadingStates[settingKey] = true
  clearError()

  try {
    const result = await settingStore.setSettingLocal(settingName, newValue)
    
    if (result.is_success) {
      localValues[settingName] = result.valNew
      // Refresh computed value since it might have changed
      await settingStore.refreshSettingComputed(settingName)
    } else {
      setErrorMessage(`Failed to update local setting: ${result.message}`)
      // Revert to current value on failure
      localValues[settingName] = result.valCurrent
    }
  } catch (error) {
    setErrorMessage(`Error updating local setting: ${error.message}`)
  } finally {
    loadingStates[settingKey] = false
  }
}

// Update synced setting
const updateSyncedSetting = async (settingName, newValue) => {
  const settingKey = `synced_${settingName}`
  loadingStates[settingKey] = true
  clearError()

  try {
    const result = await settingStore.setsettingsSynced(settingName, newValue)
    
    if (result.is_success) {
      syncedValues[settingName] = result.valNew
      // Refresh computed value since it might have changed
      await settingStore.refreshSettingComputed(settingName)
    } else {
      setErrorMessage(`Failed to update synced setting: ${result.message}`)
      // Revert to current value on failure
      syncedValues[settingName] = result.valCurrent
    }
  } catch (error) {
    setErrorMessage(`Error updating synced setting: ${error.message}`)
  } finally {
    loadingStates[settingKey] = false
  }
}

// Tab switching
const switchTab = (tabId) => {
  activeTab.value = tabId
}

// Error handling
const setErrorMessage = (message) => {
  errorMessage.value = message
  setTimeout(clearError, 5000) // Clear error after 5 seconds
}

const clearError = () => {
  errorMessage.value = ''
}


</script>

<style scoped>

.settings-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  align-self: center;
  max-width: 800px;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.tab-navigation {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 24px;
}

.tab-button {
  background: none;
  border: none;
  padding: 6px 12px;
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #374151;
}

.tab-button.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-content {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}


.settings-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  overflow: hidden;
}

.computed-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.setting-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.computed-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.value-text {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: #f3f4f6;
  color: #6b7280;
  min-width: 40px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.value-null {
  text-decoration: line-through;
  background-color: #f9fafb;
  color: #9ca3af;
}

.value-source {
  font-size: 12px;
  color: #9ca3af;
  font-style: italic;
}

.error-message {
  background-color: #fef2f2;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 8px;
  margin: 16px 24px;
  border: 1px solid #fecaca;
  font-size: 14px;
}


</style>

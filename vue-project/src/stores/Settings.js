/*
priority:
    local storage <-- synced storage <-- default value
*/

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'



import axios from 'axios'
// Create an axios instance with default config
const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true  // Enable session cookies
});

// // DEBUG. request interceptor.
// axiosInstance.interceptors.request.use(
//   (config) => {
//     console.log('📤 Request:', {
//       url: config.url,
//       method: config.method,
//       withCredentials: config.withCredentials,
//       headers: config.headers
//     });
//     return config;
//   },
//   (error) => {
//     console.error('Request error:', error);
//     return Promise.reject(error);
//   }
// );

// axiosInstance.interceptors.response.use(
//   (response) => {
//     console.log('📥 Response:', {
//       url: response.config.url,
//       status: response.status,
//       headers: response.headers,
//       setCookie: response.headers['set-cookie']
//     });
//     return response;
//   },
//   (error) => {
//     console.error('Response error:', {
//       url: error.config?.url,
//       status: error.response?.status,
//       data: error.response?.data,
//       headers: error.response?.headers
//     });
//     return Promise.reject(error);
//   }
// );

export const useSettingStore = defineStore('settings', () => {
  // Reactive state to hold current settings
  const settingsLocal = ref({})
  const settingsSynced = ref({})
  const settingsComputed = ref({})
  const settingsComputedSource = ref({})
  const settingsServer = ref({})

  // Hard-coded settings list
  const settingsList = [
    {
      name: 'fetchAllRemoteTabsOnInit',
      dataType: 'bool',
      displayType: 'checkbox'
    }
  ]
  
  // Initialize settings from storage
  const initSetting = async () => {
    if(process.env.VUE_APP_IS_DEV){
      console.log("initSetting(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
      return;
    }

    try {
      const localData = await chrome.storage.local.get()
      const syncedData = await chrome.storage.sync.get()
      
      settingsLocal.value = localData || {}
      settingsSynced.value = syncedData || {}
    } catch (error) {
      console.error('Error initializing settings:', error)
    }
  }

  // Store setting in local storage
  const setSettingLocal = async (name, value) => {
    if(process.env.VUE_APP_IS_DEV){
      console.log("setSettingLocal(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
      return;
    }
    try {
      const valOld = settingsLocal.value[name]
      await chrome.storage.local.set({ [name]: value })
      settingsLocal.value[name] = value
      refreshSettingComputed(name)
      return { is_success: true, valNew: value, valOld }
    } catch (error) {
      console.error('Error setting local setting:', error)
      return { is_success: false, message: error.message, valCurrent: settingsLocal.value[name] }
    }
  }

  // Extract setting from local storage
  const getSettingLocal = async (name) => {
    if(process.env.VUE_APP_IS_DEV){
      console.log("getSettingLocal(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
      return {is_success: true, value: null};
    }
    try {
      // Check cache first
      if (name in settingsLocal.value) {
        return { is_success: true, value: settingsLocal.value[name] }
      }
      
      // If not in cache, get from storage and update cache
      const result = await chrome.storage.local.get([name])
      const value = result[name]
      if (value !== undefined) {
        settingsLocal.value[name] = value
      }
      return { is_success: true, value }
    } catch (error) {
      console.error('Error getting local setting:', error)
      return { is_success: false, message: error.message, value: null }
    }
  }

  // Store setting in synced storage
  const setSettingSynced = async (name, value) => {
    if(process.env.VUE_APP_IS_DEV){
      console.log("setSettingSynced(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
      return;
    }
    try {
      const valOld = settingsSynced.value[name]
      await chrome.storage.sync.set({ [name]: value })
      settingsSynced.value[name] = value
      refreshSettingComputed(name)
      return { is_success: true, valNew: value, valOld }
    } catch (error) {
      console.error('Error setting synced setting:', error)
      return { is_success: false, message: error.message, valCurrent: settingsSynced.value[name] }
    }
  }

  // Extract setting from synced storage
  const getSettingSynced = async (name) => {
    if(process.env.VUE_APP_IS_DEV){
      console.log("getSettingSynced(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
      return {is_success: true, value: null};
    }
    try {
      // Check cache first
      if (name in settingsSynced.value) {
        return { is_success: true, value: settingsSynced.value[name] }
      }
      
      // If not in cache, get from storage and update cache
      const result = await chrome.storage.sync.get([name])
      const value = result[name]
      if (value !== undefined) {
        settingsSynced.value[name] = value
      }
      return { is_success: true, value }
    } catch (error) {
      console.error('Error getting synced setting:', error)
      return { is_success: false, message: error.message, value: null }
    }
  }

  // Change setting entry name in both local and synced storage
  const renameSetting = async (oldName, newName) => {
    try {
      let hasChanges = false
      
      // Handle local storage
      const localResult = await getSettingLocal(oldName)
      if (localResult.is_success && localResult.value !== null && localResult.value !== undefined) {
        const setResult = await setSettingLocal(newName, localResult.value)
        if (setResult.is_success) {
          await chrome.storage.local.remove([oldName])
          delete settingsLocal.value[oldName]
          hasChanges = true
        }
      }
      
      // Handle synced storage
      const syncedResult = await getSettingSynced(oldName)
      if (syncedResult.is_success && syncedResult.value !== null && syncedResult.value !== undefined) {
        const setResult = await setSettingSynced(newName, syncedResult.value)
        if (setResult.is_success) {
          await chrome.storage.sync.remove([oldName])
          delete settingsSynced.value[oldName]
          hasChanges = true
        }
      }
      
      return { is_success: true, hasChanges }
    } catch (error) {
      console.error('Error renaming setting:', error)
      return { is_success: false, message: error.message, hasChanges: false }
    }
  }

  // Refresh computed value for a setting
  const refreshSettingComputed = async (settingName) => {
    console.error('refreshSettingComputed: ', settingName)
    try {
      const computedResult = await getSettingComputed(settingName, null)
      if (computedResult.is_success) {
        console.log(`about to change settingComputed[${settingName}] from ${settingsComputed.value[settingName]} to ${computedResult.value}`)
        settingsComputed.value[settingName] = computedResult.value
        settingsComputedSource.value[settingName] = computedResult.source

      }else{
        console.error(`refreshSettingComputed: ${settingName} failed. message: ${computedResult.message}`)
      }
    } catch (error) {
      console.error(`Error refreshing computed value for ${settingName}:`, error)
    }
  }

  // Get computed value with priority: local (if exists and not null) > synced (if exists and not null) > default
  const getSettingComputed = async (name, valDefault = null) => {
    try {
      // Check local cache first
      if (name in settingsLocal.value) {
        const valLocal = settingsLocal.value[name]
        if (valLocal !== null && valLocal !== undefined) {
          return { is_success: true, value: valLocal, source: 'local' }
        }
      }
      
      // Check synced cache next
      if (name in settingsSynced.value) {
        const valSynced = settingsSynced.value[name]
        if (valSynced !== null && valSynced !== undefined) {
          return { is_success: true, value: valSynced, source: 'synced' }
        }
      }
      
      // If not in cache, try to get from storage
      const localResult = await getSettingLocal(name)
      if (localResult.is_success && localResult.value !== null && localResult.value !== undefined) {
        return { is_success: true, value: localResult.value, source: 'local' }
      }
      
      const syncedResult = await getSettingSynced(name)
      if (syncedResult.is_success && syncedResult.value !== null && syncedResult.value !== undefined) {
        return { is_success: true, value: syncedResult.value, source: 'synced' }
      }
      
      // Return default value if nothing found
      return { is_success: true, value: valDefault, source: 'default' }
    } catch (error) {
      console.error('Error getting computed setting:', error)
      return { is_success: false, message: error.message, value: valDefault, source: 'error' }
    }
  }

  // Get computed setting as a reactive computed property
  const createSettingComputed = (name, valDefault = null) => {
    return computed(() => {
      // Check local storage first
      const valLocal = settingsLocal.value[name]
      if (valLocal !== null && valLocal !== undefined) {
        return valLocal
      }
      
      // Check synced storage next
      const valSynced = settingsSynced.value[name]
      if (valSynced !== null && valSynced !== undefined) {
        return valSynced
      }
      
      // Return default value if nothing found
      return valDefault
    })
  }

  // Delete setting from both storages
  const deleteSetting = async (name) => {
    try {
      const valOldLocal = settingsLocal.value[name]
      const valOldSynced = settingsSynced.value[name]
      
      await chrome.storage.local.remove([name])
      await chrome.storage.sync.remove([name])
      delete settingsLocal.value[name]
      delete settingsSynced.value[name]
      
      return { is_success: true, deletedLocal: valOldLocal, deletedSynced: valOldSynced }
    } catch (error) {
      console.error('Error deleting setting:', error)
      return { is_success: false, message: error.message }
    }
  }

  // Clear all settings from both storages
  const clearAllSetting = async () => {
    try {
      const clearedLocal = { ...settingsLocal.value }
      const clearedSynced = { ...settingsSynced.value }
      
      await chrome.storage.local.clear()
      await chrome.storage.sync.clear()
      settingsLocal.value = {}
      settingsSynced.value = {}
      
      return { is_success: true, clearedLocal, clearedSynced }
    } catch (error) {
      console.error('Error clearing all settings:', error)
      return { is_success: false, message: error.message }
    }
  }

  // Get all settings as computed object
  const allSetting = computed(() => ({
    local: { ...settingsLocal.value },
    synced: { ...settingsSynced.value }
  }))

  // Set up storage change listeners
  const setupStorageListeners = () => {
    if(process.env.VUE_APP_IS_DEV){
      console.log("setupStorageListeners(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
      return;
    }
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          for (const [key, { newValue }] of Object.entries(changes)) {
            if (newValue !== undefined) {
              settingsLocal.value[key] = newValue
            } else {
              delete settingsLocal.value[key]
            }
          }
        } else if (areaName === 'sync') {
          for (const [key, { newValue }] of Object.entries(changes)) {
            if (newValue !== undefined) {
              settingsSynced.value[key] = newValue
            } else {
              delete settingsSynced.value[key]
            }
          }
        }
      })
    }
  }

  return {
    // State
    settingsLocal,
    settingsSynced,
    settingsComputed,
    settingsComputedSource,
    allSetting,
    settingsList,
    
    // Actions
    initSetting,
    setSettingLocal,
    getSettingLocal,
    setSettingSynced,
    getSettingComputed,
    createSettingComputed,
    refreshSettingComputed,
    getSettingSynced,
    renameSetting,

    deleteSetting,
    clearAllSetting,
    setupStorageListeners,
  }
})

import { defineStore } from 'pinia'
import { ref, computed, reactive, watch } from 'vue'
import { useNetworkRequest } from './NetworkRequest'
import { useTabsSearch } from './TabsSearch'
import { useSettingStore } from './Settings'
import { storeToRefs } from 'pinia'
import {
  removeTabRemote,
  uploadTabToRemote,
  uploadTabsToRemote,
  fetchTabsRemoteFromServer as _fetchTabsRemoteFromServer,
  searchTabsRemoteByTags as _searchTabsRemoteByTags
} from './TabsRemoteRequest.js'
import { useServerStore } from '@/stores/Server.js'

import axios from 'axios'

// create an axios instance with default config (same as NetworkRequest)
const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true  // Enable session cookies
});

export const useTabsRemote = defineStore('tabsRemote', () => {
  const networkRequest = useNetworkRequest()
  const tabsSearchStore = useTabsSearch()
  const settingStore = useSettingStore()
  const { settingsComputed } = storeToRefs(settingStore)

  // remote tabs
  const sessionsRemote = ref({}) // { sessionId: { name: string, tabs: { tabId: { url, text, time_create, isUiSelected, ... } } } }
  // recent remote tabs - using array for simpler iteration
  const tabsRemoteRecent = ref([]) // Array of tab objects
  
  // if false, fetch tabs only during search
  const isFetchAllTabsFromRemoteOnInit = ref(false) // its value come from Settings.js

  // switch to fetchAllTabsMode: all remote tabs from remote server --load into--> sessionsRemote
  const initFetchAllTabsMode = async () => {
    try {
      const result = await settingStore.getSettingComputed('fetchAllRemoteTabsOnInit', false)
      if (result.is_success) {
        isFetchAllTabsFromRemoteOnInit.value = result.value || false
      }
    } catch (error) {
      console.error('Error initializing fetchAllRemoteTabsOnInit setting:', error)
      isFetchAllTabsFromRemoteOnInit.value = false
    }
  }

  watch(settingsComputed, (newVal) => {
    let fetchAllRemoteTabsOnInitNew = newVal['fetchAllRemoteTabsOnInit']
    // console.log(`TabsRemote: fetchAllRemoteTabsOnInit: changed from ${isFetchAllTabsFromRemoteOnInit.value} to ${fetchAllRemoteTabsOnInitNew}`)
    if(fetchAllRemoteTabsOnInitNew !== isFetchAllTabsFromRemoteOnInit.value){
      // console.log('TabsRemote: fetchAllRemoteTabsOnInit setting changed to:', newVal)
    }else{
      return;
    }
    console.log(`TabsRemote.vue: fetchAllRemoteTabsOnInit setting changed to: ${fetchAllRemoteTabsOnInitNew}`)
    initFetchAllTabsMode()
  }, { deep: true })

  watch(isFetchAllTabsFromRemoteOnInit, (newVal, oldVal) => {

    // change mode if isFetchAllTabsFromRemoteOnInit changes
    console.log('TabsRemote: Mode changed to:', newVal ? 'Fetch All Tabs' : 'Search Only')
    
    if (newVal) {
      // Switching to fetch all tabs mode
      console.log('TabsRemote: Switching to Fetch All Tabs mode')
      // Clear any existing search-only data and load all tabs
      clearCache()
      loadRemoteTabs(true)
    } else {
      // Switching to search only mode
      console.log('TabsRemote: Switching to Search Only mode')
      // Clear the full tabs list since we're now in search mode
      clearCache()
    }
  })

  // user-selected tabs
  const tabsRemoteUiSelected = []

  // fast lookup map for tab objects (tabId -> { tab, sessionId })
  const tabsMapRemote = ref(new Map())
  
  // session position tracking for scroll monitoring
  const sessionPositions = ref(new Map()) // sessionId -> { top: number, height: number }
  
  // filter mode and state
  const isFilterMode = ref(false)
  const filterList = ref([]) // array of active filters: ['all', 'recent']
  const hasRecentTabsBeenFetched = ref(false) // track if recent tabs have been fetched

  // loading state
  const isSessionsRemoteLoaded = ref(false)
  const isSessionsRemoteLoading = ref(false)
  const lastError = ref(null)

  // computed
  const sessionRemoteTabNumTotal = computed(() => {
    return Object.values(sessionsRemote.value).reduce((total, sessionTabs) => {
      return total + Object.keys(sessionTabs.tabs || {}).length
    }, 0)
  })

  const sessionsRemoteNum = computed(() => {
    return Object.keys(sessionsRemote.value).length
  })


  const fetchTabsRemoteRecent = async (num = 50) => {
    try {
      const serverStore = useServerStore()
      const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
      if (!serverUrlResult.is_success) {
        console.error('TabsRemote.fetchTabsRemoteRecent() error:', serverUrlResult.message)
        return []
      }
      const serverUrl = serverUrlResult.data
      
      const response = await axiosInstance.post(serverUrl, {
        task: 'get_recent_url_cache_id',
        limit: num
      })
      
      const result = response.data
      console.log('fetchTabsRemoteRecent(): response.data(tab ids):', result)
      if (result.is_success && result.data) {
        // result.data is a list of IDs, not full tab objects
        const tabsRemoteRecentIds = result.data
        // console.log('fetchTabsRemoteRecent(): tabsMapRemote(before):', tabsMapRemote)
        
        // Ensure tabsMapRemote is ready before using it
        if (tabsMapRemote.value.size === 0 && isSessionsRemoteLoaded.value) {
          // console.log('fetchTabsRemoteRecent(): tabsMapRemote is empty, updating it first')
          updateTabsMapRemote()
        }
        
        // console.log('fetchTabsRemoteRecent(): tabsMapRemote(after):', tabsMapRemote)
        // Clear and rebuild tabsRemoteRecent with references to existing tabs
        tabsRemoteRecent.value.length = 0
        let foundCount = 0
        let notFoundCount = 0
        
        tabsRemoteRecentIds.forEach(tabId => {
          // Use fast lookup map instead of iterating through all lists
          const tabInfo = tabsMapRemote.value.get(tabId)
          // console.log(`fetchTabsRemoteRecent(): tabId: ${tabId}, tabInfo:`, tabInfo)
          if (tabInfo) {
            // Directly push the tabInfo which contains { tab, sessionId }
            tabsRemoteRecent.value.push(tabInfo.tab)
            foundCount++
          } else {
            notFoundCount++
            if (!isFetchAllTabsFromRemoteOnInit) {
              // In search-only mode, it's normal for tabs to not be in cache
              console.log(`fetchTabsRemoteRecent(): Tab with ID ${tabId} not found in tabsMapRemote (search-only mode)`)
            } else {
              console.warn(`fetchTabsRemoteRecent(): Tab with ID ${tabId} not found in tabsMapRemote`)
            }
          }
        })
        console.log(`fetchTabsRemoteRecent(): Found ${foundCount}/${tabsRemoteRecentIds.length} tabs (${notFoundCount} not in cache)${!isFetchAllTabsFromRemoteOnInit ? ' - search-only mode' : ''}`)
        // console.log(`Fetched ${tabsRemoteRecent.value.length} recent tabs from ${tabsRemoteRecentIds.length} IDs`)
      } else {
        console.error('Failed to fetch recent tabs:', result.message)
      }
      
      return result
    } catch (error) {
      console.error('Error fetching recent tabs:', error)
      throw error
    }
  }

  const loadRemoteTabs = async (forceRefresh = false) => {
    // Check if we're in search-only mode
    if (!isFetchAllTabsFromRemoteOnInit.value) {
      console.log('TabsRemote: In search-only mode, not fetching all tabs')
      return { is_success: false, message: 'In search-only mode' }
    }
    
    // Prevent concurrent requests
    if (isSessionsRemoteLoading.value && !forceRefresh) {
      return { is_success: false, message: 'Already loading' }
    }

    lastError.value = null
    isSessionsRemoteLoading.value = true

    try {
      // first ensure remote settings are loaded
      const serverStore = useServerStore()
      try {
        await serverStore.getSettingsServer()
      } catch (settingsError) {
        console.warn('Failed to load remote settings:', settingsError)
        lastError.value = 'Failed to load remote settings. Please check your configuration.'
        isSessionsRemoteLoading.value = false
        return { is_success: false, message: lastError.value }
      }
      
      // then check if URL is configured
      const urlCurrent = serverStore.getUrlCurrent()
      if (!urlCurrent) {
        lastError.value = 'No server URL configured. Please configure in Remote Settings.'
        isSessionsRemoteLoading.value = false
        return { is_success: false, message: lastError.value }
      }

      // Check server connection/authentication status
      const status = serverStore.getServerStatusCurrent()
      if (!status || Date.now() - (status.lastChecked || 0) > 30000) {
        await serverStore.testServerConnection(urlCurrent.id)
      }

      const currentStatus = serverStore.getServerStatusCurrent()
      if (currentStatus?.type === 'error') {
        lastError.value = `Server connection error: ${currentStatus.text}`
        isSessionsRemoteLoading.value = false
        return { is_success: false, message: lastError.value }
      }

      if (currentStatus?.requiresLogin) {
        lastError.value = 'Login required. Please login in the Upload Tab first.'
        isSessionsRemoteLoading.value = false
        return { is_success: false, message: lastError.value }
      }

      // Load regular tabs first, then recent tabs
      const result = await _fetchTabsRemoteFromServer('', forceRefresh)
  
      if (result.is_success && result.data) {
        // Process the data to add isUiSelected property and rename urls to tabs
        const processedData = {}
        Object.entries(result.data).forEach(([sessionId, sessionTabs]) => {
          processedData[sessionId] = {
            ...sessionTabs,
            tabs: {}
          }
          
          // Process each URL/tab and add isUiSelected property
          Object.entries(sessionTabs.urls || {}).forEach(([tabId, tab]) => {
            processedData[sessionId].tabs[tabId] = reactive({
              ...tab,
              isUiSelected: false // Initialize selection state
            })
          })
        })
        
        sessionsRemote.value = processedData
        isSessionsRemoteLoaded.value = true
        lastError.value = null
        
        // Update the fast lookup map
        updateTabsMapRemote()
        
        // Clear selected tabs when reloading (since tab objects are new)
        tabsRemoteUiSelected.length = 0
        
        // now load recent tabs after the map is populated
        await fetchTabsRemoteRecent(50)
      } else {
        lastError.value = result.message || 'Failed to fetch remote tabs'
      }
      return result
    } catch (err) {
      console.error('Error loading remote tabs:', err)
      lastError.value = `Network error: ${err.message || 'Failed to connect to server'}`
      return { is_success: false, message: lastError.value }
    } finally {
      isSessionsRemoteLoading.value = false
    }
  }

  const removeTabRemoteFromLocalCache = (tab, refreshTabsRemoteRecent=false, removeFromSearchResults=true) => {
    console.warn(`removeTabRemoteFromLocalCache(): tabId: ${tab.id}. about to remove from panel`)
    
    // Store the tab reference for search store notification
    const removedTab = tab
    
    // Find and remove the tab from local sessionsRemote
    for (const [sessionId, sessionTabs] of Object.entries(sessionsRemote.value)) {
      const tabs = sessionTabs.tabs || {}
      for (const [tabId, tabData] of Object.entries(tabs)) {
        if (tabId === tab.id) {
          delete tabs[tabId]
          // Remove from fast lookup map
          tabsMapRemote.value.delete(tabId)
    
          // Also remove from recent tabs if it exists there
          const recentIndex = tabsRemoteRecent.value.findIndex(recentTab => 
            recentTab.url === tab.url || recentTab.text === tab.text || recentTab.id === tabId
          )
          if (recentIndex > -1) {
            tabsRemoteRecent.value.splice(recentIndex, 1)
          }
          console.log(`Removed tab ${tabId} from list ${sessionId}`)
          if(refreshTabsRemoteRecent){
          // Refresh recent tabs from server
            fetchTabsRemoteRecent(50)
          }
          if(removeFromSearchResults){
            // Notify search store about the removed tab
            tabsSearchStore.onTabsRemoteRemoved([removedTab])
          }
          return
        }
      }
    }
  }

  const onTabsOpenUploadedToRemote = async (tabsRemoteCreated) => {
    console.log('onTabsOpenUploadedToRemote(): Processing', tabsRemoteCreated.length, 'uploaded tabs')
    
    try {
      // Instead of refreshing all data from server, add tabs locally for efficiency
      tabsRemoteCreated.forEach((tabRemote, index) => {
        // TODO: if tabRemote.session_id is a newly created list, not in sessionsRemote
          // we'll need to create a new list in sessionsRemote
        // Add to the list specified by the server response
        addTabRemoteInLocal(tabRemote.session_id, tabRemote)
        console.log(`onTabsOpenUploadedToRemote(): Added tab "${tabRemote.text || tabRemote.title || 'Untitled'}" to list "${tabRemote.session_id}"`)
      })
      
      // Only refresh recent tabs to show the newly uploaded tabs in the virtual window
      // This is a lightweight request compared to refreshing all tabs
      await fetchTabsRemoteRecent(50)
      
      console.log('onTabsOpenUploadedToRemote(): Successfully added tabs locally and refreshed recent tabs')
      
    } catch (error) {
      console.error('onTabsOpenUploadedToRemote(): Error updating local remote data after upload:', error)
      
      // Fallback: if local update fails, do a full refresh
      console.log('onTabsOpenUploadedToRemote(): Falling back to full refresh due to error')
      try {
        await loadRemoteTabs(true)
        await fetchTabsRemoteRecent(50)
      } catch (fallbackError) {
        console.error('onTabsOpenUploadedToRemote(): Fallback refresh also failed:', fallbackError)
      }
    }
    
    // Mark uploaded tabs as selected to notify the user (outside try-catch)
    tabsRemoteCreated.forEach((tabRemote) => {
      const sessionId = tabRemote.session_id
      const tabId = tabRemote.id
      
      // Find the tab in sessionsRemote and mark it as selected
      if (sessionsRemote.value[sessionId] && sessionsRemote.value[sessionId].tabs[tabId]) {
        const tabRemote = sessionsRemote.value[sessionId].tabs[tabId]
        // const tabRemote = tabInfo.tab
        console.log(`onTabsOpenUploadedToRemote(): tabRemote:`, tabRemote)
        tabRemote.isUiSelected = true
        // Add to the selected tabs tracking array
        if (!tabsRemoteUiSelected.includes(tabRemote)) {
          tabsRemoteUiSelected.push(tabRemote)
        }
      }
    })
    console.log('onTabsOpenUploadedToRemote(): Selected uploaded tabs for user notification')
  }
  const addTabRemoteInLocal = (sessionId, tabData) => {
    if (!sessionsRemote.value[sessionId]) {
      sessionsRemote.value[sessionId] = { name: `List ${sessionId}`, tabs: {} }
    }
    
    const tabId = tabData.id || `tab_${Date.now()}`
    sessionsRemote.value[sessionId].tabs[tabId] = reactive({
      ...tabData,
      isUiSelected: false,
      // Ensure we have proper title fields for display
      text: tabData.text || tabData.title || 'Untitled',
      title: tabData.title || tabData.text || 'Untitled'
    })
    
    // Update the fast lookup map
    tabsMapRemote.value.set(tabId, { 
      tab: sessionsRemote.value[sessionId].tabs[tabId], 
      sessionId 
    })
    
    console.log(`addTabRemoteInLocal(): Added tab "${tabData.text || tabData.title || 'Untitled'}" to list "${sessionId}"`)
    
    // Don't refresh recent tabs here as it's called from onTabsOpenUploadedToRemote which already does it
    // fetchTabsRemoteRecent(50)
  }

  const updateTabInLocal = (tabId, updatedData) => {
    for (const [sessionId, sessionTabs] of Object.entries(sessionsRemote.value)) {
      if (sessionTabs.tabs && sessionTabs.tabs[tabId]) {
        sessionsRemote.value[sessionId].tabs[tabId] = { ...sessionTabs.tabs[tabId], ...updatedData }
        return
      }
    }
  }

  const clearCache = () => {
    sessionsRemote.value = {}
    tabsRemoteRecent.value.length = 0
    isSessionsRemoteLoaded.value = false
    isSessionsRemoteLoading.value = false
    lastError.value = null
  }

  const forceRefresh = async () => {
    clearCache()
    return await loadRemoteTabs(true)
  }

  // Methods to manage selected tabs for efficient clearing
  const addToTabsRemoteSelected = (tab) => {
    if (!tabsRemoteUiSelected.includes(tab)) {
      tabsRemoteUiSelected.push(tab)
    }
  }

  const removeFromSelectedTabs = (tab) => {
    const index = tabsRemoteUiSelected.indexOf(tab)
    if (index > -1) {
      tabsRemoteUiSelected.splice(index, 1)
    }
  }

  const clearSelectedTabs = () => {
    // Efficiently clear all selected tabs
    tabsRemoteUiSelected.forEach(tab => {
      tab.isUiSelected = false
    })
    tabsRemoteUiSelected.length = 0
  }

  // Helper methods for filtering and organizing data
  const getTabsByList = (sessionId) => {
    const sessionTabs = sessionsRemote.value[sessionId]
    if (!sessionTabs || !sessionTabs.tabs) return []
    
    return Object.entries(sessionTabs.tabs).map(([tabId, tab]) => ({
      ...tab,
      tabId,
      sessionId,
      listName: sessionTabs.name || `List ${sessionId}`
    }))
  }

  const getTabsByDateRange = (startDate, endDate) => {
    const start = startDate instanceof Date ? startDate.getTime() : startDate
    const end = endDate instanceof Date ? endDate.getTime() : endDate
    
    return tabsRemoteRecent.value.filter(tab => {
      const tabTime = tab.time_create
      return tabTime >= start && tabTime <= end
    })
  }

  const getTabsUploadedToday = () => {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1
    
    return getTabsByDateRange(startOfDay, endOfDay)
  }

  const getTabsUploadedThisWeek = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek).getTime()
    const endOfWeek = startOfWeek + 7 * 24 * 60 * 60 * 1000 - 1
    
    return getTabsByDateRange(startOfWeek, endOfWeek)
  }

  // update the fast lookup map when sessionsRemote changes
  const updateTabsMapRemote = () => {
    tabsMapRemote.value.clear()
    Object.entries(sessionsRemote.value).forEach(([sessionId, sessionTabs]) => {
      Object.entries(sessionTabs.tabs || {}).forEach(([tabId, tab]) => {
        tabsMapRemote.value.set(tabId, { tab, sessionId })
      })
    })
    console.log(`updateTabsMapRemote(): Updated map with ${tabsMapRemote.value.size} tabs`)
  }
  // method for composable to call (alias for updateTabsMapRemote)
  const updateTabsMap = () => {
    updateTabsMapRemote()
  }
  
  // session position tracking methods
  const setSessionPositions = (positions) => {
    sessionPositions.value = positions
  }
  
  const getSessionPositions = () => {
    return sessionPositions.value
  }
  
  // filter matching logic
  const matchesFilter = (tab, sessionId) => {
    if (filterList.value.length === 0 || filterList.value.includes('all')) {
      return true
    }
    
    return filterList.value.some(filter => {
      switch (filter) {
        case 'recent':
          // Check if tab is in the recent tabs list
          return tabsRemoteRecent.value.some(recentTab => recentTab.id === tab.id)
        default:
          return false
      }
    })
  }
  
  // filtered sessions based on filter mode and criteria
  const sessionsRemoteFiltered = computed(() => {
    if (!isFilterMode.value || filterList.value.length === 0 || filterList.value.includes('all')) {
      return sessionsRemote.value || {}
    }
    
    const filtered = {}
    Object.entries(sessionsRemote.value || {}).forEach(([sessionId, sessionTabs]) => {
      const filteredTabs = {}
      Object.entries(sessionTabs.tabs || {}).forEach(([tabId, tab]) => {
        if (matchesFilter(tab, sessionId)) {
          filteredTabs[tabId] = tab
        }
      })
      
      // Only include lists that have matching tabs
      if (Object.keys(filteredTabs).length > 0) {
        filtered[sessionId] = {
          ...sessionTabs,
          tabs: filteredTabs
        }
      }
    })
    
    return filtered
  })
  
  // handle filter changes and fetch recent tabs if needed
  const handleFilterChange = async (newFilters) => {
    // Check if 'recent' is being activated for the first time
    const wasRecentActive = filterList.value.includes('recent')
    const isRecentBecomingActive = newFilters.includes('recent') && !wasRecentActive
    
    filterList.value = newFilters
    isFilterMode.value = newFilters.length > 0 && !newFilters.includes('all')
    
    // Fetch recent tabs if 'recent' is activated for the first time
    if (isRecentBecomingActive && !hasRecentTabsBeenFetched.value) {
      console.log('TabsRemote store: Fetching recent tabs for the first time')
      try {
        await fetchTabsRemoteRecent(50)
        hasRecentTabsBeenFetched.value = true
      } catch (error) {
        console.error('TabsRemote store: Error fetching recent tabs:', error)
      }
    }
  }


  const searchTabsRemoteByTags = async (tags_id = []) => {
    try {
      const result = await _searchTabsRemoteByTags(tags_id)
      if (result.is_success) {
        // Process and cache the search results
        const searchResults = result.data || []
        const cachedTabs = cacheSearchResults(searchResults)
        return { is_success: true, data: cachedTabs }
      } else {
        console.error('Error searching remote tabs by tags:', result.message)
        return { is_success: false, message: result.message }
      }
    } catch (error) {
      console.error('Error searching remote tabs by tags:', error)
      return { is_success: false, message: error.message }
    }
  }
  // search by querying remote server for text / tags_id
  const searchTabsRemote = async (searchParams) => {
    const { text, tags_id = [] } = searchParams
    
    // If only tags are provided (no text), use tag search
    if (!text && tags_id.length > 0) {
      return await searchTabsRemoteByTags(tags_id)
    }
    // If text is provided (with or without tags), use text search
    else if (text) {
      return await searchTabsRemoteByTypeTextTags(text, tags_id)
    }
    console.warn('searchTabsRemote(): no text or tags provided')
    console.warn('searchTabsRemote(): text:', text)
    console.warn('searchTabsRemote(): tags_id:', tags_id)
    // If neither text nor tags are provided, return empty results
    return { is_success: true, data: [] }
  }

  const searchTabsRemoteByTypeTextTags = async (text, tags_id = []) => {
    try {
      const result = await networkRequest.searchTabsRemoteByTypeTextTags(text, tags_id)

      if (result.is_success) {
        // Process and cache the search results
        const searchResults = result.data || []
        const cachedTabs = cacheSearchResults(searchResults)
        return { is_success: true, data: cachedTabs }
      } else {
        console.error('Error searching remote tabs by text:', result.message)
        return { is_success: false, message: result.message }
      }
    } catch (error) {
      console.error('Error searching remote tabs by text:', error)
      return { is_success: false, message: error.message }
    }
  }


  // Helper function to cache search results in sessionsRemote
  const cacheSearchResults = (results) => {
    if (!Array.isArray(results)) {
      console.warn('cacheSearchResults: results is not an array:', results)
      return
    }

    // Group results by their actual list IDs
    const resultsByListId = {}
    
    results.forEach((tab, index) => {
      const sessionId = tab.session_id || 'default'
      if (!resultsByListId[sessionId]) {
        resultsByListId[sessionId] = []
      }
      resultsByListId[sessionId].push(tab)
    })

    // Process each list and add tabs to existing sessionsRemote structure
    const cachedTabs = []
    
    for (const [sessionId, tabsData] of Object.entries(resultsByListId)) {
      // Ensure the list exists in sessionsRemote
      if (!sessionsRemote.value[sessionId]) {
        sessionsRemote.value[sessionId] = {
          name: `List ${sessionId}`,
          tabs: {},
          cached_at: Date.now()
        }
      }
      
      // Add each tab to the existing list
      tabsData.forEach((tab, index) => {
        // Use the actual tab ID from server response - don't create artificial IDs
        const tabId = tab.id
        if (!tabId) {
          console.warn('cacheSearchResults: Tab missing ID, skipping:', tab)
          return
        }
        
        const transformedTab = {
          id: tabId,
          url: tab.url,
          text: tab.text || tab.title || 'No title',
          icon: tab.icon || null,
          time_create: tab.time_create || Date.now(),
          tags_id: tab.tags_id || [],
          tags_name: tab.tags_name || [],
          isUiSelected: false,
          sessionId: sessionId,
          ...tab
        }
        
        // Add to sessionsRemote
        sessionsRemote.value[sessionId].tabs[tabId] = transformedTab
        
        // Collect reference to the cached tab
        cachedTabs.push(sessionsRemote.value[sessionId].tabs[tabId])
      })
      
      // Update the cached_at timestamp for this list
      sessionsRemote.value[sessionId].cached_at = Date.now()
    }

    // Update the fast lookup map
    updateTabsMapRemote()
    
    // Mark as loaded
    isSessionsRemoteLoaded.value = true
    
    console.log(`TabsRemote: Cached ${results.length} remote tabs across ${Object.keys(resultsByListId).length} lists`)
    
    // Return references to the cached tabs
    return cachedTabs
  }

  return {
    // State
    sessionsRemote,
    isSessionsRemoteLoaded,
    isSessionsRemoteLoading,
    lastError,
    tabsRemoteUiSelected,
    tabsRemoteRecent,
    tabsMapRemote,

    // Computed
    sessionRemoteTabNumTotal,
    sessionsRemoteNum,

    // Methods
    loadRemoteTabs,
    fetchTabsRemoteRecent,
    removeTabRemote,
    removeTabRemoteFromLocalCache,
    addTabRemoteInLocal,
    updateTabInLocal,
    clearCache,
    forceRefresh,

    // Methods to manage selected tabs for efficient clearing
    addToTabsRemoteSelected,
    removeFromSelectedTabs,
    clearSelectedTabs,

    // Helper methods
    getTabsByList,
    getTabsByDateRange,
    getTabsUploadedToday,
    getTabsUploadedThisWeek,

    // New method
    onTabsOpenUploadedToRemote,

    // New method
    updateTabsMap,
    
    // Session position tracking
    sessionPositions,
    setSessionPositions,
    getSessionPositions,
    
    // Filter mode
    isFilterMode,
    filterList,
    sessionsRemoteFiltered,
    matchesFilter,
    handleFilterChange,
    hasRecentTabsBeenFetched,
    
    // Search methods
    searchTabsRemote,
    searchTabsRemoteByTags,
    searchTabsRemoteByTypeTextTags,
    cacheSearchResults,
    
    // Mode management
    isFetchAllTabsFromRemoteOnInit,
    initFetchAllTabsMode
  }
})

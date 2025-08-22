import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useTabsSelect } from './TabsSelect'

export const useTabsOpen = defineStore('tabsOpen', () => {
  // Get select store instance
  const tabsSelectStore = useTabsSelect()
  // State
  const tabsOpenWindows = ref([]) // Array of windows, each with tabs array containing isUiSelected property
  const currentWindowId = ref(null)
  
  // Simple history structure: windowId -> { active: [tab], selected: [tabs], recent: [tabs] }
  // All arrays contain references to actual tab objects from tabsOpenWindows
  const tabsOpenHistory = ref(new Map()) // windowId -> { active: [tab], selected: [tabs], recent: [tabs] }
  const isLoading = ref(false)
  const lastError = ref(null)
  
  // Track user-selected tabs for operations (tab objects, not IDs)
  const tabsOpenUiSelected = []
  
  // Fast lookup map for tab objects (tabId -> { tab, windowId })
  const tabsMapOpen = ref(new Map())
  
  // Constants
  const MAX_RECENT_TABS = 20

  // Computed
  const totalTabs = computed(() => {
    return tabsOpenWindows.value.reduce((sum, window) => sum + window.tabs.length, 0)
  })

  const currentWindow = computed(() => {
    return tabsOpenWindows.value.find(w => w.id === currentWindowId.value)
  })

  // Methods
  const loadTabsAndWinOpen = async () => {
    console.log('loadTabsAndWinOpen().')
    console.warn('process.env.VUE_APP_IS_DEV:', process.env.VUE_APP_IS_DEV)
    isLoading.value = true
    lastError.value = null
    if(process.env.VUE_APP_IS_DEV){
      console.log("winHistory:", tabsOpenHistory.value)
      console.log("tabsOpenWindows:", tabsOpenWindows.value)
      return;
    }

    try {
      const [allWindows, currentWin] = await Promise.all([
        chrome.windows.getAll({ populate: true }),
        chrome.windows.getCurrent()
      ])
      
      // console.log('loadTabsAndWinOpen(): Loaded', allWindows.length, 'windows, current window:', currentWin.id)
      
      // Initialize tabs and history structure
      allWindows.forEach(window => {
        const tabActive = window.tabs.find(tab => tab.active)
        // console.log(`loadTabsAndWinOpen(): Window ${window.id} has ${window.tabs.length} tabs, active tab:`, tabActive?.id)
        
        // Set active/last active properties on each tab
        window.tabs.forEach(tab => {
          // Ensure tab has required properties
          tab.isActive = tabActive?.id === tab.id
          tab.isLastActive = false  // Will be set when active changes
          tab.isBrowserSelected = tab.highlighted || false  // Chrome's highlighted property
          // Ensure isUiSelected property exists (TabsSelect store manages this, but provide default)
          if (tab.isUiSelected === undefined) {
            tab.isUiSelected = false
          }
        })
        
        // Initialize history structure for this window
        initWinHistoryIfNotExist(window.id)
        const winHistory = tabsOpenHistory.value.get(window.id)
        
        // Set active tab
        if (tabActive) {
          winHistory.active = [tabActive]
          winHistory.recent = [tabActive]
          // console.log(`loadTabsAndWinOpen(): Window ${window.id} - set active tab:`, tabActive.id)
        }
      })
      
      tabsOpenWindows.value = allWindows
      currentWindowId.value = currentWin.id
      
      // Update the fast lookup map
      updateTabsMapOpen()
      
    } catch (error) {
      console.error('Error loading windows and tabs:', error)
      lastError.value = error.message
    } finally {
      isLoading.value = false
    }
  }

  // Initialize history structure for a window
  const initWinHistoryIfNotExist = (windowId) => {
    if (!tabsOpenHistory.value.has(windowId)) {
      tabsOpenHistory.value.set(windowId, { active: [], selected: [], recent: [] })
    }
  }

  // Update active tab for a window
  const onTabOpenActivated = (activeInfo) => {
    const { tabId, windowId } = activeInfo
    const tabInfo = tabsMapOpen.value.get(tabId) // Use fast lookup map to get the tab object
    // console.log('onTabOpenActivated(). tab:', tabInfo.tab)
    if (!tabInfo) {
      console.log(`onTabOpenActivated(): Tab ${tabId} not found in tabsMapOpen`)
      return
    }
    const tabActive = tabInfo.tab
    // Initialize window history if needed
    initWinHistoryIfNotExist(tabInfo.windowId)
    const winHistory = tabsOpenHistory.value.get(tabInfo.windowId)

    // Get the previous active tab BEFORE updating the history
    const tabActivePrev = winHistory.recent[0]
    if(!tabActivePrev){
      console.error('onTabOpenActivated(): tabActivePrev:', tabActivePrev)
    }else{
      // console.log('onTabOpenActivated(): tabActivePrev:', tabActivePrev)
      tabActivePrev.isActive = false;
      tabActivePrev.isLastActive = true;
    }

    const tabActivePrevPrev = winHistory.recent[1]
    if(tabActivePrevPrev){
      tabActivePrevPrev.isLastActive = false;
    }

    winHistory.active = [tabActive]
    // Add to recent tabs (move to front if already exists)
    const tabActiveIndex = winHistory.recent.findIndex(tab => tab.id === tabId)
    if (tabActiveIndex > -1) { winHistory.recent.splice(tabActiveIndex, 1)}
    winHistory.recent.unshift(tabActive)

    // Keep only MAX_RECENT_TABS
    if (winHistory.recent.length > MAX_RECENT_TABS) {
      winHistory.recent.splice(MAX_RECENT_TABS)
    }
    tabActive.isActive = true;
    tabActive.isLastActive = false;
  }

  // Update browser selection state (highlighted tabs)
  const updateBrowserSelection = async () => {
    if(process.env.VUE_APP_IS_DEV){
      // console.log("updateBrowserSelection(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
      return;
    }
    try {
      const highlightedTabs = await chrome.tabs.query({ highlighted: true })
      const highlightedIds = new Set(highlightedTabs.map(tab => tab.id))
      
      // console.log('updateBrowserSelection(): highlightedTabs:', highlightedTabs.length, 'highlightedIds:', Array.from(highlightedIds))
      
      // Step 1: Reset all previously selected tabs to false using existing winHistory.selected
      for (const [windowId, winHistory] of tabsOpenHistory.value.entries()) {
        if (winHistory.selected && Array.isArray(winHistory.selected)) {
          winHistory.selected.forEach(tab => {
            if (tab && tab.id != null) {
              tab.isBrowserSelected = false
            }
          })
        }
      }
      
      // Step 2: Use tabsMapOpen to directly find and update highlighted tabs
      const newSelectedTabs = new Map() // windowId -> [selected tabs]
      
      for (const tabId of highlightedIds) {
        const tabInfo = tabsMapOpen.value.get(tabId)
        if (tabInfo && tabInfo.tab && tabInfo.windowId != null) {
          tabInfo.tab.isBrowserSelected = true
          
          // Collect for window history update
          if (!newSelectedTabs.has(tabInfo.windowId)) {
            newSelectedTabs.set(tabInfo.windowId, [])
          }
          newSelectedTabs.get(tabInfo.windowId).push(tabInfo.tab)
        }
      }
      
      // Step 3: Update window histories with new selected tabs
      for (const [windowId, winHistory] of tabsOpenHistory.value.entries()) {
        initWinHistoryIfNotExist(windowId) // Ensure history exists
        winHistory.selected = newSelectedTabs.get(windowId) || []
        // console.log(`updateBrowserSelection(): Window ${windowId} - browser-selected tabs:`, winHistory.selected.length)
      }
      
    } catch (error) {
      console.error('Error updating browser selection:', error)
    }
  }

  const refreshData = () => {
    console.log('TabsOpen.js: Refreshing data')
    loadTabsAndWinOpen()
  }

  // Tab action methods
  const activateTab = async (tab) => {
    try {
      await chrome.tabs.update(tab.id, { active: true })
      await chrome.windows.update(tab.windowId, { focused: true })
    } catch (error) {
      console.error('Error activating tab:', error)
      throw error
    }
  }

  const closeTab = async (tab) => {
    try {
      await chrome.tabs.remove(tab.id)
    } catch (error) {
      console.error('TabsOpen.js: Error closing tab:', error)
      throw error
    }
  }
  
  const updateTabsOpenHistory = (windowId, tabId) => {
    // console.log('updateTabsOpenHistory()')
    if (!tabsOpenHistory.value.has(windowId)) {
      tabsOpenHistory.value.set(windowId, { active: [], selected: [], recent: [] })
    }
    
    const winHistory = tabsOpenHistory.value.get(windowId)
    
    // Remove tabId if it already exists
    const indexExisting = winHistory.active.indexOf(tabId)
    if (indexExisting > -1) {
      winHistory.active.splice(indexExisting, 1)
    }
    
    // Add tabId to the beginning
    winHistory.active.unshift(tabId)
    
    // Keep only MAX_RECENT_TABS
    if (winHistory.active.length > MAX_RECENT_TABS) {
      winHistory.active.splice(MAX_RECENT_TABS)
    }
  }

  const removeTabFromTabsOpenHistory = (tabId) => {
    // Remove the tab from all window histories
    for (const [windowId, winHistory] of tabsOpenHistory.value.entries()) {
      const index = winHistory.active.indexOf(tabId)
      if (index > -1) {
        winHistory.active.splice(index, 1)
      }
    }
  }
  const onTabOpenDetached = (tabId, detachInfo) => {
    // console.log('onDetached(). tabId:', tabId, 'detachInfo:', detachInfo)
    const winHistory = tabsOpenHistory.value.get(detachInfo.oldWindowId)
    if (winHistory) {
      const index = winHistory.active.indexOf(tabId)
      if (index > -1) { winHistory.active.splice(index, 1) }
    }else{ console.error('onDetached(): winHistory not found for oldWindowId:', detachInfo.oldWindowId) }
    // remove tab from old window
    removeTabFromWindowsOpen(tabId, detachInfo.oldWindowId)
  }
  const onTabOpenAttached = (tabId, winIdNew, indexNew, removeFromWinOld = false) => {
    console.log('onTabOpenAttached(). winIdNew:', winIdNew, 'indexNew:', indexNew)

    const tabInfo = tabsMapOpen.value.get(tabId)
    if(removeFromWinOld){ // this will handled by onTabOpenDetached()
      // Remove from old window's history if specified
      let winOldId = null;
      if(!tabInfo){
        console.error('onTabOpenAttached(): tabInfo not found for tabId:', tabId);
        return;
      }else{
        winOldId = tabInfo.tab.windowId;
      }
      if(!winOldId){
        console.error('onTabOpenAttached(): winOldId not found for tabId:', tabId)
      }else{
        let winOld = tabsOpenWindows.value.find(w => w.id === winOldId)
        let indexOld = winOld.tabs.findIndex(t => t.id === tabId)
        if(indexOld > -1){
          winOld.tabs.splice(indexOld, 1)
        }else{
          console.error('onTabOpenAttached(): tabId:', tabId, 'not found in winOld.tabs')
        }
      }
    }
    
    if(!tabInfo){
      console.error('onTabOpenAttached(): tabInfo not found for tabId:', tabId)
    }else{
      tabInfo.windowId = winIdNew
    }
    const tab = tabInfo.tab

    let winNew = tabsOpenWindows.value.find(w => w.id === winIdNew)
    if(!winNew){
      console.error('onTabOpenAttached(): winNew not found for winIdNew:', winIdNew)
    }else{
      winNew.tabs.splice(indexNew, 0, tab)
    }

    // Add to new window's history
    updateTabsOpenHistory(winIdNew, tabId)

    // Note: The tab will be added to the new window by the onCreated event
    // We just need to update the windowId reference
    updateTabOpenWinId(tabId, winIdNew)
  }

  const onWinCreated = async (window) => {
    console.error('onWinCreated(): window:', window)
    
    // Add the new window to tabsOpenWindows
    const newWindow = {
      id: window.id,
      tabs: []
    }
    tabsOpenWindows.value.push(newWindow)
    
    // Initialize history for the new window
    initWinHistoryIfNotExist(window.id)

    // tabs in the window will be added by the onCreated event listener
    try {
      // const tabs = await chrome.tabs.query({ windowId: window.id })
      // newWindow.tabs = tabs.map(tab => ({
      //   ...tab,
      //   isActive: tab.active || false,
      //   isLastActive: false,
      //   isBrowserSelected: tab.highlighted || false,
      //   isUiSelected: false
      // }))
      
      // // Update the fast lookup map
      // tabs.forEach(tab => {
      //   tabsMapOpen.value.set(tab.id, { tab, windowId: window.id })
      // })
    } catch (error) {
      console.error('Error loading tabs for new window:', error)
    }
  }

  const onWinClosed = (winId) => {
    console.error('onWinClosed(): windowId:', winId)
    // remove from tabsOpenWindows
    const winIndex = tabsOpenWindows.value.findIndex(w => w.id === winId)
    if(winIndex > -1){
      tabsOpenWindows.value.splice(winIndex, 1)
    }else{
      console.error('onWinClosed(): winId:', winId, 'not found in tabsOpenWindows')
    }
    // remove from tabsOpenHistory
    tabsOpenHistory.value.delete(winId)
  }

  // Handle messages from background script (for backward compatibility and sync)
  const handleBackgroundMessage = (message, sender, sendResponse) => {
    if (message.action === "tabsRecentUpdated") {
      // Background script is also maintaining this, but we prioritize our local version
      // This can serve as a backup/sync mechanism
      console.log('Background recent tabs update:', message.windowId, message.tabsRecent)
    }
  }

  // Sync initial recent tabs history from background script
  const initTabsOpenHistoryFromBackground = async () => {
    if(process.env.VUE_APP_IS_DEV){
      console.log("initTabsOpenHistoryFromBackground(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
      return;
    }

    try {
      console.log('initTabsOpenHistoryFromBackground(): Starting sync...')
      const response = await chrome.runtime.sendMessage({
        action: "getRecentTabs"
      })
      // console.log('initTabsOpenHistoryFromBackground(): Response from background:', response)
      
      if (response.tabsRecentAllWin) {
        // Initialize local state with background data
        for (const [windowId, tabsRecentId] of Object.entries(response.tabsRecentAllWin)) {
          // console.log('initTabsOpenHistoryFromBackground(): windowId:', windowId, 'tabsRecentId:', tabsRecentId)
          let tabs = [];
          tabsRecentId.forEach(tabId => {
            console.log('initTabsOpenHistoryFromBackground(): tabId:', tabId)
            const tabInfo = tabsMapOpen.value.get(tabId)
            if(tabInfo){
              tabs.push(tabInfo.tab)
            }else{
              console.error('initTabsOpenHistoryFromBackground(): tab not found for tabId:', tabId)
            }
          })
          console.log('initTabsOpenHistoryFromBackground(): tabs:', tabs)
          tabsOpenHistory.value.set(parseInt(windowId), {
            active: [],
            selected: [],
            recent: [...tabs]
          })
        }
        // console.log('initTabsOpenHistoryFromBackground(): Synced initial recent tabs from background:', response.tabsRecentAllWin)
      } else {
        console.error('initTabsOpenHistoryFromBackground(): No recent tabs data in response')
      }
    } catch (error) {
      console.error('Error syncing initial recent tabs from background:', error)
      // Continue without background sync - we'll build history as tabs are activated
    }
  }

  // Event listener management
  let selectionInterval = null
  let eventListenersInitialized = false

  const initEventListeners = () => {
    if (eventListenersInitialized) return
  
    console.warn("initEventListeners(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
    if(process.env.VUE_APP_IS_DEV){
      return;
    }
    
    // Chrome API event listeners with recent tabs history management
    chrome.tabs.onCreated.addListener((tab) => {
      addTabToWindowsOpen(tab)
    })
    chrome.tabs.onActivated.addListener(onTabOpenActivated)
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      // remove from selected tabs list
      tabsSelectStore.onTabOpenClosed(tabId)
      // remove from search results - use dynamic import to avoid circular dependency
      import('./TabsSearch').then(({ useTabsSearch }) => {
        const tabsSearchStore = useTabsSearch()
        tabsSearchStore.onTabsOpenRemoved([], [tabId])
      }).catch(err => console.warn('Failed to update search results:', err))
      // remove from history
      removeTabFromTabsOpenHistory(tabId)
      // remove from tabsOpenWindows
      removeTabFromWindowsOpen(tabId, removeInfo.windowId)
      // remove from tabsMapOpen
      tabsMapOpen.value.delete(tabId)
    })

    // DRAG TAB in SAME WINDOW
    chrome.tabs.onMoved.addListener((tabId, moveInfo) => {onTabOpenMoved(tabId, moveInfo)})
    
    // DRAG TAB to ANOTHER WINDOW
    chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
      // console.log('onAttached(). tabId:', tabId, 'attachInfo:', attachInfo)
        // attachInfo does not seem to contain oldWindowId
      onTabOpenAttached(tabId, attachInfo.newWindowId, attachInfo.newPosition)
    })
    chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
      onTabOpenDetached(tabId, detachInfo)
    })
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {onTabOpenUpdated(tabId, changeInfo, tab)})
    chrome.windows.onCreated.addListener((window) => {onWinCreated(window)})
    chrome.windows.onRemoved.addListener((winId) => {onWinClosed(winId)})
    
    // Listen for recent tabs updates from background script (for sync)
    chrome.runtime.onMessage.addListener(handleBackgroundMessage)
    
    // Start polling for browser selection updates (every 1 second)
    startBrowserSelectionPolling()
    
    eventListenersInitialized = true
    console.log('TabsOpen: Event listeners init with local recent tabs tracking and browser selection polling')
  }

  const removeEventListeners = () => {
    if (!eventListenersInitialized) return
    
    // Note: We need to remove the same function references we added
    // For event listeners with inline functions, Chrome will not remove them
    // This is a limitation, but not critical for extension lifecycle
    chrome.tabs.onCreated.removeListener((tab) => {
      addTabToWindowsOpen(tab)
    })
    chrome.tabs.onMoved.removeListener((tabId, moveInfo) => {
      onTabOpenMoved(tabId, moveInfo)
    })
    chrome.tabs.onUpdated.removeListener((tabId, changeInfo, tab) => {
      onTabOpenUpdated(tabId, changeInfo, tab)
    })
    chrome.tabs.onActivated.removeListener(onTabOpenActivated)
    chrome.windows.onCreated.removeListener(onWinCreated)
    chrome.windows.onRemoved.removeListener(onWinClosed)
    chrome.runtime.onMessage.removeListener(handleBackgroundMessage)
    
    // Stop browser selection polling
    stopBrowserSelectionPolling()
    
    if (selectionInterval) {
      clearInterval(selectionInterval)
      selectionInterval = null
    }
    
    eventListenersInitialized = false
    console.log('TabsOpen: Event listeners removed')
  }

  // Browser selection polling management
  const startBrowserSelectionPolling = () => {
    console.log('TabsOpen: Starting browser selection polling (1 second interval)')
    // Initial update
    updateBrowserSelection()
    // Set up interval
    selectionInterval = setInterval(() => {
      updateBrowserSelection()
    }, 1000) // 1 second
  }

  const stopBrowserSelectionPolling = () => {
    if (selectionInterval) {
      console.log('TabsOpen: Stopping browser selection polling')
      clearInterval(selectionInterval)
      selectionInterval = null
    }
  }

  // Initialize on store creation
  const initTabsOpen = async () => {
    console.log('TabsOpen.js: initTabsOpen(): Starting initialization...')
    initEventListeners()
    await loadTabsAndWinOpen()
    await initTabsOpenHistoryFromBackground() // get recent tabs from background.js
    await updateBrowserSelection() // Update browser selection state
    console.log('TabsOpen.js: initTabsOpen(): Initialization complete')
  }

  // Cleanup method
  const cleanupTabsOpen = () => { removeEventListeners()}

  // Update the fast lookup map when tabsOpenWindows changes
  const updateTabsMapOpen = () => {
    tabsMapOpen.value.clear()
    tabsOpenWindows.value.forEach(window => {
      window.tabs.forEach(tab => {
        tabsMapOpen.value.set(tab.id, { tab, windowId: window.id })
      })
    })
    // console.log(`updateTabsMapOpen(): Updated map with ${tabsMapOpen.value.size} tabs`)
  }

  // Precisely remove a tab from tabsOpenWindows without full refresh
  const removeTabFromWindowsOpen = (tabId, windowId) => {
    const window = tabsOpenWindows.value.find(w => w.id === windowId)
    if (!window) return
    
    const tabIndex = window.tabs.findIndex(tab => tab.id === tabId)
    if (tabIndex === -1) return
    
    // Get the tab before removing it
    const removedTab = window.tabs[tabIndex]
    
    // Remove the tab from the array
    window.tabs.splice(tabIndex, 1)
    
    // remove tab from window does not mean delete it
    // tabsMapOpen.value.delete(tabId)
    
    console.log(`removeTabFromWindowsOpen(): Removed tab ${tabId} from window ${windowId}`)
    
    // Notify search store about the removed tab - use dynamic import to avoid circular dependency
    import('./TabsSearch').then(({ useTabsSearch }) => {
      const tabsSearchStore = useTabsSearch()
      tabsSearchStore.onTabsOpenRemoved([removedTab])
    }).catch(err => console.warn('Failed to update search results:', err))
  }

  // Precisely add a tab to tabsOpenWindows without full refresh
  const addTabToWindowsOpen = (tab) => {
    // console.log('chrome.tabs.onCreated --> addTabToWindowsOpen(). tab:', tab)
    const window = tabsOpenWindows.value.find(w => w.id === tab.windowId)
    if (!window) return
    
    // Ensure tab has required properties
    tab.isActive = tab.active || false
    tab.isLastActive = false
    tab.isBrowserSelected = tab.highlighted || false
    if (tab.isUiSelected === undefined) {
      tab.isUiSelected = false
    }
    
    // Insert the tab at the correct position using the index from Chrome API
    if (tab.index !== undefined && tab.index >= 0 && tab.index <= window.tabs.length) {
      window.tabs.splice(tab.index, 0, tab)
    } else {
      // Fallback: add to end if index is invalid
      window.tabs.push(tab)
      console.warn('addTabToWindowsOpen(): Invalid tab.index:', tab.index, 'adding to end of array')
    }
    
    // Update the fast lookup map
    tabsMapOpen.value.set(tab.id, { tab, windowId: tab.windowId })
    
    console.log(`addTabToWindowsOpen(): Added tab ${tab.id} to window ${tab.windowId}`)
  }

  // Precisely update a tab in tabsOpenWindows without full refresh
  const onTabOpenUpdated = (tabId, changeInfo, updatedTab) => {
    // const window = tabsOpenWindows.value.find(w => w.id === updatedTab.windowId)
    // if (!window) return
    const tabInfo = tabsMapOpen.value.get(tabId)
    let tab = null;
    if (!tabInfo) {
      console.error(`onTabOpenUpdated(): Tab ${tabId} not found from tabsMapOpen`)
      tab = window.tabs.find(t => t.id === tabId)
    }else{
      tab = tabInfo.tab
    }

    // Update tab properties based on what changed
    if (changeInfo.title !== undefined) {
      tab.title = updatedTab.title
    }
    if (changeInfo.url !== undefined) {
      tab.url = updatedTab.url
    }
    if (changeInfo.favIconUrl !== undefined) {
      tab.favIconUrl = updatedTab.favIconUrl
    }
    if (changeInfo.status !== undefined) {
      tab.status = updatedTab.status
    }
    if (changeInfo.active !== undefined) {
      tab.active = updatedTab.active
      tab.isActive = updatedTab.active
    }
    if (changeInfo.highlighted !== undefined) {
      tab.highlighted = updatedTab.highlighted
      tab.isBrowserSelected = updatedTab.highlighted
    }
    // console.log(`onTabOpenUpdated(): Updated tab ${tabId} properties:`, Object.keys(changeInfo))
  }

  // DRAG TAB in SAME WINDOW
  const onTabOpenMoved = (tabId, moveInfo) => {
    // console.log('chrome.tabs.onMoved --> onTabOpenMoved()', tabId, moveInfo)
    const window = tabsOpenWindows.value.find(w => w.id === moveInfo.windowId)
    if (!window) return
    
    const tabIndex = window.tabs.findIndex(tab => tab.id === tabId)
    if (tabIndex === -1) return
    
    const [tab] = window.tabs.splice(tabIndex, 1)
    window.tabs.splice(moveInfo.toIndex, 0, tab)
    // console.log(`onTabOpenMoved(): Moved tab ${tabId} from index ${moveInfo.fromIndex} to ${moveInfo.toIndex}`)
  }

  const updateTabOpenWinId = (tabId, winIdNew) => {
    let tabInfo = tabsMapOpen.value.get(tabId)
    let tab = null;
    if(tabInfo){
      tab = tabInfo.tab
      tab.windowId = winIdNew
      tabsMapOpen.value.set(tabId, { tab, windowId: winIdNew })
      // console.log(`updateTabOpenWinId(): Updated tab ${tabId} windowId to ${winIdNew}`)
      return
    }else{
      // console.log(`updateTabOpenWinId(): Tab ${tabId} not found in tabsMapOpen`)
      // Find the tab in any window and update its windowId
      for (const window of tabsOpenWindows.value) {
        tab = window.tabs.find(t => t.id === tabId)
        if(tab){
          tab.windowId = winIdNew
          tabsMapOpen.value.set(tabId, { tab, windowId: winIdNew })
          console.log(`updateTabOpenWinId(): Updated tab ${tabId} windowId to ${winIdNew}`)
          break
        }else{
          tab = window.tabs.find(t => t.id === tabId)
          if (tab) {
            tab.windowId = winIdNew
            // Update the fast lookup map
            tabsMapOpen.value.set(tabId, { tab, windowId: winIdNew })
            console.log(`updateTabOpenWinId(): Updated tab ${tabId} windowId to ${winIdNew}`)
            break
          }
        }
      }
    }
  }
  return {
    // State
    tabsOpenWindows,
    currentWindowId,
    tabsOpenHistory,
    isLoading,
    lastError,
    tabsOpenUiSelected,
    tabsMapOpen,
    
    // Computed
    totalTabs,
    currentWindow,
    
    // Methods
    loadTabsAndWinOpen,
    onTabOpenActivated,
    updateBrowserSelection,
    refreshData,
    activateTab,
    closeTab,
    
    // History management
    
    // Lifecycle methods
    initTabsOpen,
    cleanupTabsOpen,
    initEventListeners,
    removeEventListeners,
    updateTabsMapOpen,
    removeTabFromWindowsOpen,
    addTabToWindowsOpen,
    onTabOpenUpdated,
    onTabOpenMoved,
    updateTabOpenWinId,
    
    // Browser selection polling
    startBrowserSelectionPolling,
    stopBrowserSelectionPolling
  }
})


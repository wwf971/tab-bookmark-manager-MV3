/**
 * Composable for handling tab click events via delegation
 * This optimizes performance by using a single event listener per container
 * instead of individual listeners on each tab card
 */
export function useTabClickDelegation() {
  // This will run on every component creation
  // console.warn(`useTabClickDelegation.js: Composable CREATED at ${new Date().toISOString()}`)
  
  // re-useable states
  let executionCount = 0
  // Track shift key state globally
  let isShiftPressed = false
  // Import stores to use their tab maps
  let tabsOpenStore = null
  let tabsRemoteStore = null
  
  // Lazy load stores to avoid circular dependencies
  const getTabsOpenStore = async () => {
    executionCount++
    // console.warn(`useTabClickDelegation.js: Store access #${executionCount} at ${new Date().toISOString()}`)
    if (!tabsOpenStore) {
      const { useSessionsOpen } = await import('@/sessions-open/SessionsOpen.js')
      tabsOpenStore = useSessionsOpen()
      // console.warn('useTabClickDelegation.js: TabsOpen store initialized for the first time')
    }
    return tabsOpenStore
  }
  
  const getTabsRemoteStore = async () => {
    if (!tabsRemoteStore) {
      const { useTabsRemote } = await import('@/sessions-remote/SessionsRemote.js')
      tabsRemoteStore = useTabsRemote()
    }
    return tabsRemoteStore
  }

  // document.body.style.userSelect = 'none'

  // Add global keydown/keyup listeners to track shift key
  const initShiftKeyTracking = () => {
    const handleKeyDown = (event) => {
      console.log('useTabClickDelegation.js: handleKeyDown', event.key)
      if (event.key === 'Shift') {
        isShiftPressed = true
        // Temporarily disable text selection. TOO COSTLY.
        // document.body.style.userSelect = 'none'
        // document.body.style.webkitUserSelect = 'none'
        // document.body.style.mozUserSelect = 'none'
        // document.body.style.msUserSelect = 'none'
      }
    }
    
    const handleKeyUp = (event) => {
      console.log('useTabClickDelegation.js: handleKeyUp', event.key)
      if (event.key === 'Shift') {
        isShiftPressed = false
        // Re-enable text selection. TOO COSTLY.
        // document.body.style.userSelect = ''
        // document.body.style.webkitUserSelect = ''
        // document.body.style.mozUserSelect = ''
        // document.body.style.msUserSelect = ''
      }
    }

    // document.addEventListener('keydown', handleKeyDown)
    // document.addEventListener('keyup', handleKeyUp)
    
    // Return cleanup function
    return () => {
      // document.removeEventListener('keydown', handleKeyDown)
      // document.removeEventListener('keyup', handleKeyUp)
      // Ensure text selection is re-enabled
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
      document.body.style.mozUserSelect = ''
      document.body.style.msUserSelect = ''
    }
  }
  
  /**
   * Update the fast lookup maps when tab data changes
   * @param {Object} tabsData - The tabs data structure
   * @param {string} source - 'open' or 'remote'
   */
  const updateTabsMap = async (tabsData, source) => {
    try {
      // The stores now handle their own map updates, so we just need to ensure
      // the stores are initialized and their maps are up to date
      if (source === 'open') {
        const store = await getTabsOpenStore()
        if (store && typeof store.updateTabsMapOpen === 'function') {
          store.updateTabsMapOpen()
        } else {
          console.warn('updateTabsMap: TabsOpen store or updateTabsMapOpen method not available')
        }
      } else if (source === 'remote') {
        const store = await getTabsRemoteStore()
        if (store && typeof store.updateTabsMap === 'function') {
          store.updateTabsMap()
        } else {
          console.warn('updateTabsMap: TabsRemote store or updateTabsMap method not available')
        }
      }
    } catch (error) {
      console.error('updateTabsMap: Error updating tab maps:', error)
    }
  }
  
  const findTabFromElement = async (element, tabsData, source) => {
    const tabCard = element.closest('.tab-card')
    if (!tabCard) return null
    
    if (source === 'open') {
      const tabId = parseInt(tabCard.dataset.tabId)
      if (!tabId){
        console.warn('findTabFromElement(): open. tabId not found.')
        return null
      }
      // Use fast lookup map from store
      const store = await getTabsOpenStore()
      const tabInfo = store.tabsMapOpen.get(tabId)
      // console.log('findTabFromElement(): open. tabInfo:', tabInfo)
      return {tab: tabInfo ? tabInfo.tab : null, tabEl: tabCard}
    } else if (source === 'remote') {
      // console.log('findTabFromElement(): remote. tabCard.dataset.tabId:', tabCard.dataset.tabId)
      const tabId = tabCard.dataset.tabId
      if (!tabId) return null
      
      // Use fast lookup map from store
      const store = await getTabsRemoteStore()
      const tabInfo = store.tabsMapRemote.get(tabId)
      const tab = tabInfo ? tabInfo.tab : null
      if(tab){ // TODO: remove this ugly code
        tab.cache = {parentClass: tabCard.dataset.parentClass}
        // console.log('tab.cache:', tab.cache)
      }
      return {tab: tab, tabEl: tabCard}
    }
    return {tab: null, tabEl: null}
  }

  const createGridEventHandlers = (options) => {
    const {
      onTabClick,
      onTabDoubleClick,
      onTabRightClick,
      onTabRemove,
      tabsData,
      source
    } = options

    const handleGridClick = async (event) => {
      console.warn('useTabClickDelegation.js: handleGridClick().')
      // Check if this is a remove button click
      if (event.target.closest('.tab-remove-button')) {
        const {tab, tabEl} = await findTabFromElement(event.target, tabsData, source)
        if (tab && onTabRemove) {
          event.stopPropagation() // Prevent triggering other click events
          onTabRemove(tab)
        }
        return
      }
      // else{
      //   console.warn('useTabClickDelegation.js: handleGridClick(). not a remove button click.')
      // }
      
      const {tab, tabEl} = await findTabFromElement(event.target, tabsData, source)
      if (tab && onTabClick) {
        // Prevent text selection during shift-click operations
        if (event.shiftKey) {
          event.preventDefault()
        }
        onTabClick(tab, event, source)
      }
    }

    const handleGridDoubleClick = async (event) => {
      const {tab, tabEl} = await findTabFromElement(event.target, tabsData, source)
      if (tab && onTabDoubleClick) {
        onTabDoubleClick(tab)
      }
    }

    const handleGridContextMenu = async (event) => {
      console.log('useTabClickDelegation.js: handleGridContextMenu().')
      const {tab, tabEl} = await findTabFromElement(event.target, tabsData, source)
      console.log('useTabClickDelegation.js: handleGridContextMenu(). tab:', tab)
      if (tab && onTabRightClick) {
        event.preventDefault() // Prevent default context menu
        onTabRightClick(event, tab, tabEl)
      }else{
        console.log('useTabClickDelegation.js: handleGridContextMenu(). no tab found')
      }
    }

    return {
      handleGridClick,
      handleGridDoubleClick, 
      handleGridContextMenu
    }
  }

  return {
    findTabFromElement,
    createGridEventHandlers,
    initShiftKeyTracking,
    updateTabsMap
  }
} 
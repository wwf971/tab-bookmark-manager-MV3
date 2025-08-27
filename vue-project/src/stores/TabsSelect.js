import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useTabsOpen } from './TabsOpen'
import { useTabsRemote } from './TabsRemote'
import { useTabsSearch } from './TabsSearch'

export const useTabsSelect = defineStore('tabsSelect', () => {
  const tabsOpenStore = useTabsOpen()
  const tabsRemoteStore = useTabsRemote()
  const tabsSearchStore = useTabsSearch()

  // Track last selected tab for shift-click ranges (plain objects - no reactivity needed)
  let tabOpenLastSelectedId = null
  let tabRemoteLastSelectedId = null
  let tabLocalLastSelectedId = null
  let tabBookmarkLastSelectedId = null

  const getTabsLastSelected = (source) => {
    switch (source) {
      case 'open': return tabOpenLastSelectedId
      case 'remote': return tabRemoteLastSelectedId
      case 'local': return tabLocalLastSelectedId
      case 'bookmark': return tabBookmarkLastSelectedId
      default: return null
    }
  }

  const setTabsLastSelected = (source, tabId) => {
    switch (source) {
      case 'open': tabOpenLastSelectedId = tabId; break
      case 'remote': tabRemoteLastSelectedId = tabId; break
      case 'local': tabLocalLastSelectedId = tabId; break
      case 'bookmark': tabBookmarkLastSelectedId = tabId; break
    }
  }

  const getSelectedCount = (source) => {
    // Use selectedTabs arrays for fast lookup
    switch (source) {
      case 'open': 
        // Count user-selected tabs for operations
        return tabsOpenStore.tabsOpenUiSelected.length
      case 'remote': return tabsRemoteStore.tabsRemoteUiSelected.length
      case 'local': return 0 // Future: local tabs
      case 'bookmark': return 0 // Future: bookmarks
      default: return 0
    }
  }

  // Core selection methods - directly modify tab objects
  const selectTab = (tab, source) => {
    // console.log(`selectTab(): source: ${source}, tabId: ${tab.id}, before isUiSelected: ${tab.isUiSelected}`)
    if (source === 'open') {
      tab.isUiSelected = true
      setTabsLastSelected(source, tab.id)
      // Add to UI selected tabs tracking
      if (!tabsOpenStore.tabsOpenUiSelected.includes(tab)) {
        tabsOpenStore.tabsOpenUiSelected.push(tab)
      }
    } else if (source === 'remote') {
      tab.isUiSelected = true
      setTabsLastSelected(source, tab.id)
      // Add to selected tabs tracking for efficient clearing
      tabsRemoteStore.addToTabsRemoteSelected(tab)
    }
    // console.log(`selectTab(): after isUiSelected: ${tab.isUiSelected}`)
  }

  const unselectTab = (tab, source) => {
    if (source === 'open') {
      tab.isUiSelected = false
      if (getTabsLastSelected(source) === tab.id) {
        setTabsLastSelected(source, null)
      }
      // Remove from UI selected tabs tracking
      const index = tabsOpenStore.tabsOpenUiSelected.indexOf(tab)
      if (index > -1) {
        tabsOpenStore.tabsOpenUiSelected.splice(index, 1)
      }
    } else if (source === 'remote') {
      tab.isUiSelected = false
      if (getTabsLastSelected(source) === tab.id) {
        setTabsLastSelected(source, null)
      }
      // Remove from selected tabs tracking
      tabsRemoteStore.removeFromSelectedTabs(tab)
    }
  }

  // Range selection implementation
  // Selects all tabs between startTabId and endTabId (inclusive)
  const selectRange = (startTabId, endTabId, allTabs, source) => {
    if (!allTabs || allTabs.length === 0) return

    // Find indices of start and end tabs
    const startIndex = allTabs.findIndex(tab => {
      const id = tab.id
      return id === startTabId
    })
    
    const endIndex = allTabs.findIndex(tab => {
      const id = tab.id
      return id === endTabId
    })

    // If either tab is not found, fallback to single selection
    if (startIndex === -1 || endIndex === -1) {
      clearSelection(source)
      const endTab = allTabs.find(tab => {
        const id = tab.id
        return id === endTabId
      })
      if (endTab) {
        selectTab(endTab, source)
      }
      return
    }

    // Determine the range (start could be after end)
    const minIndex = Math.min(startIndex, endIndex)
    const maxIndex = Math.max(startIndex, endIndex)

    // Clear current selection
    clearSelection(source)

    // Select all tabs in the range
    for (let i = minIndex; i <= maxIndex; i++) {
      const tab = allTabs[i]
      selectTab(tab, source)
    }
  }

  const clearSelection = (source = null) => {
    if (source) {
      // Use optimized clearing methods
      if (source === 'open') {
        // Clear all UI-selected tabs
        tabsOpenStore.tabsOpenUiSelected.forEach(tab => {
          tab.isUiSelected = false
        })
        tabsOpenStore.tabsOpenUiSelected.length = 0
      } else if (source === 'remote') {
        tabsRemoteStore.clearSelectedTabs()
      }
      setTabsLastSelected(source, null)
    } else {
      // Clear all selections using optimized methods
      // Clear open tabs
      tabsOpenStore.tabsOpenUiSelected.forEach(tab => {
        tab.isUiSelected = false
      })
      tabsOpenStore.tabsOpenUiSelected.length = 0
      // Clear remote tabs
      tabsRemoteStore.clearSelectedTabs()
      
      // Clear all last selected
      setTabsLastSelected('open', null)
      setTabsLastSelected('remote', null)
      setTabsLastSelected('local', null)
      setTabsLastSelected('bookmark', null)
    }
  }

  const onTabOpenClosed = (tabId) => {
      // Debug: Print call stack to see where this is called from
      // console.trace(`removeOpenTab(). source: ${source}`)
      if(tabId === tabOpenLastSelectedId){
        tabOpenLastSelectedId = null;
      }
      const tabToRemove = tabsOpenStore.tabsOpenUiSelected.find(tab => tab.id === tabId)
      // console.log(`onTabOpenClosed(): tabId: ${tabId}. tabToRemove: ${tabToRemove}`)
      if (!tabToRemove) { return;}
      const index = tabsOpenStore.tabsOpenUiSelected.indexOf(tabToRemove)
      if (index > -1) {
        tabsOpenStore.tabsOpenUiSelected.splice(index, 1)
      }

  }

  // Handle tab closure - cleanup selection state
  const removeClosedTab = (tabId, source, removeFromSearchResults = true) => {
    if (source === 'open') {
      onTabOpenClosed(tabId)
    } else if (source === 'remote') {
      if (getTabsLastSelected(source) === tabId) {
        setTabsLastSelected(source, null)
      }

      const tabToRemove = tabsRemoteStore.tabsRemoteUiSelected.find(tab => tab.id === tabId)
      console.log(`removeClosedTab(): tabId: ${tabId}. tabToRemove: ${tabToRemove}`)
      if (tabToRemove) {
        tabsRemoteStore.removeFromSelectedTabs(tabToRemove)
        // remove from search results
        if(removeFromSearchResults){
          tabsSearchStore.onTabsRemoteRemoved([tabToRemove])
        }
      }else{
        console.error(`removeClosedTab(): tabId: ${tabId} not found in tabsRemoteUiSelected`)
      }
    }

    // Note: The tab object itself will be removed from the store by the TabsOpen store
    // so we don't need to find and modify it here
  }
  // Helper methods for working with selected tabs
  const getSelectedTabIds = (source) => {
    switch (source) {
      case 'open': 
        return tabsOpenStore.tabsOpenUiSelected.map(tab => tab.id)
      case 'remote': 
        return tabsRemoteStore.tabsRemoteUiSelected.map(tab => tab.id)
      case 'local': return [] // Future: local tabs
      case 'bookmark': return [] // Future: bookmarks
      default: return []
    }
  }

  const getAllSelectedTabIds = () => {
    return {
      open: getSelectedTabIds('open'),
      remote: getSelectedTabIds('remote'),
      local: getSelectedTabIds('local'),
      bookmarks: getSelectedTabIds('bookmark')
    }
  }

  const getSelectedTabs = (source) => {
    switch (source) {
      case 'open': 
        return [...tabsOpenStore.tabsOpenUiSelected] // Return copy to prevent external mutations
      case 'remote': 
        return [...tabsRemoteStore.tabsRemoteUiSelected] // Return copy to prevent external mutations
      case 'local': return [] // Future: local tabs
      case 'bookmark': return [] // Future: bookmarks
      default: return []
    }
  }

  const getAllSelectedTabs = () => {
    return {
      open: getSelectedTabs('open'),
      remote: getSelectedTabs('remote'),
      local: [], // Future
      bookmarks: [] // Future
    }
  }

  // Batch operations for selected tabs
  const performBatchOperation = (operation, source = null) => {
    const sources = source ? [source] : ['open', 'remote']
    const results = { success: [], failed: [] }
    
    for (const src of sources) {
      const selectedTabs = getSelectedTabs(src)
      for (const tab of selectedTabs) {
        try {
          const result = operation(tab, src)
          if (result !== false) { // Allow operation to return false to indicate failure
            results.success.push({ tab, source: src })
          } else {
            results.failed.push({ tab, source: src, error: 'Operation returned false' })
          }
        } catch (error) {
          results.failed.push({ tab, source: src, error })
        }
      }
    }
    
    return results
  }

  // Computed properties for totals - based on selectedTabs arrays (more reliable than cache)
  const getTotalSelectedCount = computed(() => {
    return tabsOpenStore.tabsOpenUiSelected.length + tabsRemoteStore.tabsRemoteUiSelected.length
  })
  
  const hasSelection = computed(() => getTotalSelectedCount.value > 0)

  // Get all tabs for range selection - computed only when needed
  const getAllTabsForSource = (source) => {
    console.log(`getAllTabsForSource(): source: ${source}`)
    const allTabs = []
    if (source === 'open') {
      for (const window of tabsOpenStore.sessionsOpen) {
        if (window.tabs) {
          allTabs.push(...window.tabs)
        }
      }
    } else if (source === 'remote') {
      Object.entries(tabsRemoteStore.tabsRemoteList || {}).forEach(([listId, listData]) => {
        Object.entries(listData.tabs || {}).forEach(([tabId, tab]) => {
          // Return the original tab object to maintain reactivity
          allTabs.push(tab)
        })
      })
    }
    return allTabs
  }

  // Tab click handler with full selection logic - optimized to avoid unnecessary allTabs computation
  const handleTabClick = (tab, event, source, allTabs=null) => {
    const tabId = tab.id
    console.warn(`handleTabClick(): source: ${source}. tabId: ${tabId}. isUiSelected: ${tab.isUiSelected}`)
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+click: toggle individual tab selection (multi-select)
      if (tab.isUiSelected) {
        unselectTab(tab, source)
      } else {
        selectTab(tab, source)
      }
    } else if (event.shiftKey && getTabsLastSelected(source)) {
      // Shift+click: range selection from last selected to current tab
      // Only compute allTabs when actually needed for range selection
      if(!allTabs){
        allTabs = getAllTabsForSource(source)
      }
      event.preventDefault() // avoid text selection when using shift+click to select multiple tabs
      selectRange(getTabsLastSelected(source), tabId, allTabs, source)
    } else {
      // Regular click: if tab is selected and it's the only selected tab, unselect it
      // If tab is selected and there are other selected tabs, make it the only selected tab
      // If tab is not selected, make it the only selected tab
      if (tab.isUiSelected) {
        const selectedCount = getSelectedCount(source)
        if (selectedCount === 1) {
          // If it's the only selected tab, unselect it
          clearSelection(source)
        } else {
          // If there are other selected tabs, make this the only selected one
          clearSelection(source)
          selectTab(tab, source)
        }
      } else {
        // If tab is not selected, make it the only selected tab
        clearSelection(source)
        selectTab(tab, source)
      }
    }
    if(source === 'open'){
      // console.log('handleTabClick(): source: open. tabsOpenUiSelected.length:', tabsOpenStore.tabsOpenUiSelected.length)
    }
  }

  return {
    // Core methods
    selectTab,
    unselectTab,
    selectRange,
    clearSelection,
    onTabOpenClosed,
    removeClosedTab,
    getSelectedTabIds,
    getAllSelectedTabIds,
    getSelectedTabs,
    getAllSelectedTabs,
    performBatchOperation,

    // Computed
    getSelectedCount,
    getTotalSelectedCount,
    hasSelection,

    // Event handlers
    handleTabClick
  }
})

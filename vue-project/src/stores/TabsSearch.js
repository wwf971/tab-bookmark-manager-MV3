import { defineStore } from 'pinia'
import { reactive, computed } from 'vue'
import { useTabsOpen } from '@/stores/TabsOpen'
import { useTabsRemote } from '@/stores/TabsRemote'

export const useTabsSearch = defineStore('tabsSearch', () => {
  const tabsOpenStore = useTabsOpen()
  const tabsRemoteStore = useTabsRemote()

  // Search state
  const searchState = reactive({
    isSearching: false,
    searchQuery: '',
    get hasSearchQuery() {
      return this.searchQuery.trim().length > 0
    },
    tagsSelected: [],
    get hasTagFilter() {
      return this.tagsSelected.length > 0
    },
    isTagSearching: false,
    sessionsOpenSearchResults: [],
    sessionsRemoteSearchResults: [],
    get hasSearchResults() {
      return this.sessionsOpenSearchResults.length > 0 || this.sessionsRemoteSearchResults.length > 0
    },
    get isSearchActive() {
      return this.hasSearchQuery || this.hasTagFilter
    },
    get searchResultsNumTotal() {
      return this.sessionsOpenSearchResults.length + this.sessionsRemoteSearchResults.length
    }
  })

  // Update search state
  const updateSearchState = (newState) => {
    console.log('TabsSearch store: updateSearchState:', newState)
    Object.assign(searchState, newState)
  }

  // Clear search state
  const clearSearchState = () => {
    console.log('TabsSearch store: clearSearchState')
    Object.assign(searchState, {
      searchQuery: '',
      tagsSelected: [],
      sessionsOpenSearchResults: [],
      sessionsRemoteSearchResults: [],
      isSearching: false
    })
  }

  // when tabs is closed in browser, also remove it from search results for tabsOpen
  const onTabsOpenRemoved = (removedTabs=[], removedTabsId=[]) => {
    // console.log('TabsSearch store: onTabsOpenRemoved(): removedTabs:', removedTabs.map(t => t.id))
    if (!searchState.isSearchActive) {
    //   console.log('TabsSearch store: Search not active, skipping removal from search results')
      return
    }
    if(removedTabsId.length > 0){
      removedTabs = [
        ...removedTabs,
        ...removedTabsId.map(tabId => tabsOpenStore.tabsMapOpen.get(tabId))
      ]
    }

    // Check if any removed tabs are in the open search results
    const numInit = searchState.sessionsOpenSearchResults.length
    
    // Filter out the removed tabs from search results
    searchState.sessionsOpenSearchResults = searchState.sessionsOpenSearchResults.filter(searchTab => {
      const isRemoved = removedTabs.some(removedTab => removedTab.id === searchTab.id)
      if (isRemoved) {
        console.log(`TabsSearch store: Removing tab ${searchTab.id} from open search results`)
      }
      return !isRemoved
    })

    const numFinal = searchState.sessionsOpenSearchResults.length
    const numRemoved = numInit - numFinal
    
    if (numRemoved > 0) {
      console.log(`TabsSearch.js: onTabsOpenRemoved(): Removed ${numRemoved} tabs from open search results`)
      // Update the search state to trigger reactivity
      // searchState = { ...searchState }
    }
  }

  // Handle tab removal from search results when remote tabs are removed
  const onTabsRemoteRemoved = (removedTabs) => {
    console.log('TabsSearch store: onTabsRemoteRemoved(): removedTabs:', removedTabs.map(t => t.id))
    
    if (!searchState.isSearchActive) {
      console.log('TabsSearch store: Search not active, skipping removal from search results')
      return
    }

    // Check if any removed tabs are in the remote search results
    const numInit = searchState.sessionsRemoteSearchResults.length
    
    // Filter out the removed tabs from search results
    for (let i = searchState.sessionsRemoteSearchResults.length - 1; i >= 0; i--) {
      const searchTab = searchState.sessionsRemoteSearchResults[i]
      const isRemoved = removedTabs.some(removedTab => removedTab.id === searchTab.id)
      if (isRemoved) {
        console.log(`TabsSearch store: Removing tab ${searchTab.id} from remote search results`)
        searchState.sessionsRemoteSearchResults.splice(i, 1)
      }
    }

    const numFinal = searchState.sessionsRemoteSearchResults.length
    const numRemoved = numInit - numFinal
    
    if (numRemoved > 0) {
      console.log(`TabsSearch.js: onTabsRemoteRemoved(): Removed ${numRemoved} tabs from remote search results`)
      // searchState = { ...searchState }
    }
  }

  // Set search query
  const setSearchQuery = (query) => {
    searchState.searchQuery = query
  }

  // Set selected tags
  const setSelectedTags = (tags) => {
    searchState.tagsSelected = tags || []
  }

  // Helper function to check if tab matches search term
  const matchesSearchTerm = (tab, searchTerm) => {
    // Search in title (open tabs) or text (remote tabs)
    if (tab.title && tab.title.toLowerCase().includes(searchTerm)) {
      return true
    }
    
    if (tab.text && tab.text.toLowerCase().includes(searchTerm)) {
      return true
    }
    
    // Search in URL
    if (tab.url && tab.url.toLowerCase().includes(searchTerm)) {
      return true
    }
    
    // Search in domain (extract domain from URL)
    if (tab.url) {
      try {
        const url = new URL(tab.url)
        const domain = url.hostname.toLowerCase()
        if (domain.includes(searchTerm)) {
          return true
        }
      } catch (e) {
        // Invalid URL, ignore domain search
      }
    }
    
    return false
  }

  // Helper function to check if tab matches tag filter
  const tabMatchesTags = (tab, tagFilter) => {
    // Check if tab has tags_id array
    if (!tab.tags_id || !Array.isArray(tab.tags_id) || tab.tags_id.length === 0) {
      return false
    }

    // tagFilter should be an array of tag IDs
    const filterTagIds = tagFilter.map(tag => tag.id).filter(id => id !== undefined)
    
    if (filterTagIds.length === 0) {
      return false
    }

    // Check if any of the filter tag IDs match the tab's tag IDs
    return filterTagIds.some(filterId => tab.tags_id.includes(filterId))
  }

  // Search open tabs (text search only)
  const searchOpenTabs = (textQuery, controller) => {
    const searchTerm = textQuery ? textQuery.toLowerCase().trim() : ''
    const results = []

    if (!searchTerm) {
      return results
    }

    // Get open tabs from TabsOpen store
    const sessionsOpen = tabsOpenStore.sessionsOpen

    // Search in open tabs (text search only)
    if (sessionsOpen && sessionsOpen.length > 0) {
      for (const window of sessionsOpen) {
        for (const tab of window.tabs) {
          if (controller.signal.aborted) return results
          if (matchesSearchTerm(tab, searchTerm)) {
            results.push(tab)
          }
        }
      }
    }
    return results
  }

  // Search remote tabs (text + tags)
  const searchTabsRemote = async (textQuery, tagFilter, controller) => {
    const searchTerm = textQuery ? textQuery.toLowerCase().trim() : ''
    let results = []

    if (!searchTerm && (!tagFilter || tagFilter.length === 0)) {
      return results
    }

    // SEARCH-ONLY MODE: search by querying remote server
    if (!tabsRemoteStore.isFetchAllTabsFromRemoteOnInit) {
      // In search-only mode, perform remote search
      try {
        const searchParams = {
          text: searchTerm,
          tags_id: tagFilter ? tagFilter.map(tag => tag.id || tag).filter(id => id !== undefined) : []
        }
        console.log('TabsSearch store: Performing remote search with params:', searchParams)
        const result = await tabsRemoteStore.searchTabsRemote(searchParams)
        if (result.is_success) {
          results = result.data || []
        } else {
          console.error('TabsSearch store: Remote search failed:', result.message)
          results = []
        }
      } catch (error) {
        console.error('TabsSearch store: Error during remote search:', error)
        results = []
      }
    } else { 
      // FETCH-ALL MODE: all tabs have been downloaded to local. search locally cached tabs
      const sessionsRemote = tabsRemoteStore.sessionsRemote
      if (sessionsRemote && Object.keys(sessionsRemote).length > 0) {
        for (const [sessionId, sessionTabs] of Object.entries(sessionsRemote)) {
          if (sessionTabs.tabs) {
            for (const [tabId, tab] of Object.entries(sessionTabs.tabs)) {
              if (controller.signal.aborted) return results
              
              // Check text match if we have text query
              const textMatches = !searchTerm || matchesSearchTerm(tab, searchTerm)
              
              // Check tag match if we have tag filter
              let tagMatches = true
              if (tagFilter && tagFilter.length > 0) {
                tagMatches = tabMatchesTags(tab, tagFilter)
              }
              
              // Include tab if it matches both text and tag criteria
              if (textMatches && tagMatches) {
                results.push(tab)
              }
            }
          }
        }
      }
    }
    console.log('TabsSearch store: searchTabsRemote(): results:', results)
    return results
  }

  // Main search function that coordinates open and remote searches
  const performSearch = async (textQuery, tagFilter, controller) => {
    console.log('TabsSearch store: Performing search - text:', textQuery, 'tags:', tagFilter)
    
    if (!textQuery && (!tagFilter || tagFilter.length === 0)) {
      searchState.sessionsOpenSearchResults = []
      searchState.sessionsRemoteSearchResults = []
      searchState.isSearching = false
      return
    }

    // Set searching state
    searchState.isSearching = true

    try {
      // Check if search was cancelled
      if (controller.signal.aborted) return

      // Search open tabs (text only)
      const sessionsOpenSearchResults = searchOpenTabs(textQuery, controller)
      if (controller.signal.aborted) return

      // Search remote tabs (text + tags)
      const sessionsRemoteSearchResults = await searchTabsRemote(textQuery, tagFilter, controller)
      if (controller.signal.aborted) return
      
      console.log(`TabsSearch store: performSearch(): Search completed - \
        Open: ${sessionsOpenSearchResults.length}, Remote: ${sessionsRemoteSearchResults.length}`)

      // Update search results
      searchState.sessionsOpenSearchResults = sessionsOpenSearchResults
      searchState.sessionsRemoteSearchResults = sessionsRemoteSearchResults

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('TabsSearch store: Search was cancelled')
      } else {
        console.error('TabsSearch store: Search error:', error)
      }
    } finally {
      // Clear searching state
      searchState.isSearching = false
    }
  }

  // Start search with current search state
  const startSearch = async (controller) => {
    console.log('TabsSearch store: Starting search - text:', searchState.searchQuery, 'tags:', searchState.tagsSelected)
    
    try {
      await performSearch(searchState.searchQuery, searchState.tagsSelected, controller)
    } catch (error) {
      console.error('TabsSearch store: Error in startSearch:', error)
    }
  }

  return {
    // State
    searchState,
    // Methods
    updateSearchState,
    clearSearchState,
    onTabsOpenRemoved,
    onTabsRemoteRemoved,
    setSearchQuery,
    setSelectedTags,
    // Search methods
    performSearch,
    searchOpenTabs,
    searchTabsRemote,
    startSearch,
    matchesSearchTerm,
    tabMatchesTags,
  }
})

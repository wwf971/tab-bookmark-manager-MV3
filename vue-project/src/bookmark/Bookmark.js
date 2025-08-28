import { defineStore } from 'pinia'
import { ref, onScopeDispose } from 'vue'
import {
  uploadTabToServer
} from '@/sessions-remote/SessionsRemoteRequest.js'



export const useBookmarkStore = defineStore('bookmark', () => {
  const bookmarksLocal = ref({})
  const bookmarksChildren = ref({})
  const bookmarksLocalRootId = ref('')
  const hasInit = ref(false)
  const isListening = ref(false)

  // Store references to the listener functions for cleanup
  let onCreatedListener = null
  let onRemovedListener = null
  let onChangedListener = null
  let onMovedListener = null
  const listenToBookmarksLocalChange = () => {
    if (isListening.value) {
      console.log('Bookmark listeners already registered')
      return
    }
    
    // Handle bookmark creation
    onCreatedListener = (id, bookmark) => {
      console.log('Bookmark created:', id, bookmark)
      
      // add the new bookmark to our local store
      bookmarksLocal.value[id] = {
        id: bookmark.id,
        title: bookmark.title,
        parentId: bookmark.parentId,
        index: bookmark.index,
        dateAdded: bookmark.dateAdded,
        dateGroupModified: bookmark.dateGroupModified,
        ...(bookmark.url && { url: bookmark.url })
      }
      
      // Update parent's children list
      if (bookmark.parentId) {
        if (!bookmarksChildren.value[bookmark.parentId]) {
          bookmarksChildren.value[bookmark.parentId] = []
        }
        
        // Insert at the correct index
        const parentChildren = [...bookmarksChildren.value[bookmark.parentId]]
        parentChildren.splice(bookmark.index, 0, id)
        bookmarksChildren.value[bookmark.parentId] = parentChildren
      }
      
      // Initialize children list for folders
      bookmarksChildren.value[id] = bookmark.url ? null : []
    }
    
    // Handle bookmark removal
    onRemovedListener = (id, removeInfo) => {
      console.log('Bookmark removed:', id, removeInfo)
      
      // Remove from local store
      delete bookmarksLocal.value[id]
      delete bookmarksChildren.value[id]
      
      // Remove from parent's children list
      if (removeInfo.parentId && bookmarksChildren.value[removeInfo.parentId]) {
        bookmarksChildren.value[removeInfo.parentId] = bookmarksChildren.value[removeInfo.parentId].filter(childId => childId !== id)
      }
    }
    
    // Handle bookmark changes (title, URL)
    onChangedListener = (id, changeInfo) => {
      console.log('Bookmark changed:', id, changeInfo)
      
      if (bookmarksLocal.value[id]) {
        // Update the bookmark properties
        Object.assign(bookmarksLocal.value[id], changeInfo)
      }
    }
    
    // Handle bookmark moves
    onMovedListener = (id, moveInfo) => {
      console.log('Bookmark moved:', id, moveInfo)
      
      if (bookmarksLocal.value[id]) {
        // Update bookmark's parentId and index
        bookmarksLocal.value[id].parentId = moveInfo.parentId
        bookmarksLocal.value[id].index = moveInfo.index
        
        // Remove from old parent's children list
        if (moveInfo.oldParentId && bookmarksChildren.value[moveInfo.oldParentId]) {
          bookmarksChildren.value[moveInfo.oldParentId] = bookmarksChildren.value[moveInfo.oldParentId].filter(childId => childId !== id)
        }
        
        // Add to new parent's children list at correct index
        if (moveInfo.parentId) {
          if (!bookmarksChildren.value[moveInfo.parentId]) {
            bookmarksChildren.value[moveInfo.parentId] = []
          }
          
          const parentChildren = [...bookmarksChildren.value[moveInfo.parentId]]
          parentChildren.splice(moveInfo.index, 0, id)
          bookmarksChildren.value[moveInfo.parentId] = parentChildren
        }
      }
    }
    
    // Register all listeners
    chrome.bookmarks.onCreated.addListener(onCreatedListener)
    chrome.bookmarks.onRemoved.addListener(onRemovedListener)
    chrome.bookmarks.onChanged.addListener(onChangedListener)
    chrome.bookmarks.onMoved.addListener(onMovedListener)
    
    console.log('Bookmark change listeners registered')
    isListening.value = true
  }
  const stopListenToBookmarksLocalChange = () => {
    if (!isListening.value) {
      console.log('No bookmark listeners to remove')
      return
    }
    
    // Remove all listeners
    if (onCreatedListener) {
      chrome.bookmarks.onCreated.removeListener(onCreatedListener)
      onCreatedListener = null
    }
    if (onRemovedListener) {
      chrome.bookmarks.onRemoved.removeListener(onRemovedListener)
      onRemovedListener = null
    }
    if (onChangedListener) {
      chrome.bookmarks.onChanged.removeListener(onChangedListener)
      onChangedListener = null
    }
    if (onMovedListener) {
      chrome.bookmarks.onMoved.removeListener(onMovedListener)
      onMovedListener = null
    }
    console.log('Bookmark change listeners removed')
    isListening.value = false
  }

  const loadBookmarksLocal = async () => {
    try {
      // check if chrome bookmarks API is available
      if (!chrome || !chrome.bookmarks || !chrome.bookmarks.getTree) {
        console.warn('chrome bookmarks API not available')
        hasInit.value = false
        return { is_success: false, message: 'Chrome bookmarks API not available' }
      }

      // Get the complete bookmark tree
      const bookmarkTree = await chrome.bookmarks.getTree()
      
      // Get the root node (first element in the array)
      const rootNode = bookmarkTree[0]
      
      // Store the root ID
      bookmarksLocalRootId.value = rootNode.id
      
      // Create empty dictionaries
      const bookmarksDict = {}
      const _bookmarksChildren = {}
      
      // Process the entire tree starting from root
      _processBookmarkNode(rootNode, bookmarksDict, _bookmarksChildren)
      
      // Update the reactive references
      bookmarksLocal.value = bookmarksDict
      bookmarksChildren.value = _bookmarksChildren
      
      console.log('Bookmarks loaded successfully:', Object.keys(bookmarksDict).length, 'items')
      hasInit.value = true
      return { is_success: true, message: 'Bookmarks loaded successfully' }
    } catch (error) {
      console.error('Failed to load bookmarks:', error)
      hasInit.value = false
      return { is_success: false, message: error.message }
    }
  }


  // bookmark tree retrieved from chrome --> local dictionary
  const _processBookmarkNode = (node, bookmarksDict, _bookmarksChildren) => {
    // Create the bookmark entry (without children attribute)
    const bookmarkEntry = {
      id: node.id,
      title: node.title,
      parentId: node.parentId,
      index: node.index,
      dateAdded: node.dateAdded,
      dateGroupModified: node.dateGroupModified
    }

    // If it's a bookmark (has URL), add the URL
    if (node.url) {
      bookmarkEntry.url = node.url
    }

    // Store bookmark in dictionary with ID as key
    bookmarksDict[node.id] = bookmarkEntry

    // If it's a folder (has children), store children IDs separately
    if (node.children && node.children.length > 0) {
      _bookmarksChildren[node.id] = node.children.map(child => child.id)
      
      // Recursively process all children
      node.children.forEach(child => {
        _processBookmarkNode(child, bookmarksDict, _bookmarksChildren)
      })
    } else {
      // For leaf nodes, set null or don't set anything (undefined)
      _bookmarksChildren[node.id] = null
    }
  }


  const getBookmarkLocalById = (id) => {
    return bookmarksLocal.value[id]
  }

  // Helper function to get all children of a folder (recursively)
  const getBookmarkChildren = (id, recursive = false) => {
    const childrenIds = bookmarksChildren.value[id]
    if (!childrenIds || childrenIds.length === 0) {
      return []
    }

    let children = childrenIds.map(childId => bookmarksLocal.value[childId]).filter(Boolean)
    
    if (recursive) {
      // Add all descendants
      childrenIds.forEach(childId => {
        children = children.concat(getBookmarkChildren(childId, true))
      })
    }
    
    return children
  }

  // Helper function to get bookmark path (breadcrumb)
  const getBookmarkPath = (id) => {
    const path = []
    let idCurrent = id
    
    while (idCurrent && bookmarksLocal.value[idCurrent]) {
      const bookmark = bookmarksLocal.value[idCurrent]
      path.unshift(bookmark)
      idCurrent = bookmark.parentId
    }
    
    return path
  }

  const removeBookmarkLocal = async (id) => {
    try {
      // Get bookmark details before removal
      const bookmark = bookmarksLocal.value[id]
      if (!bookmark) {
        console.warn(`removeBookmarkLocal(): Bookmark with ID ${id} not found`)
        return { is_success: false, message: 'Bookmark not found' }
      }

      // Remove from Chrome bookmarks
      await chrome.bookmarks.remove(id)
      
      // Note: The onRemoved listener will automatically update our local stores
      // when Chrome confirms the removal, so we don't need to manually update here
      
      console.log(`removeBookmarkLocal(): Successfully removed bookmark ${id}`)
      return { is_success: true, message: 'Bookmark removed successfully' }
    } catch (error) {
      console.error('removeBookmarkLocal(): Error removing bookmark:', error)
      return { is_success: false, message: error.message }
    }
  }


  const uploadBookmarkLocalToRemote = async (id, options = {}) => {
    try {
      const { 
        delete_after_upload = true, 
        tags_name = [], 
        tags_id = [], 
        comment = '',
        task = 'create_tab_remote'
      } = options
      
      // Get bookmark details
      const bookmark = bookmarksLocal.value[id]
      if (!bookmark) {
        console.warn(`uploadBookmarkLocalToRemote(): Bookmark with ID ${id} not found`)
        return { is_success: false, message: 'Bookmark not found' }
      }

      // Only upload bookmarks (not folders)
      if (!bookmark.url) {
        console.warn(`uploadBookmarkLocalToRemote(): Cannot upload folder ${id}`)
        return { is_success: false, message: 'Cannot upload folders, only bookmarks' }
      }

      // Import required stores
      const { useNetworkRequest } = await import('@/network/NetworkRequest.js')
      const { useTabsRemote } = await import('@/sessions-remote/SessionsRemote.js')
      const networkRequest = useNetworkRequest()
      const tabsRemoteStore = useTabsRemote()

      // Prepare tab object for upload (convert bookmark to tab format)
      const tabForUpload = {
        url: bookmark.url,
        title: bookmark.title,
        id: bookmark.id,
        dateAdded: bookmark.dateAdded,
        dateGroupModified: bookmark.dateGroupModified
      }

      // upload using NetworkRequest store
      const uploadResult = await tabsRemoteStore.uploadTabToServer({
        tab: tabForUpload,
        options: { task, tags_name, tags_id, comment },
        fetchTabsRemoteRecent: true
      })

      if (uploadResult.is_success) {
        console.log(`uploadBookmarkLocalToRemote(): Successfully uploaded bookmark ${id}`)
        
        // If successful and delete_after_upload is true, remove the local bookmark
        if (delete_after_upload) {
          const removeResult = await removeBookmarkLocal(id)
          if (removeResult.is_success) {
            console.log(`uploadBookmarkLocalToRemote(): Successfully removed local bookmark ${id} after upload`)
          } else {
            console.warn(`uploadBookmarkLocalToRemote(): Failed to remove local bookmark ${id} after upload:`, removeResult.message)
          }
        }

        // Refresh remote tabs to show the newly uploaded bookmark
        try {
          await tabsRemoteStore.fetchTabsRemoteRecent(50)
        } catch (refreshError) {
          console.warn('uploadBookmarkLocalToRemote(): Failed to refresh recent tabs after upload:', refreshError)
        }

        return { 
          is_success: true, 
          message: 'Bookmark uploaded successfully',
          data: uploadResult.data,
          deleted_locally: delete_after_upload
        }
      } else {
        console.error(`uploadBookmarkLocalToRemote(): Failed to upload bookmark ${id}:`, uploadResult.message)
        return uploadResult
      }
    } catch (error) {
      console.error('uploadBookmarkLocalToRemote(): Error uploading bookmark:', error)
      return { is_success: false, message: error.message }
    }
  }

  // detect duplicate bookmarks with different criteria
  const detectDuplicateBookmarksLocal = (criteria = 'url') => {
    const duplicates = {}
    const bookmarksOnly = {}
    
    // normalize criteria to array format
    const criteriaArray = Array.isArray(criteria) ? criteria : [criteria]
    
    // first, collect only bookmarks (not folders)
    Object.values(bookmarksLocal.value).forEach(bookmark => {
      if (bookmark.url) {  // only bookmarks have URLs
        bookmarksOnly[bookmark.id] = bookmark
      }
    })
    
    // group by the specified criteria
    Object.values(bookmarksOnly).forEach(bookmark => {
      const keyParts = []
      
      criteriaArray.forEach(criterion => {
        switch (criterion) {
          case 'url':
            keyParts.push(bookmark.url || '')
            break
          case 'title':
            keyParts.push(bookmark.title?.toLowerCase().trim() || '')
            break
          default:
            keyParts.push(bookmark.url || '')
        }
      })
      
      const key = keyParts.join('|||')
      
      if (!duplicates[key]) {
        duplicates[key] = []
      }
      duplicates[key].push(bookmark)
    })
    
    // filter out groups with only one bookmark (not duplicates)
    const duplicateGroups = {}
    Object.entries(duplicates).forEach(([key, bookmarksList]) => {
      if (bookmarksList.length > 1) {
        duplicateGroups[key] = bookmarksList
      }
    })
    
    return {
      groups: duplicateGroups,
      groupNum: Object.keys(duplicateGroups).length,
      groupTabsNum: Object.values(duplicateGroups).reduce((sum, group) => sum + group.length, 0),
      criteria: criteriaArray
    }
  }

  // Auto-initialize the store when it's first used
  const init = async () => {
    if (hasInit.value) {
      console.log('Bookmark store already initialized')
      return
    }
    try {
      await loadBookmarksLocal()
      listenToBookmarksLocalChange()
      console.log('Bookmark store initialized successfully')
    } catch (error) {
      console.error('Failed to initialize bookmark store:', error)
    }
  }

  // Auto-initialize when store is created
  init()

  // Cleanup when the store scope is disposed
  onScopeDispose(() => {
    console.log('Bookmark store scope disposed, cleaning up listeners')
    stopListenToBookmarksLocalChange()
  })

  return {
    bookmarksLocal,
    bookmarksChildren,
    bookmarksLocalRootId,
    hasInit,
    isListening,
    loadBookmarksLocal,
    getBookmarkLocalById,
    getBookmarkChildren,
    getBookmarkPath,
    listenToBookmarksLocalChange,
    stopListenToBookmarksLocalChange,
    removeBookmarkLocal,
    uploadBookmarkLocalToRemote,
    detectDuplicateBookmarksLocal,
    init
  }
})
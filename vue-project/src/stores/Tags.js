import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useNetworkRequest } from './NetworkRequest'

export const useTags = defineStore('tags', () => {
  const networkRequest = useNetworkRequest()
  
  // Cache state
  const tagsCache = ref({}) // id -> tag object
  const tagSetCache = ref({}) // id -> tagSet object
  
  // Loading states
  const isLoadingTags = ref(false)
  const isLoadingTagSets = ref(false)
  
  // Computed
  const tagSetsAll = computed(() => Object.values(tagSetCache.value))
  
  // Cache management
  const updateTagsCache = (tags) => {
    // console.log('Tags.js: updateTagsCache: tags:', tags)
    if (Array.isArray(tags)) {
      tags.forEach(tag => {
        const tagExisting = tagsCache.value[tag.id]
        if (tagExisting && tagExisting.status) {
          // update existing reactive reference without changing the reference
          // preserve important fields like 'type' that components expect
          Object.assign(tagExisting, {
            ...tag,
            status: 'loaded',
            type: tagExisting.type || 'tag' // preserve existing type
          })
          // console.log('Tags.js: updateTagsCache: updated tagExisting:', tagExisting)
        } else {
          // create new entry with loaded status
          tagsCache.value[tag.id] = {
            ...tag,
            status: 'loaded',
            type: 'tag' // ensure type is set for new entries
          }
        }
      })
    } else {
      // single tag
      const tagExisting = tagsCache.value[tags.id]
      if (tagExisting && tagExisting.status) {
        // update existing reactive reference without changing the reference
        // preserve important fields like 'type' that components expect
        Object.assign(tagExisting, {
          ...tags,
          status: 'loaded',
          type: tagExisting.type || 'tag' // preserve existing type
        })
        // console.log('Tags.js: updateTagsCache: updated tagExisting single:', tagExisting)
      } else {
        // create new entry with loaded status
        tagsCache.value[tags.id] = {
          ...tags,
          status: 'loaded',
          type: 'tag' // ensure type is set for new entries
        }
      }
    }
  }

  const updateTagSetCache = (tagSet) => {
    // Extract and cache tags if they exist
    if (tagSet.tags && Array.isArray(tagSet.tags)) {
      updateTagsCache(tagSet.tags)
    }
    
    // Create a clean tag set object with only tags_id
    const cleanTagSet = {
      ...tagSet,
      tags_id: tagSet.tags_id || tagSet.tags?.map(tag => tag.id) || []
    }
    
    // Remove the tags attribute - we only store tags_id
    delete cleanTagSet.tags
    
    tagSetCache.value[cleanTagSet.id] = cleanTagSet
  }

  // immediately returns reactive references
  const getTagsRefById = (tagsId) => {
    // console.log('Tags.js: getTagsRefById: tagsId:', tagsId)
    
    if (!Array.isArray(tagsId)) {
      return []
    }
    
    const tagRefs = []
    const tagsIdToFetch = []
    tagsId.forEach(tagId => {
      let tagRef = tagsCache.value[tagId]
      if (!tagRef) {
        // create loading placeholder immediately
        tagRef = {
          id: tagId,
          name: 'Loading...',
          status: 'loading',
          type: 'tag' // ensure type is set for components
        }
        tagsCache.value[tagId] = tagRef
        tagsIdToFetch.push(tagId)
        // console.log('Tags.js: getTagsRefById: created loading placeholder for tagId:', tagId, tagRef)
      } else if (tagRef.status === 'load_fail') {
        // retry failed loads
        tagRef.status = 'loading'
        tagRef.name = 'Loading...'
        tagsIdToFetch.push(tagId)
        // console.log('Tags.js: getTagsRefById: retrying failed tag:', tagId)
      } else {
        // console.log('Tags.js: getTagsRefById: using existing tagRef for tagId:', tagId, 'status:', tagRef.status, 'name:', tagRef.name)
      }
      // if status is 'loaded' or 'loading', just use the existing reference
      tagRefs.push(tagRef)
    })
    
    // start async fetching for tags that need to be loaded
    if (tagsIdToFetch.length > 0) {
      fetchTagsAsync(tagsIdToFetch)
    }
    
    // console.log('Tags.js: getTagsRefById: returning tagRefs:', tagRefs)
    return tagRefs
  }

  // helper method to fetch tags asynchronously and update cache
  const fetchTagsAsync = async (tagsIdToFetch) => {
    console.log('Tags.js: fetchTagsAsync: tagsIdToFetch:', tagsIdToFetch)
    
    try {
      const result = await networkRequest.getTagsById(tagsIdToFetch)
      if (result.is_success && Array.isArray(result.data)) {
        // updateTagsCache will handle updating the existing reactive references
        console.log('Tags.js: fetchTagsAsync: received data from server:', result.data)
        
        // log the current state before update
        tagsIdToFetch.forEach(tagId => {
          const tagRef = tagsCache.value[tagId]
          console.log('Tags.js: fetchTagsAsync: BEFORE update - tagId:', tagId, 'tagRef:', tagRef)
        })
        
        updateTagsCache(result.data)
        console.log('Tags.js: fetchTagsAsync: successfully loaded tags')
        
        // log the state after update to verify reactive changes
        tagsIdToFetch.forEach(tagId => {
          const tagRef = tagsCache.value[tagId]
          console.log('Tags.js: fetchTagsAsync: AFTER update - tagId:', tagId, 'tagRef:', tagRef)
        })
      } else {
        // mark failed tags
        tagsIdToFetch.forEach(tagId => {
          const tagRef = tagsCache.value[tagId]
          if (tagRef && tagRef.status === 'loading') {
            Object.assign(tagRef, {
              name: `Tag ${tagId}`,
              status: 'load_fail'
            })
          }
        })
        console.warn('Tags.js: fetchTagsAsync: failed to load tags:', result.message)
      }
    } catch (error) {
      // mark all as failed
      tagsIdToFetch.forEach(tagId => {
        const tagRef = tagsCache.value[tagId]
        if (tagRef && tagRef.status === 'loading') {
          Object.assign(tagRef, {
            name: `Tag ${tagId}`,
            status: 'load_fail'
          })
        }
      })
      console.error('Tags.js: fetchTagsAsync: error fetching tags:', error)
    }
  }


  // Fetch methods with caching
  const refreshTagSet = async (tagSetIdOrName) => {
    try {
      const result = await networkRequest.getTagSet(tagSetIdOrName)
      if (result.is_success) {
        updateTagSetCache(result.data)
        return result.data
      }
      return { is_success: false, message: result.message }
    } catch (error) {
      console.error('Error refreshing tag set:', error)
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  const getTagsById = async (tagsId) => {
    // Fetch a list of tags from server by their id
    console.log('Tags.js: getTagsById: tagsId:', tagsId)
    const tagsIdToFetch = tagsId.filter(id => {
      const tag = tagsCache.value[id]
      return !tag || tag.status === 'load_fail' || tag.status === 'loading'
    })
    
    if (tagsIdToFetch.length === 0) {
      const tags = tagsId.map(id => tagsCache.value[id]).filter(tag => tag && tag.status === 'loaded')
      return {
        is_success: true,
        data: tags,
        message: 'All tags are already loaded in cache'
      }
    }
    
    console.log('Tags.js: getTagsById: tagsIdToFetch:', tagsIdToFetch)
    try {
      isLoadingTags.value = true
      const result = await networkRequest.getTagsById(tagsIdToFetch)
      if (result.is_success) {
        updateTagsCache(result.data)
        const tags = tagsId.map(id => tagsCache.value[id]).filter(tag => tag && tag.status === 'loaded')
        console.log('Tags.js: getTagsById: tags to return:', tags)
        return {is_success: true, data: tags, message: 'Tags successfully loaded'}
      }
      return { is_success: false, message: result.message }
    } catch (error) {
      console.error('Error refreshing tags:', error)
      return { is_success: false, message: error.message || 'Network error' }
    } finally {
      isLoadingTags.value = false
    }
  }

  // Get methods with caching
  const getTagSet = async (tagSetId) => {
    if (tagSetCache.value[tagSetId]) {
      return tagSetCache.value[tagSetId]
    }
    return await refreshTagSet(tagSetId)
  }

  // Get tags from a specific tag set (by ID or name)
  const getTagsFromTagSet = (tagSetIdOrName) => {
    // Find tag set by ID or name
    let tagSet = tagSetCache.value[tagSetIdOrName]
    if (!tagSet) {
      // Try to find by name
      tagSet = Object.values(tagSetCache.value).find(ts => ts.name === tagSetIdOrName)
    }
    
    if (!tagSet || !tagSet.tags_id) {
      return []
    }
    // Return tag objects for the tag IDs in this tag set
    return tagSet.tags_id
      .map(tagId => tagsCache.value[tagId])
      .filter(tag => tag) // Filter out undefined tags
  }

  const gettagSetsAll = async (forceRefresh = false) => {
    // Return cached data if available and not forcing refresh
    if (!forceRefresh && Object.keys(tagSetCache.value).length > 0) {
      return tagSetsAll.value
    }
    
    try {
      isLoadingTagSets.value = true
      const result = await networkRequest.gettagSetsAll()
      if (result.is_success) {
        // Clear cache before updating to ensure consistency
        tagSetCache.value = {}
        result.data.forEach(tagSet => updateTagSetCache(tagSet))
        return result.data
      }
      return { is_success: false, message: result.message }
    } catch (error) {
      console.error('Error fetching all tag sets:', error)
      return { is_success: false, message: error.message || 'Network error' }
    } finally {
      isLoadingTagSets.value = false
    }
  }

  const searchTags = async (searchStr) => {
    try {
      const result = await networkRequest.searchTag(searchStr)
      // console.log('Tags.js: searchTags: result:', result)
      if (result.is_success) {
        updateTagsCache(result.data)
        return result.data
      }
      return { is_success: false, message: result.message }
    } catch (error) {
      console.error('Error searching tags:', error)
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  // Check if a tag exists by exact name without polluting cache
  const checkTagExist = async (tagName) => {
    try {
      const result = await networkRequest.searchTag(tagName)
      if (result.is_success) {
        const exactMatch = result.data.find(tag => tag.name === tagName)
        if (exactMatch) {
          // Only add the exact match to cache, not all search results
          updateTagsCache([exactMatch])
          return { is_success: true, data: exactMatch }
        }
        return { is_success: false, message: 'Tag not found' }
      }
      return { is_success: false, message: result.message }
    } catch (error) {
      console.error('Error checking tag existence:', error)
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  const getTagById = async (tagId) => {
    // Return from cache if available and loaded
    const tagCached = tagsCache.value[tagId]
    if (tagCached && tagCached.status === 'loaded') {
      return tagCached
    }
    
    // Fetch from server if not cached, loading, or failed
    try {
      const result = await networkRequest.getTagById(tagId)
      if (result.is_success) {
        updateTagsCache([result.data])
        return tagsCache.value[tagId] // Return the cached version with status
      }
      return { is_success: false, message: result.message }
    } catch (error) {
      console.error('Error fetching tag by ID:', error)
      console.log(error.stack)
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  const renameTag = async (tagId, newName) => {
    try {
      const result = await networkRequest.renameTag(tagId, newName)
      if (result.is_success) {
        // Update local cache
        if (tagsCache.value[tagId]) {
          tagsCache.value[tagId].name = newName
        }
        return result
      }
      return { is_success: false, message: result.message }
    } catch (error) {
      console.error('Error renaming tag:', error)
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  const mergeTag = async (sourceTagId, destTagId) => {
    try {
      const result = await networkRequest.mergeTag(sourceTagId, destTagId)
      if (result.is_success) {
        // Complex local cache update:
        
        // 1. Remove source tag from tagsCache
        delete tagsCache.value[sourceTagId]
        
        // 2. Update all tag sets that contain the source tag
        Object.values(tagSetCache.value).forEach(tagSet => {
          if (tagSet.tags_id && tagSet.tags_id.includes(sourceTagId)) {
            const sourceIndex = tagSet.tags_id.indexOf(sourceTagId)
            
            // Remove source tag
            tagSet.tags_id.splice(sourceIndex, 1)
            
            // Add destination tag if not already present
            if (!tagSet.tags_id.includes(destTagId)) {
              tagSet.tags_id.push(destTagId)
            }
          }
        })
        
        // 3. Note: Remote tabs cache update would need to be handled by 
        // the component that manages remote tabs, as this store doesn't have access to that data
        
        return result
      }
      return { is_success: false, message: result.message }
    } catch (error) {
      console.error('Error merging tag:', error)
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  // Tag set operations
  const addTagsToTagSet = async (tagSetId, tagsId) => {
    try {
      // Validate tag set exists in cache
      if (!tagSetCache.value[tagSetId]) {
        return { is_success: false, message: 'Tag set not found in cache' }
      }
        
      // Initialize tags_id array if needed
      if (!tagSetCache.value[tagSetId].tags_id) {
        tagSetCache.value[tagSetId].tags_id = []
      }

      // Check if tags are already in tag set
      const currentTagsId = tagSetCache.value[tagSetId].tags_id
      const newTagsId = tagsId.filter(tagId => !currentTagsId.includes(tagId))
    //   console.log('addTagsToTagSet() newTagsId:', newTagsId)
      if (newTagsId.length === 0) {
        return { is_success: true, message: 'All tags are already in the tag set' }
      }
      // Add only new tags to the set
      const result = await networkRequest.addTagsToTagSet(tagSetId, newTagsId)
    //   console.log('addTagsToTagSet() result:', result)
      if (result.is_success) {
        // Update local cache - add tag IDs to tags_id array
        tagSetCache.value[tagSetId].tags_id.push(...newTagsId)
        // Ensure we have the tag objects in our cache
        await getTagsById(newTagsId)
      }
      return result
    } catch (error) {
      console.error('Error in addTagsToTagSet:', {
        message: error.message,
        stack: error.stack,
        lineNumber: error.lineNumber,
        fileName: error.fileName
      })
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  const removeTagsFromTagSet = async (tagSetId, tagsId) => {
    try {
      const result = await networkRequest.removeTagsFromTagSet(tagSetId, tagsId)
      if (result.is_success) {
        // Update local cache
        if (tagSetCache.value[tagSetId] && tagSetCache.value[tagSetId].tags_id) {
          const tagSet = tagSetCache.value[tagSetId]
          tagSet.tags_id = tagSet.tags_id.filter(id => !tagsId.includes(id))
        }
      }
      return result
    } catch (error) {
      console.error('Error removing tag from set:', error)
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  const changeTagOrderInTagSet = async (tagSetId, tagId, newPosition) => {
    try {
      const result = await networkRequest.changeTagOrderInTagSet(tagSetId, tagId, newPosition)
      if (result.is_success) {
        // Update local cache - reorder the tags array
        if (tagSetCache.value[tagSetId] && tagSetCache.value[tagSetId].tags_id) {
          const tagSet = tagSetCache.value[tagSetId]
          const draggedTagIndex = tagSet.tags_id.findIndex(id => id === tagId)
          if (draggedTagIndex >= 0) {
            const [draggedTag] = tagSet.tags_id.splice(draggedTagIndex, 1)
            tagSet.tags_id.splice(newPosition, 0, draggedTag)
          }
        } 
      }
      return result
    } catch (error) {
      console.error('Error reordering tags in set:', error)
      return { is_success: false, message: error.message || 'Network error' }
    }
  }

  // Clear cache methods
  const clearTagsCache = () => {
    tagsCache.value = {}
  }

  const clearTagSetCache = () => {
    tagSetCache.value = {}
  }

  const clearAllCache = () => {
    clearTagsCache()
    clearTagSetCache()
  }

  return {
    // State
    tagsCache,
    tagSetCache,
    isLoadingTags,
    isLoadingTagSets,
    
    // Computed
    tagSetsAll,
    
    // Cache management
    updateTagsCache,
    updateTagSetCache,
    clearTagsCache,
    clearTagSetCache,
    clearAllCache,
    
    // Fetch methods
    refreshTagSet,
    getTagsById,
    getTagsRefById, // NEW: Async reference method
    getTagSet,
    getTagsFromTagSet,
    gettagSetsAll,
    searchTags,
    getTagById,
    
    // Tag set operations
    addTagsToTagSet,
    removeTagsFromTagSet,
    changeTagOrderInTagSet,
    
    // Tag operations
    renameTag,
    mergeTag,
    checkTagExist
  }
})
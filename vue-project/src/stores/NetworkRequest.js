// network request functions
import { defineStore } from 'pinia'

import { get_local_timezone_int } from '../utils/common'
import { useSettingStore } from '@/stores/Settings.js'
import { useServerStore } from '@/stores/Server.js'

import { ref } from 'vue'

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

export const useNetworkRequest = defineStore('networkRequest', ()=>{
  // vuex style store, with state, getters, actions
  const messages = ref([])
  const urlCacheData = ref({
    listIdToName: {},
    listIdToUrlDict: {}
  })
  // Remote URL lists cache: { listId: { name: string, urls: { urlId: { url, text, tags, ... } } } }
  const urlLists = ref({})
  const urlListsLoaded = ref(false)
  const urlListsLoading = ref(false)

  const serverStore = useServerStore()


    const uploadTabToRemote = async (tab, options = {}, fetchTabsRemoteRecent = true) => {
      try {
        const { task = 'create_url_cache', tags_name = [], tags_id = [], comment = ''} = options
        const urlUploadResult = serverStore.getServerEndpoint(`/url_pool/${task}`)
        if (!urlUploadResult.is_success) {
          return urlUploadResult
        }
        const urlUpload = urlUploadResult.data
        const post_dict = {
          task,
          url: tab.url,
          title: tab.title,
          tags_name,
          tags_id,
          // time_create: , // should be unix time stamp in microseconds
          time_create_zone: new Date().getTimezoneOffset() / -60
        }
        // console.log('uploadTabToRemote() tags_name:', tags_name, 'tags_id:', tags_id)
        if(comment && comment !== ''){
          post_dict.comment = comment
        }

        const response = await axiosInstance.post(urlUpload, post_dict);
        // console.log('uploadTabToRemote() response:', response)
        
        // If upload was successful, trigger recent tabs refresh
        if (response.data.is_success) {
          // Import and call the TabsRemote store to refresh recent tabs
          try {
            if (fetchTabsRemoteRecent) {
              const { useTabsRemote } = await import('./TabsRemote.js')
              const tabsRemoteStore = useTabsRemote()
              await tabsRemoteStore.fetchTabsRemoteRecent(50)
            }
          } catch (refreshError) {
            console.warn('Failed to refresh recent tabs after upload:', refreshError)
          }
        }
        
        return response.data
      } catch (error) {
        console.error('uploadTabToRemote() error:', error)
        return { is_success: false, message: error.message }
      }
    }

    const uploadTabsToRemote = async (tabs, options = {}) => {
      const { tags_name = [], comment = '' } = options
      const results = { success: [], failed: [] }

      for (const tab of tabs) {
        try {
          const result = await uploadTabToRemote(tab, {
            task: 'create_url_cache',
            tags_name,
            comment
          })
          if (result.is_success) {
            results.success.push(tab)
          } else {
            results.failed.push(tab)
          }
        } catch (error) {
          results.failed.push(tab)
        }
      }
      return results
    }

    const checkSessionStatus = async () => {
      try {
        const urlCurrent = serverStore.getUrlCurrent()
        if (!urlCurrent) {
          console.error('checkSessionStatus: No current URL configured')
          return { cookieCount: 0, cookies: [] }
        }
        
        const baseUrl = urlCurrent.url
        const cookies = await chrome.cookies.getAll({ url: baseUrl });
        return {
          cookieCount: cookies.length,
          cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain }))
        };
      } catch (error) {
        console.error('checkSessionStatus error:', error);
        return { cookieCount: 0, cookies: [] };
      }
    }

    const remove_url_cache = async (url) => {
      try {
        const serverUrl = serverStore.getServerEndpoint('/url_pool/')
        if (!serverUrl.is_success) {
          return serverUrl // Return the error from getServerEndpoint
        }
        
        const response = await axiosInstance.post(serverUrl.data, {
          task: 'remove_url_cache',
          id: url.id
        })
        
        const result = response.data
        
        // If deletion was successful, update local state instead of re-fetching
        if (result.is_success) {
          removeUrlFromLocalState(url.id)
        }
        
        return result
      } catch (error) {
        console.error('remove_url_cache error:', error)
        return {
          is_success: false,
          message: `Remove URL cache failed: ${error.message}`
        }
      }
    }

    const update_url_cache_tags = async (url, tags_name_new) => {
      const urlCurrent = serverStore.getUrlCurrent()
      if (!urlCurrent) {
        return {
          is_success: false,
          message: 'No remote URL configured'
        }
      }
      
      try {
        const response = await axiosInstance.post(`${urlCurrent.url}/url_pool/update_url_cache_tags`, {
          task: 'update_url_cache_tags',
          url: url,
          tags_name_new: tags_name_new
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to update URL cache tags'
          }
        }
      } catch (error) {
        console.error('NetworkRequest.js: update_url_cache_tags error:', error)
        return {
          is_success: false,
          message: `Update URL cache tags failed: ${error.message}`
        }
      }
    }

    const setTagsForUrlCache = async ({ id, tags_id = [], tags_name = [] }) => {
      const urlCurrent = serverStore.getUrlCurrent()
      if (!urlCurrent) {
        return {
          is_success: false,
          message: 'No remote URL configured'
        }
      }
      
      try {
        const response = await axiosInstance.post(`${urlCurrent.url}/url_pool/set_tags_for_url_cache`, {
          task: 'set_tags_for_url_cache',
          id: id,
          tags_id: tags_id,
          tags_name: tags_name
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to set tags for URL cache'
          }
        }
      } catch (error) {
        console.error('NetworkRequest.js: setTagsForUrlCache error:', error)
        return {
          is_success: false,
          message: `Set tags for URL cache failed: ${error.message}`
        }
      }
    }

    const fetchTabsFromRemote = async (type = '', forceRefresh = false) => {
      // Return cached data if available and not forcing refresh
      if (!forceRefresh && urlListsLoaded && !urlListsLoading) {
        return { 
          is_success: true, 
          data: urlLists,
          from_cache: true
        }
      }

      // Don't make multiple concurrent requests
      if (urlListsLoading) {
        // Wait for the current request to complete
        while (urlListsLoading) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        return { 
          is_success: true, 
          data: urlLists,
          from_cache: true
        }
      }

      urlListsLoading = true

      try {

        const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'get_all_url_cache',
          name: type
        })
        
        const result = response.data
        if (result.is_success && result.data) {
          // Update the store state
          urlLists = result.data
          urlListsLoaded = true
        }
        
        return result
      } catch (error) {
        console.error(`fetchTabsFromRemote error:`, error)
        
        // Provide more specific error messages
        if (error.response) {
          const status = error.response.status
          const data = error.response.data
          
          if (status === 401 || status === 403) {
            return { is_success: false, message: 'Authentication required. Please login first.' }
          } else if (status === 404) {
            return { is_success: false, message: 'Server endpoint not found. Check your URL configuration.' }
          } else if (status >= 500) {
            return { is_success: false, message: 'Server error. Please try again later.' }
          } else if (data?.message) {
            return { is_success: false, message: data.message }
          }
        } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
          return { is_success: false, message: 'Network error. Check your connection and server URL.' }
        }
        
        return { is_success: false, message: error.message || 'Unknown error occurred' }
      } finally {
        urlListsLoading = false
      }
    }

    const searchTag = async (searchStr, useIndex = false) => {
      try {
        const tagUrlResult = serverStore.getServerEndpoint('/note/')
        if (!tagUrlResult.is_success) {
          return tagUrlResult
        }
        const tagUrl = tagUrlResult.data
        
        const response = await axiosInstance.post(tagUrl, {
          task: 'search_tag',
          search_str: searchStr,
          use_index: useIndex
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to search tags'
          }
        }
      } catch (error) {
        console.error('searchTag error:', error)
        return {
          is_success: false,
          message: `Search failed: ${error.message}`
        }
      }
    }

    const getTagByName = async (name) => {
      const urlCurrent = serverStore.getUrlCurrent()
      if (!urlCurrent) {
        return {
          is_success: false,
          message: 'No remote URL configured'
        }
      }
      
      try {
        const response = await axiosInstance.post(`${urlCurrent.url}/note/get_tag_by_name`, {
          task: 'get_tag_by_name',
          name: name
        })
        
        // console.log('NetworkRequest.js: getTagByName() response:', response.data)
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to get tag by name'
          }
        }
      } catch (error) {
        console.error('Error getting tag by name:', error)
        return {
          is_success: false,
          message: `Get tag by name failed: ${error.message}`
        }
      }
    }
    const getTagsById = async (tags_id) => {
      const urlCurrent = serverStore.getUrlCurrent()
      if (!urlCurrent) {
        return {
          is_success: false,
          message: 'No remote URL configured'
        }
      }
      console.log('NetworkRequest.js: getTagsById() tags_id:', tags_id)
      try {
        const response = await axiosInstance.post(`${urlCurrent.url}/note/get_tags_by_id`, {
          task: 'get_tags_by_id',
          tags_id: tags_id
        })
        console.log('NetworkRequest.js: getTagsById() response:', response.data)
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to get tags by IDs'
          }
        }
      } catch (error) {
        console.error('Error getting tags by IDs:', error)
        return {
          is_success: false,
          message: `Get tags by IDs failed: ${error.message}`
        }
      }
    }
    const getTagById = async (id) => {
      const urlCurrent = serverStore.getUrlCurrent()
      if (!urlCurrent) {
        return {
          is_success: false,
          message: 'No remote URL configured'
        }
      }
      // console.log('NetworkRequest.js: getTagById() urlCurrent:', urlCurrent)
      // console.log('NetworkRequest.js: getTagById() id:', id)
      try {
        const response = await axiosInstance.post(`${urlCurrent.url}/note/get_tag_by_id`, {
          task: 'get_tag_by_id',
          id: id
        })
        
        // console.log('NetworkRequest.js: getTagById() response:', response.data)
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to get tag by ID'
          }
        }
      } catch (error) {
        console.error('Error getting tag by ID:', error)
        return {
          is_success: false,
          message: `Get tag by ID failed: ${error.message}`
        }
      }
    }

    const renameTag = async (id, nameNew) => {
      const urlCurrent = serverStore.getUrlCurrent()
      if (!urlCurrent) {
        return {
          is_success: false,
          message: 'No remote URL configured'
        }
      }
      
      try {
        const response = await axiosInstance.post(`${urlCurrent.url}/note/`, {
          task: 'rename_tag',
          id: id,
          name_new: nameNew
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to rename tag'
          }
        }
      } catch (error) {
        console.error('Error renaming tag:', error)
        return {
          is_success: false,
          message: `Rename tag failed: ${error.message}`
        }
      }
    }

    const mergeTag = async (sourceTagId, destTagId) => {
      const urlCurrent = serverStore.getUrlCurrent()
      if (!urlCurrent) {
        return {
          is_success: false,
          message: 'No remote URL configured'
        }
      }
      
      try {
        const response = await axiosInstance.post(`${urlCurrent.url}/note/`, {
          task: 'merge_tag',
          tag_id_source: sourceTagId,
          tag_id_dest: destTagId
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to merge tag'
          }
        }
      } catch (error) {
        console.error('Error merging tag:', error)
        return {
          is_success: false,
          message: `Merge tag failed: ${error.message}`
        }
      }
    }

    const createSnapshot = async (windows, creatorInfo = {}) => {
      try {
        const urlSnapshot = windows.map(window => ({
          id: window.id,
          tabs: window.tabs.map(tab => ({
            url: tab.url,
            text: tab.title,
            tag_ids: [],
            comment: ''
          }))
        }))
        
        const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'create_url_snapshot',
          url_snapshot: urlSnapshot,
          creator_name: creatorInfo.name,
          creator_id: creatorInfo.id,
          time_zone: get_local_timezone_int()
        });
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to create snapshot'
          }
        }
      } catch (error) {
        console.error('createSnapshot error:', error)
        return {
          is_success: false,
          message: `Create snapshot failed: ${error.message}`
        }
      }
    }

    const getSnapshotInfo = async (id) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'get_url_snapshot_info',
          id
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to get snapshot info'
          }
        }
      } catch (error) {
        console.error('getSnapshotInfo error:', error)
        return {
          is_success: false,
          message: `Get snapshot info failed: ${error.message}`
        }
      }
    }

    const getSnapshot = async (id) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'get_url_snapshot',
          id
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to get snapshot'
          }
        }
      } catch (error) {
        console.error('getSnapshot error:', error)
        return {
          is_success: false,
          message: `Get snapshot failed: ${error.message}`
        }
      }
    }

    const deleteSnapshot = async (id) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'delete_url_snapshot',
          id
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to delete snapshot'
          }
        }
      } catch (error) {
        console.error('deleteSnapshot error:', error)
        return {
          is_success: false,
          message: `Delete snapshot failed: ${error.message}`
        }
      }
    }


    // URL Lists state management methods
    const clearUrlListsCache = () => {
      urlLists = {}
      urlListsLoaded = false
      urlListsLoading = false
    }

    const removeUrlFromLocalState = (urlId) => {
      // Find and remove the URL from local state
      for (const listId in urlLists) {
        const list = urlLists[listId]
        if (list.urls && list.urls[urlId]) {
          delete list.urls[urlId]
          break
        }
      }
    }

    const addUrlToLocalState = (listId, urlData) => {
      if (!urlLists[listId]) {
        urlLists[listId] = { name: listId, urls: {} }
      }
      if (!urlLists[listId].urls) {
        urlLists[listId].urls = {}
      }
      urlLists[listId].urls[urlData.id] = urlData
    }

    const updateUrlInLocalState = (urlId, updatedData) => {
      // Find and update the URL in local state
      for (const listId in urlLists) {
        const list = urlLists[listId]
        if (list.urls && list.urls[urlId]) {
          urlLists[listId].urls[urlId] = { ...list.urls[urlId], ...updatedData }
          break
        }
      }
    }

    const forceRefreshUrlLists = () => {
      return fetchTabsFromRemote('', true)
    }

    // Tag set management APIs
    const gettagSetsAll = async () => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/get_all_tag_set')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'get_all_tag_set'
        })
        console.log('NetworkRequest.js: gettagSetsAll() response:', response.data)
        if (response.data && response.data.is_success) {
          return { is_success: true, data: response.data.data }
        } else {
          return { is_success: false, message: response.data?.message || 'Failed to fetch tag sets' }
        }
      } catch (error) {
        console.error('Error fetching tag sets:', error)
        return { is_success: false, message: error.message || 'Network error' }
      }
    }

    const getTagSet = async (name) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/get_tag_set')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'get_tag_set',
          name: name
        })
        
        if (response.data && response.data.is_success) {
          return { is_success: true, data: response.data.data }
        } else {
          return { is_success: false, message: response.data?.message || 'Failed to fetch tag set' }
        }
      } catch (error) {
        console.error('Error fetching tag set:', error)
        return { is_success: false, message: error.message || 'Network error' }
      }
    }

    const changeTagOrderInTagSet = async (tagSetId, tagId, indexNew) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/change_tag_order_in_tag_set')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'change_tag_order_in_tag_set',
          id: tagSetId,
          tag_id: tagId,
          index_new: indexNew
        })
        
        if (response.data && response.data.is_success) {
          return { is_success: true, data: response.data.data }
        } else {
          return { is_success: false, message: response.data?.message || 'Failed to change tag order' }
        }
      } catch (error) {
        console.error('Error changing tag order:', error)
        return { is_success: false, message: error.message || 'Network error' }
      }
    }

    const removeTagsFromTagSet = async (tagSetId, tagsId) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/remove_tags_from_tag_set')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'remove_tags_from_tag_set',
          id: tagSetId,
          tags_id: tagsId
        })
        
        if (response.data && response.data.is_success) {
          return { is_success: true, data: response.data.data }
        } else {
          return { is_success: false, message: response.data?.message || 'Failed to remove tag from set' }
        }
      } catch (error) {
        console.error('Error removing tag from set:', error)
        return { is_success: false, message: error.message || 'Network error' }
      }
    }

    const addTagsToTagSet = async (tagSetId, tagsId) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'add_tags_to_tag_set',
          id: tagSetId,
          tags_id: tagsId
        })
        
        if (response.data && response.data.is_success) {
          return { is_success: true, data: response.data.data }
        } else {
          return { is_success: false, message: response.data?.message || 'Failed to add tag to set' }
        }
      } catch (error) {
        console.error('Error adding tag to set:', error)
        return { is_success: false, message: error.message || 'Network error' }
      }
    }

    // Search tabs by tags only
    const searchTabsRemoteByTags = async (tags_id = []) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'search_note_by_type_and_tags',
          type: 'url_cache',
          tags_id: tags_id
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data || []
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Search failed'
          }
        }
      } catch (error) {
        console.error('Error searching tabs by tags:', error)
        return {
          is_success: false,
          message: error.message || 'Network error'
        }
      }
    }

    const searchTabsRemoteByTypeTextTags = async (text, tags_id = [], type = "url_cache") => {
      const result = await searchNotesByTypeTextTags(text, tags_id, type)
      return result
    }

    // Search tabs by text (with optional tags)
    const searchNotesByTypeTextTags = async (text = null, tags_id = [], type = null) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const post_dict = {
          task: 'search_note_by_type_and_text_and_tags',
          tags_id: tags_id
        }
        if(text && text.trim().length > 0){
          post_dict.text = text
        }
        if(type){
          post_dict.type = type
        }
        console.warn('NetworkRequest.js: searchNotesByTypeTextTags() text:', text, 'tags_id:', tags_id, 'type:', type)
        console.warn('NetworkRequest.js: searchNotesByTypeTextTags() post_dict:', post_dict)
        const response = await axiosInstance.post(serverUrl, post_dict)
        console.warn('NetworkRequest.js: searchNotesByTypeTextTags() response:', response.data)
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data || []
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Search failed'
          }
        }
      } catch (error) {
        console.error('Error searching tabs by text:', error)
        return {
          is_success: false,
          message: error.message || 'Network error'
        }
      }
    }

    // Change note type (e.g., from url_cache to url)
    const changeNoteType = async (noteId, typeNew) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'change_note_type',
          id: noteId,
          type_new: typeNew
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data || {}
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to change note type'
          }
        }
      } catch (error) {
        console.error('Error changing note type:', error)
        return {
          is_success: false,
          message: error.message || 'Network error'
        }
      }
    }

    // Get similar URLs based on URL and title
    const getSimilarUrl = async (url, title) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'get_similar_url',
          url: url,
          title: title
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data || []
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to get similar URLs'
          }
        }
      } catch (error) {
        console.error('Error getting similar URLs:', error)
        return {
          is_success: false,
          message: error.message || 'Network error'
        }
      }
    }

    // Update an existing note
    const updateNote = async (noteId, updateDict) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint('/note/')
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, {
          task: 'update_note',
          id: noteId,
          update_dict: updateDict
        })
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Failed to update note'
          }
        }
      } catch (error) {
        console.error('Error updating note:', error)
        return {
          is_success: false,
          message: error.message || 'Network error'
        }
      }
    }

    // Generic POST method for direct API calls
    const post = async (endpoint, data = {}) => {
      try {
        const serverUrlResult = serverStore.getServerEndpoint(endpoint)
        if (!serverUrlResult.is_success) {
          return serverUrlResult
        }
        const serverUrl = serverUrlResult.data
        
        const response = await axiosInstance.post(serverUrl, data)
        
        if (response.data?.is_success) {
          return {
            is_success: true,
            data: response.data.data
          }
        } else {
          return {
            is_success: false,
            message: response.data?.message || 'Request failed'
          }
        }
      } catch (error) {
        console.error('Error making POST request:', error)
        return {
          is_success: false,
          message: error.message || 'Network error'
        }
      }
    }
  return {
    uploadTabToRemote,
    uploadTabsToRemote,
    checkSessionStatus,
    remove_url_cache,
    update_url_cache_tags,
    setTagsForUrlCache,
    fetchTabsFromRemote,
    getTagByName,
    getTagsById,
    getTagById,
    renameTag,
    mergeTag,
    searchTag,
    createSnapshot,
    getSnapshotInfo,
    getSnapshot,
    deleteSnapshot,
    clearUrlListsCache,
    removeUrlFromLocalState,
    addUrlToLocalState,
    updateUrlInLocalState,
    forceRefreshUrlLists,
    gettagSetsAll,
    getTagSet,
    changeTagOrderInTagSet,
    removeTagsFromTagSet,
    addTagsToTagSet,
    searchTabsRemoteByTags,
    searchTabsRemoteByTypeTextTags,
    searchNotesByTypeTextTags,
    changeNoteType,
    getSimilarUrl,
    updateNote,
    post,
  }
})
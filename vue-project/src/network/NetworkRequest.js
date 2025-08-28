// network request functions
import { defineStore } from 'pinia'

import { get_local_timezone_int } from '../utils/common'
import { useSettingStore } from '@/settings/Settings.js'
import { useServerStore } from '@/network/Server.js'

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

  const serverStore = useServerStore()

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
        task: 'create_session_snapshot',
        session_snapshot: urlSnapshot,
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
        task: 'get_session_snapshot_info',
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
        task: 'get_session_snapshot',
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




  const removeUrlFromLocalState = (urlId) => {
    // Find and remove the URL from local state
    for (const sessionId in urlLists) {
      const list = urlLists[sessionId]
      if (list.urls && list.urls[urlId]) {
        delete list.urls[urlId]
        break
      }
    }
  }

  const addUrlToLocalState = (sessionId, urlData) => {
    if (!urlLists[sessionId]) {
      urlLists[sessionId] = { name: sessionId, urls: {} }
    }
    if (!urlLists[sessionId].urls) {
      urlLists[sessionId].urls = {}
    }
    urlLists[sessionId].urls[urlData.id] = urlData
  }

  const updateUrlInLocalState = (urlId, updatedData) => {
    // Find and update the URL in local state
    for (const sessionId in urlLists) {
      const list = urlLists[sessionId]
      if (list.urls && list.urls[urlId]) {
        urlLists[sessionId].urls[urlId] = { ...list.urls[urlId], ...updatedData }
        break
      }
    }
  }

  const forceRefreshUrlLists = () => {
    return fetchTabsRemoteFromServer('', true)
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

  const searchTabsRemoteByTypeTextTags = async (text, tags_id = [], type = "tab_remote") => {
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
      // console.log('NetworkRequest.js: searchNotesByTypeTextTags() text:', text, 'tags_id:', tags_id, 'type:', type)
      // console.log('NetworkRequest.js: searchNotesByTypeTextTags() post_dict:', post_dict)
      const response = await axiosInstance.post(serverUrl, post_dict)
      // console.log('NetworkRequest.js: searchNotesByTypeTextTags() response:', response.data)
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
  const getSimilarTabsRemote = async (url, title) => {
    try {
      const serverUrlResult = serverStore.getServerEndpoint('/note/')
      if (!serverUrlResult.is_success) {
        return serverUrlResult
      }
      const serverUrl = serverUrlResult.data

      const response = await axiosInstance.post(serverUrl, {
        task: 'get_similar_tabs_remote',
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

  // update an existing note
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
    checkSessionStatus,
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
    removeUrlFromLocalState,
    addUrlToLocalState,
    updateUrlInLocalState,
    forceRefreshUrlLists,
    gettagSetsAll,
    getTagSet,
    changeTagOrderInTagSet,
    removeTagsFromTagSet,
    addTagsToTagSet,
    searchTabsRemoteByTypeTextTags,
    searchNotesByTypeTextTags,
    changeNoteType,
    getSimilarTabsRemote,
    updateNote,
    post,
  }
})
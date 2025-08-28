import axios from 'axios'
// create an axios instance with default config
const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true  // enable session cookies
});

import { useServerStore } from '@/network/Server.js'


const removeTabRemote = async (tab_remote) => {
  try {
    const serverStore = useServerStore()
    const serverUrl = serverStore.getServerEndpoint('/url_pool/')
    if (!serverUrl.is_success) {
      return serverUrl // Return the error from getServerEndpoint
    }
    
    const response = await axiosInstance.post(`${serverUrl.data}/remove_tab_remote`, {
      task: 'remove_tab_remote',
      id: tab_remote.id
    })
    
    const result = response.data
    // if deletion was successful, update local state instead of re-fetching
    if (result.is_success) {
      removeUrlFromLocalState(tab_remote.id)
    }
    
    return result
  } catch (error) {
    console.error('removeTabRemote error:', error)
    return {
      is_success: false,
      message: `Remove URL cache failed: ${error.message}`
    }
  }
}

const uploadTabToServer = async (tab, options = {}) => {
  try {
    const serverStore = useServerStore()
    const {
      task = 'create_tab_remote',
      tags_name = [],
      tags_id = [],
      comment = ''
    } = options;
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
    // console.log('uploadTabToServer() tags_name:', tags_name, 'tags_id:', tags_id)
    if(comment && comment !== ''){
      post_dict.comment = comment
    }

    const response = await axiosInstance.post(urlUpload, post_dict);
    // console.log('uploadTabToServer() response:', response)    
    return response.data
  } catch (error) {
    console.error('uploadTabToServer() error:', error)
    return { is_success: false, message: error.message }
  }
}

const uploadTabsToRemote = async (tabs, options = {}) => {
  const { tags_name = [], comment = '' } = options
  const results = { success: [], failed: [] }

  for (const tab of tabs) {
    try {
      const result = await uploadTabToServer(tab, {
        task: 'create_tab_remote',
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

const searchTabsRemoteByTags = async (tags_id = []) => {
  try {
    const serverStore = useServerStore()
    const serverUrlResult = serverStore.getServerEndpoint('/note/')
    if (!serverUrlResult.is_success) {
      return serverUrlResult
    }
    const serverUrl = serverUrlResult.data
    
    const response = await axiosInstance.post(serverUrl, {
      task: 'search_note_by_type_and_tags',
      type: 'tab_remote',
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

const setTagsForTabRemote = async ({ tab_id, tags_id = [], tags_name = [] }) => {
  const serverStore = useServerStore()
  const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
  if (!serverUrlResult.is_success) {
    return serverUrlResult
  }
  const serverUrl = serverUrlResult.data
  console.warn('SessionsRemoteRequest.js: setTagsForTabRemote() serverUrl:', serverUrl)
  console.log("tab_id:", tab_id)
  console.log("tags_id:", tags_id)
  console.log("tags_name:", tags_name)
  try {
    const response = await axiosInstance.post(`${serverUrl}set_tags_for_tab_remote`, {
      task: 'set_tags_for_tab_remote',
      tab_id: tab_id,
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
    console.error('NetworkRequest.js: setTagsForTabRemote error:', error)
    return {
      is_success: false,
      message: `Set tags for URL cache failed: ${error.message}`
    }
  }
}

const fetchTabsRemoteFromServer = async (type = '', forceRefresh = false) => {
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
    const serverStore = useServerStore()
    const serverUrlResult = serverStore.getServerEndpoint('/url_pool/')
    if (!serverUrlResult.is_success) {
      return serverUrlResult
    }
    const serverUrl = serverUrlResult.data
    
    const response = await axiosInstance.post(serverUrl, {
      task: 'get_all_tabs_remote',
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
    console.error(`fetchTabsRemoteFromServer error:`, error)
    
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

export {
  removeTabRemote,
  uploadTabToServer,
  uploadTabsToRemote,
  searchTabsRemoteByTags,
  setTagsForTabRemote,
  fetchTabsRemoteFromServer
}


import { defineStore } from 'pinia'
import { useNetworkRequest } from './NetworkRequest'
import { ref, computed, reactive, watch } from 'vue'

import axios from 'axios'

// import configuration loading function
import { loadUserConfig } from '../../../js/common.js'

// create an axios instance with default config
const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true  // Enable session cookies
});

export const useServerStore = defineStore('server', () => {
	// Server status by URL ID: { urlId: { icon, text, type, isPinging, lastChecked } }
	const serverStatus = ref({})
	// cacheSettingsServer: {url: {local: [{id: 'local_1', name: 'Local Dev', url: 'https://localhost:8000'}, ...], remote: [{id: 'remote_1', name: 'Production', url: 'https://api.example.com'}]}, current: 'local_1'}
	const cacheSettingsServer = ref(null)
	// Initialize default settings with configuration
	let cacheSettingsServerDefault = null;
	
	const initCacheSettingsServerDefault = async () => {
		if (cacheSettingsServerDefault) return cacheSettingsServerDefault;
		
		const config = await loadUserConfig();
		const configUrl = config.urlUpload;
		const urlObj = new URL(configUrl);
		const baseName = urlObj.host;
		
		cacheSettingsServerDefault = {
			url: {
				local: [
					// example: 'https://192.168.0.1:10001/url_pool/',
					// potential problem: SSL certificate is bound to serverUrl, so 192.168.0.1 is invalid
					{
						id: '20160823_12301422+09',  // example timestamp with timezone
						name: 'Local QNAP',
						url: 'https://192.168.0.3:8000'
					},
					{
						id: 'config_default',
						name: baseName,
						url: configUrl.replace(/\/$/, '') // Remove trailing slash if present
					}
				],
				remote: [
					{
						id: '20160823_12301500+09',  // example timestamp with timezone
						name: 'Production Server',
						url: 'https://example.com:8000'
					}
				]
			},
			current: 'config_default'
		};
		
		return cacheSettingsServerDefault;
	}
	

	const getSettingsServer = async (use_cache = true) => {
		if(process.env.VUE_APP_IS_DEV){
			// console.log("getSettingsServer(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
			// load configuration from user config files
			const config = await loadUserConfig();
			const configUrl = config.urlUpload;
			
			// Extract base URL (remove path) for display name
			const urlObj = new URL(configUrl);
			const baseName = urlObj.host;
			
			const settings = {
				url: {
					local: [
						{
							id: "default",
							name: baseName,
							url: configUrl.replace(/\/$/, '') // Remove trailing slash if present
						}
					],
					remote: []
				},
				current: "default"
			};
			cacheSettingsServer.value = settings
			return settings
		}
		if (!cacheSettingsServer.value || !use_cache) {
			// Initialize default settings from configuration
			await initCacheSettingsServerDefault();
			
			// Get local settings (includes local URLs and current selection)
			const resultLocal = await chrome.storage.local.get(['urlsServer'])
			// Get synced settings (remote URLs)
			const resultSync = await chrome.storage.sync.get(['urlsServer'])
			
			const settingsLocal = resultLocal.urlsServer || {
				urlsLocal: cacheSettingsServerDefault.url.local,
				current: cacheSettingsServerDefault.current
			}
			const urlsRemote = resultSync.urlsServer?.urlsSync || cacheSettingsServerDefault.url.remote
			
			// Ensure arrays are actually arrays
			const urlsLocalSafe = Array.isArray(settingsLocal.urlsLocal) ? settingsLocal.urlsLocal : cacheSettingsServerDefault.url.local
			const urlsRemoteSafe = Array.isArray(urlsRemote) ? urlsRemote : cacheSettingsServerDefault.url.remote
			
			cacheSettingsServer.value = {
				url: {
					local: urlsLocalSafe,
					remote: urlsRemoteSafe
				},
				current: settingsLocal.current || cacheSettingsServerDefault.current
			}
		}
		return cacheSettingsServer.value
		// Return a plain JavaScript object (non-reactive) to avoid proxy issues
		// return JSON.parse(JSON.stringify(cacheSettingsServer))
	}

	const saveSettingsServer = async (settings) => {
		cacheSettingsServer.value = settings
		console.log("saveSettingsServer(). settings:", settings)
		if(process.env.VUE_APP_IS_DEV){
			console.log("saveSettingsServer(). process.env.VUE_APP_IS_DEV:", process.env.VUE_APP_IS_DEV)
			return;
		}
		// Save local URLs and current selection to local storage
		console.warn("saveSettingsServer(). saving to local storage")
		console.log("saveSettingsServer(). settings.url.local:", JSON.parse(JSON.stringify(settings.url.local)))
		console.log("saveSettingsServer(). settings.current:", settings.current)
		await chrome.storage.local.set({ 
			urlsServer: {
				urlsLocal: JSON.parse(JSON.stringify(settings.url.local)), // turn vue.js proxy project to pure json object
				current: settings.current
			}
		})
		
		// Save remote URLs to sync storage
		await chrome.storage.sync.set({ 
			urlsServer: {
				urlsSync: JSON.parse(JSON.stringify(settings.url.remote)) // turn vue.js proxy project to pure json object
			}
		})
	}
	const getUrlCurrent = () => {
		console.log("getUrlCurrent(). cacheSettingsServer.value:", cacheSettingsServer.value)
		if (!cacheSettingsServer.value){
			console.warn("getUrlCurrent(). cacheSettingsServer.value is null")
			return null
		}
		
		// Safely access arrays with proper fallbacks
		const urlsLocal = cacheSettingsServer.value.url?.local || []
		const urlsRemote = cacheSettingsServer.value.url?.remote || []
		
		// Ensure arrays are actually arrays before spreading
		const urlsLocalSafe = Array.isArray(urlsLocal) ? urlsLocal : []
		const urlsRemoteSafe = Array.isArray(urlsRemote) ? urlsRemote : []
		
		const urlsAll = [...urlsLocalSafe, ...urlsRemoteSafe]
		
		return urlsAll.find(url => url.id === cacheSettingsServer.value.current)
	}

    // Helper to get current server URL with endpoint path
    const getServerEndpoint = (path = '') => {
      const urlCurrent = getUrlCurrent()
      if (!urlCurrent) {
        return {
          is_success: false,
          message: 'No URL configured. Please set it in the settings.'
        }
      }
      return {
        is_success: true,
        data: `${urlCurrent.url}${path}`
      }
    }
  
    const getServerStatusCurrent = () => {
        if (!cacheSettingsServer.value){
          console.warn('getServerStatusCurrent(): cacheSettingsServer is null')
          return null;
        }
        const urlCurrent = cacheSettingsServer?.value.current
        // console.log('getServerStatusCurrent(): urlCurrent:', urlCurrent)
        if (!urlCurrent){
          console.warn('getServerStatusCurrent(): urlCurrent is null')
          return null
        }
        // console.log('getServerStatusCurrent(): serverStatus:', serverStatus.value)
				const serverStatusCurrent = serverStatus.value[urlCurrent]
				// console.log('getServerStatusCurrent(): serverStatusCurrent:', serverStatusCurrent)
        return serverStatusCurrent || null
    }
  
      const getServerStatusForUrl = (urlId) => {
        return serverStatus.value[urlId] || null
    }
  
    const isCurrentUrlLoggedIn = () => {
        if (!cacheSettingsServer.value) return false
        const statusCurrent = cacheSettingsServer?.value.current
        if (!statusCurrent) return false
        const status = serverStatus.value[statusCurrent]
        return status?.type === 'success' && !status?.requiresLogin
    }

    // Server status management
    const setServerStatus = (urlId, status) => {
        // console.log("setServerStatus(): urlId:", urlId, "status:", status)
        serverStatus.value[urlId] = {
            ...status,
            lastChecked: Date.now()
        }
    }

    const clearServerStatus = (urlId) => {
        delete serverStatus.value[urlId]
    }

    const testServerConnection = async (urlId) => {
        // console.log('testServerConnection: urlId:', urlId)
        const settings = await getSettingsServer()
        const urlsLocal = Array.isArray(settings.url?.local) ? settings.url.local : []
        const urlsRemote = Array.isArray(settings.url?.remote) ? settings.url.remote : []
        const urlsAll = [...urlsLocal, ...urlsRemote]
        const urlObj = urlsAll.find(url => url.id === urlId)
        
        if (!urlObj) {
            setServerStatus(urlId, {
            icon: '❌',
            text: 'URL not found',
            type: 'error',
            isPinging: false
            })
            return
        }

        // Set pinging status
        setServerStatus(urlId, {
            icon: '⟳',
            text: 'Testing connection...',
            type: 'testing',
            isPinging: true
        })

        try {
            const result = await pingServer(urlObj.url)
            
            // Interpret the response
            if (!result.is_success) {
            setServerStatus(urlId, {
                icon: '❌',
                text: 'Server not reachable',
                type: 'error',
                isPinging: false
            })
            } else if (result.data) {
            const { is_server_normal, is_logged_in, server_message, username } = result.data
            
            if (!is_server_normal) {
                setServerStatus(urlId, {
                icon: '❌',
                text: `Server issue: ${server_message}`,
                type: 'error',
                isPinging: false
                })
            } else if (!is_logged_in) {
                setServerStatus(urlId, {
                icon: '🔐',
                text: 'Login required',
                type: 'warning',
                isPinging: false,
                requiresLogin: true
                })
            } else {
                setServerStatus(urlId, {
                icon: '✅',
                text: `Connected as ${username}`,
                type: 'success',
                isPinging: false
                })
            }
            } else {
            setServerStatus(urlId, {
                icon: '❌',
                text: 'Invalid server response',
                type: 'error',
                isPinging: false
            })
            }
        } catch (error) {
            console.error('Error testing server connection:', error)
            setServerStatus(urlId, {
            icon: '❌',
            text: 'Connection error',
            type: 'error',
            isPinging: false
            })
        }
    }
	// Helper function to generate timestamp-based ID with timezone
	const generateTimestampId =() => {
		const now = new Date()
		
		// Get date components
		const year = now.getFullYear()
		const month = String(now.getMonth() + 1).padStart(2, '0')
		const day = String(now.getDate()).padStart(2, '0')
		
		// Get time components
		const hours = String(now.getHours()).padStart(2, '0')
		const minutes = String(now.getMinutes()).padStart(2, '0')
		const seconds = String(now.getSeconds()).padStart(2, '0')
		const milliseconds = String(now.getMilliseconds()).padStart(2, '0') // 2 digits for ms
		
		// Get timezone offset
		const timezoneOffset = -now.getTimezoneOffset() // getTimezoneOffset() returns negative for positive offsets
		const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60)
		const offsetMinutes = Math.abs(timezoneOffset) % 60
		const offsetSign = timezoneOffset >= 0 ? '+' : '-'
		const timezone = `${offsetSign}${String(offsetHours).padStart(2, '0')}`
		
		// Format: YYYYMMDD_HHMMSSms+TZ
		return `${year}${month}${day}_${hours}${minutes}${seconds}${milliseconds}${timezone}`
	}
  const addUrl = async (type, urlData) => {
    const settings = await getSettingsServer()
    const newUrl = {
      id: generateTimestampId(),
      name: urlData.name,
      url: urlData.url
    }
    
    // Ensure the target array exists and is an array
    if (!settings.url) {
      settings.url = { local: [], remote: [] }
    }
    if (!Array.isArray(settings.url[type])) {
      settings.url[type] = []
    }
    
    settings.url[type].push(newUrl)
    await saveSettingsServer(settings)
    return newUrl
  }

  const updateUrl = async (urlId, urlData) => {
    const settings = await getSettingsServer()
    
    // Ensure arrays exist
    const localUrls = Array.isArray(settings.url?.local) ? settings.url.local : []
    const urlsRemote = Array.isArray(settings.url?.remote) ? settings.url.remote : []
    const allUrls = [...localUrls, ...urlsRemote]
    
    const url = allUrls.find(u => u.id === urlId)
    
    if (url) {
      url.name = urlData.name
      url.url = urlData.url
      await saveSettingsServer(settings)
    }
  }

  const deleteUrl = async (urlId) => {
    const settings = await getSettingsServer()
    
    // Ensure arrays exist and are arrays
    if (!Array.isArray(settings.url?.local)) {
      settings.url.local = []
    }
    if (!Array.isArray(settings.url?.remote)) {
      settings.url.remote = []
    }
    
    // Remove from local URLs
    settings.url.local = settings.url.local.filter(u => u.id !== urlId)
    // Remove from remote URLs  
    settings.url.remote = settings.url.remote.filter(u => u.id !== urlId)
    
    // If current URL was deleted, switch to first available
    if (settings.current === urlId) {
      const allUrls = [...settings.url.local, ...settings.url.remote]
      settings.current = allUrls.length > 0 ? allUrls[0].id : null
    }
    
    await saveSettingsServer(settings)
  }

  const setUrlCurrentId = async (urlId) => {
    // console.log("setUrlCurrentId(): urlId:", urlId)
    const settings = await getSettingsServer()
		// console.log("setUrlCurrentId(). settings:", settings)
    settings.current = urlId
    await saveSettingsServer(settings)
  }

  const reorderUrls = async (type, newOrder) => {
    const settings = await getSettingsServer()
    settings.url[type] = newOrder
    await saveSettingsServer(settings)
  }

  const pingServer = async (url) => {
    try {
    if (!url) {
        return { is_success: false, message: 'No URL provided' }
      }
      
      const response = await axiosInstance.post(`${url}/ping`, {}, { timeout: 5000 });
      console.log('pingServer() response:', response)
      return response.data;
    } catch (error) {
      console.error('pingServer error:', error)
      return { is_success: false, message: error.message }
    }
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

	const loginToServer = async (username, password) => {
		try {
			const baseUrlResult = getServerEndpoint('')
			if (!baseUrlResult.is_success) {
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data
			console.warn("loginToServer() baseUrl:", baseUrl)
			const loginUrl = `${baseUrl}/login`
			console.warn("loginToServer() loginUrl:", loginUrl)
			const urlNext = `${baseUrl}/url_pool/`
			
			const response = await axiosInstance.post(loginUrl, {
				username,
				password,
				url_next: urlNext
			});
			console.warn("loginToServer() response:", response)
			
			if (response.data.is_success) {
				await checkSessionStatus()
			}
			return response.data
		} catch (error) {
			console.error('loginToServer error:', error)
			return { is_success: false, message: error.response?.data?.message || 'Login request failed' }
		}
	}

	const logoutFromServer = async () => {
		try {
			const urlCurrent = serverStore.getUrlCurrent()
			if (!urlCurrent) {
				return { is_success: false, message: 'No URL configured' }
		}

			const baseUrl = urlCurrent.url
			const logoutUrl = `${baseUrl}/logout`
			
			const response = await axiosInstance.post(logoutUrl, {});
			console.log('logoutFromServer response:', response)

			if (response.data.is_success) {
				// Test server connection to confirm logout status
				await testServerConnection(urlCurrent.id)
				
				// Check if still logged in after logout
				const status = serverStatus[urlCurrent.id]
				if (status && status.type === 'success' && !status.requiresLogin) {
					return { is_success: false, message: 'Logout failed - still logged in' }
					}
				
				return { is_success: true, message: 'Logged out successfully' }
			}

			return response.data
		} catch (error) {
			console.error('logoutFromServer error:', error)
			return { is_success: false, message: error.response?.data?.message || 'Logout request failed' }
		}
	}

	// server file_access_point
	const serverInfo = ref(null)
	const serverId = computed(() => {
		return serverInfo.value?.id || null
	})
	
	const fileAccessPointDefaultId = computed(() => {
		// console.log('fileAccessPointDefaultId(): serverInfo:', serverInfo.value)
		return serverInfo.value?.file_access_point_default_id || null
	})
	
	const isServerFileAccessPointsLoading = ref(false)
	const serverFileAccessPointsError = ref(null)

	const getThisServerId = async () => {
		if(serverId.value) {
			return { is_success: true, data: serverId.value }
		}

		try {
			const baseUrlResult = getServerEndpoint('')
			if (!baseUrlResult.is_success) {
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data
			// console.log('getThisServerId() baseUrl:', baseUrl)
			const response = await axiosInstance.post(`${baseUrl}/config/`, {
				task: 'get_this_server_info'
			})

			// console.log('getThisServerId() response:', response)
			if (response.data.is_success) {
				return { is_success: true, data: response.data.data.id }
			}
			return response.data
		} catch (error) {
			console.error('getThisServerId error:', error)
			return { is_success: false, message: error.message }
		}
	}

	const getThisServerInfo = async () => {
		isServerFileAccessPointsLoading.value = true
		serverFileAccessPointsError.value = null
		
		try {
			const baseUrlResult = getServerEndpoint('')
			console.warn("getThisServerInfo() baseUrlResult:", baseUrlResult)
			if (!baseUrlResult.is_success) {
				serverFileAccessPointsError.value = baseUrlResult.message
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data

			const response = await axiosInstance.post(`${baseUrl}/config/`, {
				task: 'get_this_server_info'
			})
			// console.log('getThisServerInfo() response:', response)

			if (response.data.is_success) {
				serverInfo.value = response.data.data
				return { is_success: true, data: response.data.data }
			} else {
				serverFileAccessPointsError.value = response.data.message
				return response.data
			}
		} catch (error) {
			console.error('getThisServerInfo error:', error)
			serverFileAccessPointsError.value = error.message
			return { is_success: false, message: error.message }
		} finally {
			isServerFileAccessPointsLoading.value = false
		}
	}

	const fetchServerFileAccessPoints = async () => {
		// Use getThisServerInfo() instead since it includes file access points
		return await getThisServerInfo()
	}

	const createFileAccessPoint = async (name, setting) => {
		try {
			// Ensure we have server info
			if (!serverInfo.value) {
				const result = await getThisServerInfo()
				if (!result.is_success) {
					return result
				}
			}

			const baseUrlResult = getServerEndpoint('')
			if (!baseUrlResult.is_success) {
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data
			const task = 'create_file_access_point'
			const response = await axiosInstance.post(`${baseUrl}/file/${task}`, {
				task,
				server_id: serverId.value,
				name: name,
				setting: setting,
			})

			if (response.data.is_success) {
				// Refresh the server info to get updated file access points
				await getThisServerInfo()
			}
			return response.data
		} catch (error) {
			console.error('createFileAccessPoint error:', error)
			return { is_success: false, message: error.message }
		}
	}

	const deleteFileAccessPoint = async (fileAccessPointId) => {
		try {
			if (!serverInfo.value) {
				const result = await getThisServerInfo()
				if (!result.is_success) {
					return result
				}
			}

			const baseUrlResult = getServerEndpoint('')
			if (!baseUrlResult.is_success) {
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data

			const task = 'delete_file_access_point'
			const response = await axiosInstance.post(`${baseUrl}/file/${task}`, {
				task,
				server_id: serverId.value,
				file_access_point_id: fileAccessPointId
			})

			if (response.data.is_success) {
				// Refresh the server info to get updated file access points
				await getThisServerInfo()
			}
			return response.data
		} catch (error) {
			console.error('deleteFileAccessPoint error:', error)
			return { is_success: false, message: error.message }
		}
	}

	const renameFileAccessPoint = async (fileAccessPointId, nameNew) => {
		try {
			if (!serverInfo.value) {
				const result = await getThisServerInfo()
				if (!result.is_success) {
					return result
				}
			}

			const baseUrlResult = getServerEndpoint('')
			if (!baseUrlResult.is_success) {
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data

			const task = 'rename_file_access_point'
			const response = await axiosInstance.post(`${baseUrl}/file/${task}`, {
				task,
				server_id: serverId.value,
				file_access_point_id: fileAccessPointId,
				name_new: nameNew
			})

			if (response.data.is_success) {
				// Refresh the server info to get updated file access points
				await getThisServerInfo()
			}
			return response.data
		} catch (error) {
			console.error('renameFileAccessPoint error:', error)
			return { is_success: false, message: error.message }
		}
	}

	const updateFileAccessPoint = async (name, fileAccessPointId, type, setting) => {
		try {
			if (!serverInfo.value) {
				const result = await getThisServerInfo()
				if (!result.is_success) {
					return result
				}
			}

			const baseUrlResult = getServerEndpoint('')
			if (!baseUrlResult.is_success) {
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data
			const task = 'update_file_access_point'
			const response = await axiosInstance.post(`${baseUrl}/file/${task}`, {
				task,
				server_id: serverId.value,
				name,
				file_access_point_id: fileAccessPointId,
				type: type,
				setting: setting
			})

			if (response.data.is_success) {
				// Refresh the server info to get updated file access points
				await getThisServerInfo()
			}
			return response.data
		} catch (error) {
			console.error('updateFileAccessPoint error:', error)
			return { is_success: false, message: error.message }
		}
	}

	const changeFileAccessPointOrder = async (fileAccessPointId, indexNew) => {
		try {
			if (!serverInfo.value) {
				const result = await getThisServerInfo()
				if (!result.is_success) {
					return result
				}
			}

			const baseUrlResult = getServerEndpoint('')
			if (!baseUrlResult.is_success) {
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data
			const task = 'change_file_access_point_order'
			const response = await axiosInstance.post(`${baseUrl}/file/${task}`, {
				task,
				server_id: serverId.value,
				file_access_point_id: fileAccessPointId,
				index_new: indexNew
			})

			if (response.data.is_success) {
				// Refresh the server info to get updated file access points
				await getThisServerInfo()
			}
			return response.data
		} catch (error) {
			console.error('changeFileAccessPointOrder error:', error)
			return { is_success: false, message: error.message }
		}
	}
	const setFileAccessPointDefaultId = async (fileAccessPointId) => {
		try {
			if (!serverInfo.value) {
				const result = await getThisServerInfo()
				if (!result.is_success) {
					return result
				}
			}

			const baseUrlResult = getServerEndpoint('')
			if (!baseUrlResult.is_success) {
				return baseUrlResult
			}
			const baseUrl = baseUrlResult.data

			const response = await axiosInstance.post(`${baseUrl}/file/`, {
				task: 'set_file_access_point_default_id',
				server_id: serverId.value,
				file_access_point_id: fileAccessPointId
			})

			if (response.data.is_success) {
				// Refresh the server info to get updated file access points
				await getThisServerInfo()
			}
			return response.data
		} catch (error) {
			console.error('setFileAccessPointDefaultId error:', error)
			return { is_success: false, message: error.message }
		}
	}

	return {
		generateTimestampId,
		serverStatus,
		cacheSettingsServer,
		getUrlCurrent,
		getServerEndpoint,
		getServerStatusCurrent,
		getServerStatusForUrl,
		isCurrentUrlLoggedIn,
		setServerStatus,
		clearServerStatus,
		testServerConnection,
		addUrl,
		updateUrl,
		deleteUrl,
		setUrlCurrentId,
		reorderUrls,
		pingServer,
		loginToServer,
		logoutFromServer,
		getSettingsServer,
		saveSettingsServer,
		checkSessionStatus,

		// File access point functions
		serverInfo,
		serverId,
		getThisServerId,
		getThisServerInfo,
		fileAccessPointDefaultId,
		isServerFileAccessPointsLoading,
		serverFileAccessPointsError,
		fetchServerFileAccessPoints,
		createFileAccessPoint,
		deleteFileAccessPoint,
		renameFileAccessPoint,
		updateFileAccessPoint,
		changeFileAccessPointOrder,
		setFileAccessPointDefaultId,
	}
})
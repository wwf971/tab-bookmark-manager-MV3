// Import user configuration with fallback
let userConfig = null;

// Function to load configuration with fallback
async function loadUserConfig() {
	if (userConfig) return userConfig; // Return cached config if already loaded
	try {
		// import from user.config.js first (user-specific settings)
		const { userConfig: config } = await import('./vue-project/user.config.js');
		userConfig = config;
		console.log('Loaded configuration from user.config.js');
		return userConfig;
	} catch (error) {
		try {
			// FALLBACK: import from user.config.0.js(user-specific settings)
				// this is used during development. user.config.
			const { userConfig: config } = await import('./vue-project/user.config.0.js');
			userConfig = config;
			console.log('Loaded configuration from user.config.0.js');
			return userConfig;
		} catch (error) {
			userConfig = {
				urlUpload: "https://example.com"
			};
		}
	}
}

// Handle browser action click
chrome.action.onClicked.addListener(() => {
	openTabManager();
});

// Handle right-click menu selection
chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === "open-tab-manager") {
		openTabManager();
	}
	else if (info.menuItemId === "open-tab-manager-grid") {
		openTabManagerGrid();
	}
	else if (info.menuItemId === "upload-current-tab") {
		uploadTabInfo(tab);
	}
});

// Create the context menu item on install
chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: "open-tab-manager",
		title: "Display Tabs",
		contexts: ["all"]
	});
	chrome.contextMenus.create({
		id: "open-tab-manager-grid",
		title: "Display Tabs(Grid)",
		contexts: ["all"]
	});
	chrome.contextMenus.create({
		id: "upload-current-tab",
		title: "Upload current tab",
		contexts: ["all"]  // "paeg". This makes it appear when right-clicking on a webpage
	});
});

// Handle retry upload message and other communications
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (message.action === "retryUpload") {
	console.log("retrying upload")
	// Get the tab info and retry upload
	chrome.tabs.get(message.tabId, (tab) => {
	if (tab) {
		uploadTabInfo(tab);
	}
	});
}
	else if (message.action === "getRecentTabs") {
		// Return recent tabs history for a specific window or all windows
		const tabsRecentAllWin = {};
		if (message.windowId) {
			// query only one window
			const winHistory = tabsRecent.get(message.windowId) || [];
			tabsRecentAllWin[message.windowId] = winHistory;
			sendResponse({ tabsRecent });
		} else {
			// query all windows
			for (const [windowId, tabHistory] of tabsRecent.entries()) {
				tabsRecentAllWin[windowId] = tabHistory;
			}
			sendResponse({ tabsRecentAllWin });
		}
		return true; // Keep the message channel open for async response
	}
});

// function to open the tab manager window
function openTabManager() {
	chrome.tabs.query({ url: chrome.runtime.getURL("tabs.html") }, (tabs) => {
		// check if tabs_grid.html is already open in any tab
		if (tabs.length > 0) {
			// If the tab is already open, switch to it
			chrome.tabs.update(tabs[0].id, { active: true });
			// If the tab is in a different window, focus that window too
			chrome.windows.update(tabs[0].windowId, { focused: true });
		} else {
			chrome.tabs.create({ // If not open, create a new tab
				// url: "tabs.html"
				url: "vue-project/dist/main.html"
				// type: "popup",
				// width: 800,
				// height: 600
			});
		}
	});
}

// function to open the tab manager window
function openTabManagerGrid() {
	chrome.tabs.query({ url: chrome.runtime.getURL("tabs_grid.html") }, (tabs) => {
		// check if tabs_grid.html is already open in any tab
		if (tabs.length > 0) {
			// If the tab is already open, switch to it
			chrome.tabs.update(tabs[0].id, { active: true });
			// If the tab is in a different window, focus that window too
			chrome.windows.update(tabs[0].windowId, { focused: true });
		} else {
			chrome.tabs.create({ // If not open, create a new tab
				url: "tabs_grid.html"
				// type: "popup",
				// width: 800,
				// height: 600
			});
		}
	});
}

async function uploadTabInfo(tab) {
	// get urlUpload from user configuration
	const config = await loadUserConfig();
	const urlUpload = config.urlUpload;
	
	// since this is the background script, we need a different approach to update UI elements
	// first, notify any UI components that upload has started
	chrome.runtime.sendMessage({ action: "uploadStarted", tabId: tab.id });
	
	// use fetch instead of axios since it's built into browsers
	fetch(urlUpload, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			task: 'insert_url',
			url: tab.url,
			text: tab.title,
		})
	})
	.then(response => response.json())
	.then(data => {
		if (data.is_success) {
			console.log(`url: ${tab.url}`);
			
			// Notify UI components of success
			chrome.runtime.sendMessage({ 
				action: "uploadSuccess", 
				tabId: tab.id 
			});
			
			// Close the tab after successful upload
			setTimeout(() => {
				chrome.tabs.remove(tab.id);
			}, 300);
		} else {
			console.log(data);
			
			// Show error popup and notify UI components
			showErrorPopup(tab, data.message);
			
			// Notify UI components of error
			// chrome.runtime.sendMessage({ 
			//     action: "uploadError", 
			//     tabId: tab.id,
			//     error: data.message
			// });
		}
	})
	.catch(error => {
		console.error('Error uploading tab info:', error);
		
		// show error popup and notify UI components
		showErrorPopup(tab, error.message);
		
		// notify UI components of error
		// chrome.runtime.sendMessage({ 
		//     action: "uploadError", 
		//     tabId: tab.id,
		//     error: error.message
		// });
	});
}

// function to show error popup
function showErrorPopup(tab, errorMessage) {
	// store error information in local storage for the popup to access
	chrome.storage.local.set({
		'errorInfo': {
			tabId: tab.id,
			errorMessage: errorMessage,
			url: tab.url,
			title: tab.title
		}
	}, () => {
		// create a popup window
		chrome.windows.create({
			url: 'popup-error.html',
			type: 'popup',
			width: 400,
			height: 250,
			focused: true
		});
	});
}

// global variables to track tab focus history
let tabLastActiveIdGlobal = null;
let windowLastActiveId = null;
let tabActiveIdGlobal = null;
let windowCurrentIdGlobal = null;

// recent tabs history per window (windowId -> [tabId1, tabId2, ...])
// most recent tabs are at the beginning of the array
let tabsRecent = new Map();
const MAX_RECENT_TABS = 10; // Keep track of last 10 tabs per window

// listen for tab activation events to track tab focus history
chrome.tabs.onActivated.addListener((activeInfo) => {
	// store the previous active tab info
	tabLastActiveIdGlobal = tabActiveIdGlobal;
	windowLastActiveId = windowCurrentIdGlobal;
	
	// update current active tab info
	tabActiveIdGlobal = activeInfo.tabId;
	windowCurrentIdGlobal = activeInfo.windowId;
	
	// update recent tabs history for this window
	updateTabsRecent(activeInfo.windowId, activeInfo.tabId);
});

// Function to update recent tabs history
function updateTabsRecent(windowId, tabId) {
	if (!tabsRecent.has(windowId)) {
		tabsRecent.set(windowId, []);
	}
	
	const windowHistory = tabsRecent.get(windowId);
	
	// Remove tabId if it already exists
	const indexExisting = windowHistory.indexOf(tabId);
	if (indexExisting > -1) {
		windowHistory.splice(indexExisting, 1);
	}
	
	// Add tabId to the beginning
	windowHistory.unshift(tabId);
	
	// Keep only MAX_RECENT_TABS
	if (windowHistory.length > MAX_RECENT_TABS) {
		windowHistory.splice(MAX_RECENT_TABS);
	}
	
	// Notify tabs components about the update
	chrome.runtime.sendMessage({
		action: "tabsRecentUpdated",
		windowId: windowId,
		tabsRecent: windowHistory
	}).catch(() => {
		// Ignore errors if no listeners
	});
}

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
	// Remove the tab from all window histories
	for (const [windowId, tabHistory] of tabsRecent.entries()) {
		const index = tabHistory.indexOf(tabId);
		if (index > -1) {
			tabHistory.splice(index, 1);
			// Notify about update
			chrome.runtime.sendMessage({
				action: "tabsRecentUpdated",
				windowId: windowId,
				tabsRecent: tabHistory
			}).catch(() => {});
		}
	}
	
	// Clean up if this was the current or last active tab
	if (tabId === tabActiveIdGlobal) {
		tabActiveIdGlobal = null;
	}
	if (tabId === tabLastActiveIdGlobal) {
		tabLastActiveIdGlobal = null;
	}
});

// Handle tab moving between windows
chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
	// Add to new window's history
	updateTabsRecent(attachInfo.newWindowId, tabId);
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
	// Remove from old window's history
	if (tabsRecent.has(detachInfo.oldWindowId)) {
		const windowHistory = tabsRecent.get(detachInfo.oldWindowId);
		const index = windowHistory.indexOf(tabId);
		if (index > -1) {
			windowHistory.splice(index, 1);
			chrome.runtime.sendMessage({
				action: "tabsRecentUpdated",
				windowId: detachInfo.oldWindowId,
				tabsRecent: windowHistory
			}).catch(() => {});
		}
	}
});

// Handle window closure
chrome.windows.onRemoved.addListener((windowId) => {
	// Clean up history for closed window
	tabsRecent.delete(windowId);
	
	// Clean up active tab cache for closed window
	cacheTabActive.delete(windowId);
	cacheTabActivePrev.delete(windowId);
	
	if (is_debug) {
		console.log(`Window ${windowId} closed - cleaned up active tab cache`);
	}
});

chrome.commands.onCommand.addListener((command) => {
	if (command === "move_tab_to_last") {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const currentTab = tabs[0];
			if (!currentTab) return;

			chrome.tabs.query({ windowId: currentTab.windowId }, (allTabs) => {
				const lastIndex = allTabs.length - 1;
				chrome.tabs.move(currentTab.id, { index: lastIndex });
			});
		});
	}
	else if (command === "move_tab_to_first") {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const currentTab = tabs[0];
			if (!currentTab) return;
			chrome.tabs.move(currentTab.id, { index: 0 });
		});
	}
	else if (command === "move_current_tab_to_recent") {
		// First, get the current active tab
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const currentTab = tabs[0];
			if (!currentTab) return;
			
			// Check if we have a valid last active tab
			if (!tabLastActiveIdGlobal) {
				console.log("No recent tab to move to");
				return;
			}
			
			// Get information about the last active tab
			chrome.tabs.get(tabLastActiveIdGlobal, (lastTab) => {
				// Handle potential error if the last tab no longer exists
				if (chrome.runtime.lastError) {
					console.log("Last active tab no longer exists");
					return;
				}
				
				// if the last active tab is in the same window
				if (lastTab.windowId === currentTab.windowId) {
					// Move the current tab to the position right after the last active tab
					chrome.tabs.move(currentTab.id, {
						index: lastTab.index
					});
				} else {
					// Move the current tab to another window
					chrome.tabs.move(currentTab.id, {
						windowId: lastTab.windowId,
						index: lastTab.index
					});
				}
			});
		});
	}
	else if (command === "move_recent_tab_to_current") {
		// First, get the current active tab
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const currentTab = tabs[0];
			if (!currentTab) return;
			
			// Check if we have a valid last active tab
			if (!tabLastActiveIdGlobal) {
				console.log("No recent tab to move");
				return;
			}
			
			// Get information about the last active tab
			chrome.tabs.get(tabLastActiveIdGlobal, (lastTab) => {
				// Handle potential error if the last tab no longer exists
				if (chrome.runtime.lastError) {
					console.log("Last active tab no longer exists");
					return;
				}
				
				// If the last active tab is in the same window
				if (lastTab.windowId === currentTab.windowId) {
					// Move the last active tab to the position right after the current tab
					chrome.tabs.move(lastTab.id, {
						index: currentTab.index
					});
				} else {
					// Move the last active tab from another window to this one
					chrome.tabs.move(lastTab.id, {
						windowId: currentTab.windowId,
						index: currentTab.index
					});
				}
			});
		});
	}
	else if (command === "duplicate_tab") {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		if (tabs.length > 0) {
			chrome.tabs.duplicate(tabs[0].id);
		}
		});
	}
});



// display text over extension icon
let display_current_window_tab_num = true;
let intervalId = null;

async function updateBadge(event_name) {
	// If this is an event-triggered update, reset the timer
	if (event_name) {
		// Clear any existing interval
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
		
		// Start a new interval only if one isn't already running
		if (intervalId === null) {
			intervalId = setInterval(updateBadge, 1500);
		}
		display_current_window_tab_num = true;
	}

	const allTabs = await chrome.tabs.query({});
	const tab_num_total = allTabs.length;

	const currentWindow = await chrome.windows.getCurrent({ populate: true });
	const tab_num_current = currentWindow.tabs.length;

	// Alternate what to show on the badge
	const text = display_current_window_tab_num ? `${tab_num_current}` : `${tab_num_total}`;
	if (display_current_window_tab_num) {
		chrome.action.setBadgeBackgroundColor({ color: '#157017' }); // Green for current window
	} else {
		chrome.action.setBadgeBackgroundColor({ color: '#C72A1C' }); // Red for total
	}
	chrome.action.setBadgeText({ text });

	display_current_window_tab_num = !display_current_window_tab_num;
}

// Global cache for current and previous active tabs in each window
let cacheTabActive = new Map(); // windowId -> { tabId, lastUpdated }
let cacheTabActivePrev = new Map(); // windowId -> { tabId, lastUpdated }

let is_debug = true;
function onTabOpenActivated(windowId, tabId) {
	const tabActive = cacheTabActive.get(windowId);
	if (tabActive && tabActive.tabId !== tabId) {
		cacheTabActivePrev.set(windowId, { // Store current active tab as previous before updating
			tabId: tabActive.tabId,
			lastUpdated: Date.now()
		});
	}
	
	// Update current active tab
	cacheTabActive.set(windowId, {
		tabId: tabId,
		lastUpdated: Date.now()
	});
	
	if (is_debug) {
		let tabActiveId = cacheTabActive.get(windowId)?.tabId;
		let tabActivePrevId = cacheTabActivePrev.get(windowId)?.tabId;
		
		// Get current tab details for enhanced logging
		chrome.tabs.get(tabId, (currentTab) => {
			if (chrome.runtime.lastError) {
				console.log(`onTabOpenActivated(): windowId: ${windowId}, cacheTabActiveId: ${tabActiveId}, cacheTabActivePrevId: ${tabActivePrevId} (could not fetch tab details)`);
			} else {
				console.log(`onTabOpenActivated(): windowId: ${windowId}, cacheTabActiveId: ${tabActiveId}, cacheTabActivePrevId: \
					${tabActivePrevId}, currentTab: "${currentTab.title}" (index: ${currentTab.index})`);
			}
		});
	}
}

function initTabActive(){
	console.log("initTabActive(): Initializing active tab cache...");
	
	// Get all windows and their active tabs
	chrome.windows.getAll({ populate: true }, (windows) => {
		if (chrome.runtime.lastError) {
			console.error("initTabActive(): Error getting windows:", chrome.runtime.lastError);
			return;
		}
		
		windows.forEach((window) => {
			if (window.tabs && window.tabs.length > 0) {
				// Find the active tab in this window
				const activeTab = window.tabs.find(tab => tab.active);
				if (activeTab) {
					// Initialize current active tab cache
					cacheTabActive.set(window.id, {
						tabId: activeTab.id,
						lastUpdated: Date.now()
					});

					// Initialize previous active tab cache (set to same for now, will be updated on first activation)
					cacheTabActivePrev.set(window.id, {
						tabId: activeTab.id,
						lastUpdated: Date.now()
					});
					
					if (is_debug) {
						console.log(`initTabActive(): Window ${window.id} - active tab: ${activeTab.id}`);
					}
				}
			}
		});
		if (is_debug) {
			console.log(`initTabActive(): Initialized cache for ${windows.length} windows`);
			console.log("initTabActive(): cacheTabActive size:", cacheTabActive.size);
			console.log("initTabActive(): cacheTabActivePrev size:", cacheTabActivePrev.size);
		}
	});
}
initTabActive();

chrome.tabs.onActivated.addListener((activeInfo) => {
	onTabOpenActivated(activeInfo.windowId, activeInfo.tabId);
});

// Listen for tab removals to clean up cache
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
	removeTabFromCache(tabId, removeInfo.windowId);
});

// Listen for tab detachments to remove from cache
chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
	removeTabFromCache(tabId, detachInfo.oldWindowId);
});

// Function to remove tab from cache when tabs are removed
function removeTabFromCache(tabId, windowId) {
	// Check if removed tab was the current active tab
	const currentActive = cacheTabActive.get(windowId);
	if (currentActive && currentActive.tabId === tabId) {
		// Clear current active tab cache for this window
		cacheTabActive.delete(windowId);
		if (is_debug) {
			console.log(`removeTabFromCache(): Removed current active tab ${tabId} from window ${windowId} cache`);
		}
	}
	
	// Check if removed tab was the previous active tab
	const prevActive = cacheTabActivePrev.get(windowId);
	if (prevActive && prevActive.tabId === tabId) {
		// Clear previous active tab cache for this window
		cacheTabActivePrev.delete(windowId);
		if (is_debug) {
			console.log(`removeTabFromCache(): Removed previous active tab ${tabId} from window ${windowId} cache`);
		}
	}
}

// Register event listeners
chrome.tabs.onCreated.addListener((tabNew) => {
	// console.log("new tab created", tabNew);
	updateBadge("create")
	// Move new tab next to current tab
	moveNewTabNextToCurrent(tabNew);
});

async function getTabIndex(tabId) {
	try {
	  const tab = await chrome.tabs.get(tabId);
	  return tab.index;
	} catch (error) {
	  console.error('Error getting tab index:', error);
	  return null;
	}
	// Usage
	// const index = await getTabIndex(tabId);
}

// Function to move new tab next to current tab
async function moveNewTabNextToCurrent(tabNew) {
	if (!tabNew || !tabNew.windowId){
		console.log("new tab created but no windowId", tabNew);
		return;
	}
	if(is_debug){
		console.log("moveNewTabNextToCurrent(): tabNew", tabNew);
	}
	// Check if the new tab is active (extension-created tabs often become active immediately)
	const isNewTabActive = tabNew.active;
	if (isNewTabActive) { // New tab is active - move it next to the previous active tab
		const tabActive = cacheTabActive.get(tabNew.windowId);
		const cachedTabActivePrev = cacheTabActivePrev.get(tabNew.windowId)
		if(is_debug){
			// Enhanced debug logging with titles
			if (tabActive) {
				try {
					const activeTab = await chrome.tabs.get(tabActive.tabId);
					console.log("tabActive", { ...tabActive, title: activeTab.title });
				} catch (e) {
					console.log("tabActive", tabActive, "(could not fetch title)");
				}
			} else {
				console.log("tabActive", tabActive);
			}
			
			if (cachedTabActivePrev) {
				try {
					const prevTab = await chrome.tabs.get(cachedTabActivePrev.tabId);
					console.log("cacheTabActivePrev", { ...cachedTabActivePrev, title: prevTab.title });
				} catch (e) {
					console.log("cacheTabActivePrev", cachedTabActivePrev, "(could not fetch title)");
				}
			} else {
				console.log("cacheTabActivePrev", cachedTabActivePrev);
			}
		}
		let tabActiveTitle, tabNewTitle;
		if(tabActive && tabActive.tabId !== tabNew.id){ // onTabOpenActivated() is not triggered yet
			// Query for current active tab's index
			const activeTabDetails = await chrome.tabs.get(tabActive.tabId);
			let activeTabIndex = activeTabDetails.index;
			console.log("tabNew.index:", tabNew.index);
			console.log("activeTab.index:", activeTabDetails.index);
			if (activeTabDetails !== null 
				// && tabNew.index !== activeTabIndex + 1
				// && tabNew.index !== activeTabIndex
			) {
				if(is_debug){
					// Get tab titles for enhanced logging
					tabActiveTitle = "unknown";
					tabNewTitle = tabNew.title || "unknown";
					try {
						tabActiveTitle = activeTabDetails.title;
					} catch (e) {
						console.log("Could not fetch active tab title:", e);
					}
					console.log("tabNew.index: before", tabNew.index);
				}
				let indexNew;
				if(tabNew.index < activeTabIndex){
					indexNew = activeTabIndex;
				}else{
					indexNew = activeTabIndex + 1;
				}
				await chrome.tabs.move(tabNew.id, {
					// index: activeTabIndex + 1
					index: indexNew
				});
				if(is_debug){
					let tabNewIndexAfterMove = await getTabIndex(tabNew.id);
					console.log(`tabNew: ${tabNew.id} ("${tabNewTitle}") index after move: ${tabNewIndexAfterMove}`)
					let tabActiveIndexAfterMove = await getTabIndex(tabActive.tabId);
					console.log(`tabActive: ${tabActive.tabId} ("${tabActiveTitle}") index after move: ${tabActiveIndexAfterMove}`);
				}
				return;
			}
		}

		const tabActivePrev = cacheTabActivePrev.get(tabNew.windowId);
		console.log("tabActivePrev", tabActivePrev);
		
		// Check if we have valid cached previous active tab data
		if (tabActivePrev && tabActivePrev.tabId) {
			// Query for previous active tab's current index
			const prevTabIndex = await getTabIndex(tabActivePrev.tabId);
			if (prevTabIndex !== null && tabNew.index !== prevTabIndex + 1) {
				chrome.tabs.move(tabNew.id, {
					index: prevTabIndex + 1
				});
				console.log(`tabNew(id:${tabNew.id}) moved tabActivePrev(id=:${tabActivePrev.tabId}) at index ${prevTabIndex}`);
			}
		} else {
			console.log(`No valid previous active tab cache for window ${tabNew.windowId}, skipping move`);
		}
	} else {
		// New tab is not active - move it next to the current active tab
		const tabActiveCached = cacheTabActive.get(tabNew.windowId);
		console.log("tabActiveCached", tabActiveCached);
		
		// Check if we have valid cached current active tab data
		if (tabActiveCached && tabActiveCached.tabId) {
			// Query for current active tab's index
			const activeTabIndex = await getTabIndex(tabActiveCached.tabId);
			if (activeTabIndex !== null && tabNew.index !== activeTabIndex + 1) {
				chrome.tabs.move(tabNew.id, {
					index: activeTabIndex + 1
				});
				// console.log(`Moved inactive new tab ${tabNew.id} next to current active tab ${tabActiveCached.tabId} at index ${activeTabIndex}`);
			}
		} else {
			console.log(`No valid current active tab cache for window ${tabNew.windowId}, skipping move`);
		}
	}
}
chrome.tabs.onRemoved.addListener(() => updateBadge("remove"));
chrome.windows.onFocusChanged.addListener(() => updateBadge("focus_change"));

// Initial update
updateBadge();

// Start the initial interval only if one isn't already running
if (intervalId === null) {
	intervalId = setInterval(updateBadge, 1500);  // every 1.5 seconds
}

let currentTabMode = 0; // 0: Free, 1: Always first, 2: Always last
let contextMenuTarget = null;
let elTabsActive = {};
let elTabsActiveLast = {};

// DOM Elements
const windowsContainer = document.getElementById('windows-container');
const contextMenu = document.getElementById('context-menu');
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const urlUploadBtn = document.getElementById('upload-url-btn');
const refreshBtn = document.getElementById('refresh-btn');
const RemoteSettings = document.getElementById('upload-url-modal');
const urlUploadInput = document.getElementById('upload-url-input');
const saveUploadUrlBtn = document.getElementById('save-upload-url');
const cancelUploadUrlBtn = document.getElementById('cancel-upload-url');

// initialize tabs when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    getRemoteAddress()
    loadSessionsOpen();
    setupEventListeners();
    closeDuplicateTabs(); // Add this line
    setupItemSize();
});

function setUploadUrl(url){
    chrome.storage.sync.set({ urlUpload: url });
}

// Setup all event listeners
function setupEventListeners() {
    // Mode toggle button
    modeToggleBtn.addEventListener('click', toggleTabMode);
    
    // Upload URL button
    urlUploadBtn.addEventListener('click', () => {
        urlUploadInput.value = urlUpload;
        RemoteSettings.style.display = 'flex';
    });
    
    // Refresh button
    refreshBtn.addEventListener('click', loadSessionsOpen);
    
    // Save upload URL
    saveUploadUrlBtn.addEventListener('click', () => {
        urlUpload = urlUploadInput.value.trim();
        setUploadUrl(urlUpload)
        RemoteSettings.style.display = 'none';
    });
    
    // Cancel upload URL
    cancelUploadUrlBtn.addEventListener('click', () => {
        RemoteSettings.style.display = 'none';
    });
    
    // Close modal when clicking outside
    RemoteSettings.addEventListener('click', (e) => {
        if (e.target === RemoteSettings) {
            RemoteSettings.style.display = 'none';
        }
    });
    
    // Handle context menu item clicks
    document.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', handleContextMenuAction);
    });
    
    // Close context menu when clicking outside
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });
    
    // Chrome tabs event listeners
    setupChromeTabsListeners();
}

// Toggle tab mode (Free, Always First, Always Last)
function toggleTabMode() {
    currentTabMode = (currentTabMode + 1) % 3;
    
    switch(currentTabMode) {
        case 0:
            modeToggleBtn.textContent = 'Current Tab: Free';
            break;
        case 1:
            modeToggleBtn.textContent = 'Current Tab: Always First';
            break;
        case 2:
            modeToggleBtn.textContent = 'Current Tab: Always Last';
            break;
    }
    
    applyCurrentTabMode();
}

// Apply the current tab mode
function applyCurrentTabMode() {
    chrome.windows.getCurrent(currentWindow => {
        chrome.tabs.query({ windowId: currentWindow.id }, (tabs) => {
            const activeTab = tabs.find(tab => tab.active);
            
            if (!activeTab) return;
            
            switch(currentTabMode) {
                case 1: // Always first
                    if (tabs[0].id !== activeTab.id) {
                        chrome.tabs.move(activeTab.id, { index: 0 });
                    }
                    break;
                case 2: // Always last
                    if (tabs[tabs.length - 1].id !== activeTab.id) {
                        chrome.tabs.move(activeTab.id, { index: -1 });
                    }
                    break;
            }
        });
    });
}

let pendingNewTabs = {}; // deal with onActivated during tab creation

// Setup Chrome tabs event listeners
function setupChromeTabsListeners() {
    // Create a debounce function to prevent rapid successive calls
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };
    
    const debouncedLoadTabs = debounce(loadSessionsOpen, 300); // Debounced version of loadSessionsOpen
    
    // Tab events that should trigger a complete reload
    chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
        handleTabMoved(tabId, moveInfo);
    });
    chrome.tabs.onAttached.addListener((newTab)=>{
        console.log("onAttached")
        debouncedLoadTabs()
    });
    chrome.tabs.onDetached.addListener((newTab)=>{
        console.log("onDetached")
        debouncedLoadTabs()
    });

    
    // Modified Tab activation handler that's aware of pending tabs
    chrome.tabs.onActivated.addListener((activeInfo) => {
        console.log("onActivated")
        monitorActiveTabs()

        // If this is a pending new tab, we'll handle its activation when it's fully added to the DOM
        if (pendingNewTabs[activeInfo.tabId]) {
            console.log("tab in pendingNewTabs")
            return;
        }
        
        // Update active tab highlighting
        if(elTabsActive[activeInfo.windowId]){
            elTabsActive[activeInfo.windowId].classList.remove('active-tab');
        }else{
            document.querySelectorAll('.tab-item').forEach(el => {
                el.classList.remove('active-tab');
            });
        }
        
        const activeTabElement = document.querySelector(`.tab-item[data-tab-id="${activeInfo.tabId}"]`);
        if (activeTabElement) {
            set_active_tab_el(activeTabElement, activeInfo.windowId);
        } else {
            // Consider a small delay before reloading to allow the DOM to update
            setTimeout(() => {
                // Check again after the delay, in case the tab was being added
                const delayedCheck = document.querySelector(`.tab-item[data-tab-id="${activeInfo.tabId}"]`);
                if (delayedCheck) {
                    set_active_tab_el(delayedCheck, activeInfo.windowId);
                } else {
                    debouncedLoadTabs();
                }
            }, 50);
        }
    });// Track newly created tabs to handle synchronization with onActivated
    

    // Modified chrome.tabs.onCreated.addListener to handle tab position and track new tabs
    chrome.tabs.onCreated.addListener((newTab) => {
        // Track this new tab
        pendingNewTabs[newTab.id] = true;
        
        // Find the window container or create it if it doesn't exist
        let windowElement = document.querySelector(`.window-container[data-window-id="${newTab.windowId}"]`);
        
        if (!windowElement) {
            // If the window doesn't exist in our UI, we need to create it
            chrome.windows.get(newTab.windowId, { populate: false }, (window) => {
                chrome.windows.getCurrent(currentWindow => {
                    const isCurrentWindow = window.id === currentWindow.id;
                    windowElement = createWindowElement(window, isCurrentWindow);
                    windowsContainer.appendChild(windowElement);
                    
                    // Now add the new tab to this window
                    addNewTabToWindow(newTab, windowElement);
                });
            });
        } else {
            // The window exists, just add the new tab to it
            addNewTabToWindow(newTab, windowElement);
        }
    });


    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => { // Handle tab removal more efficiently
        console.log("onRemoved")
        const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
        if (tabElement) {
            // Get the window element
            const windowId = removeInfo.windowId;
            const windowElement = document.querySelector(`.window-container[data-window-id="${windowId}"]`);
            
            if (windowElement) { // Remove the tab element
                tabElement.remove();
                
                // Update the tab count
                const tabCountElement = windowElement.querySelector('.tab-count');
                const tabGrid = windowElement.querySelector('.tab-grid');
                const remainingTabs = tabGrid.querySelectorAll('.tab-item').length;
                
                if (tabCountElement) {
                    tabCountElement.textContent = `${remainingTabs} tab${remainingTabs !== 1 ? 's' : ''}`;
                }
                
                // If no tabs left, remove the window element
                if (remainingTabs === 0) {
                    windowElement.remove();
                }
            }
        } else {
            // If we can't find the element, fall back to reloading everything
            debouncedLoadTabs();
        }
    });

    
    // Tab updates (title, favicon, etc.)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
        
        if (tabElement) {
            // Update title if changed
            if (changeInfo.title) {
                const titleElement = tabElement.querySelector('.tab-title');
                if (titleElement) {
                    titleElement.textContent = tab.title || 'Untitled';
                }
                
                // Update tooltip
                tabElement.querySelector('.tab-tooltip').textContent = tab.title || 'Untitled';
            }
            
            // Update favicon if changed
            if (changeInfo.favIconUrl) {
                const faviconElement = tabElement.querySelector('.tab-icon');
                if (faviconElement && tab.favIconUrl && tab.favIconUrl.trim() !== '') {
                    if (tab.favIconUrl.startsWith('http') || tab.favIconUrl.startsWith('data:')) {
                        faviconElement.src = tab.favIconUrl;
                        faviconElement.onerror = () => {
                            faviconElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
                            faviconElement.onerror = null;
                        };
                    }
                }
            }
        }
    });
}

// insert tab at certain position
function addNewTabToWindow(tab, windowElement) {
    // Create the tab element
    const tabElement = createTabElement(tab);
    
    // Find the tab grid in this window
    const tabGrid = windowElement.querySelector('.tab-grid');
    if (tabGrid) {
        // Get all tabs in the window to determine correct position
        chrome.tabs.query({ windowId: tab.windowId }, (tabs) => {
            // Find the index of our tab
            const tabIndex = tabs.findIndex(t => t.id === tab.id);
            
            if (tabIndex === -1 || tabIndex >= tabs.length - 1) {
                // Tab not found in the list or it's the last tab, append to the end
                tabGrid.appendChild(tabElement);
            } else {
                // Find the next tab element after our position
                const nextTabId = tabs[tabIndex + 1].id;
                const nextTabElement = tabGrid.querySelector(`.tab-item[data-tab-id="${nextTabId}"]`);
                
                if (nextTabElement) {
                    // Insert before the next tab
                    tabGrid.insertBefore(tabElement, nextTabElement);
                } else {
                    // Fallback: append to the end
                    tabGrid.appendChild(tabElement);
                }
            }
            
            // Update the tab count
            const tabCountElement = windowElement.querySelector('.tab-count');
            const tabsOpenNumTotal = tabGrid.querySelectorAll('.tab-item').length;
            
            if (tabCountElement) {
                tabCountElement.textContent = `${tabsOpenNumTotal} tab${tabsOpenNumTotal !== 1 ? 's' : ''}`;
            }
            
            console.log("pendingNewTabs:", pendingNewTabs)
            // Mark this tab as fully added to the DOM
            if (pendingNewTabs[tab.id]) {
                // Set a very small timeout to ensure DOM is updated
                setTimeout(() => {
                    console.log("pendingNewTabs: deleting", tab.id)
                    delete pendingNewTabs[tab.id];
                    
                    // If this tab is active, update its active state now
                    if (tab.active) {
                        set_active_tab_el(tabElement, tab.windowId);
                    }
                }, 10);
            }
        });
    }
}

// Function to handle tab moved event
function handleTabMoved(tabId, moveInfo) {
    const { windowId, fromIndex, toIndex } = moveInfo;
    
    // Find the tab element and window element
    const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    const windowElement = document.querySelector(`.window-container[data-window-id="${windowId}"]`);
    
    if (!tabElement || !windowElement) {
        // If we can't find the elements, fall back to reloading everything
        debouncedLoadTabs();
        return;
    }
    
    const tabGrid = windowElement.querySelector('.tab-grid');
    if (!tabGrid) {
        debouncedLoadTabs();
        return;
    }
    
    // Get all tabs in this window to determine the new position
    chrome.tabs.query({ windowId }, (tabs) => {
        // Find where to insert the tab
        if (toIndex >= tabs.length - 1) {
            // Moving to the end
            tabGrid.appendChild(tabElement);
        } else {
            // Find the tab that should come after this one
            const afterTabId = tabs[toIndex + 1].id;
            const afterTabElement = tabGrid.querySelector(`.tab-item[data-tab-id="${afterTabId}"]`);
            
            if (afterTabElement) {
                // Insert before the next tab
                tabGrid.insertBefore(tabElement, afterTabElement);
            } else {
                // Fallback if we can't find the next tab
                tabGrid.appendChild(tabElement);
            }
        }
    });
}// Modified Tab activation handler that's aware of pending tabs

// Load all windows and tabs
function loadSessionsOpen() {
    monitorActiveTabs();

    // Clear existing content
    windowsContainer.innerHTML = '';
    
    // Get all windows
    chrome.windows.getAll({ populate: true }, (windows) => {
        // Get current window ID to identify the active window
        chrome.windows.getCurrent(currentWindow => {
            const windowCurrentId = currentWindow.id;
            
            // Process each window
            windows.forEach(window => {
                // Create window container
                const windowElement = createWindowElement(window, window.id === windowCurrentId);
                windowsContainer.appendChild(windowElement);
            });
        });
    });
}

// create a window element
function createWindowElement(window, isCurrentWindow) {
    const windowElement = document.createElement('div');
    windowElement.className = 'window-container';
    windowElement.dataset.windowId = window.id;

    const windowHeader = document.createElement('div');
    windowHeader.className = 'window-header';
    
    const windowTitle = document.createElement('div');
    windowTitle.className = 'window-title';
    windowTitle.textContent = `Window ${window.id}`;
    
    const tabCount = document.createElement('div');
    tabCount.className = 'tab-count';
    tabCount.textContent = `${window.tabs.length} tab${window.tabs.length !== 1 ? 's' : ''}`;
    
    windowHeader.appendChild(windowTitle);
    windowHeader.appendChild(tabCount);
    
    // Create tab grid
    const tabGrid = document.createElement('div');
    tabGrid.className = 'tab-grid';
    
    // Add tabs to the grid
    window.tabs.forEach(tab => {
        const tabElement = createTabElement(tab);
        tabGrid.appendChild(tabElement);
    });
    
    // Assemble window container
    windowElement.appendChild(windowHeader);
    windowElement.appendChild(tabGrid);
    
    return windowElement;
}

function set_active_tab_el(el, windowId){
    // el.classList.add('active-tab')
    let elTabActive = elTabsActive[windowId];
    let elTabActiveLast = elTabsActiveLast[windowId];
    
    if(elTabActive){
        elTabActive.classList.remove('active-tab')
        elTabActive.classList.add('active-tab-last');        
    }
    if(elTabActiveLast){
        elTabActiveLast.classList.remove('active-tab-last');
    }
    el.classList.remove('active-tab-last')
    el.classList.add('active-tab')
    
    if(elTabActive){
        elTabActiveLast = elTabActive;
    }
    elTabActive = el;

    elTabsActive[windowId] = elTabActive;
    elTabsActiveLast[windowId] = elTabActiveLast;
}

function createTabElement(tab) {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab-item';
    tabElement.dataset.tabId = tab.id;
    tabElement.dataset.windowId = tab.windowId;
    
    if (tab.active) {
        set_active_tab_el(tabElement, tab.windowId);
    }
    
    // Create favicon with error handling
    const favicon = document.createElement('img');
    favicon.className = 'tab-icon';
    favicon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
    
    if (tab.favIconUrl && tab.favIconUrl.trim() !== '') {
        if (tab.favIconUrl.startsWith('http') || tab.favIconUrl.startsWith('data:')) {
            favicon.src = tab.favIconUrl;
            favicon.onerror = () => {
                favicon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
                favicon.onerror = null;
            };
        }
    }
    
    // create title
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title || 'Untitled';
    
    // create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tab-tooltip';
    tooltip.textContent = tab.title || 'Untitled';
    
    // create status badge (hidden by default)
    const statusBadge = document.createElement('div');
    statusBadge.className = 'status-badge';
    statusBadge.style.display = 'none';
    
    // create close button (visible on hover)
    const closeButton = document.createElement('div');
    closeButton.className = 'tab-close-button';
    closeButton.innerHTML = '&times;'; // × symbol
    closeButton.title = 'Close tab';
    
    // add click event for close button
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the tab from being activated
        chrome.tabs.remove(tab.id);
    });
    
    // add click event to switch to tab
    tabElement.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
    });
    
    // add context menu event
    tabElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, tab);
    });
    
    const tabContent = document.createElement('div');
    tabContent.classList.add("tab-content")

    // Assemble tab element
    tabElement.appendChild(tabContent);
    tabElement.appendChild(closeButton);
    tabElement.appendChild(tooltip);
    tabContent.appendChild(favicon);
    tabContent.appendChild(title);
    tabContent.appendChild(statusBadge);
    
    return tabElement;
}

// Show context menu for a tab
function showContextMenu(event, tab) {
    // Store the target tab
    contextMenuTarget = tab;
    
    // Position the context menu
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    contextMenu.style.display = 'block';
    
    // Prevent the menu from going off-screen
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (menuRect.right > viewportWidth) {
        contextMenu.style.left = `${event.pageX - menuRect.width}px`;
    }
    
    if (menuRect.bottom > viewportHeight) {
        contextMenu.style.top = `${event.pageY - menuRect.height}px`;
    }
    
    // Stop event propagation
    event.stopPropagation();
}

// Handle context menu actions
function handleContextMenuAction(e) {
    const action = e.currentTarget.getAttribute('data-action');
    
    if (!contextMenuTarget) return;
    
    switch(action) {
        case 'switch':
            chrome.tabs.update(contextMenuTarget.id, { active: true });
            chrome.windows.update(contextMenuTarget.windowId, { focused: true });
            break;
            
        case 'upload':
            uploadTabInfo(contextMenuTarget);
            break;
            
        case 'close':
            chrome.tabs.remove(contextMenuTarget.id);
            break;
    }
    
    // Hide the context menu
    contextMenu.style.display = 'none';
}

// Upload tab information
function uploadTabInfo(tab) {
    const tabElement = document.querySelector(`.tab-item[data-tab-id="${tab.id}"]`);
    const statusBadge = tabElement ? tabElement.querySelector('.status-badge') : null;
    
    if (statusBadge) {
        statusBadge.style.display = 'block';
        statusBadge.className = 'status-badge';  // Reset class
    }
    
    axios.post(
        urlUpload,
        {
            task: 'create_url', // insert_url
            url: tab.url,
            text: tab.title,
            time_zone: get_local_timezone_int()
        }
    ).then((response) => {
        if (response.data.is_success) {
            console.log(`url: ${tab.url}`);
            
            if (statusBadge) {
                statusBadge.className = 'status-badge success';
            }
            
            // close the tab after successful upload
            setTimeout(() => {
                chrome.tabs.remove(tab.id);
            }, 1000);
            
        } else {
            console.log(response);
            
            if (statusBadge) {
                statusBadge.className = 'status-badge error';
            }
        }
    }).catch((error) => {
        console.error('Error uploading tab info:', error);
        
        if (statusBadge) {
            statusBadge.className = 'status-badge error';
        }
    });
}



// Function to close duplicate extension tabs
function closeDuplicateTabs() {
    // Get current tab URL to compare against others
    const urlCurrent = window.location.href;
    const currentTabId = new URLSearchParams(window.location.search).get('tabId');
    
    // Query for all extension tabs with the same URL pattern
    chrome.tabs.query({url: chrome.runtime.getURL("*")}, (tabs) => {
        if (tabs.length <= 1) return; // No duplicates
        
        // Get the current tab's ID to exclude it from closing
        chrome.tabs.getCurrent((currentTab) => {
            if (!currentTab) return;
            
            // Close all tabs with the same URL except the current one
            tabs.forEach(tab => {
                if (tab.id !== currentTab.id && tab.url.includes(chrome.runtime.getURL(""))) {
                    chrome.tabs.remove(tab.id);
                    console.log(`Closed duplicate tab: ${tab.id}`);
                }
            });
        });
    });
}

let tabs_selected_last = [];
let intervalId = null;

// monitor multiple tab selection
function monitorActiveTabs() {
    // Reset interval to prevent multiple intervals
    if (intervalId !== null) {
        clearInterval(intervalId);
    }

    // First, get the currently highlighted tabs to check against
    chrome.tabs.query({ 
        highlighted: true // selected windows
    }, (currentHighlightedTabs) => {
        // Create a map of highlighted tab IDs for faster lookup
        const highlightedTabIds = new Set(currentHighlightedTabs.map(tab => tab.id));
        
        // Only remove the class from tabs that are no longer highlighted
        tabs_selected_last.forEach(tabId => {
            // Skip removing the class if the tab is still highlighted
            if (highlightedTabIds.has(tabId)) {
                return;
            }
            
            let tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
            if (tabElement !== null) {
                // Only remove the class if the tab is not highlighted
                tabElement.classList.remove("selected-tab");
            }
        });
        
        // Reset the tracking array
        tabs_selected_last = [];
        
        // Now add the class to currently highlighted tabs and update tracking
        currentHighlightedTabs.forEach((tab) => {
            let tabElement = document.querySelector(`.tab-item[data-tab-id="${tab.id}"]`);
            if (tabElement !== null) {
                tabElement.classList.add("selected-tab");
                tabs_selected_last.push(tab.id);
            }
        });
    });

    intervalId = setInterval(monitorActiveTabs, 1000);
}

// Initialize the monitoring
intervalId = setInterval(monitorActiveTabs, 1000); // Fixed: was missing () after function name

const monitorId = monitorActiveTabs(); // This might not be needed since you're already using setInterval



function setupItemSize(){

    // use alt+wheel to alter tab item size
    const root = document.documentElement;
    const getSize = () => {
        const value = getComputedStyle(root).getPropertyValue("--item-size").trim();
        return parseFloat(value); // Convert "100px" → 100
    };
    chrome.storage.local.get("itemSize", (result) => {
        console.log("result.itemSize:", result.itemSize);
        let size = result.itemSize ?? getSize();

        // console.log("size:", result.itemSize);

        root.style.setProperty("--item-size", `${size}px`);

        window.addEventListener("wheel", (e) => {
            // console.log("wheel")
            if (!e.altKey) return; // Only trigger when Alt is pressed
            // console.log("alt+wheel")
            e.preventDefault();

            size += e.deltaY > 0 ? -5 : 5;
            size = Math.max(20, Math.min(300, size)); // Clamp size

            root.style.setProperty("--item-size", `${size}px`);
            chrome.storage.local.set({ itemSize: size });
            console.log("setting itemSize:", size);
        }, { passive: false });
    })

}



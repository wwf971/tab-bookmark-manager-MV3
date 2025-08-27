// tabs.js
document.addEventListener('DOMContentLoaded', () => {
    // Initial load of tabs
    loadTabs();
    
    // Setup listeners for tab changes
    setupTabListeners();
});

function loadTabs() {
    const tabListElement = document.getElementById('tab-list');
    tabListElement.innerHTML = '';
    
    // Get current window ID to identify the active tab in current window
    chrome.windows.getCurrent(currentWindow => {
        const windowCurrentId = currentWindow.id;
        
        // Query all tabs from all windows
        chrome.tabs.query({}, (allTabs) => {
            updateTabCount(allTabs.length);
            
            // Find the active tab in current window
            const activeTabInCurrentWindow = allTabs.find(tab => tab.active && tab.windowId === windowCurrentId);
            
            // Other tabs (all tabs except the active one in current window)
            const otherTabs = allTabs.filter(tab => !(tab.active && tab.windowId === windowCurrentId));
            
            // Place active tab of current window at the beginning
            if (activeTabInCurrentWindow) {
                const activeTabElement = createTabElement(activeTabInCurrentWindow);
                tabListElement.appendChild(activeTabElement);
            }
            
            // Add all other tabs
            otherTabs.forEach(tab => {
                const tabElement = createTabElement(tab);
                tabListElement.appendChild(tabElement);
            });
        });
    });
}

function createTabElement(tab) {
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    tabItem.dataset.tabId = tab.id;
    tabItem.dataset.windowId = tab.windowId;
    
    if (tab.active) {
        tabItem.classList.add('current-tab');
    }
    
    // Create favicon with better error handling
    const favicon = document.createElement('img');
    favicon.className = 'tab-icon';
    
    // Set a default icon first
    favicon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
    
    // Only try to load the actual favicon if one exists
    if (tab.favIconUrl && tab.favIconUrl.trim() !== '') {
        // Verify the favicon URL is valid
        if (tab.favIconUrl.startsWith('http') || tab.favIconUrl.startsWith('data:')) {
            favicon.src = tab.favIconUrl;
            favicon.onerror = () => {
                // On error, fallback to the default favicon (already set)
                // Prevent further error requests
                favicon.onerror = null;
            };
        }
    }
    
    // Create window indicator
    const windowIndicator = document.createElement('span');
    windowIndicator.className = 'window-indicator';
    windowIndicator.textContent = `Window ${tab.windowId}`;
    
    // Create title
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title || 'Untitled';
    
    // Create URL
    const url = document.createElement('div');
    url.className = 'tab-url';
    url.textContent = tab.url;
    
    // Create status indicator
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'action-status';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the tab click event
        chrome.tabs.remove(tab.id);
    });
    
    // Create upload button
    const uploadButton = document.createElement('button');
    uploadButton.className = 'upload-button';
    uploadButton.textContent = 'Upload';
    uploadButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the tab click event
        uploadTabInfo(tab, statusIndicator);
    });
    
    // Append all elements
    tabItem.appendChild(favicon);
    tabItem.appendChild(windowIndicator);
    tabItem.appendChild(title);
    tabItem.appendChild(url);
    tabItem.appendChild(statusIndicator);
    tabItem.appendChild(closeButton);
    tabItem.appendChild(uploadButton);
    
    // Make the tab item clickable to switch to that tab
    tabItem.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
    });
    
    return tabItem;
}

// Function to upload tab information
function uploadTabInfo(tab, statusIndicator) {
    // Use the provided code to upload tab information
    axios.post(
        urlUpload,
        {
            task: 'insert_url',
            url: tab.url,
            text: tab.title,
        }
    ).then((response) => {
        if (response.data.is_success) {
            console.log(`url: ${tab.url}`);

            // Show success message
            statusIndicator.textContent = 'Uploaded successfully';
            statusIndicator.className = 'action-status success';

            // Close the tab after successful upload
            setTimeout(() => {
                chrome.tabs.remove(tab.id);
            }, 1000); // Delay closing by 1 second to show the success message
            
        } else {
            console.log(response);
            
            // Show error message
            statusIndicator.textContent = 'Upload failed';
            statusIndicator.className = 'action-status error';
        }
    }).catch((error) => {
        console.error('Error uploading tab info:', error);
        
        // Show error message
        statusIndicator.textContent = 'Upload failed';
        statusIndicator.className = 'action-status error';
    });
}

function updateTabCount(count) {
    const tabCountElement = document.getElementById('tab-count');
    tabCountElement.textContent = `${count} tab${count !== 1 ? 's' : ''}`;
}

function setupTabListeners() {
    // Create a debounce function for loadTabs
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };
    
    // Debounced version of loadTabs to prevent rapid successive calls
    const debouncedLoadTabs = debounce(loadTabs, 300);
    
    // Listen for tab creation
    chrome.tabs.onCreated.addListener((tab) => {
        debouncedLoadTabs();
    });
    
    // Listen for tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
        const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.remove();
            
            // Update tab count
            chrome.tabs.query({}, (tabs) => {
                updateTabCount(tabs.length);
            });
        } else {
            // If element not found, reload all tabs
            debouncedLoadTabs();
        }
    });
    
    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        const tabElement = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
        
        if (tabElement) {
            // Selectively update title if changed
            if (changeInfo.title) {
                const titleElement = tabElement.querySelector('.tab-title');
                if (titleElement) {
                    titleElement.textContent = tab.title || 'Untitled';
                }
            }
            
            // Selectively update URL if changed
            if (changeInfo.url) {
                const urlElement = tabElement.querySelector('.tab-url');
                if (urlElement) {
                    urlElement.textContent = tab.url;
                }
            }
            
            // Selectively update favicon if changed
            if (changeInfo.favIconUrl) {
                const faviconElement = tabElement.querySelector('.tab-icon');
                if (faviconElement && tab.favIconUrl && tab.favIconUrl.trim() !== '') {
                    // Only update if favicon URL is valid
                    if (tab.favIconUrl.startsWith('http') || tab.favIconUrl.startsWith('data:')) {
                        faviconElement.src = tab.favIconUrl;
                        faviconElement.onerror = () => {
                            // Fallback to default icon if favicon fails to load
                            faviconElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
                            faviconElement.onerror = null;
                        };
                    }
                }
            }
        }
    });
    
    // Listen for tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
        // Remove current-tab class from all tabs
        document.querySelectorAll('.current-tab').forEach(el => {
            el.classList.remove('current-tab');
        });
        
        // Add current-tab class to the newly activated tab
        const tabElement = document.querySelector(`.tab-item[data-tab-id="${activeInfo.tabId}"]`);
        if (tabElement) {
            tabElement.classList.add('current-tab');
        } else {
            // If we can't find the element, it might be because our list is outdated
            debouncedLoadTabs();
        }
    });
    
    // Listen for tab movement - debounced to prevent multiple reloads
    chrome.tabs.onMoved.addListener(() => {
        debouncedLoadTabs();
    });
    
    // Listen for tab attachment/detachment
    chrome.tabs.onAttached.addListener(() => {
        debouncedLoadTabs();
    });
    
    chrome.tabs.onDetached.addListener(() => {
        debouncedLoadTabs();
    });
}
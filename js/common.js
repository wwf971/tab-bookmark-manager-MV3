function get_local_timezone_int(){
    const timezoneOffsetInMinutes = new Date().getTimezoneOffset();
    const timezoneOffsetInHours = Math.round(-timezoneOffsetInMinutes / 60);
    return timezoneOffsetInHours
}

// Configuration loading with fallback
let userConfig = null;
let urlUpload = null;
let urlUploadDefault = null;

// Function to load configuration with fallback
export async function loadUserConfig() {
    if (userConfig) return userConfig; // Return cached config if already loaded
    
    try {
        // Try to import from _user.config.js first (user-specific settings)
        const { userConfig: config } = await import('../vue-project/_user.config.js');
        userConfig = config;
        console.log('Loaded configuration from _user.config.js');
        return userConfig;
    } catch (error) {
        // If _user.config.js doesn't exist or fails to load, fallback to user.config.js
        try {
            const { userConfig: config } = await import('../vue-project/user.config.js');
            userConfig = config;
            console.log('Loaded configuration from user.config.js (fallback)');
            return userConfig;
        } catch (fallbackError) {
            console.error('Failed to load any configuration file:', fallbackError);
            // Set default configuration
            userConfig = {
                urlUpload: "https://example.com"
            };
            return userConfig;
        }
    }
}

// Initialize configuration
async function initializeConfig() {
    const config = await loadUserConfig();
    urlUploadDefault = config.urlUpload;
    urlUpload = urlUploadDefault;
    return config;
}
async function getRemoteAddress() {
    return new Promise(async (resolve) => {
        // Ensure configuration is loaded first
        await initializeConfig();
        
        // First get the URL source preference
        chrome.storage.local.get(['urlUploadSource', 'urlUploadLocal'], (localResult) => {
            chrome.storage.sync.get(['urlUploadSync'], (syncResult) => {
                let useLocalUrl = localResult.urlUploadSource === 'local';
                
                // Initialize local URL if needed
                if (localResult.urlUploadLocal === undefined) {
                    chrome.storage.local.set({ urlUploadLocal: urlUploadDefault });
                    localResult.urlUploadLocal = urlUploadDefault;
                }

                // Initialize sync URL if needed
                if (syncResult.urlUploadSync === undefined) {
                    chrome.storage.sync.set({ urlUploadSync: urlUploadDefault });
                    syncResult.urlUploadSync = urlUploadDefault;
                }

                // Initialize source preference if needed
                if (localResult.urlUploadSource === undefined) {
                    chrome.storage.local.set({ urlUploadSource: 'sync' });
                    useLocalUrl = false;
                }

                // Set the global urlUpload based on source preference
                urlUpload = useLocalUrl ? localResult.urlUploadLocal : syncResult.urlUploadSync;
                resolve(urlUpload);
            });
        });
    });
}

// Function to update URL settings
function updateUrlSettings(localUrl, syncUrl, useLocal) {
    return new Promise((resolve) => {
        const updates = [];
        
        // Update local storage
        updates.push(new Promise((resolveLocal) => {
            chrome.storage.local.set({
                urlUploadLocal: localUrl,
                urlUploadSource: useLocal ? 'local' : 'sync'
            }, resolveLocal);
        }));

        // Update sync storage
        updates.push(new Promise((resolveSync) => {
            chrome.storage.sync.set({
                urlUploadSync: syncUrl
            }, resolveSync);
        }));

        // Wait for all updates to complete
        Promise.all(updates).then(() => {
            // Update the global urlUpload
            urlUpload = useLocal ? localUrl : syncUrl;
            resolve(urlUpload);
        });
    });
}

// Initialize by getting upload URL
(async () => {
    await getRemoteAddress();
})();
// Wait for DOM to be fully loaded before initializing variables and event listeners
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM Content Loading...');

        // Initialize DOM elements
        const statusElement = document.getElementById('status');
        const regularRadio = document.getElementById('regular');
        const videoRadio = document.getElementById('video');
        const tagInput = document.getElementById('tagInput');
        const addTagButton = document.getElementById('addTagButton');
        const refreshTagsButton = document.getElementById('refreshTagsButton');
        const suggestionsContainer = document.getElementById('suggestions');
        const closeTabCheckbox = document.getElementById('closeTabCheckbox');
        const tagsContainer = document.getElementById('tagsContainer');
        const uploadButton = document.getElementById('uploadButton');
        const urlUploadDisplay = document.getElementById('urlUploadDisplay');
        const commentInput = document.getElementById('commentInput');
        const uploadCacheButton = document.getElementById('uploadCacheButton');
        const uploadSelectedButton = document.getElementById('uploadSelectedButton');
        
        // URL Settings elements
        const remoteSettingsButton = document.getElementById('remoteSettingsButton');
        const remoteSettingsModal = document.getElementById('remoteSettingsModal');
        const urlUploadLocalInput = document.getElementById('urlUploadLocal');
        const urlUploadSyncInput = document.getElementById('urlUploadSync');
        const useLocalUrlRadio = document.getElementById('useLocalUrl');
        const useSyncUrlRadio = document.getElementById('useSyncUrl');
        const saveUrlSettingsButton = document.getElementById('saveUrlSettings');
        const cancelUrlSettingsButton = document.getElementById('cancelUrlSettings');

        // Add URL Settings elements to required elements check
        const requiredElements = {
            status: statusElement,
            tagsContainer: tagsContainer,
            uploadButton: uploadButton,
            uploadCacheButton: uploadCacheButton,
            uploadSelectedButton: uploadSelectedButton,
            tagInput: tagInput,
            addTagButton: addTagButton,
            refreshTagsButton: refreshTagsButton,
            suggestionsContainer: suggestionsContainer,
            regularRadio: regularRadio,
            videoRadio: videoRadio,
            closeTabCheckbox: closeTabCheckbox,
            urlUploadDisplay: urlUploadDisplay,
            commentInput: commentInput,
            remoteSettingsButton,
            remoteSettingsModal,
            urlUploadLocalInput,
            urlUploadSyncInput,
            useLocalUrlRadio,
            useSyncUrlRadio,
            saveUrlSettingsButton,
            cancelUrlSettingsButton
        };

        console.log('Checking required elements...');
        for (const [name, element] of Object.entries(requiredElements)) {
            if (!element) {
                const error = `Required element not found: ${name}`;
                console.error(error);
                throw new Error(error);
            }
        }

        console.log('All required elements found');
        statusElement.style.display = 'block';
        statusElement.innerHTML = 'Initializing...';

        // Initialize urlUpload
        try {
            await getRemoteAddress();
            if (typeof urlUpload === 'undefined') {
                throw new Error('urlUpload is not defined');
            }
            urlUploadDisplay.textContent = urlUpload;
        } catch (error) {
            console.error('Error initializing urlUpload:', error);
            statusElement.innerHTML = 'Error initializing urlUpload';
            statusElement.className = 'error';
            throw error;
        }

        let tags = [];

        // Function to save tags to local storage
        async function saveTagsToStorage(tags) {
            try {
                await chrome.storage.local.set({ 'savedTags': tags });
                console.log('Tags saved to storage:', tags);
            } catch (error) {
                console.error('Error saving tags to storage:', error);
                statusElement.innerHTML = `Error saving tags: ${error}`;
            }
        }

        // Function to load tags from local storage
        async function loadTagsFromStorage() {
            try {
                const result = await chrome.storage.local.get(['savedTags']);
                console.log('Tags loaded from storage:', result.savedTags);
                return result.savedTags || [];
            } catch (error) {
                console.error('Error loading tags from storage:', error);
                statusElement.innerHTML = `Error loading tags: ${error}`;
                return [];
            }
        }

        // Function to create tag element
        function createTagElement(tag) {
            try {
                console.log('Creating tag element for:', tag);
                const checkboxId = `tag-${tag}`;
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = checkboxId;
                checkbox.className = 'tag-checkbox';
                checkbox.value = tag;

                const label = document.createElement('label');
                label.htmlFor = checkboxId;
                label.className = 'tag-label';
                label.textContent = tag;

                tagsContainer.appendChild(checkbox);
                tagsContainer.appendChild(label);
                return checkbox;
            } catch (error) {
                console.error('Error creating tag element:', error);
                statusElement.innerHTML = `Error creating tag element: ${error}`;
                return null;
            }
        }

        // Function to fetch tags from server
        async function fetchTags(showStatus = true) {
            if (showStatus) {
                statusElement.style.display = 'block';
                statusElement.innerHTML = 'Fetching tags from server...';
            }

            try {
                const tagUrl = urlUpload
                console.log('Fetching tags from:', tagUrl);
                
                const response = await axios.post(tagUrl, {
                    task: "get_tag_set",
                    name: "video"
                });

                console.log('Server response:', response.data);

                if (response.data.is_success && Array.isArray(response.data.data)) {
                    tags = response.data.data;
                    console.log('Tags fetched successfully:', tags);
                    
                    // Save to local storage
                    await saveTagsToStorage(tags);
                    
                    // Clear existing tags
                    tagsContainer.innerHTML = '';
                    
                    // Initialize tags after fetching
                    tags.forEach(tag => createTagElement(tag));
                    
                    if (showStatus) {
                        statusElement.innerHTML = `Tags refreshed successfully! (${tags.length} tags)`;
                        statusElement.className = 'success';
                        setTimeout(() => {
                            statusElement.style.display = 'none';
                        }, 2000);
                    }
                } else {
                    const errorMsg = `Failed to fetch tags: ${response.data.message || 'Unknown error'}`;
                    if (showStatus) {
                        statusElement.innerHTML = errorMsg;
                        statusElement.className = 'error';
                    }
                    console.error(errorMsg, response.data);
                }
            } catch (error) {
                const errorMsg = `Failed to fetch tags: ${error.message || error}`;
                if (showStatus) {
                    statusElement.innerHTML = errorMsg;
                    statusElement.className = 'error';
                }
                console.error('Error fetching tags:', error);
            }
        }

        // Function to initialize tags
        async function initializeTags() {
            try {
                statusElement.style.display = 'block';
                statusElement.innerHTML = 'Loading stored tags...';
                
                // Try to load tags from storage first
                const storedTags = await loadTagsFromStorage();
                console.log('Loaded stored tags:', storedTags);

                if (storedTags && storedTags.length > 0) {
                    tags = storedTags;
                    tagsContainer.innerHTML = ''; // Clear container first
                    tags.forEach(tag => createTagElement(tag));
                    statusElement.innerHTML = `Loaded ${tags.length} tags from storage`;
                    // Fetch from server in background to update cache
                    fetchTags(false);
                } else {
                    statusElement.innerHTML = 'No stored tags, fetching from server...';
                    // If no stored tags, fetch from server
                    await fetchTags(true);
                }
            } catch (error) {
                console.error('Error in initializeTags:', error);
                statusElement.innerHTML = `Error initializing tags: ${error.message || error}`;
            }
        }

        // Function to filter tags based on input
        function filterTags(input) {
            const inputValue = input.toLowerCase();
            return tags.filter(tag => 
                tag.toLowerCase().includes(inputValue) && 
                !document.getElementById(`tag-${tag}`)?.checked
            );
        }

        // Function to show suggestions
        function showSuggestions(filteredTags) {
            suggestionsContainer.innerHTML = '';
            if (filteredTags.length === 0) {
                suggestionsContainer.style.display = 'none';
                return;
            }

            filteredTags.forEach(tag => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = tag;
                div.addEventListener('click', () => {
                    selectTag(tag);
                });
                suggestionsContainer.appendChild(div);
            });

            suggestionsContainer.style.display = 'block';
        }

        // Function to select a tag
        function selectTag(tag) {
            const existingCheckbox = document.getElementById(`tag-${tag}`);
            if (existingCheckbox) {
                existingCheckbox.checked = true;
            } else {
                tags.push(tag);
                const checkbox = createTagElement(tag);
                checkbox.checked = true;
                saveTagsToStorage(tags);
            }
            tagInput.value = '';
            suggestionsContainer.style.display = 'none';
        }

        // Event Listeners
        tagInput.addEventListener('input', () => {
            const filteredTags = filterTags(tagInput.value);
            showSuggestions(filteredTags);
        });

        tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && tagInput.value.trim()) {
                e.preventDefault();
                selectTag(tagInput.value.trim());
            }
        });

        addTagButton.addEventListener('click', () => {
            if (tagInput.value.trim()) {
                selectTag(tagInput.value.trim());
            }
        });

        refreshTagsButton.addEventListener('click', async () => {
            refreshTagsButton.disabled = true;
            await fetchTags(true);
            refreshTagsButton.disabled = false;
        });

        document.addEventListener('click', (e) => {
            if (!suggestionsContainer.contains(e.target) && e.target !== tagInput) {
                suggestionsContainer.style.display = 'none';
            }
        });

        // URL type radio button change handler
        const handleUrlTypeChange = (e) => {
            const tagsSection = document.getElementById('tagsSection');
            if (tagsSection) {
                tagsSection.style.display = e.target.value === 'video' ? 'flex' : 'none';
            }
        };

        regularRadio.addEventListener('change', handleUrlTypeChange);
        videoRadio.addEventListener('change', handleUrlTypeChange);

        // Function to check if URL is from a video site
        function isVideoSite(url) {
            const videoSites = [
                'youtube.com/watch',
                'youtu.be',
                'bilibili.com/video',
                'b23.tv'
            ];
            return videoSites.some(site => url.includes(site));
        }

        // Initialize tags
        console.log('Starting tag initialization...');
        await initializeTags().catch(error => {
            console.error('Error during initialization:', error);
            statusElement.innerHTML = `Initialization error: ${error.message || error}`;
        });
        console.log('Tag initialization complete');

        // Upload button click handler
        uploadButton.addEventListener('click', async () => {
            await handleUpload('create_url', 'create_url_video');
        });

        uploadCacheButton.addEventListener('click', async () => {
            await handleUpload('create_url_cache', 'create_url_cache');
        });

        uploadSelectedButton.addEventListener('click', async () => {
            statusElement.style.display = 'block';
            statusElement.innerHTML = 'Uploading selected tabs...';
            try {
                // Query for highlighted (selected) tabs in current window
                const selectedTabs = await chrome.tabs.query({ 
                    highlighted: true,
                    currentWindow: true
                });
                console.log('Selected tabs in current window:', selectedTabs);

                if (selectedTabs.length === 0) {
                    statusElement.innerHTML = 'No tabs selected!';
                    statusElement.className = 'error';
                    return;
                }

                let successCount = 0;
                let failCount = 0;

                // Process each selected tab
                for (const tab of selectedTabs) {
                    try {
                        const isVideo = isVideoSite(tab.url);
                        const selectedTags = Array.from(document.querySelectorAll('.tag-checkbox:checked'))
                            .map(checkbox => checkbox.value);

                        const uploadData = {
                            task: 'create_url_cache',
                            url: tab.url,
                            text: tab.title,
                            time_zone: get_local_timezone_int(),
                            tags: selectedTags
                        };

                        // Add comment to upload data if it's not empty
                        const comment = commentInput.value.trim();
                        if (comment) {
                            uploadData.comment = comment;
                        }

                        console.log('Uploading tab:', tab.url);
                        const response = await axios.post(urlUpload, uploadData);

                        if (response.data.is_success) {
                            successCount++;
                        } else {
                            failCount++;
                            console.error('Failed to upload tab:', tab.url, response.data.message);
                        }
                    } catch (error) {
                        failCount++;
                        console.error('Error uploading tab:', tab.url, error);
                    }

                    // Update status after each upload
                    statusElement.innerHTML = `Uploaded ${successCount} tabs, ${failCount} failed...`;
                }

                // Final status update
                if (failCount === 0) {
                    statusElement.innerHTML = `Successfully uploaded all ${successCount} tabs!`;
                    statusElement.className = 'success';
                    
                    // Close tabs if checkbox is checked
                    if (closeTabCheckbox.checked) {
                        setTimeout(() => {
                            selectedTabs.forEach(tab => chrome.tabs.remove(tab.id));
                        }, 1000);
                    }
                    
                    // Close the popup after 1 second
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                } else {
                    statusElement.innerHTML = `Completed with ${successCount} successful and ${failCount} failed uploads.`;
                    statusElement.className = 'error';
                }
            } catch (error) {
                console.error('Error in batch upload:', error);
                statusElement.innerHTML = `Error in batch upload: ${error.message || error}`;
                statusElement.className = 'error';
            }
        });

        // Function to handle upload for both buttons
        async function handleUpload(regularTask, videoTask) {
            statusElement.style.display = 'block';
            statusElement.innerHTML = 'Start upload...';
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const isVideo = videoRadio.checked;
                
                console.log('Current tab:', tab);
                console.log('Is video:', isVideo);

                const selectedTags = Array.from(document.querySelectorAll('.tag-checkbox:checked'))
                    .map(checkbox => checkbox.value);
                console.log('Selected tags:', selectedTags);

                const uploadData = {
                    task: isVideo ? videoTask : regularTask,
                    url: tab.url,
                    text: tab.title,
                    time_zone: get_local_timezone_int(),
                    tags: selectedTags
                };

                // Add comment to upload data if it's not empty
                const comment = commentInput.value.trim();
                if (comment) {
                    uploadData.comment = comment;
                }

                console.log('Upload data:', uploadData);
                const response = await axios.post(urlUpload, uploadData);

                if (response.data.is_success) {
                    statusElement.textContent = 'Upload successful!';
                    statusElement.className = 'success';
                    
                    // Close the popup after 1 second
                    setTimeout(() => {
                        window.close();
                    }, 1000);

                    // Close the tab if checkbox is checked
                    if (closeTabCheckbox.checked) {
                        setTimeout(() => {
                            chrome.tabs.remove(tab.id);
                        }, 1000);
                    }
                } else {
                    statusElement.innerHTML = `Upload failed. Please try again.<br>${response.data.message}`;
                    statusElement.className = 'error';
                }
            } catch (error) {
                console.error('Error uploading tab info:', error);
                statusElement.innerHTML = `Error uploading. Please try again.<br>${error}<br>urlUpload: ${urlUpload}`;
                statusElement.className = 'error';
            }
        }

        // Check current tab on popup open to set initial state
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab && tab.url) {
                console.log('Current tab URL:', tab.url);
                const isVideo = isVideoSite(tab.url);
                if (isVideo) {
                    videoRadio.checked = true;
                    handleUrlTypeChange({ target: videoRadio });
                } else {
                    regularRadio.checked = true;
                    handleUrlTypeChange({ target: regularRadio });
                }
            }
        });

        // URL Settings Modal Handlers
        let currentLocalUrl = '';
        let currentSyncUrl = '';
        let urlCurrentSource = '';

        remoteSettingsButton.addEventListener('click', async () => {
            // Load current settings
            const [localResult, syncResult] = await Promise.all([
                new Promise(resolve => chrome.storage.local.get(['urlUploadLocal', 'urlUploadSource'], resolve)),
                new Promise(resolve => chrome.storage.sync.get(['urlUploadSync'], resolve))
            ]);

            currentLocalUrl = localResult.urlUploadLocal || urlUploadDefault;
            currentSyncUrl = syncResult.urlUploadSync || urlUploadDefault;
            urlCurrentSource = localResult.urlUploadSource || 'sync';

            urlUploadLocalInput.value = currentLocalUrl;
            urlUploadSyncInput.value = currentSyncUrl;
            
            if (urlCurrentSource === 'local') {
                useLocalUrlRadio.checked = true;
            } else {
                useSyncUrlRadio.checked = true;
            }

            remoteSettingsModal.style.display = 'block';
        });

        cancelUrlSettingsButton.addEventListener('click', () => {
            remoteSettingsModal.style.display = 'none';
        });

        saveUrlSettingsButton.addEventListener('click', async () => {
            const newLocalUrl = urlUploadLocalInput.value.trim();
            const newSyncUrl = urlUploadSyncInput.value.trim();
            const newUseLocal = useLocalUrlRadio.checked;
            const newUrlSource = newUseLocal ? 'local' : 'sync';

            if (!newLocalUrl || !newSyncUrl) {
                alert('Both URLs must be provided');
                return;
            }

            // Check if any changes were made
            const urlsChanged = newLocalUrl !== currentLocalUrl || newSyncUrl !== currentSyncUrl;
            const sourceChanged = newUrlSource !== urlCurrentSource;

            if (!urlsChanged && !sourceChanged) {
                console.log('No changes detected in URL settings');
                remoteSettingsModal.style.display = 'none';
                return;
            }

            try {
                const newUploadUrl = await updateUrlSettings(newLocalUrl, newSyncUrl, newUseLocal);
                urlUploadDisplay.textContent = newUploadUrl;
                remoteSettingsModal.style.display = 'none';
                
                // Update current values
                currentLocalUrl = newLocalUrl;
                currentSyncUrl = newSyncUrl;
                urlCurrentSource = newUrlSource;

                statusElement.innerHTML = 'URL settings updated successfully!';
                statusElement.className = 'success';
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 2000);
            } catch (error) {
                console.error('Error saving URL settings:', error);
                statusElement.innerHTML = 'Error saving URL settings';
                statusElement.className = 'error';
            }
        });

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === remoteSettingsModal) {
                remoteSettingsModal.style.display = 'none';
            }
        });

    } catch (error) {
        console.error('Critical error during initialization:', error);
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.style.display = 'block';
            statusElement.innerHTML = `Critical error: ${error.message || error}`;
        }
    }
});


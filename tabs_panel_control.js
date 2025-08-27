// tabs_panel_control.js
// Default upload URL (can be changed by user)
let urlUpload = "http://192.168.0.33:10003/url_pool/";

// Current tab positioning mode
// 0: Free movement, 1: Always first, 2: Always last
let currentTabMode = 0;

// reference to the mode button
const currentTabModeBtn = document.getElementById('current-tab-mode-btn');

// reference to the upload URL modal
const RemoteSettings = document.getElementById('upload-url-modal');
const urlUploadInput = document.getElementById('upload-url-input');
const saveUploadUrlBtn = document.getElementById('save-upload-url');
const cancelUploadUrlBtn = document.getElementById('cancel-upload-url');
const urlUploadBtn = document.getElementById('upload-url-btn');

// reference to the bulk upload modal
const bulkUploadModal = document.getElementById('bulk-upload-modal');
const bulkUploadTextarea = document.getElementById('bulk-upload-textarea');
const processBulkUploadBtn = document.getElementById('process-bulk-upload');
const cancelBulkUploadBtn = document.getElementById('cancel-bulk-upload');
const bulkUploadBtn = document.getElementById('bulk-upload-btn');
const bulkStatusElement = document.getElementById('bulk-status');

// mode button click handler
currentTabModeBtn.addEventListener('click', () => {
    // Cycle through modes
    currentTabMode = (currentTabMode + 1) % 3;
    
    // Update button text
    switch(currentTabMode) {
        case 0:
            currentTabModeBtn.textContent = 'Current Tab: Free';
            break;
        case 1:
            currentTabModeBtn.textContent = 'Current Tab: Always First';
            break;
        case 2:
            currentTabModeBtn.textContent = 'Current Tab: Always Last';
            break;
    }
    
    // Apply the current tab mode
    applyCurentTabMode();
});

// Open upload URL modal
urlUploadBtn.addEventListener('click', () => {
    // Set the current upload URL in the input
    urlUploadInput.value = urlUpload;
    
    // Show the modal
    RemoteSettings.style.display = 'flex';
});

// Save upload URL
saveUploadUrlBtn.addEventListener('click', () => {
    // Get the new URL from the input
    const newUrl = urlUploadInput.value.trim();
    
    // Basic URL validation
    const urlPattern = /^(https?:\/\/)([a-zA-Z0-9.-]+(\.[a-zA-Z]{2,}))(:[0-9]+)?(\/.*)?$/;
    
    // if (urlPattern.test(newUrl)) {
    //     // Update the upload URL
    //     urlUpload = newUrl;
        
    //     // Close the modal
    //     RemoteSettings.style.display = 'none';
        
    //     // Optional: Show a success message or notify the user
    //     alert('Upload URL updated successfully');
    // } else {
    //     // Show an error if the URL is invalid
    //     alert('Please enter a valid URL');
    // }
    urlUpload = newUrl;
    RemoteSettings.style.display = 'none';
});

// Cancel upload URL changes
cancelUploadUrlBtn.addEventListener('click', () => {
    // Simply hide the modal
    RemoteSettings.style.display = 'none';
});

// Close modal when clicking outside
RemoteSettings.addEventListener('click', (e) => {
    if (e.target === RemoteSettings) {
        RemoteSettings.style.display = 'none';
    }
});

// Open bulk upload modal
bulkUploadBtn.addEventListener('click', () => {
    // Clear the textarea and status
    bulkUploadTextarea.value = '';
    bulkStatusElement.textContent = '';
    bulkStatusElement.className = 'bulk-status';
    
    // Show the modal
    bulkUploadModal.style.display = 'flex';
});

// Process bulk upload
processBulkUploadBtn.addEventListener('click', () => {
    // Get the text from the textarea
    const bulkText = bulkUploadTextarea.value.trim();
    
    if (!bulkText) {
        bulkStatusElement.textContent = 'Please enter some URLs and titles';
        bulkStatusElement.className = 'bulk-status error';
        return;
    }
    
    // Split the text into lines
    const lines = bulkText.split('\n');
    const validEntries = [];
    const invalidEntries = [];
    
    // Process each line
    lines.forEach((line, index) => {
        const parts = line.split('|');
        
        if (parts.length === 2) {
            const url = parts[0].trim();
            const text = parts[1].trim();
            
            if (url && text) {
                validEntries.push({ url, text });
            } else {
                invalidEntries.push({ line, index });
            }
        } else {
            invalidEntries.push({ line, index });
        }
    });
    
    // If there are invalid entries, show an error
    if (invalidEntries.length > 0) {
        bulkStatusElement.textContent = `Found ${invalidEntries.length} invalid entries. Please check line format.`;
        bulkStatusElement.className = 'bulk-status error';
        return;
    }
    
    // Upload all valid entries
    bulkStatusElement.textContent = `Uploading ${validEntries.length} entries...`;
    
    // Counter for tracking uploads
    let successCount = 0;
    let failCount = 0;
    let completedCount = 0;
    
    // Process each valid entry
    validEntries.forEach(entry => {
        uploadBulkTabInfo(entry.url, entry.text, (success) => {
            completedCount++;
            
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
            
            // Update status
            bulkStatusElement.textContent = `Completed: ${completedCount}/${validEntries.length} (Success: ${successCount}, Failed: ${failCount})`;
            
            // If all uploads are done, show final status
            if (completedCount === validEntries.length) {
                if (failCount === 0) {
                    bulkStatusElement.className = 'bulk-status success';
                    bulkStatusElement.textContent = `All ${successCount} entries uploaded successfully!`;
                    
                    // Clear the textarea after successful upload
                    bulkUploadTextarea.value = '';
                    
                    // Close the modal after 2 seconds
                    setTimeout(() => {
                        bulkUploadModal.style.display = 'none';
                    }, 2000);
                } else {
                    bulkStatusElement.className = 'bulk-status error';
                    bulkStatusElement.textContent = `Completed with errors: ${successCount} successes, ${failCount} failures.`;
                }
            }
        });
    });
});

// Function to upload tab info for bulk uploads
function uploadBulkTabInfo(url, text, callback) {
    axios.post(
        urlUpload,
        {
            task: 'insert_url',
            url: url,
            text: text,
        }
    ).then((response) => {
        if (response.data.is_success) {
            console.log(`Bulk upload success: ${url}`);
            callback(true);
        } else {
            console.log(`Bulk upload error: ${url}`, response);
            callback(false);
        }
    }).catch((error) => {
        console.error('Error bulk uploading tab info:', error);
        callback(false);
    });
}

// Cancel bulk upload
cancelBulkUploadBtn.addEventListener('click', () => {
    // Simply hide the modal
    bulkUploadModal.style.display = 'none';
});

// Close bulk modal when clicking outside
bulkUploadModal.addEventListener('click', (e) => {
    if (e.target === bulkUploadModal) {
        bulkUploadModal.style.display = 'none';
    }
});

// Function to apply current tab mode
function applyCurentTabMode() {
    // This function rearranges tabs based on the mode
    chrome.windows.getCurrent(currentWindow => {
        chrome.tabs.query({ windowId: currentWindow.id }, (tabs) => {
            // Find the active tab
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
                // Case 0 (free movement) does nothing
            }
        });
    });
}
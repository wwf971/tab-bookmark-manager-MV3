// error-popup.js
document.addEventListener('DOMContentLoaded', function() {
    const errorMessageEl = document.getElementById('errorMessage');
    const tabInfoEl = document.getElementById('tabInfo');
    const retryBtn = document.getElementById('retryBtn');
    const closeBtn = document.getElementById('closeBtn');
    const countdownEl = document.getElementById('countdown');
    
    let countdownSeconds = 5;
    let tabId = null;
    
    // Get error information from storage
    chrome.storage.local.get('errorInfo', function(data) {
        if (data.errorInfo) {
            const { errorMessage, url, title, tabId: storedTabId } = data.errorInfo;
            
            // Store tabId for retry action
            tabId = storedTabId;
            
            // Display error information
            errorMessageEl.textContent = errorMessage || 'Unknown error occurred';
            tabInfoEl.textContent = `${title || 'Unknown page'} (${url || 'No URL'})`;
            
            // Clear storage after retrieving data
            chrome.storage.local.remove('errorInfo');
        } else {
            errorMessageEl.textContent = 'Error information not available';
            tabInfoEl.textContent = 'Unknown tab';
        }
    });
    
    // Handle retry button click
    retryBtn.addEventListener('click', function() {
        if (tabId) {
            chrome.runtime.sendMessage({ 
                action: "retryUpload", 
                tabId: tabId 
            });
        }
        window.close();
    });
    
    // Handle close button click
    closeBtn.addEventListener('click', function() {
        window.close();
    });
    
    // Countdown timer
    function updateCountdown() {
        countdownEl.textContent = `Closing in ${countdownSeconds}s`;
        
        if (countdownSeconds <= 0) {
            window.close();
            return;
        }
        
        countdownSeconds--;
        setTimeout(updateCountdown, 1000);
    }
    
    // Start countdown
    updateCountdown();
});
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCommunicateStore = defineStore('communicate', () => {
  
  // SingleFile extension ID (fixed)
  const SINGLEFILE_EXTENSION_ID = 'olndjaocjhamlgahkdcoohjkifokjkmj'
  
  // Communication status
  const isMessageSending = ref(false)
  const lastMessageResult = ref(null)
  
  // Send hello message to SingleFile extension
  const sendHelloMessage = async (content = 'Hello from extension!', additionalData = {}) => {
    isMessageSending.value = true
    lastMessageResult.value = null
    
    try {
      console.log("=== COMMUNICATE: Sending hello message to SingleFile extension")
      
      const message = {
        type: 'hello',
        content: content,
        timestamp: new Date().toISOString(),
        additionalData: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          ...additionalData
        }
      }
      
      console.log("=== COMMUNICATE: Message:", message)
      
      const response = await chrome.runtime.sendMessage(SINGLEFILE_EXTENSION_ID, message)
      console.log("=== COMMUNICATE: Response:", response)
      
      if (response && response.success) {
        lastMessageResult.value = { 
          success: true, 
          message: 'Hello message sent successfully!' 
        }
      } else {
        lastMessageResult.value = { 
          success: false, 
          message: response?.message || 'No confirmation received.' 
        }
      }
      
      return response
      
    } catch (error) {
      console.error("=== COMMUNICATE: Error sending hello message:", error)
      lastMessageResult.value = { 
        success: false, 
        message: `Error: ${error.message}` 
      }
      throw error
      
    } finally {
      isMessageSending.value = false
      
      // Clear result after 5 seconds
      setTimeout(() => {
        lastMessageResult.value = null
      }, 5000)
    }
  }
  
  // Send extract and upload message to SingleFile extension
  const sendExtractAndUploadMessage = async (tabId, serverUrl, tabInfo = {}) => {
    isMessageSending.value = true
    lastMessageResult.value = null
    
    try {
      console.log("=== COMMUNICATE: Sending extract-and-upload message to SingleFile extension")
      
      // Validate inputs
      if (!tabId) {
        throw new Error('Tab ID is required')
      }
      
      if (!serverUrl) {
        throw new Error('Server URL is required')
      }
      
      const message = {
        type: 'extract-and-upload',
        tabId: tabId,
        serverUrl: serverUrl,
        timestamp: new Date().toISOString(),
        tabInfo: tabInfo
      }
      
      console.log("=== COMMUNICATE: Message:", message)
      
      const response = await chrome.runtime.sendMessage(SINGLEFILE_EXTENSION_ID, message)
      console.log("=== COMMUNICATE: Response:", response)
      
      if (response && response.success) {
        lastMessageResult.value = { 
          success: true, 
          message: 'Extract and upload initiated successfully!' 
        }
      } else {
        lastMessageResult.value = { 
          success: false, 
          message: response?.message || 'Failed to start extraction.' 
        }
      }
      
      return response
      
    } catch (error) {
      console.error("=== COMMUNICATE: Error sending extract-and-upload message:", error)
      lastMessageResult.value = { 
        success: false, 
        message: `Error: ${error.message}` 
      }
      throw error
      
    } finally {
      isMessageSending.value = false
      
      // Clear result after 5 seconds
      setTimeout(() => {
        lastMessageResult.value = null
      }, 5000)
    }
  }
  
  // Check if SingleFile extension is available
  const checkSingleFileExtension = async () => {
    try {
      console.log("=== COMMUNICATE: Checking SingleFile extension availability")
      
      const response = await chrome.runtime.sendMessage(SINGLEFILE_EXTENSION_ID, {
        type: 'ping',
        timestamp: new Date().toISOString()
      })
      
      console.log("=== COMMUNICATE: Extension availability check:", response)
      return { available: true, response }
      
    } catch (error) {
      console.log("=== COMMUNICATE: SingleFile extension not available:", error.message)
      return { available: false, error: error.message }
    }
  }
  
  // Clear last message result
  const clearLastResult = () => {
    lastMessageResult.value = null
  }
  
  return {
    // Constants
    SINGLEFILE_EXTENSION_ID,
    
    // State
    isMessageSending,
    lastMessageResult,
    
    // Actions
    sendHelloMessage,
    sendExtractAndUploadMessage,
    checkSingleFileExtension,
    clearLastResult
  }
})

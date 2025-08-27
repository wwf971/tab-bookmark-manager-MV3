<template>
  <div v-if="modelValue" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Login Required</h3>
        <button class="close-button" @click="closeModal">&times;</button>
      </div>
      
      <div class="modal-body">
        <p class="login-message">{{ message || 'Please login to continue' }}</p>
        
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="username">Username:</label>
            <input
              id="username"
              type="text"
              v-model="username"
              required
              :disabled="isLoggingIn"
              placeholder="Enter username"
            />
          </div>
          
          <div class="form-group">
            <label for="password">Password:</label>
            <input
              id="password"
              type="password"
              v-model="password"
              required
              :disabled="isLoggingIn"
              placeholder="Enter password"
            />
          </div>
          
          <div class="form-actions">
            <button 
              type="submit" 
              :disabled="isLoggingIn"
              class="login-button"
            >
              {{ isLoggingIn ? 'Logging in...' : 'Login' }}
            </button>
            <button 
              type="button" 
              @click="closeModal"
              :disabled="isLoggingIn"
              class="cancel-button"
            >
              Cancel
            </button>
          </div>
        </form>
        
        <div v-if="loginError" class="error-message">
          {{ loginError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useNetworkRequest } from '../stores/NetworkRequest'

// Props
const props = defineProps({
  modelValue: Boolean,
  message: String
})

// Emits
const emit = defineEmits(['update:modelValue', 'loginSuccess'])

// Store
const networkRequest = useNetworkRequest()

// State
const username = ref('')
const password = ref('')
const isLoggingIn = ref(false)
const loginError = ref('')

// Methods
const closeModal = () => {
  if (!isLoggingIn.value) {
    emit('update:modelValue', false)
    resetForm()
  }
}

const resetForm = () => {
  username.value = ''
  password.value = ''
  loginError.value = ''
  isLoggingIn.value = false
}

import { useServerStore } from '../stores/Server'
const serverStore = useServerStore()

const handleLogin = async () => {
  if (!username.value || !password.value) {
    loginError.value = 'Please enter both username and password'
    return
  }
  
  isLoggingIn.value = true
  loginError.value = ''
  
  try {
    const result = await serverStore.loginToServer(username.value, password.value)
    console.log("Login.vue: loginToServer result", result)
    if (result.is_success) {
      emit('loginSuccess')
      emit('update:modelValue', false)
      resetForm()
    } else {
      loginError.value = result.message || 'Login failed'
    }
  } catch (error) {
    console.error('Login error:', error)
    loginError.value = 'Login request failed'
  } finally {
    isLoggingIn.value = false
  }
}

// Watch for modal close to reset form
watch(() => props.modelValue, (newValue) => {
  if (!newValue) {
    resetForm()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  min-width: 400px;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  padding: 12px;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  color: #333;
}

.modal-body {
  padding: 0;
}

.login-message {
  margin-bottom: 20px;
  color: #666;
  text-align: center;
}

.form-group {
  margin-bottom: 8px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  color: #333;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-group input:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 12px;
}

.login-button {
  flex: 1;
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.login-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.cancel-button {
  flex: 1;
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-button:hover:not(:disabled) {
  background-color: #545b62;
}

.cancel-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.error-message {
  color: #dc3545;
  font-size: 13px;
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}
</style>

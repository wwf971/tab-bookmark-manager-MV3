<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Rename Session</h3>
        <button class="close-btn" @click="closeModal">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="form-field">
          <label class="field-label">Default Name</label>
          <input 
            type="text" 
            :value="defaultName" 
            readonly 
            class="input-field disabled"
          />
        </div>
        
        <div class="form-field">
          <label class="field-label">Nickname</label>
          <input 
            type="text" 
            v-model="nicknameInput" 
            class="input-field"
            placeholder="Enter custom name..."
            @keyup.enter="confirmRename"
            @keyup.escape="closeModal"
            ref="nicknameInputRef"
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="closeModal">Cancel</button>
        <button class="btn btn-primary" @click="confirmRename">Confirm</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  windowId: {
    type: Number,
    default: null
  },
  defaultName: {
    type: String,
    default: ''
  },
  currentNickname: {
    type: String,
    default: ''
  }
})

// Emits
const emit = defineEmits(['close', 'confirm'])

// Refs
const nicknameInputRef = ref(null)
const nicknameInput = ref('')

// Watch for modal visibility changes
watch(() => props.isVisible, async (newVal) => {
  if (newVal) {
    // Reset input with current nickname
    nicknameInput.value = props.currentNickname || ''
    
    // Focus input field after modal opens
    await nextTick()
    if (nicknameInputRef.value) {
      nicknameInputRef.value.focus()
      nicknameInputRef.value.select()
    }
  }
})

// Methods
const closeModal = () => {
  emit('close')
}

const confirmRename = () => {
  emit('confirm', {
    windowId: props.windowId,
    nickname: nicknameInput.value.trim()
  })
}
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
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 400px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e3e1;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #202124;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #5f6368;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #202124;
}

.modal-body {
  padding: 20px;
}

.form-field {
  margin-bottom: 16px;
}

.form-field:last-child {
  margin-bottom: 0;
}

.field-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #202124;
  margin-bottom: 6px;
}

.input-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}

.input-field:focus {
  outline: none;
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
}

.input-field.disabled {
  background-color: #f8f9fa;
  color: #5f6368;
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e1e3e1;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.btn-secondary {
  background-color: #f8f9fa;
  color: #3c4043;
  border: 1px solid #dadce0;
}

.btn-secondary:hover {
  background-color: #f1f3f4;
}

.btn-primary {
  background-color: #1a73e8;
  color: white;
}

.btn-primary:hover {
  background-color: #1557b0;
}
</style>

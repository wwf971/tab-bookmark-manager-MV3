<template>
  <div class="settings-checkbox">
    <div class="checkbox-container">
      <div
        class="checkbox"
        :class="{ 
          'checkbox-checked': value === true,
          'checkbox-unchecked': value === false,
          'checkbox-null': value === null,
          'checkbox-disabled': disabled
        }"
        @click="handleClick"
      >
        <div class="checkbox-icon">
          <svg v-if="value === true" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else-if="value === false" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L10 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
      <label 
        class="checkbox-label"
        :class="{ 
          'label-null': value === null,
          'label-disabled': disabled
        }"
        @click="handleClick"
      >
        {{ label }}
      </label>
    </div>
    <div class="checkbox-state">
      <span class="state-text" :class="{ 'state-null': value === null }">
        {{ stateText }}
      </span>
      <div v-if="disabled" class="loading-spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: [Boolean, null],
    default: null
  },
  label: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:value'])

const stateText = computed(() => {
  if (props.value === true) return 'true'
  if (props.value === false) return 'false'
  return 'null'
})

const handleClick = () => {
  if (props.disabled) return
  
  // Cycle through: null -> false -> true -> null
  let newValue
  if (props.value === null) {
    newValue = false
  } else if (props.value === false) {
    newValue = true
  } else {
    newValue = null
  }
  
  emit('update:value', newValue)
}
</script>

<style scoped>
.settings-checkbox {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.settings-checkbox:hover {
  background-color: #f5f5f5;
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.checkbox {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background-color: white;
}

.checkbox-checked {
  background-color: #10b981;
  border-color: #10b981;
  color: white;
}

.checkbox-unchecked {
  background-color: #ef4444;
  border-color: #ef4444;
  color: white;
}

.checkbox-null {
  background-color: #6b7280;
  border-color: #6b7280;
  color: white;
  position: relative;
}

.checkbox-null::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 2px;
  right: 2px;
  height: 1px;
  background-color: currentColor;
  transform: translateY(-50%);
}

.checkbox-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.checkbox-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.checkbox-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: color 0.2s;
  user-select: none;
}

.label-null {
  text-decoration: line-through;
  color: #6b7280;
}

.label-disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.checkbox-state {
  display: flex;
  align-items: center;
  gap: 8px;
}

.state-text {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: #f3f4f6;
  color: #6b7280;
  min-width: 40px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.state-null {
  text-decoration: line-through;
  background-color: #f9fafb;
  color: #9ca3af;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f3f4f6;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

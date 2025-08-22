<template>
  <div class="panel-display-setting">
    <!-- Primary Controls Row -->
    <div class="control-row primary-row">
      <!-- Select Items (dropdowns with options) -->
      <div 
        v-for="selectItem in Object.values(selectItems)" 
        :key="selectItem.name" 
        class="control-group"
      >
        <div class="control-label">{{ selectItem.title }}:</div>
        <div class="toggle-buttons">
          <button 
            v-for="option in selectItem.options" 
            :key="option.value"
            class="digital-button mode-button"
            :class="{ active: selectItem.value === option.value }"
            @click="setSelectItem(selectItem.name, option.value)"
            :title="option.title || option.label"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- Trigger Items -->
      <div v-if="triggerItems.length > 0" class="control-group">
        <button 
          v-for="item in triggerItems"
          :key="item.name"
          class="refresh-btn"
          @click="triggerAction(item.name)"
          :disabled="item.disabled"
          :title="item.title"
        >
          <span :class="{ 'spinning': item.disabled }">{{ item.icon }}</span>
        </button>
      </div>
    </div>

    <!-- Secondary Controls Row -->
    <div v-if="Object.keys(booleanItems).length > 0 || Object.keys(rangeItems).length > 0" class="control-row secondary-row">
      <!-- Boolean Items Groups -->
      <div v-if="Object.keys(booleanItems).length > 0" class="control-group">
        <div class="control-label">Options:</div>
        <div class="toggle-buttons">
          <button 
            v-for="item in Object.values(booleanItems)"
            :key="item.name"
            class="digital-button"
            :class="{ active: item.value }"
            @click="toggleBooleanItem(item.name)"
            :title="item.title"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <!-- Range Items -->
      <div 
        v-for="rangeItem in Object.values(rangeItems)" 
        :key="rangeItem.name" 
        class="control-group"
      >
        <div class="control-label">{{ rangeItem.title }}:</div>
        <div class="range-controls">
          <!-- For discrete values like columns, show buttons -->
          <div v-if="rangeItem.max <= 10 && rangeItem.step === 1" class="discrete-buttons">
            <button 
              v-for="val in generateRange(rangeItem.min, rangeItem.max, rangeItem.step)"
              :key="val"
              class="digital-button column-button"
              :class="{ active: rangeItem.value === val }"
              @click="setRangeItem(rangeItem.name, val)"
              :title="`${rangeItem.title}: ${val}`"
            >
              {{ val }}
            </button>
          </div>
          <!-- For continuous values like size, show +/- controls -->
          <div v-else class="continuous-controls">
            <button 
              class="digital-button size-button"
              @click="adjustRangeItem(rangeItem.name, -rangeItem.step)"
              :disabled="rangeItem.value <= rangeItem.min"
              :title="`Decrease ${rangeItem.title}`"
            >
              −
            </button>
            <input 
              type="number"
              class="size-input"
              :value="rangeItem.value"
              @input="setRangeItem(rangeItem.name, parseInt($event.target.value))"
              @blur="validateRangeItem(rangeItem.name)"
              :min="rangeItem.min"
              :max="rangeItem.max"
              :step="rangeItem.step"
              :title="`${rangeItem.title} (${rangeItem.min}-${rangeItem.max})`"
            >
            <button 
              class="digital-button size-button"
              @click="adjustRangeItem(rangeItem.name, rangeItem.step)"
              :disabled="rangeItem.value >= rangeItem.max"
              :title="`Increase ${rangeItem.title}`"
            >
              +
            </button>
            <button 
              class="digital-button reset-button"
              @click="resetRangeItem(rangeItem.name)"
              :title="`Reset ${rangeItem.title} to default (${rangeItem.default})`"
            >
              ↺
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'

// component props for configuration
const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  // configuration for boolean items (toggles)
  booleanItems: {
    type: Array,
    default: () => []
    // example: [
    //   { name: 'showIcon', label: 'Icon', value: true, title: 'Toggle icon display' },
    //   { name: 'showTitle', label: 'Title', value: true, title: 'Toggle title display' }
    // ]
  },
  // configuration for range items (sliders/numeric inputs)
  rangeItems: {
    type: Array,
    default: () => []
    // example: [
    //   { name: 'columns', value: 2, min: 1, max: 4, step: 1, default: 2, title: 'Columns per row' }
    // ]
  },
  // configuration for trigger items (buttons that increment count)
  triggerItems: {
    type: Array,
    default: () => []
    // example: [
    //   { name: 'refresh', icon: '↻', title: 'Refresh', disabled: false }
    // ]
  },
  // configuration for select items (dropdowns with options)
  selectItems: {
    type: Array,
    default: () => []
    // example: [
    //   { name: 'mode', value: 'detailed', title: 'Display mode', options: [
    //     { value: 'detailed', label: 'Detailed View' },
    //     { value: 'compact', label: 'Compact View' }
    //   ]}
    // ]
  }
})

// initialize items from props configuration
const booleanItems = reactive({})
const rangeItems = reactive({})
const selectItems = reactive({})
const triggerItems = ref([])

// initialize boolean items from configuration
props.booleanItems.forEach(config => {
  booleanItems[config.name] = {
    name: config.name,
    value: config.value,
    label: config.label,
    title: config.title
  }
})

// initialize range items from configuration  
props.rangeItems.forEach(config => {
  rangeItems[config.name] = {
    name: config.name,
    value: config.value,
    min: config.min,
    max: config.max,
    step: config.step || 1,
    default: config.default,
    title: config.title
  }
})

// initialize select items from configuration
props.selectItems.forEach(config => {
  selectItems[config.name] = {
    name: config.name,
    value: config.value,
    title: config.title,
    options: config.options || []
  }
})

// initialize trigger items from configuration
triggerItems.value = props.triggerItems.map(config => ({
  name: config.name,
  icon: config.icon,
  title: config.title,
  disabled: config.disabled || false,
  count: 0
}))

// boolean item methods
const toggleBooleanItem = (itemName) => {
  if (booleanItems[itemName]) {
    booleanItems[itemName].value = !booleanItems[itemName].value
  }
}

const setBooleanItem = (itemName, value) => {
  if (booleanItems[itemName]) {
    booleanItems[itemName].value = value
  }
}

const getBooleanItem = (itemName) => {
  return booleanItems[itemName]?.value
}

// getter that returns reactive reference
const getBooleanItemReactive = (itemName) => {
  return computed(() => booleanItems[itemName]?.value)
}

// select item methods
const setSelectItem = (itemName, value) => {
  if (selectItems[itemName]) {
    selectItems[itemName].value = value
  }
}

const getSelectItem = (itemName) => {
  return selectItems[itemName]?.value
}

// getter that returns reactive reference
const getSelectItemReactive = (itemName) => {
  return computed(() => selectItems[itemName]?.value)
}

// helper to generate range of values
const generateRange = (min, max, step) => {
  const range = []
  for (let i = min; i <= max; i += step) {
    range.push(i)
  }
  return range
}

// range item methods
const setRangeItem = (itemName, value) => {
  if (rangeItems[itemName]) {
    const item = rangeItems[itemName]
    const clampedValue = Math.max(item.min, Math.min(item.max, value))
    item.value = clampedValue
  }
}

const adjustRangeItem = (itemName, delta) => {
  if (rangeItems[itemName]) {
    const item = rangeItems[itemName]
    const newValue = item.value + (delta * item.step)
    setRangeItem(itemName, newValue)
  }
}

const resetRangeItem = (itemName) => {
  if (rangeItems[itemName]) {
    rangeItems[itemName].value = rangeItems[itemName].default
  }
}

const validateRangeItem = (itemName) => {
  if (rangeItems[itemName]) {
    const item = rangeItems[itemName]
    if (isNaN(item.value) || item.value < item.min || item.value > item.max) {
      item.value = item.default
    }
  }
}

const getRangeItem = (itemName) => {
  return rangeItems[itemName]?.value
}

// getter that returns reactive reference
const getRangeItemReactive = (itemName) => {
  return computed(() => rangeItems[itemName]?.value)
}

// trigger item methods
const triggerAction = (itemName) => {
  const item = triggerItems.value.find(t => t.name === itemName)
  if (item && !item.disabled) {
    item.count++
    // parent will access this count reactively to know when action was triggered
  }
}

const getTriggerCount = (itemName) => {
  const item = triggerItems.value.find(t => t.name === itemName)
  return item?.count || 0
}

// getter that returns reactive reference
const getTriggerCountReactive = (itemName) => {
  return computed(() => {
    const item = triggerItems.value.find(t => t.name === itemName)
    return item?.count || 0
  })
}

const setTriggerDisabled = (itemName, disabled) => {
  const item = triggerItems.value.find(t => t.name === itemName)
  if (item) {
    item.disabled = disabled
  }
}

// computed values for dynamic access by name
const getComputedValue = (type, itemName) => {
  switch (type) {
    case 'boolean':
      return computed(() => booleanItems[itemName]?.value)
    case 'range':
      return computed(() => rangeItems[itemName]?.value)
    case 'select':
      return computed(() => selectItems[itemName]?.value)
    case 'trigger':
      return computed(() => getTriggerCount(itemName))
    default:
      return computed(() => undefined)
  }
}

// helper to get all current values as a plain object
const getAllValues = computed(() => {
  const values = {}
  
  // add boolean values
  Object.keys(booleanItems).forEach(key => {
    values[key] = booleanItems[key].value
  })
  
  // add range values
  Object.keys(rangeItems).forEach(key => {
    values[key] = rangeItems[key].value
  })
  
  // add select values
  Object.keys(selectItems).forEach(key => {
    values[key] = selectItems[key].value
  })
  
  // add trigger counts
  triggerItems.value.forEach(item => {
    values[`${item.name}Count`] = item.count
  })
  
  return values
})

// watch for loading state to disable trigger items
const updateLoadingState = () => {
  triggerItems.value.forEach(item => {
    if (item.name === 'refresh') {
      item.disabled = props.isLoading
    }
  })
}

// init on mount
onMounted(() => {
  updateLoadingState()
})

// watch loading prop
computed(() => {
  updateLoadingState()
  return props.isLoading
})

// expose reactive refs and methods for parent
defineExpose({
  // reactive state objects
  booleanItems,
  rangeItems,
  selectItems,
  triggerItems,
  
  // computed helper for getting all values
  getAllValues,
  
  // individual value getters (static)
  getBooleanItem,
  getRangeItem,
  getSelectItem,
  getTriggerCount,
  
  // reactive value getters (return computed refs)
  getBooleanItemReactive,
  getRangeItemReactive,  
  getSelectItemReactive,
  getTriggerCountReactive,
  
  // value setters
  toggleBooleanItem,
  setBooleanItem,
  setRangeItem,
  adjustRangeItem,
  resetRangeItem,
  validateRangeItem,
  setSelectItem,
  triggerAction,
  setTriggerDisabled,
  
  // dynamic computed value getter
  getComputedValue
})
</script>

<style scoped>
.panel-display-setting {
  background-color: #fafbfc;
  border-bottom: 1px solid #dee2e6;
  border-radius: 8px 8px 0 0;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
}

.primary-row {
  border-bottom: 1px solid #e8eaed;
  background-color: #fafbfc;
}

.secondary-row {
  background-color: #f5f6f7;
  min-height: 40px;
}

.mode-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.toggle-buttons,
.layout-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

.column-buttons {
  display: flex;
  gap: 4px;
  transition: opacity 0.2s;
}

.column-buttons.disabled {
  opacity: 0.4;
}

.range-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.discrete-buttons {
  display: flex;
  gap: 4px;
}

.continuous-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* simple white-grey button styles */
.digital-button {
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 32px;
  user-select: none;
}

.digital-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  background: #f5f5f5;
}

.digital-button:hover:not(:disabled) {
  background: #f8f8f8;
  border-color: #999;
}

.digital-button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.digital-button.active:hover {
  background: #0056b3;
  border-color: #0056b3;
}

.digital-button:active:not(:disabled) {
  background: #e6e6e6;
}

.column-button {
  min-width: 28px;
  padding: 4px 8px;
}

.mode-button {
  min-width: 80px;
  padding: 6px 12px;
}

.icon-size-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.size-button {
  min-width: 28px;
  padding: 4px 8px;
  font-size: 14px;
}

.size-input {
  width: 40px;
  padding: 4px 6px;
  border: 1px solid #999;
  border-radius: 3px;
  background: #a8a8b3; /* much lighter background */
  color: #2c3e50; /* darker text for better contrast */
  font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  letter-spacing: 1px;
}

.size-input:focus {
  outline: none;
  border-color: #aaa;
  background: #b8b8c3; /* slightly darker on focus */
  color: #1a1a1a; /* darker text on focus */
}

.size-unit {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.reset-button {
  min-width: 28px;
  padding: 4px 8px;
  font-size: 12px;
}

.refresh-btn {
  padding: 6px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  background: #f8f9fa; /* much lighter background instead of white */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary) !important; /* ensure lighter color is applied */
  /* transition: all 0.2s; */
  font-size: 16px;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #f5f5f5;
  color: var(--text-secondary) !important; /* maintain lighter color on hover */
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .control-row {
    flex-wrap: wrap;
    gap: 12px;
    padding: 6px 12px;
  }
  
  .mode-controls {
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .control-group {
    gap: 6px;
  }
  
  .control-label {
    font-size: 11px;
  }
  
  .digital-button {
    padding: 3px 8px;
    font-size: 10px;
    min-width: 28px;
    letter-spacing: 0.8px;
  }
  
  .column-button {
    min-width: 24px;
    padding: 3px 6px;
  }
  
  .mode-button {
    min-width: 60px;
    padding: 4px 8px;
    font-size: 10px;
  }
}
</style>
<template>
  <div 
    ref="menuElement"
    class="context-menu"
    :style="{ 
      left: x + 'px', 
      top: y + 'px',
      visibility: show ? 'visible' : 'hidden'
    }"
    @click.stop
  >
    <!-- Selection Info Header -->
    <div v-if="hasSelection && selectedCount > 1" class="context-menu-header">
      <strong>{{ selectedCount }} tab{{ selectedCount !== 1 ? 's' : '' }} selected</strong>
    </div>
    
    <!-- Dynamic Menu Items -->
    <div 
      v-for="item in menuItems"
      :key="item.name"
      class="context-menu-item"
      :class="{ 
        'loading': isLoading && loadingAction === item.name,
        'disabled': item.disabled 
      }"
      @click="handleMenuClick(item)"
    >
      <div class="context-menu-icon">
        <span v-if="isLoading && loadingAction === item.name" class="spinner">↻</span>
        <span v-else-if="item.icon">{{ item.icon }}</span>
      </div>
      {{ isLoading && loadingAction === item.name ? (item.loadingText || 'Loading...') : item.text }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Template ref for the menu element
const menuElement = ref(null)

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  tab: {
    type: Object,
    default: null
  },
  selectedCount: {
    type: Number,
    default: 0
  },
  hasSelection: {
    type: Boolean,
    default: false
  },
  selectedTabs: {
    type: Array,
    default: () => []
  },
  // Menu items array
  menuItems: {
    type: Array,
    default: () => []
    // Each item should have: { name, text, icon?, loadingText?, disabled? }
  },
  // Loading state
  isLoading: {
    type: Boolean,
    default: false
  },
  loadingAction: {
    type: String,
    default: null
  }
})

// Emits
const emit = defineEmits(['menu-item-clicked'])

// Expose the menuElement ref to parent components
defineExpose({
  menuElement
})

// Methods
const handleMenuClick = (item) => {
  if (item.disabled) return
  
  // Determine which tabs to work with
  const tabsToProcess = props.hasSelection && props.selectedCount > 1 
    ? props.selectedTabs 
    : (props.tab ? [props.tab] : [])

  // Emit single event with item name and relevant data
  emit('menu-item-clicked', {
    action: item.name,
    tab: props.tab,
    tabs: tabsToProcess,
    selectedCount: props.selectedCount,
    hasSelection: props.hasSelection
  })
}
</script>

<style scoped>
.context-menu {
  position: absolute;
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  min-width: 180px;
  padding: 4px 0;
  font-size: 14px;
}

.context-menu-header {
  padding: 8px 16px;
  border-bottom: 1px solid #e8eaed;
  margin-bottom: 4px;
  font-size: 12px;
  color: #5f6368;
  background-color: #f8f9fa;
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  user-select: none;
}

.context-menu-item:hover:not(.disabled) {
  background-color: #f1f3f4;
}

.context-menu-item.loading {
  opacity: 0.7;
  cursor: wait;
}

.context-menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  color: #9e9e9e;
}

.context-menu-icon {
  margin-right: 12px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

<template>
  <div 
    v-if="show" 
    class="context-menu"
    :style="menuStyle"
    @click.stop
  >
      <div class="context-menu-header">
        <span class="tag-info">
          <span class="tag-name">{{ tag?.name }}</span>
          <span v-if="tag?.id" class="tag-id">ID: {{ tag.id }}</span>
        </span>
      </div>
      
      <div class="context-menu-divider"></div>
      
      <div class="context-menu-items">
        <div 
          class="context-menu-item"
          @click="renameTag"
        >
          <span class="menu-icon">✏️</span>
          <span class="menu-text">Rename Tag</span>
        </div>
        
        <!-- Future menu items can be added here -->
        <!-- 
        <div 
          class="context-menu-item"
          @click="deleteTag"
        >
          <span class="menu-icon">🗑️</span>
          <span class="menu-text">Delete Tag</span>
        </div>
        -->
      </div>
    </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

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
  tag: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'close',
  'rename-tag',
  'delete-tag'
])

// Computed styles for menu positioning
const menuStyle = computed(() => {
  if (!props.show) return {}
  
  return {
    left: `${props.x}px`,
    top: `${props.y}px`
  }
})

// Methods
const closeMenu = () => {
  emit('close')
}

const renameTag = () => {
  emit('rename-tag', props.tag)
  closeMenu()
}

const deleteTag = () => {
  emit('delete-tag', props.tag)
  closeMenu()
}

// Handle escape key
const handleKeydown = (event) => {
  console.log('TagsContextMenu.vue: handleKeydown', event.key)
  if (event.key === 'Escape') {
    closeMenu()
  }
}

// Add/remove event listeners when component is mounted/unmounted
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  overflow: hidden;
  z-index: 1001;
}

.context-menu-header {
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.tag-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-name {
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.tag-id {
  font-size: 11px;
  color: #5f6368;
}

.context-menu-divider {
  height: 1px;
  background-color: #e0e0e0;
  margin: 4px 0;
}

.context-menu-items {
  padding: 4px 0;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: background-color 0.2s ease;
}

.context-menu-item:hover {
  background-color: #f1f3f4;
}

.context-menu-item:active {
  background-color: #e8eaed;
}

.menu-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.menu-text {
  flex: 1;
}

/* Animation */
.context-menu {
  animation: contextMenuFadeIn 0.15s ease-out;
}

@keyframes contextMenuFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>

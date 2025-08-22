<template>
  <div class="tags-manager-overlay" v-if="visible" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp">
    <div class="tags-manager-panel" @click.stop>
      <!-- Header -->
      <div class="panel-header">
        <h3>Tag Management</h3>
        <button class="close-button" @click="$emit('close')" title="Close">
          ×
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-button"
          :class="{ 'active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Tag Sets Tab -->
        <div v-if="activeTab === 'sets'" class="tab-panel">
          <TagsSet ref="tagsSetRef" />
        </div>

        <!-- Tag Rename Tab (Placeholder) -->
        <div v-if="activeTab === 'rename'" class="tab-panel">
          <TagsRename 
            ref="tagsRenameRef"
            :tag-to-rename="props.tagToRename"
          />
        </div>

        <!-- Additional tabs can be added here -->
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TagsSet from './tag/TagsSet.vue'
import TagsRename from './tag/TagsRename.vue'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  tabInitial: {
    type: String,
    default: 'sets'
  },
  tagToRename: {
    type: Object,
    default: null
  }
})

// Emits
const emit = defineEmits(['close'])

// State
const activeTab = ref(props.tabInitial)
const tagsSetRef = ref(null)
const tagsRenameRef = ref(null)
const mouseDownOnOverlay = ref(false)

// Available tabs
const tabs = ref([
  {
    id: 'sets',
    label: 'Tag Sets',
    description: 'Manage tag sets and reorder tags'
  },
  {
    id: 'rename',
    label: 'Rename Tags',
    description: 'Rename existing tags'
  }
  // Future tabs can be added here:
  // {
  //   id: 'merge',
  //   label: 'Merge Tags',
  //   description: 'Merge duplicate or similar tags'
  // },
  // {
  //   id: 'delete',
  //   label: 'Delete Tags',
  //   description: 'Delete unused tags'
  // }
])

// Methods
const handleOverlayMouseDown = (event) => {
  // Track if mouse down started on the overlay
  mouseDownOnOverlay.value = (event.target === event.currentTarget)
}

const handleOverlayMouseUp = (event) => {
  // Only close if both mouse down and mouse up happened on the overlay
  if (mouseDownOnOverlay.value && event.target === event.currentTarget) {
    emit('close')
  }
  mouseDownOnOverlay.value = false
}

// Reset active tab when panel becomes visible
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    activeTab.value = props.tabInitial
  }
})

// Expose methods for parent component
defineExpose({
  refreshTags: () => {
    if (activeTab.value === 'sets' && tagsSetRef.value) {
      tagsSetRef.value.refreshTagSets()
    }
    // Add other tab refresh methods as needed
  },
  setActiveTab: (tabId) => {
    activeTab.value = tabId
  }
})
</script>

<style scoped>
.tags-manager-overlay {
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
  padding: 20px;
}

.tags-manager-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.panel-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-button:hover {
  background-color: #f1f3f4;
  color: #333;
}

.tab-navigation {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  background-color: #f8f9fa;
}

.tab-button {
  padding: 12px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  position: relative;
}

.tab-button:hover {
  background-color: #e8eaed;
  color: #333;
}

.tab-button.active {
  color: #1a73e8;
  border-bottom-color: #1a73e8;
  background-color: white;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0; /* Important for proper scrolling */
}

.tab-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Responsive design */
@media (max-width: 768px) {
  .tags-manager-overlay {
    padding: 10px;
  }
  
  .tags-manager-panel {
    max-width: 100%;
    max-height: 95vh;
  }

  .tab-button {
    padding: 10px 16px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .tab-navigation {
    flex-wrap: wrap;
  }
  
  .tab-button {
    flex: 1;
    min-width: 0;
    padding: 8px 12px;
    font-size: 12px;
  }
}
</style>

<template>
  <div 
    class="tab-card"
    :class="{
      'browser-active-tab': tab.isActive,         // Browser's current active tab
      'browser-last-active-tab': tab.isLastActive, // Browser's previous active tab
      'browser-selected-tab': tab.isBrowserSelected, // Browser-selected tabs (highlighted)
      'ui-selected-tab': tab.isUiSelected            // User-selected in UI for operations
    }"
    :data-source="source"
  >
    <!-- Remove button (if provided) -->
    <button 
      v-show="showRemoveButton"
      class="tab-remove-button"
      :title="removeButtonTitle"
    >
      &times;
    </button>

    <!-- Card content -->
    <div class="tab-card-content">
      <!-- Icon -->
      <img 
        v-show="showIcon"
        class="tab-icon" 
        :src="tab.favIconUrl || tab.icon || defaultIcon"
        :alt="iconAlt"
        @error="handleIconError"
      />
      
      <!-- Text content -->
      <div v-if="showTitle || showUrl" class="tab-info">
        <div 
          v-show="showTitle" 
          class="tab-title" 
          :title="tab.title || tab.text"
        >
          {{ tab.title || tab.text || 'Untitled' }}
        </div>
        <div 
          v-show="showUrl" 
          class="tab-url" 
          :title="tab.url"
        >
          {{ tab.url }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Props
const props = defineProps({
  tab: {
    type: Object,
    required: true
  },
  showIcon: {
    type: Boolean,
    default: true
  },
  showTitle: {
    type: Boolean,
    default: true
  },
  showUrl: {
    type: Boolean,
    default: true
  },
  showRemoveButton: {
    type: Boolean,
    default: true
  },
  removeButtonTitle: {
    type: String,
    default: 'Remove'
  },
  defaultIcon: {
    type: String,
    default: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" fill="%23e8f0fe" rx="2"/><path d="M4 6h8v1H4V6zm0 2h6v1H4V8z" fill="%231a73e8"/></svg>'
  },
  iconAlt: {
    type: String,
    default: 'tab icon'
  },
  source: {
    type: String,
    default: 'open' // 'open' or 'remote'
  }
})

// Emits - All events now handled by delegation system

// Methods
const handleIconError = (event) => {
  // Fallback to default icon if the favicon fails to load
  event.target.src = props.defaultIcon
}


</script>

<style scoped>
.tab-card {
  background-color: #f8f9fa;
  border: 2px solid #dadce0;
  border-radius: 6px;
  cursor: pointer;
  /* Remove all transitions for better performance */
  position: relative;
  display: flex;
  align-items: center;
  overflow: hidden;
  width: 100%; /* Take full width of grid cell */
  /* Hardware acceleration */
  will-change: transform;
  transform: translateZ(0);
  box-sizing: border-box;
  transition: none; /* Remove transitions for better performance */
}


.tab-card:hover::before {
  opacity: 1;
}

.tab-card.selected {
  background-color: #e8f0fe;
  border-color: #1a73e8 !important;
}

.tab-card.selected:hover {
  background-color: #d2e3fc;
}

.tab-remove-button {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  /* Remove transition for better performance */
  z-index: 1;
}

.tab-card:hover .tab-remove-button {
  opacity: 1;
}

.tab-remove-button:hover {
  background-color: rgba(234, 67, 53, 0.1);
  color: #ea4335;
}

.tab-card-content {
  display: flex;
  align-items: center;
  padding: 1px 8px;
  width: 100%;
  gap: 2px;
  min-width: 0;
}

.tab-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 2px;
}

.tab-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tab-title {
  font-size: 13px;
  font-weight: 500;
  color: #202124;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-url {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .tab-card-content {
    padding: 2px 8px;
    gap: 8px;
  }
  
  .tab-icon {
    width: 16px;
    height: 16px;
  }
  
  .tab-title {
    font-size: 12px;
  }
  
  .tab-url {
    font-size: 10px;
  }
}

</style>
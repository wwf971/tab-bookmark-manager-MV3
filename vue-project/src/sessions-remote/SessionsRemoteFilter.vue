<template>
  <div class="sessions-remote-filter">
    <div class="filter-buttons">
      <button
        v-for="filterType in filterTypes"
        :key="filterType.id"
        class="filter-btn"
        :class="{ active: isFilterActive(filterType.id) }"
        @click="toggleFilter(filterType.id)"
        :title="filterType.description"
      >
        {{ filterType.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Props
const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits(['update:modelValue'])

// Filter types configuration
const filterTypes = [
  { id: 'all', label: 'All', description: 'Show all remote sessions' },
  { id: 'recent', label: 'Recent', description: 'Show only recently uploaded tabs' }
]

// Computed
const activeFilters = computed(() => props.modelValue || [])

// Methods
const isFilterActive = (filterId) => {
  return activeFilters.value.includes(filterId)
}

const toggleFilter = (filterId) => {
  let newFilters = [...activeFilters.value]
  
  if (filterId === 'all') {
    // When 'All' is clicked, clear all other filters and set only 'all'
    if (isFilterActive('all')) {
      newFilters = [] // Toggle off 'all' means no filters
    } else {
      newFilters = ['all'] // Only 'all' is active
    }
  } else {
    // When any other filter is clicked
    if (isFilterActive(filterId)) {
      // Remove the filter
      newFilters = newFilters.filter(f => f !== filterId)
    } else {
      // Add the filter and remove 'all' if it exists
      newFilters = newFilters.filter(f => f !== 'all')
      newFilters.push(filterId)
    }
    
    // If no other filters are active after removing one, auto-activate 'all'
    const otherFilters = newFilters.filter(f => f !== 'all')
    if (otherFilters.length === 0) {
      newFilters = ['all']
    }
  }
  
  emit('update:modelValue', newFilters)
}
</script>

<style scoped>
.sessions-remote-filter {
  display: flex;
  align-items: center;
  padding: 4px;
}

.filter-buttons {
  display: flex;
  gap: 0;
  border: 1px solid #e1e3e1;
  border-radius: 4px;
  overflow: hidden;
}

.filter-btn {
  padding: 4px 8px;
  border: none;
  background: white;
  color: #5f6368;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  border-right: 1px solid #e1e3e1;
  min-width: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-btn:last-child {
  border-right: none;
}

.filter-btn:hover {
  background: #f8f9fa;
  color: #1a73e8;
}

.filter-btn.active {
  background: #1a73e8;
  color: white;
}

.filter-btn.active:hover {
  background: #1557b0;
}
</style>

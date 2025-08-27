<template>
  <div 
    class="session-card"
    :class="{ 'current': isCurrent }"
    :data-session-card-id="sessionCardId"
    @click="$emit('click')"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <div class="session-card-content">
      <div class="session-card-name">
        {{ sessionName }}
        <span v-if="isCurrentWindow" class="current-window-tag">Current</span>
      </div>
      <div class="session-card-counts">
        <div v-if="shouldDisplaySearchResult" class="search-result-count">
          {{ searchResultTabNum }}
        </div>
        <div class="session-card-count">
          {{ tabCount }} tab{{ tabCount !== 1 ? 's' : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Props
const props = defineProps({
  sessionName: {
    type: String,
    required: true
  },
  tabCount: {
    type: Number,
    required: true
  },
  sessionCardId: {
    type: String,
    required: true
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  isCurrentWindow: {
    type: Boolean,
    default: false
  },
  shouldDisplaySearchResult: {
    type: Boolean,
    default: false
  },
  searchResultTabNum: {
    type: Number,
    default: 0
  }
})

// Emits
const emit = defineEmits(['click', 'contextmenu'])
</script>

<style scoped>
.session-card {
  padding: 6px;
  margin-bottom: 0px;
  border: 1px solid #e1e3e1;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: white;
}

.session-card:hover {
  border-color: #1a73e8;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.2);
}

.session-card.current {
  border-color: #1a73e8;
  background-color: #e8f0fe;
  box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
}

.session-card-content {
  display: flex;
  gap: 4px;
  justify-content: space-between;
}

.session-card-name {
  font-size: 14px;
  font-weight: 500;
  color: #202124;
  line-height: 1.2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
}

.session-card-counts {
  display: flex;
  align-items: center;
}

.search-result-count {
  font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
  font-size: 10px;
  font-weight: 600;
  color: #0d652d;
  background-color: #e6f4ea;
  padding: 2px 6px;
  border-radius: 8px;
  border: 1px solid #c4e7d1;
  letter-spacing: 0.5px;
}

.session-card-count {
  font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
  font-size: 11px;
  font-weight: 500;
  color: #9aa0a6;
  letter-spacing: 0.5px;
}
</style>

<template>
  <div class="snapshot-item">
    <div class="snapshot-header">
      <div class="snapshot-info">
        <div class="snapshot-time">
          {{ formatSnapshotTime(snapshot.time_create, snapshot.time_zone) }}
        </div>
        <div class="snapshot-stats">
          {{ snapshot.metadata.window_num }} window{{ snapshot.metadata.window_num !== 1 ? 's' : '' }},
          {{ snapshot.metadata.tab_num_total }} tab{{ snapshot.metadata.tab_num_total !== 1 ? 's' : '' }}
          ({{ snapshot.metadata.size_str }})
        </div>
        <div v-if="snapshot.metadata.creator_name" class="snapshot-creator">
          by {{ snapshot.metadata.creator_name }}
        </div>
      </div>
      <div class="snapshot-actions">
        <button 
          class="action-btn"
          @click="$emit('open', snapshot)"
          title="Open snapshot in new window"
        >
          <span class="material-icons">open_in_new</span>
        </button>
        <button 
          class="action-btn delete"
          @click="$emit('delete', snapshot)"
          title="Delete snapshot"
        >
          <span class="material-icons">delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  snapshot: {
    type: Object,
    required: true
  }
})

defineEmits(['open', 'delete'])

const formatSnapshotTime = (timeCreate, timeZone) => {
  const date = new Date(timeCreate)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  
  const tzSign = timeZone >= 0 ? '+' : '-'
  const tzHours = String(Math.abs(timeZone)).padStart(2, '0')
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}${ms}${tzSign}${tzHours}`
}
</script>

<style scoped>
.snapshot-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.snapshot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.snapshot-info {
  flex: 1;
}

.snapshot-time {
  font-family: monospace;
  font-size: 14px;
  color: #1a73e8;
  margin-bottom: 4px;
}

.snapshot-stats {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.snapshot-creator {
  font-size: 12px;
  color: #80868b;
}

.snapshot-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f1f3f4;
  color: #1a73e8;
}

.action-btn.delete:hover {
  background: #fce8e6;
  color: #d93025;
}

.material-icons {
  font-size: 20px;
}
</style>
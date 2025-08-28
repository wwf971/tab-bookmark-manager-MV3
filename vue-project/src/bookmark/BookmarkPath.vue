<template>
  <div class="bookmark-path">
    <!-- ROOT virtual folder -->
    <span 
      class="path-segment root-segment"
      @click="onPathSegmentClick('/')"
    >
      ROOT
    </span>
    
    <!-- Path segments -->
    <template v-for="(segment, index) in pathList" :key="index">
      <span class="path-separator">/</span>
      <span 
        class="path-segment"
        @click="onPathSegmentClick(segment.path)"
        :title="segment.title"
      >
        {{ segment.name }}
      </span>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBookmarkStore } from '@/bookmark/Bookmark.js'

const bookmarkStore = useBookmarkStore()

const props = defineProps({
  nodePathInit: {
    type: String,
    required: false,
    default: '/'
  },
})

const emit = defineEmits([
  'node-path-clicked' // "/a/b/c", user clicked on "b" --> emit "/a/b"
])

// node path should always start with "/"
// node path ending with "/" --> a bookmark folder
// node path not ending with "/" --> a leaf(bookmark)

const nodePathStrCurrent = ref(props.nodePathInit)

// convert path string to segments with clickable paths
const pathList = computed(() => {
  const path = nodePathStrCurrent.value || '/'
  
  // if root path, return empty segments
  if (path === '/') {
    return []
  }
  
  // split path and build segments
  const segments = []
  const pathParts = path.split('/').filter(part => part.length > 0)
  
  for (let i = 0; i < pathParts.length; i++) {
    const bookmarkId = pathParts[i]
    const bookmark = bookmarkStore.getBookmarkLocalById(bookmarkId)
    
    // build path up to this segment
    const segmentPath = '/' + pathParts.slice(0, i + 1).join('/')
    
    segments.push({
      name: bookmark?.title || bookmarkId,
      title: bookmark?.title || 'Unknown folder',
      path: segmentPath,
      id: bookmarkId
    })
  }
  
  return segments
})

const setNodePath = (nodePath) => {
  nodePathStrCurrent.value = nodePath
}

const onPathSegmentClick = (segmentPath) => {
  nodePathStrCurrent.value = segmentPath
  emit('node-path-clicked', segmentPath)
}

// expose method for parent component
defineExpose({
  setNodePath
})
</script>

<style scoped>
.bookmark-path {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  overflow-x: auto;
  white-space: nowrap;
}

.path-segment {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  color: #1a73e8;
  text-decoration: none;
  transition: background-color 0.2s;
}

.path-segment:hover {
  background-color: #e8f0fe;
  text-decoration: underline;
}

.root-segment {
  font-weight: bold;
  color: #666;
}

.root-segment:hover {
  color: #1a73e8;
}

.path-separator {
  color: #666;
  font-weight: normal;
}
</style>
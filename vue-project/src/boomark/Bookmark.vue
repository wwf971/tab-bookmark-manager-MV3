<!-- representing a browser bookmark -->
<template>
  <div class="bookmark-item" v-if="bookmark" :class="{ 'is-folder': isFolder }">
    <!-- Folder icon or bookmark favicon -->
    <div class="bookmark-icon" v-if="displayItems.icon">
      <span v-if="isFolder" class="folder-icon">📁</span>
      <img 
        v-else-if="faviconUrl"
        :src="faviconUrl"
        class="favicon"
        @error="onFaviconError"
        :alt="bookmark.title"
      />
      <span v-else class="bookmark-icon-fallback">🔖</span>
    </div>
    
    <!-- Bookmark/folder content -->
    <div class="bookmark-content" @click="onBookmarkClick" @dblclick="onBookmarkDoubleClick">
      <div v-show="displayItems.title" class="bookmark-title">{{ bookmark.title || 'Untitled' }}</div>
      <div v-show="displayItems.url && !isFolder && bookmark.url" class="bookmark-url">{{ bookmark.url }}</div>
      <div v-show="displayPath" class="bookmark-path">{{ bookmarkPathStr }}</div>
    </div>
    
    <!-- Action buttons -->
    <div class="bookmark-actions">
      <button 
        v-if="!isFolder" 
        @click.stop="onUploadClick"
        class="action-btn upload-btn"
        title="Upload to remote"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,5 17,10"/>
          <line x1="12" y1="5" x2="12" y2="15"/>
        </svg>
      </button>
      <button 
        @click.stop="onRemoveClick"
        class="action-btn remove-btn"
        title="Remove bookmark"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useBookmarkStore } from '@/stores/Bookmark'

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  displayItems: {
    type: Object,
    required: false,
    default: () => ({
      title: true,
      url: true,
      icon: true
    })
  },
  displayPath: {
    type: Boolean,
    required: false,
    default: false
  }
})

const emit = defineEmits([
  'folder-clicked',  // when folder is clicked, emit folder id for navigation
  'bookmark-uploaded',
  'bookmark-removed'
])

const bookmarkStore = useBookmarkStore()

// get bookmark data from pinia store
const bookmark = computed(() => {
  return bookmarkStore.getBookmarkLocalById(props.id)
})

const isFolder = computed(() => {
  return bookmark.value && !bookmark.value.url
})

// favicon URL generation for bookmarks
const faviconUrl = computed(() => {
  if (isFolder.value || !bookmark.value?.url) return null
  
  try {
    const url = new URL(bookmark.value.url)
    // use Google's favicon service as a reliable source
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=16`
  } catch (error) {
    console.warn('invalid bookmark URL:', bookmark.value.url)
    return null
  }
})

const onFaviconError = (event) => {
  // fallback to generic bookmark icon if favicon fails to load
  event.target.style.display = 'none'
}

// bookmark path string for display
const bookmarkPathStr = computed(() => {
  if (!props.displayPath || !bookmark.value) return ''
  
  const path = bookmarkStore.getBookmarkPath(props.id)
  if (!path || path.length <= 1) return ''
  
  // exclude the bookmark itself, show only parent folders
  const parentPath = path.slice(0, -1)
  return parentPath.map(item => item.title || 'Untitled').join(' / ')
})

const onBookmarkClick = () => {
  if (isFolder.value) {
    // emit folder click for navigation
    emit('folder-clicked', props.id)
  } else {
    // single click on bookmark - just select/highlight it
    // could emit a selection event if needed
    console.log('bookmark selected:', bookmark.value?.title)
  }
}

const onBookmarkDoubleClick = () => {
  if (!isFolder.value && bookmark.value?.url) {
    // double click on bookmark - open in new tab
    chrome.tabs.create({ url: bookmark.value.url })
  }
}

const onUploadClick = async () => {
  if (isFolder.value) return
  
  try {
    const result = await bookmarkStore.uploadBookmarkLocalToRemote(props.id, {
      delete_after_upload: false // keep local copy by default
    })
    
    if (result.is_success) {
      console.log('bookmark uploaded successfully:', result.message)
      emit('bookmark-uploaded', { id: props.id, result })
    } else {
      console.error('failed to upload bookmark:', result.message)
    }
  } catch (error) {
    console.error('error uploading bookmark:', error)
  }
}

const onRemoveClick = async () => {
  try {
    const result = await bookmarkStore.removeBookmarkLocal(props.id)
    if (result.is_success) {
      console.log('bookmark removed successfully:', result.message)
      emit('bookmark-removed', { id: props.id, result })
    } else {
      console.error('failed to remove bookmark:', result.message)
    }
  } catch (error) {
    console.error('error removing bookmark:', error)
  }
}
</script>

<style scoped>
.bookmark-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  transition: background-color 0.2s;
}

.bookmark-item:hover {
  background-color: #f5f5f5;
}

.bookmark-item.is-folder {
  background-color: #f0f8ff;
}

.bookmark-item.is-folder:hover {
  background-color: #e8f0fe;
}

.bookmark-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.folder-icon,
.bookmark-icon-fallback {
  font-size: 16px;
}

.favicon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.bookmark-content {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

.bookmark-title {
  font-weight: 500;
  color: #202124;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-url {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-path {
  font-size: 11px;
  color: #888;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-style: italic;
}

.bookmark-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
}

.upload-btn {
  background-color: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.upload-btn:hover {
  background-color: rgba(76, 175, 80, 0.2);
  transform: scale(1.05);
}

.remove-btn {
  background-color: rgba(128, 128, 128, 0.3);
  color: #666;
}

.remove-btn:hover {
  background-color: rgba(244, 67, 54, 0.2);
  color: #f44336;
  transform: scale(1.05);
}
</style>
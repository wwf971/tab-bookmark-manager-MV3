<template>
  <div class="bookmarks-local-panel">
    <!-- Panel display setting -->
    <PanelDisplaySetting
      ref="panelDisplayRef"
      :boolean-items="booleanItemsConfig"
      :range-items="rangeItemsConfig"
    />
    
    <!-- Path navigation -->
    <BookmarkPath 
      ref="pathComponent"
      :node-path-init="nodePathStrCurrent"
      @node-path-clicked="onPathClicked"
    />
    
    <!-- Current folder info -->
    <div class="folder-info" v-if="folderCurrent">
      <h3>{{ folderCurrent.title || 'Bookmarks' }}</h3>
      <div class="item-counts">
        <!-- <span class="item-count total">{{ childNumCurrent.length }} items</span> -->
        <span class="item-count folders">{{ folderCount }} folders</span>
        <span class="item-count bookmarks">{{ bookmarkCount }} bookmarks</span>
      </div>
    </div>
    
    <!-- Bookmarks list -->
    <div 
      class="bookmarks-list" 
      v-if="childNumCurrent.length > 0"
      :style="{ 
        gridTemplateColumns: (panelDisplayRef?.booleanItems?.useResponsiveGrid?.value ?? true) ? 'repeat(auto-fit, minmax(300px, 1fr))' : `repeat(${panelDisplayRef?.rangeItems?.columnsPerRow?.value ?? 1}, 1fr)` 
      }"
    >
      <Bookmark
        v-for="childId in childNumCurrent"
        :key="childId"
        :id="childId"
        :display-items="booleanItems"
        @folder-clicked="onFolderClicked"
        @bookmark-uploaded="onBookmarkUploaded"
        @bookmark-removed="onBookmarkRemoved"
      />
    </div>
    
    <!-- Empty state -->
    <div v-else class="empty-state">
      <p>This folder is empty</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useBookmarkStore } from '@/bookmark/Bookmark.js'
import { storeToRefs } from 'pinia'
import Bookmark from './Bookmark.vue'
import BookmarkPath from './BookmarkPath.vue'
import PanelDisplaySetting from '@/panel/PanelDisplaySetting.vue'

const bookmarkStore = useBookmarkStore()
const { bookmarksLocal, bookmarksChildren, bookmarksLocalRootId } = storeToRefs(bookmarkStore)

const props = defineProps({
  nodePathInit: {
    type: String,
    required: false,
    default: '/'
  },
})

// current path in the bookmark tree
const nodePathStrCurrent = ref(props.nodePathInit)
const pathComponent = ref(null)
const panelDisplayRef = ref(null)

// configuration for PanelDisplaySetting - bookmarks specific
const booleanItemsConfig = ref([
  { name: 'showIcon', label: 'Icon', value: true, title: 'Toggle icon display' },
  { name: 'showTitle', label: 'Title', value: true, title: 'Toggle title display' },
  { name: 'showUrl', label: 'URL', value: true, title: 'Toggle URL display' },
  { name: 'useResponsiveGrid', label: 'Auto', value: true, title: 'Auto-fit responsive grid' }
])

const rangeItemsConfig = ref([
  { name: 'columnsPerRow', value: 1, min: 1, max: 4, step: 1, default: 1, title: 'Columns per row' }
])

// computed for bookmark display items mapping
const booleanItems = computed(() => ({
  title: panelDisplayRef.value?.booleanItems?.showTitle?.value ?? true,
  url: panelDisplayRef.value?.booleanItems?.showUrl?.value ?? true, 
  icon: panelDisplayRef.value?.booleanItems?.showIcon?.value ?? true
}))

// get current folder id from path
const folderIdCurrent = computed(() => {
  const path = nodePathStrCurrent.value
  
  if (path === '/') {
    // root folder
    return bookmarksLocalRootId.value
  }
  
  // extract last folder id from path
  const pathParts = path.split('/').filter(part => part.length > 0)
  return pathParts[pathParts.length - 1]
})

// get current folder bookmark object
const folderCurrent = computed(() => {
  const folderId = folderIdCurrent.value
  if (!folderId) return null
  
  const folder = bookmarkStore.getBookmarkLocalById(folderId)
  
  // for root folder, create virtual folder object
  if (folderId === bookmarksLocalRootId.value && (!folder || folder.id === '0')) {
    return {
      id: folderId,
      title: 'Bookmarks',
      isRoot: true
    }
  }
  
  return folder
})

// get children of current folder
const childNumCurrent = computed(() => {
  const folderId = folderIdCurrent.value
  if (!folderId) return []
  
  const children = bookmarkStore.getBookmarkChildren(folderId)
  return children.map(child => child.id).filter(Boolean)
})

// count folders and bookmarks
const folderCount = computed(() => {
  return childNumCurrent.value.filter(childId => {
    const child = bookmarkStore.getBookmarkLocalById(childId)
    return child && !child.url // folders don't have url
  }).length
})

const bookmarkCount = computed(() => {
  return childNumCurrent.value.filter(childId => {
    const child = bookmarkStore.getBookmarkLocalById(childId)
    return child && child.url // bookmarks have url
  }).length
})

const setNodePath = (nodePath) => {
  nodePathStrCurrent.value = nodePath
  // update path component
  if (pathComponent.value) {
    pathComponent.value.setNodePath(nodePath)
  }
}

const onPathClicked = (clickedPath) => {
  console.log('path clicked:', clickedPath)
  setNodePath(clickedPath)
}

const onFolderClicked = (folderId) => {
  console.log('folder clicked:', folderId)
  
  // build new path
  let newPath
  if (nodePathStrCurrent.value === '/') {
    newPath = `/${folderId}`
  } else {
    newPath = `${nodePathStrCurrent.value}/${folderId}`
  }
  
  setNodePath(newPath)
}

const onBookmarkUploaded = (event) => {
  console.log('bookmark uploaded:', event)
  // could show notification or refresh something
}

const onBookmarkRemoved = (event) => {
  console.log('bookmark removed:', event)
  // the bookmark will be automatically removed from UI via reactive data
}

// no longer needed - settings are accessed reactively through panelDisplayRef

// watch for path changes to update path component
watch(nodePathStrCurrent, (newPath) => {
  if (pathComponent.value) {
    pathComponent.value.setNodePath(newPath)
  }
})

onMounted(() => {
  console.log('bookmarks local panel mounted with path:', nodePathStrCurrent.value)
  // configuration is now set declaratively in booleanItemsConfig and rangeItemsConfig
})
</script>

<style scoped>
.bookmarks-local-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 16px;
  width: 100%;
  max-width: 1200px;
  align-self: center;
}

.folder-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid #ddd;
}

.folder-info h3 {
  margin: 0;
  color: #1a73e8;
  font-size: 18px;
}

.item-counts {
  display: flex;
  gap: 8px;
}

.item-count {
  font-size: 12px;
  color: #666;
  background-color: #f0f0f0;
  padding: 2px 6px;
  border-radius: 8px;
}

.item-count.total {
  background-color: #e8f0fe;
  color: #1a73e8;
}

.item-count.folders {
  background-color: #fff3e0;
  color: #ff9800;
}

.item-count.bookmarks {
  background-color: #e8f5e8;
  color: #4caf50;
}

.bookmarks-list {
  flex: 1;
  overflow-y: auto;
  display: grid;
  gap: 8px;
  grid-auto-rows: min-content;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-style: italic;
}
</style>
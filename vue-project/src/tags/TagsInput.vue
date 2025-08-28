<template>
  <div 
    class="tags-input-container" 
    :class="{ 'locked': isLocked, 'is-drag': isDragOperation }"
    @keydown="onContainerKeyDown"
    tabindex="0"
    ref="containerRef"
  >
    <!-- Tag Input Row -->
    <div class="tags-input-row">
      <!-- Single v-for for both tags and input spans -->
      <template v-for="(item, index) in tagsExist" :key="item.id || item.name || `input-${index}`">
        <!-- Input Span -->
        <span
          v-if="item.type === 'tag_input'"
          :ref="el => setTagInputSpanRef(el, index)"
          class="tag-input-span"
          :class="{
            'is-last': index === tagsExist.length - 1,
            'is-first': index === 0,
            'tag-input-between': !item.is_show &&!item.is_last,
            'is-show': item.is_show && !isDragOperation,
            'is-drag': isDragOperation,
            'is-closest-during-drag': indexClosest === index
          }"
          :data-index="index"
        >
          <div v-show="item.is_show || item.is_last || isDragOperation" class="tag-input-wrapper">
            <span
              :ref="el => setTagInputFieldRef(el, index)"
              contenteditable="true"
              tabindex="0"
              class="tag-input-field"
              :class="{
                'tag-input-hidden': !item.is_show,
                'input-focused': tagFocused === item,
                'is-drag': isDragOperation
              }"
              :data-placeholder="isDragOperation ? '' : (item.is_last ? 'Add tag...' : `Insert tag before ${getNextTagName(index)}...`)"
              @input="(event) => onTagInputChange(event, index)"
              @keydown="(event) => onTagInputKeyDown(event, index)"
              @focus="() => onInputFocus(index)"
              @blur="onInputBlur"
              @click="onInputClick"
            ></span>
          </div>
        </span>

        <!-- Existing Tag -->
        <span
          v-else-if="item.type === 'tag'"
          class="tag-selected"
          :class="{ 
            'focused': tagFocused === item,
            'tag-keyboard-focused': tagFocused === item,
            'dragging': item.is_dragging,
            'tag-loading': item.status === 'loading',
            'tag-load-fail': item.status === 'load_fail'
          }"
          tabindex="0"
          draggable="true"
          @click="onTagClick($event, item)"
          @keydown="onContainerKeyDown"
          @dragstart="onSimpleDragStart($event, item, index)"
          @dragend="onSimpleDragEnd"
        >
          <span class="tag-name">{{ item.name }}</span>
          <span v-if="item.status === 'loading'" class="tag-status-corner loading">⟳</span>
          <span v-else-if="item.status === 'load_fail'" class="tag-status-corner fail">!</span>
          <span v-else-if="item.id && item.status === 'loaded'" class="tag-id-corner">{{ item.id }}</span>
          <span v-else-if="item.type === 'tag_new'" class="tag-new-corner">NEW</span>
          <button 
            v-if="allowUserEdit && !isLocked"
            class="tag-item-button-remove" 
            @click.stop="deleteTag(item, index)"
          >
            ×
          </button>
        </span>
      </template>
    </div>

    <!-- Tag Operation Error Display -->
    <div v-if="tagError" class="tag-error-banner">
      <span class="error-icon">⚠️</span>
      <span class="error-message">{{ tagError }}</span>
      <button @click="tagError = null" class="error-dismiss">×</button>
    </div>

    <!-- Tag Suggestions Panel with dynamic positioning -->
    <div 
      v-if="isShowingTagSuggest" 
      class="tag-suggestions-panel"
      :style="suggestPanelStyle"
    >
      <!-- Loading indicator -->
      <div v-if="isSearchingTags" class="tag-search-loading">
        <span class="loading-text">Searching tags...</span>
      </div>
      
      <!-- Existing Tags -->
      <div
        v-for="(tag, index) in tagsSuggestFiltered"
        :key="tag.id || tag.name"
        class="tag-item-search"
        :class="{ 
          'selected-suggestion': index === tagSuggestSelectedIndex,
          'already-added': tag.isAlreadyAdded
        }"
        @click="selectTagInSuggest(tag, getFocusedInputIndex())"
      >
        <span class="tag-name" v-html="highlightSearchMatch(tag.name, getCurrentQuery())"></span>
        <span v-if="tag.id" class="tag-id-corner">{{ tag.id }}</span>
        <span v-if="tag.isAlreadyAdded" class="indicator-already-added">✓ Added</span>
      </div>

      <!-- No Existing Tags Found -->
      <div 
        v-if="!isSearchingTags && tagsSuggestFiltered.length === 0 && getCurrentQuery().trim().length > 0"
        class="tag-no-results"
      >
        <div v-if="allowNewTag" class="tag-no-results-content">
          <span class="tag-no-results-text">No existing tags found</span>
          <div class="tag-create-new" @click="addNewTag(getFocusedInputIndex())">
            <span>Create new tag: "<strong>{{ getCurrentQuery().trim() }}</strong>"</span>
            <span class="tag-new-corner">NEW</span>
          </div>
        </div>
        <div v-else class="tag-no-results-content">
          <span class="tag-no-results-text">No matching tags found</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTags } from '@/tags/Tags'

const props = defineProps({
  tagsInit: {
    type: Array,
    default: () => []
  },
  allowUserEdit: {
    type: Boolean,
    default: true
  },
  emitOnEdit: {
    type: Boolean,
    default: true
  },
  lockOnTagModify: {
    type: Boolean,
    default: true // if true, this component will stay locked after tag modify event is emitted.
  },
  allowNewTag: {
    type: Boolean,
    default: true
  },
  disableInternalSearch: {
    type: Boolean,
    default: false
  },
  allowDrag: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  // tag update event
  // param 1: values related to tag update
  // param 2: a callback function for parent, only valid if prop lockOnTagModify is true
  // parent should call this callback function to approve or reject the modify, otherwise this component will permanently stay in locked state.
  // if the event is not important, parent should still immediately call the callback function with true, to avoid locking this component
  // lock(set isLocked to true) before emit, unlock(set isLocked to false) after parent runs callback
  'tagUpdate',
  'tagDelete',
  'tagAdd',
  'tagReorder' // New event for tag reordering
])

const drag_track_interval_ms = 80;
  // interval in ms when calculate nearest drop zone
const drag_track_method = 'dragover' // 'timer' or 'dragover'

// Store
const tagsStore = useTags()

// State
const isLocked = ref(false)
const tagsExist = ref([]) // Now contains both tags and input spans
const tagFocused = ref(null) // reference to tag or input span object
const tagsSelected = ref([]) // references to tags

const isShowingTagSuggest = ref(false)
const tagSuggestAll = ref([])
const tagSuggestSelectedIndex = ref(-1) // Start with no selection
const isSearchingTags = ref(false) // Loading state for tag search

// local error handling for tag operations
const tagError = ref(null)

// Search debouncing
let tagSearchTimeout = null

// Drag and drop state
const tagDragged = ref(null)
const tagDraggedIndex = ref(-1)
const indexClosest = ref(-1)
const dragStartTime = ref(0)
const isDragOperation = ref(false)

// Timer-based drag tracking variables (ACTIVE - testing container dragover approach)
let dragTrackingInterval = null
const mousePosCurrent = { x: undefined, y: undefined }

// Throttling timer for onDocumentDragOver
let dragOverThrottleTimer = null
const mousePosLatest = { x: undefined, y: undefined }

// Refs
const containerRef = ref(null)
const suggestPanelStyle = ref({}) // Suggestions panel positioning

// initialize tagsExist with input spans
const initTagsExist = () => {
  const result = []
  
  let _index = 0;
  // Add tags from props.tagsInit
  props.tagsInit.forEach((tag, index) => {
    // Add input span before each tag (initially hidden)
    if (props.allowUserEdit && !isLocked.value) {
      result.push({
        type: 'tag_input',
        is_show: false,
        is_last: false,
        text: '',
        is_dragging: false // Initialize dragging state
      })
    }
    _index ++;
    // Add the tag - use the actual reference to maintain reactivity
    result.push(tag) // use the reference directly, type should already be set by store
    _index ++;
  })
  
  // Add final input span (initially visible if user can edit)
  if (props.allowUserEdit && !isLocked.value) {
    result.push({
      type: 'tag_input',
      is_show: true,
      is_last: true,
      text: '',
      is_dragging: false // Initialize dragging state
    })
  }
  tagsExist.value = result
  // console.log('TagsInput.vue: initTagsExist() - tagsExist:', tagsExist.value)
  nextTick(() => { // ensure that tagInputFieldRefs are updated
    // console.log('tagInputFieldRefs.length:', Object.keys(tagInputFieldRefs.value).length, 'tagInputFieldRefs.value:', tagInputFieldRefs.value)
    tagsExist.value.forEach((item, index) => {
      if(item.type === 'tag_input'){
        let except_last = true;
        if(index === tagsExist.value.length - 1){
          except_last = false;
        }
        deactivateTagInput(
          null,
          item,
          except_last
        )
      }
    })
  })
}

// Computed - extract only actual tags (exclude input spans)
const tagsActual = computed(() => {
  return tagsExist.value.filter(item => item.type === 'tag')
})

const tagsSuggestFiltered = computed(() => {
  // Only compute when suggestions are actually being shown
  if (!isShowingTagSuggest.value) return []
  
  const query = getCurrentQuery().trim()
  if (query.trim().length === 0) return []
  
  const existingTagNames = tagsActual.value.map(tag => tag.name)
  
  return tagSuggestAll.value
    .filter(tag => {
      return tag.name?.includes(query)
    })
    .map(tag => ({
      ...tag,
      isAlreadyAdded: existingTagNames.includes(tag.name)
    }))
    .slice(0, 10) // Limit suggestions
})

// Watch for changes in tagsInit prop
watch(() => props.tagsInit, (newTags) => {
  // console.log('watch() tagsInit', newTags)
  // initTagsExist()
}, { deep: true })

// Watch for is_show changes to set initial width
watch(() => tagsExist.value, (newTagsExist, oldTagsExist) => {
  if (!newTagsExist || !oldTagsExist) return
  
  // Find inputs that just became visible (is_show changed from false to true)
  newTagsExist.forEach((newItem, index) => {
    if (newItem.type === 'tag_input' && newItem.is_show && !newItem.is_last) {
      const oldItem = oldTagsExist[index]
      if (oldItem && oldItem.type === 'tag_input' && !oldItem.is_show) {
        // Input just became visible, set initial width
        nextTick(() => {
          setInputSpanWidth(index, 100)
        })
      }
    }
  })
}, { deep: true })

// watch(() => tagFocused.value, (newTagFocused, oldTagFocused) => {
//   if(isDragOperation.value){ return}
//   if (oldTagFocused && oldTagFocused.type === 'tag_input') {
//     console.error('TagsInput.vue: watch() tagFocused() - deactivateTagInput()', oldTagFocused)
//     deactivateTagInput(tagsExist.value.findIndex(item => item === oldTagFocused))
//   }
// })

// initialize focus state
const initFocus = () => {
  // set focus to last input after refs are available
  setTimeout(() => {
    const indexLastInput = findTagInputLastIndex()
    if (indexLastInput !== -1) {
      tagFocused.value = tagsExist.value[indexLastInput]
    }
  }, 0)
}

// initialize on mount
onMounted(() => {
  initTagsExist()
  initFocus()
  
  // Debug drag settings
  // console.log('TagsInput.vue: onMounted() - allowDrag prop:', props.allowDrag)
  // console.log('TagsInput.vue: onMounted() - all props:', props)
  
  // Check if tags are draggable after a short delay
  setTimeout(() => {
    const tagElements = document.querySelectorAll('.tag-selected')
    // console.log('TagsInput.vue: Found tag elements:', tagElements.length)
    // console.log('TagsInput.vue: tagsExist.length:', tagsExist.value.length)
    
    tagElements.forEach((tag, i) => {
      const isDraggable = tag.getAttribute('draggable')
      const hasPointerEvents = window.getComputedStyle(tag).pointerEvents
      const tagData = tagsExist.value.find(item => item.type === 'tag')
      const childElements = Array.from(tag.children).map(child => ({
        tagName: child.tagName,
        className: child.className,
        textContent: child.textContent.substring(0, 20),
        pointerEvents: window.getComputedStyle(child).pointerEvents
      }))
      
      console.log(`Tag ${i}:`, {
        element: tag,
        draggable: isDraggable,
        pointerEvents: hasPointerEvents,
        classList: Array.from(tag.classList),
        childElements: childElements,
        tagText: tag.textContent.substring(0, 30),
        hasMouseDownListener: !!tag.onmousedown,
        hasClickListener: !!tag.onclick
      })
    })
  }, 500)
})

// Cleanup on unmount
onUnmounted(() => {
  if (tagSearchTimeout) {
    clearTimeout(tagSearchTimeout)
    tagSearchTimeout = null
  }
  
  // Clean up throttle timer
  if (dragOverThrottleTimer) {
    clearTimeout(dragOverThrottleTimer)
    dragOverThrottleTimer = null
  }
  
  // Clean up drag event listeners if component unmounts during drag
  document.removeEventListener('dragover', onDocumentDragOver)
  document.removeEventListener('drop', onDocumentDrop)
  
  // Clean up timer-based tracking if component unmounts during drag
  if (dragTrackingInterval) {
    clearInterval(dragTrackingInterval)
    dragTrackingInterval = null
  }
  document.removeEventListener('dragover', onContainerDragOver)
})

// Helper methods

const tagInputFieldRefs = ref({}) // Object to store refs for input elements
const setTagInputFieldRef = (el, index) => {
  if (el) {
    tagInputFieldRefs.value[index] = el
  }
}


const tagInputSpanRefs = ref({})
const setTagInputSpanRef = (el, index) => {
  if (el) {
    tagInputSpanRefs.value[index] = el
  }
}

const getNextTagName = (inputIndex) => {
  // Find the next tag after this input index
  for (let i = inputIndex + 1; i < tagsExist.value.length; i++) {
    if (tagsExist.value[i].type === 'tag') {
      return tagsExist.value[i].name
    }
  }
  return ''
}

const getFocusedInputIndex = () => {
return tagsExist.value.findIndex(item => item === tagFocused.value)
}

const getCurrentQuery = () => {
  const focusedIndex = getFocusedInputIndex()
  if (focusedIndex !== -1 && tagsExist.value[focusedIndex].type === 'tag_input') {
    return tagsExist.value[focusedIndex].text || ''
  }
  return ''
}

const calcSuggestPanelPos = () => {
  if (!containerRef.value) return

  const focusedIndex = getFocusedInputIndex()
  if (focusedIndex === -1 || tagsExist.value[focusedIndex].type !== 'tag_input') {
    suggestPanelStyle.value = {}
    return
  }

  const inputElement = tagInputFieldRefs.value[focusedIndex]
  if (!inputElement) {
    suggestPanelStyle.value = {}
    return
  }

  const containerRect = containerRef.value.getBoundingClientRect()
  const inputRect = inputElement.getBoundingClientRect()
  
  const left = inputRect.left - containerRect.left
  const top = inputRect.bottom - containerRect.top + 2 // 2px gap
  
  suggestPanelStyle.value = {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 1000
  }
}

// Methods
const onTagInputChange = (event, index) => {
  // Get text content from contenteditable span
  const newValue = event.target.textContent || ''
  
  // Update the text in tagsExist
  if (tagsExist.value[index] && tagsExist.value[index].type === 'tag_input') {
    tagsExist.value[index].text = newValue
  }
  
  // Set as focused
  tagFocused.value = tagsExist.value[index]
  
  // Update input span width dynamically for between inputs
  const inputItem = tagsExist.value[index]
  if (inputItem && !inputItem.is_last && inputItem.is_show) {
    updateInputWidth(index, newValue)
  }
  
  // console.log('TagsInput.vue: onTagInputChange()', newValue, 'index:', index)
  
  // Always clear previous timeout to ensure latest search is processed
  if (tagSearchTimeout) {
    clearTimeout(tagSearchTimeout)
  }
  
  // Skip internal search if disabled (parent component will handle it)
  if (props.disableInternalSearch) {
    console.log('TagsInput.vue: onTagInputChange() return due to disableInternalSearch')
    return
  }
  
  const query = newValue.trim()
  // console.log('TagsInput.vue: onTagInputChange() query:', query)

  if (query.trim().length === 0) {
    isShowingTagSuggest.value = false
    tagSuggestAll.value = []
    tagSuggestSelectedIndex.value = -1
    return
  }
  
  // Debounce search with 300ms delay
  tagSearchTimeout = setTimeout(async () => {
    if (query.length >= 1) {
      // console.log('TagsInput.vue: onTagInputChange() start search with debounce')
      const searchTimestamp = Date.now()
      const searchResult = await searchTags(query, searchTimestamp)
      
      // Only update UI if the search was processed (meaning it was the most recent)
      if (searchResult && searchResult.processed) {
        isShowingTagSuggest.value = tagSuggestAll.value.length > 0 || query.trim().length > 0 // Show panel even if no results for "create new" option
        // Set initial selection to first item when results appear
        if (tagSuggestAll.value.length > 0) {
          tagSuggestSelectedIndex.value = 0
        } else {
          tagSuggestSelectedIndex.value = -1
        }
        
        // Calculate position for suggestions panel
        nextTick(() => {
          calcSuggestPanelPos()
        })
      } else {
        console.log('TagsInput.vue: Ignoring outdated search results in UI update')
      }
    }
  }, 300)
  
  // Start with no selection when search starts
  tagSuggestSelectedIndex.value = -1
  console.log('TagsInput.vue: onTagInputChange() end')
}

// Helper function to set input span width
const setInputSpanWidth = (index, width) => {
  // console.log('TagsInput.vue: setInputSpanWidth()', index, width)
  const inputElement = tagInputFieldRefs.value[index]
  if (inputElement) {
    const parentSpan = inputElement.closest('.tag-input-span')
    // console.log('TagsInput.vue: setInputSpanWidth() parentSpan:', parentSpan)
    if (parentSpan) {
      parentSpan.style.width = `${width}px`
      // IMPORTANT. if not set, tag-input-span will stretch its height outside container tags-input-row
      parentSpan.style.minWidth = `${width}px`
      parentSpan.style.maxWidth = 'none' // Allow expansion
      parentSpan.style.flex = 'none' // Override flex: 1
    }
  }else{
    console.error(`TagsInput.vue: setInputSpanWidth() - inputElement not found for index: ${index}`)
  }
}

// Dynamic width calculation for input spans
const updateInputWidth = (index, text) => {
  nextTick(() => {
    const inputElement = tagInputFieldRefs.value[index]
    if (!inputElement) return

    // if is last input, set width to 100%
    if (index === tagsExist.value.length - 1) {
      return;
    }
    
    // Create temporary element to measure text width
    const measurer = document.createElement('span')
    measurer.style.visibility = 'hidden'
    measurer.style.position = 'absolute'
    measurer.style.fontSize = getComputedStyle(inputElement).fontSize
    measurer.style.fontFamily = getComputedStyle(inputElement).fontFamily
    measurer.style.whiteSpace = 'nowrap'
    measurer.textContent = text || 'W' // Use 'W' as fallback for empty text
    
    document.body.appendChild(measurer)
    const textWidth = measurer.offsetWidth
    document.body.removeChild(measurer)
    
    // Calculate required width: text width + padding + some buffer
    const requiredWidth = Math.max(100, textWidth + 20) // min 100px, add 20px for padding/buffer
    
    // Update the parent span width
    setInputSpanWidth(index, requiredWidth)
  })
}

// Track the most recent search timestamp
let searchTimestampLatest = 0

const searchTags = async (query, timestamp) => {
  if (!query) return null
  
  // Update the latest search timestamp
  searchTimestampLatest = timestamp
  
  isSearchingTags.value = true
  try {
    const result = await tagsStore.searchTags(query)
    
    // Only update results if this is still the most recent search
    if (timestamp >= searchTimestampLatest) {
      if (Array.isArray(result)) {
        tagSuggestAll.value = result
      } else if (result.is_success && Array.isArray(result.data)) {
        tagSuggestAll.value = result.data
      } else {
        tagSuggestAll.value = []
      }
      
      return { timestamp, processed: true }
    } else {
      console.log('TagsInput.vue: Search result ignored - newer search initiated')
      return { timestamp, processed: false }
    }
  } catch (error) {
    console.error('Error searching tags:', error)
    // Only clear results if this is still the most recent search
    if (timestamp >= searchTimestampLatest) {
      tagSuggestAll.value = []
      return { timestamp, processed: true }
    }
    return { timestamp, processed: false }
  } finally {
    isSearchingTags.value = false
  }
}

const onTagInputKeyDown = async (event, index) => {
  // console.log('TagsInput.vue: onTagInputKeyDown()', event.key)
  let shouldStopPropagation = true;
  const inputItem = tagsExist.value[index]
  switch (event.key) {
    case 'Process': // IME
      event.preventDefault()
      event.stopPropagation()
      return;
    case 'Enter':
      event.preventDefault()
      await handleEnterKey(index)
      break
    case 'Backspace': // Handle backspace/delete on empty input - delete previous tag
    case 'Delete':
      if(inputItem.text.trim().length === 0){
        // console.log('TagsInput.vue: onTagInputKeyDown() inputItem.text.trim().length === 0')
        event.preventDefault()
        if(inputItem.text.length > 0){ // only white chars in input
          clearTagInput(index)
        }
        // Delete previous tag if exists
        const indexTagPrev = findPrevTag(index)
        if(indexTagPrev !== -1){
          deleteTag(tagsExist.value[indexTagPrev], indexTagPrev) 
        }
      }
      break
    case 'ArrowLeft':
      // console.log('TagsInput.vue: onTagInputKeyDown() - ArrowLeft. inputItem.text:', inputItem.text)
      if(inputItem.text === ''){
        const indexTagPrev = findPrevTag(index)
        // console.log('TagsInput.vue: onTagInputKeyDown() - indexTagPrev', indexTagPrev)
        if(indexTagPrev !== -1){
          event.preventDefault()
          inputItem.is_show = false
          deactivateTagInput(index)
          focusOnTag(tagsExist.value[indexTagPrev])
        }
      }
      break
    case 'ArrowRight':
      if(inputItem.text === ''){
        // Only navigate to tag on right if this is not the last input span
        const tagIndexNext = findNextTag(index)
        if(tagIndexNext !== -1){
          event.preventDefault()
          deactivateTagInput(index)
          focusOnTag(tagsExist.value[tagIndexNext])
        }
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if(isShowingTagSuggest.value && tagsSuggestFiltered.value.length > 0){
        tagSuggestSelectedIndex.value = Math.min(
          tagSuggestSelectedIndex.value + 1,
          tagsSuggestFiltered.value.length - 1
        )
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if(isShowingTagSuggest.value && tagsSuggestFiltered.value.length > 0){
        tagSuggestSelectedIndex.value = Math.max(tagSuggestSelectedIndex.value - 1, -1)
      }
      break
    case 'Escape':
      event.preventDefault()
      isShowingTagSuggest.value = false
      break
    // default:
    //   return; // keep propagation
  }
  if(shouldStopPropagation){
    // console.log('TagsInput.vue: onTagInputKeyDown() stopPropagation')
    event.stopPropagation();
  }
}

const findPrevTag = (currentIndex) => {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (tagsExist.value[i].type === 'tag') {
      return i
    }
  }
  return -1
}

const findNextTag = (currentIndex) => {
  for (let i = currentIndex + 1; i < tagsExist.value.length; i++) {
    if (tagsExist.value[i].type === 'tag') {
      return i
    }
  }
  return -1
}

const findNextInput = (currentIndex) => {
  for (let i = currentIndex + 1; i < tagsExist.value.length; i++) {
    if (tagsExist.value[i].type === 'tag_input' && tagsExist.value[i].is_show) {
      return i
    }
  }
  return -1
}

const findPreviousInput = (currentIndex) => {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (tagsExist.value[i].type === 'tag_input' && tagsExist.value[i].is_show) {
      return i
    }
  }
  return -1
}

// sophisticated Enter key handling
const handleEnterKey = async (inputIndex) => {
  const inputItem = tagsExist.value[inputIndex]
  const query = inputItem.text.trim()
  
  if (query.trim().length === 0) return
  
  // Wait for search to complete if it's in progress
  if (isSearchingTags.value) {
    // Wait for search to complete
    while (isSearchingTags.value) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  // If panel is not shown but we have input, trigger search and wait
  if (!isShowingTagSuggest.value && query) {
    await searchTags(query)
    isShowingTagSuggest.value = tagSuggestAll.value.length > 0 || query.trim().length > 0 // Show panel even if no results for "create new" option
    if (tagSuggestAll.value.length > 0) {
      tagSuggestSelectedIndex.value = 0
    }
    
    // Calculate position for suggestions panel
    nextTick(() => {
      calcSuggestPanelPos()
    })
  }
  
  // If there's a selected suggestion, use it
  if (tagSuggestSelectedIndex.value >= 0 && tagsSuggestFiltered.value[tagSuggestSelectedIndex.value]) {
    const selectedTag = tagsSuggestFiltered.value[tagSuggestSelectedIndex.value]
    selectTagInSuggest(selectedTag, inputIndex)
    return
  }
  
  // If index is -1, check if input matches any suggestion
  if (tagSuggestSelectedIndex.value === -1 && tagsSuggestFiltered.value.length > 0) {
    const matchingSuggestion = tagsSuggestFiltered.value.find(tag => 
      tag.name === query
    )
    if (matchingSuggestion) {
      selectTagInSuggest(matchingSuggestion, inputIndex)
      return
    }
  }
  
  // Otherwise, add as new tag if allowed
  if (props.allowNewTag) {
    addNewTag(inputIndex)
  }
}

const selectTagInSuggest = (tag, inputIndex) => {
  // Check if tag is already added
  if (tag.isAlreadyAdded) {
    console.log('TagsInput.vue: selectTagInSuggest() tag already added, not adding duplicate:', tag.name)
    clearTagInput(inputIndex)
    isShowingTagSuggest.value = false
    return
  }
  
  addTag(tag, inputIndex, false) // Focus on final input, not new tag
  clearTagInput(inputIndex)
  isShowingTagSuggest.value = false
}

const addNewTag = (inputIndex) => {
  const inputItem = tagsExist.value[inputIndex]
  const query = inputItem.text.trim()
  
  if (query.trim().length === 0) return
  
  // Create a new tag object
  const tagNew = {
    name: query,
    type: 'tag_new'
  }
  
  addTag(tagNew, inputIndex, false) // Focus on final input, not new tag
  clearTagInput(inputIndex)
  isShowingTagSuggest.value = false
}

// Helper method to clear specific input
const clearTagInput = (inputIndex) => {
  const inputItem = tagsExist.value[inputIndex]
  if (inputItem && inputItem.type === 'tag_input') {
    // Set a flag to prevent search during clearing
    const wasSearching = isSearchingTags.value
    isSearchingTags.value = true
    
    inputItem.text = ''
    if (tagInputFieldRefs.value[inputIndex]) {
      tagInputFieldRefs.value[inputIndex].textContent = ''
    }
    
    // Clear search state
    if (tagSearchTimeout) {
      clearTimeout(tagSearchTimeout)
      tagSearchTimeout = null
    }
    isShowingTagSuggest.value = false
    tagSuggestAll.value = []
    tagSuggestSelectedIndex.value = -1
    
    // Restore search flag
    nextTick(() => {
      isSearchingTags.value = wasSearching
    })
  }
}

// Core tag addition logic - extracted from else block (the correct implementation)
const executeTagAdd = (tag, inputIndex, focusOnNewTag = true) => {
  console.warn('TagsInput.vue: executeTagAdd() tag:', tag, 'inputIndex:', inputIndex, 'focusOnNewTag:', focusOnNewTag)
  const tagToAdd = tag;
  // console.log('TagsInput.vue: executeTagAdd() tagToAdd:', tagToAdd)
  // Replace the input span with the new tag
  tagsExist.value.splice(inputIndex, 0, tagToAdd);
  tagsExist.value.splice(inputIndex, 0, {
    type: 'tag_input',
    is_show: false,
    is_last: false,
    text: '',
    is_dragging: false
  })
  // console.log('TagsInput.vue: executeTagAdd() tagsExist.value:', tagsExist.value)
  deactivateTagInput(inputIndex)
  deactivateTagInput(inputIndex + 2)
  
  // Focus handling
  if (focusOnNewTag) {
    nextTick(() => {
      const newTag = tagsExist.value[inputIndex + 1]
      if (newTag && newTag.type === 'tag') {
        focusOnTag(newTag)
      }
    })
  } else {
    // Focus on final input
    nextTick(() => {
      const indexLastInput = findTagInputLastIndex()
      if (indexLastInput !== -1) {
        focusOnTagInput(indexLastInput)
      }
    })
  }
}

// Helper function to find the last tag_input index more robustly
const findTagInputLastIndex = () => {
  for (let i = tagsExist.value.length - 1; i >= 0; i--) {
    if (tagsExist.value[i].type === 'tag_input') {
      return i;
    }
  }
  return -1;
}

const addTag = (tag, inputIndex, focusOnNewTag = true) => {
  // Check if tag already exists
  const existingTag = tagsActual.value.find(t => t.name === tag.name)
  if (existingTag) return

  const inputItem = tagsExist.value[inputIndex]
  if (!inputItem || inputItem.type !== 'tag_input') return
  inputItem.text = '';

  // Calculate insertion position based on whether it's the last input or between tags
  let indexInsert
  const lastInputIndex = findTagInputLastIndex()
  if (inputIndex === lastInputIndex) {
    indexInsert = tagsActual.value.length
  } else {
    // Count actual tags before this input position
    indexInsert = 0
    for (let i = 0; i < inputIndex; i++) {
      if (tagsExist.value[i].type === 'tag') {
        indexInsert++
      }
    }
  }

  if (props.emitOnEdit) {
    if (props.lockOnTagModify) {
      isLocked.value = true
    }
    emit('tagAdd', { tag, indexInsert }, (approved) => {
      if (approved) {
        // Use updated tag data if provided by server, otherwise use original tag
        const tagFinal = tagsStore.getTagsRefById([tag.id])[0]
        executeTagAdd(tagFinal, inputIndex, focusOnNewTag)
        // Emit update with actual tags only
        emit('tagUpdate', tagsActual.value)
        tagError.value = null // clear any previous errors
      } else {
        // If not approved, show error and restore focus to input
        tagError.value = 'Failed to add tag'
        nextTick(() => {
          if (tagInputFieldRefs.value[inputIndex]) {
            tagFocused.value = inputItem
            tagInputFieldRefs.value[inputIndex].focus()
          }
        })
      }
      if (props.lockOnTagModify) {
        isLocked.value = false
      }
    })
  } else {
    // Direct execution without approval
    const tagFinal = tagsStore.getTagsRefById([tag.id])[0]
    executeTagAdd(tagFinal, inputIndex, focusOnNewTag)
  }
}

const deleteTag = (tag, index) => {
  if (props.emitOnEdit) {
    if (props.lockOnTagModify) {
      isLocked.value = true
    }
    
    // Store focus restoration info before deletion
    const indexTagPrev = findPrevTag(index)
    const nextTagIndex = findNextTag(index)
    
    emit('tagDelete', { tag, index: tagsActual.value.findIndex(t => t === tag) }, (approved) => {
      if (approved) {
        tagsExist.value.splice(index, 1)
        tagsExist.value.splice(index - 1, 1)
        
        // Restore focus after deletion
        nextTick(() => {
          if (indexTagPrev !== -1 && indexTagPrev < tagsExist.value.length && tagsExist.value[indexTagPrev].type === 'tag') {
            focusOnTag(tagsExist.value[indexTagPrev])
          } else if (nextTagIndex !== -1) {
            // Find the next tag after deletion (index shifts down by 1)
            const adjustedNextIndex = nextTagIndex - 1
            if (adjustedNextIndex < tagsExist.value.length && tagsExist.value[adjustedNextIndex].type === 'tag') {
              focusOnTag(tagsExist.value[adjustedNextIndex])
            } else {
              // Focus on last input if no tags available
              const indexLastInput = findTagInputLastIndex()
              if (indexLastInput !== -1) {
                focusOnTagInput(indexLastInput)
              }
            }
          } else {
            // Focus on last input if no other tags
            const indexLastInput = findTagInputLastIndex()
            if (indexLastInput !== -1) {
              focusOnTagInput(indexLastInput)
            }
          }
        })
        // Emit update with actual tags only
        emit('tagUpdate', tagsActual.value)
        tagError.value = null // clear any previous errors
      } else {
        // If not approved, show error
        tagError.value = 'Failed to delete tag'
      }
      if (props.lockOnTagModify) {
        isLocked.value = false
      }
    })
  } else {
    // Store focus restoration info before deletion
    const indexTagPrev = findPrevTag(index)
    const nextTagIndex = findNextTag(index)
    
    tagsExist.value.splice(index, 1)
    tagsExist.value.splice(index - 1, 1)
    
    // Restore focus after deletion
    nextTick(() => {
      if (indexTagPrev !== -1 && indexTagPrev < tagsExist.value.length && tagsExist.value[indexTagPrev].type === 'tag') {
        focusOnTag(tagsExist.value[indexTagPrev])
      } else if (nextTagIndex !== -1) {
        // Find the next tag after deletion (index shifts down by 1)
        const adjustedNextIndex = nextTagIndex - 1
        if (adjustedNextIndex < tagsExist.value.length && tagsExist.value[adjustedNextIndex].type === 'tag') {
          focusOnTag(tagsExist.value[adjustedNextIndex])
        } else {
          // Focus on last input if no tags available
          const indexLastInput = findTagInputLastIndex()
          if (indexLastInput !== -1) {
            focusOnTagInput(indexLastInput)
          }
        }
      } else {
        // Focus on last input if no other tags
        const indexLastInput = findTagInputLastIndex()
        if (indexLastInput !== -1) {
          focusOnTagInput(indexLastInput)
        }
      }
    })
  }
}

const onInputFocus = (inputIndex) => {
  const inputItem = tagsExist.value[inputIndex]
  if (inputItem && inputItem.type === 'tag_input') {
    tagFocused.value = inputItem
    
    // Calculate position for suggestions panel if showing
    if (isShowingTagSuggest.value) {
      nextTick(() => {
        calcSuggestPanelPos()
      })
    }
  }
}

const onInputClick = (inputItem) => {
  if(inputItem.type === 'tag_input' && inputItem.is_last){
    inputItem.is_show = true
    tagInputFieldRefs.value[inputItem.index].focus()
  }
}

const onInputBlur = () => {
  // Delay hiding suggestions to allow click on suggestions
  setTimeout(() => {
    isShowingTagSuggest.value = false
  }, 200)
}

// Focus and keyboard navigation methods
const focusOnTag = (tag) => {
  console.log('TagsInput.vue: focusOnTag() called with tag:', tag)
  tagFocused.value = tag
  
  // Find and focus the clicked tag element
  nextTick(() => {
    const tagElements = document.querySelectorAll('.tag-selected')
    const tagIndex = tagsExist.value.findIndex(t => t === tag)
    if (tagIndex !== -1) {
      // Find which visual tag element this corresponds to
      let visualIndex = 0
      for (let i = 0; i <= tagIndex; i++) {
        if (tagsExist.value[i].type === 'tag') {
          if (i === tagIndex) break
          visualIndex++
        }
      }
      if (tagElements[visualIndex]) {
        tagElements[visualIndex].focus()
      }
    }
  })
}

// Simplified cursor positioning - much simpler with normal flow layout
const setCursorToEnd = (element) => {
  if (!element) return
  
  // With the new wrapper approach, simple focus should work well
  if (document.activeElement !== element) {
    element.focus()
  }
  
  // For programmatic focus, position cursor at end if there's content
  if (element.textContent && element.textContent.length > 0) {
    // Simple range positioning - much more reliable now
    const range = document.createRange()
    const selection = window.getSelection()
    
    try {
      range.selectNodeContents(element)
      range.collapse(false) // Collapse to end
      selection.removeAllRanges()
      selection.addRange(range)
    } catch (error) {
      // If range fails, that's okay - browser will handle it
    }
  }
}

const focusOnTagInput = (inputIndex = -1) => {
  console.warn('TagsInput.vue: focusOnTagInput() called with inputIndex:', inputIndex)
  // Find the last input if no specific index provided
  if (inputIndex === -1) {
    inputIndex = findTagInputLastIndex()
  }
  
  if (inputIndex !== -1) {
    const inputItem = tagsExist.value[inputIndex]
    inputItem.is_show = true
    tagFocused.value = inputItem
    
    // Simple focus with the new wrapper approach
    nextTick(() => {
      const element = tagInputFieldRefs.value[inputIndex]
      if (element) {
        element.focus()
        // Only position cursor if there's existing content
        if (inputItem.text && inputItem.text.length > 0) {
          setCursorToEnd(element)
        }
        console.log('TagsInput.vue: focusOnTagInput() called with inputIndex:', inputIndex, 'tagExist.length:', tagsExist.value.length)
        if(inputIndex !== tagsExist.value.length - 1){
          setInputSpanWidth(inputIndex, 100)
          updateInputWidth(inputIndex, inputItem.text || '')
        }
      }
    })
  }
}

const onContainerKeyDown = (event) => {
  if (!tagFocused.value) {
    return
  }
  const indexCurrent = tagsExist.value.findIndex(item => item === tagFocused.value)

  // Only handle when not in suggestions mode
  switch (event.key) {
    case 'Process': // IME
      event.preventDefault()
      event.stopPropagation()
      return;
    case 'ArrowLeft':
      event.preventDefault()
      if (event.shiftKey) {
        // Shift+Left: activate input span before current tag
        if (tagFocused.value.type === 'tag') {
          activateInputBefore(indexCurrent, event)
        }else{
          goToPrevTag(indexCurrent) // shouldStopPropagation = true; // otherwise onContainerKeyDown() will also call goToPrevTag()
        }
      }else{
        if(indexCurrent === 1){
          activateInputBefore(indexCurrent, event)
        }else{
          goToPrevTag(indexCurrent) // shouldStopPropagation = true; // otherwise onContainerKeyDown() will also call goToPrevTag()
        }
        
      }
      break
    case 'ArrowRight':
      // Allow normal cursor movement in text inputs - don't prevent default for text editing
      if (tagFocused.value && tagFocused.value.type === 'tag_input' && tagFocused.value.text.length > 0) {
        // Let browser handle cursor movement in contenteditable input with text
        return; // Don't preventDefault, don't stopPropagation
      }
      
      event.preventDefault()
      if (event.shiftKey) {
        // Shift+Right: activate input span after current tag
        if (tagFocused.value && tagFocused.value.type === 'tag') {
          const indexCurrent = tagsExist.value.findIndex(item => item === tagFocused.value)
          activateInputAfter(indexCurrent, event)
        }
      } else {
        goToNextTag(indexCurrent)
      }
      break
    case 'Backspace':
    case 'Delete':
      if (tagFocused.value && tagFocused.value.type === 'tag') {
        event.preventDefault()
        deleteTagCurrent(indexCurrent)
      }
      break
    default:
      return; // keep propagation
  }
  event.stopPropagation();
}

const goToPrevTag = (index) => {

  if (tagFocused.value && tagFocused.value.type === 'tag_input') {
    // From input, move to previous tag if exists
    const indexTagPrev = findPrevTag(index)
    if (indexTagPrev !== -1) {
      // Hide this input span when navigating away (unless it's the last one)
      if (!tagFocused.value.is_last) {
        tagFocused.value.is_show = false
      }
      focusOnTag(tagsExist.value[indexTagPrev])
    }
  } else if (tagFocused.value && tagFocused.value.type === 'tag') {
    // From tag, find previous tag
    const indexTagPrev = findPrevTag(index)
    if (indexTagPrev !== -1) {
      focusOnTag(tagsExist.value[indexTagPrev])
    }
    // If at first tag, stay there
  }
}

const goToNextTag = (index) => {
  if (tagFocused.value && tagFocused.value.type === 'tag') {
    // From tag, find next tag or last input
    const tagIndexNext = findNextTag(index)
    if (tagIndexNext !== -1) {
      focusOnTag(tagsExist.value[tagIndexNext])
    } else {
      // Move to last input
      const indexLastInput = findTagInputLastIndex()
      if (indexLastInput !== -1) {
        focusOnTagInput(indexLastInput)
      }
    }
  }
  // If on input, do nothing
}

const deleteTagCurrent = (index) => {
  if (index !== -1 && tagFocused.value.type === 'tag' && props.allowUserEdit && !isLocked.value) {
    const tag = tagsExist.value[index]
    deleteTag(tag, index)
  }
}

const highlightSearchMatch = (text, searchTerm) => {
  if (!searchTerm) return text
  const regex = new RegExp(`(${searchTerm})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

// activation function for shift+left
const activateInputBefore = (tagIndex, event) => {
  event.preventDefault()
  event.stopPropagation()
  
  // Find the input span before this tag
  const inputIndex = tagIndex - 1
  if (inputIndex >= 0 && tagsExist.value[inputIndex] && tagsExist.value[inputIndex].type === 'tag_input') {
    // Show and activate the input
    tagsExist.value[inputIndex].is_show = true
    tagFocused.value = tagsExist.value[inputIndex]
    
    nextTick(() => {
      if (tagInputFieldRefs.value[inputIndex]) {
        tagInputFieldRefs.value[inputIndex].focus()
        // Set initial width to exactly 100px
        setInputSpanWidth(inputIndex, 100)
        // Update width based on current content
        updateInputWidth(inputIndex, tagsExist.value[inputIndex].text || '')
      }
    })
  }
}

// activation function for shift+right
const activateInputAfter = (tagIndex, event) => {
  if(event){
    event.preventDefault()
    event.stopPropagation()
  }
  
  // Find the input span after this tag
  const inputIndex = tagIndex + 1
  if (inputIndex < tagsExist.value.length && tagsExist.value[inputIndex] && tagsExist.value[inputIndex].type === 'tag_input') {
    // Show and activate the input
    tagsExist.value[inputIndex].is_show = true
    tagFocused.value = tagsExist.value[inputIndex]
    
    nextTick(() => {
      if (tagInputFieldRefs.value[inputIndex]) {
        tagInputFieldRefs.value[inputIndex].focus()
        // Set initial width to exactly 100px
        setInputSpanWidth(inputIndex, 100)
        // Update width based on current content
        updateInputWidth(inputIndex, tagsExist.value[inputIndex].text || '')
      }
    })
  }
}

const deactivateTagInput = (tagInputIndex, tagInput, except_last = false) => {
  // console.log('TagsInput.vue: deactivateTagInput(). tagInputIndex:', tagInputIndex, 'tagInput:', tagInput)
  if(!tagInput){
    if(tagInputIndex >= tagsExist.value.length ){
      console.warn(`TagsInput.vue: deactivateTagInput() - tagInputIndex: ${tagInputIndex} exceeds ${tagsExist.value.length}, returning`)
      return;
    }
    tagInput = tagsExist.value[tagInputIndex]
  }else{
    if(tagInput.type !== 'tag_input'){
      console.warn(`TagsInput.vue: deactivateTagInput() - tagInput.type: ${tagInput.type} is not tag_input, returning`)
      return;
    }
    tagInputIndex = tagsExist.value.findIndex(item => item === tagInput)
  }
  // console.log('TagsInput.vue: deactivateTagInput(). tagInputIndex:', tagInputIndex, 'tagInput:', tagInput)
  if (tagInput && tagInput.type === 'tag_input') {
    // console.error('TagsInput.vue: deactivateTagInput(). tagInput.is_last:', tagInput.is_last, 'except_last:', except_last, 'is_show:', tagInput.is_show)
    if(!tagInput.is_last || except_last){
      // console.log("    about to deactivate tagInput")
      tagInput.is_show = false
      nextTick(() => {
        setInputSpanWidth(tagInputIndex, 10)

      })
    }else{
      tagInput.is_show = true
    }
    tagInput.text = ''
  }
}

const onTagClick = (event, item) => {
  // Don't process click if it was actually a drag operation
  if (isDragOperation.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  
  focusOnTag(item)
}

// Drag event wrappers with debugging
const onSimpleDragStart = (event, tag, index) => {  
  if (!props.allowDrag) {
    console.log('TagsInput.vue: onSimpleDragStart() - dragging not allowed, preventing')
    event.preventDefault()
    return false
  }
  
  console.log('TagsInput.vue: onSimpleDragStart() - calling onDragStart')
  return onDragStart(event, tag, index)
}


// Drag and drop event handlers - WORKING: Only reactive updates, NO document listeners
const onDragStart = (event, tag, index) => {
  console.log('TagsInput.vue: onDragStart() WORKING - Only reactive updates', {
    tag: tag.name,
    index: index
  })
  
  // Prevent parent interference
  event.stopPropagation()
  
  // Record start time (this is reactive but seems safe)
  dragStartTime.value = Date.now()
  
  // Browser setup
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', tag.name)
  
  console.log('TagsInput.vue: onDragStart() WORKING - browser setup complete')
  
  // Reactive updates work fine!
  isDragOperation.value = true
  tagDragged.value = tag
  tagDraggedIndex.value = index
  indexClosest.value = -1
  
  console.log('TagsInput.vue: onDragStart() WORKING - reactive updates done, NO document listeners')
  

  if (drag_track_method === 'dragover') {
    // APPROACH 1: Document dragover listener (COMMENTED OUT for now)
    setTimeout(() => {
      document.addEventListener('dragover', onDocumentDragOver)
      console.log('TagsInput.vue: onDragStart() - document dragover listener added for distance calculation')
    }, 10)
  }
  else if (drag_track_method === 'timer') {
    // APPROACH 2: Timer-based mouse tracking (TESTING - let's try other ways to get mouse position)
    // Start timer to calculate closest drop zone every drag_track_interval_ms
    dragTrackingInterval = setInterval(() => {
      // console.log('TagsInput.vue: timer tick - mousePosCurrent:', mousePosCurrent)
      if (isDragOperation.value) {
        // Get current mouse position from stored value
        if (mousePosCurrent.x !== undefined && mousePosCurrent.y !== undefined) {
          calcNearestDropZone(mousePosCurrent.x, mousePosCurrent.y)
        }
      }
    }, drag_track_interval_ms)
    // browser does not support query mouse position subjectively.
    setTimeout(() => {
      document.addEventListener('dragover', onContainerDragOver)
      console.log('TagsInput.vue: onDragStart() - container dragover listener added to track mouse')
    }, 10)
  }else{
    console.error('TagsInput.vue: onDragStart() - invalid drag_track_method:', drag_track_method)
  }
  
  console.log('TagsInput.vue: onDragStart() - timer-based approach with container dragover')
}

const onSimpleDragEnd = (event) => {
  console.log('TagsInput.vue: onSimpleDragEnd() called!', {
    allowDrag: props.allowDrag,
    event: event,
    eventTarget: event.target,
    currentTarget: event.currentTarget
  })
  
  if (!props.allowDrag) {
    return false
  }
  
  console.log('TagsInput.vue: onSimpleDragEnd() - calling onDragEnd')
  return onDragEnd(event)
}

const onDragEnd = () => {
  const dragDuration = Date.now() - (dragStartTime.value || Date.now())
  console.log('TagsInput.vue: onDragEnd() WORKING - drag lasted:', dragDuration, 'ms')
  
  // Clean up throttle timer
  if (dragOverThrottleTimer) {
    clearTimeout(dragOverThrottleTimer)
    dragOverThrottleTimer = null
  }
  
  // Perform reordering if needed
  performTagReorder()
  
  // MINIMAL cleanup - only non-reactive state that's safe
  dragStartTime.value = 0  // Even this might be too much
  isDragOperation.value = false
  
  // Fix: Restore width for is_last input span after drag ends
  nextTick(() => {
    const indexLastInput = findTagInputLastIndex()
    if (indexLastInput !== -1) {
      const inputElement = tagInputFieldRefs.value[indexLastInput]
      if (inputElement) {
        const parentSpan = inputElement.closest('.tag-input-span')
        if (parentSpan) {
          // Remove any explicit width styles to restore flex: 1 behavior
          parentSpan.style.width = ''
          parentSpan.style.minWidth = ''
          parentSpan.style.maxWidth = ''
          parentSpan.style.flex = '1'
          console.log('TagsInput.vue: onDragEnd() - restored is_last input span width')
        }
      }
    }
  })

  if (drag_track_method === 'dragover') {
    // APPROACH 1: Clean up document dragover listener (COMMENTED OUT)
    // Clean up document listener
    document.removeEventListener('dragover', onDocumentDragOver)
  } else if (drag_track_method === 'timer') {
    if (dragTrackingInterval) {
      clearInterval(dragTrackingInterval)
      dragTrackingInterval = null
    }
    document.removeEventListener('dragover', onContainerDragOver)
  } else {
    console.error('TagsInput.vue: onDragEnd() - invalid drag_track_method:', drag_track_method)
  }

  // Don't touch ANY other Vue reactive state during onDragEnd
  console.log('TagsInput.vue: onDragEnd() WORKING - minimal cleanup complete')
}

const onDocumentDragOver = (event) => {
  if (!isDragOperation.value) return
  event.preventDefault()
  
  // Always store latest mouse position
  mousePosLatest.x = event.clientX
  mousePosLatest.y = event.clientY
  
  // Throttle calcNearestDropZone calls
  if (!dragOverThrottleTimer) {
    // First call - execute immediately and start timer
    calcNearestDropZone(event.clientX, event.clientY)
    // dragOverThrottleTimer = setTimeout(() => {
    //   // Timer expired - call with latest position if we have one
    //   if (mousePosLatest.x !== undefined && mousePosLatest.y !== undefined) {
    //     calcNearestDropZone(mousePosLatest.x, mousePosLatest.y)
    //   }
    //   dragOverThrottleTimer = null
    // }, drag_track_interval_ms)
  }
  // If timer is running, just store position and wait
}

const onContainerDragOver = (event) => {
  if (!isDragOperation.value) return
  event.preventDefault()
  mousePosCurrent.x = event.clientX
  mousePosCurrent.y = event.clientY
  calcNearestDropZone(event.clientX, event.clientY)
}

// will not be triggered during drag
// const onGlobalMouseMove = (event) => {
//   mousePosCurrent.x = event.clientX
//   mousePosCurrent.y = event.clientY
// }

const calcNearestDropZone = (mouseX, mouseY) => {
  let _indexClosest = -1
  let distNearest = Infinity
  // console.log('TagsInput.vue: calcNearestDropZone()', mouseX, mouseY)

  tagsExist.value.forEach((item, index) => {
    if (item.type === 'tag_input') {
      // Use tagInputSpanRefs instead of document.querySelector for more reliable coordinates
      const inputSpan = tagInputSpanRefs.value[index]
      // console.log(`TagsInput.vue: Checking input span ${index}:`, {
      //   item: item,
      //   element: inputSpan,
      //   hasElement: !!inputSpan
      // })
      
      if (inputSpan) {
        const rect = inputSpan.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const distance = Math.abs(mouseX - centerX)
        console.error("mouseX:", mouseX, "centerX:", centerX, "distance:", distance, 'drag_track_method:', drag_track_method)  
        // console.log(`TagsInput.vue: Input span ${index} - rect:`, rect, 'distance:', distance)
        
        if (distance < distNearest) {
          distNearest = distance
          _indexClosest = index
        }
      }
    }
  })
  
  // console.log('TagsInput.vue: calcNearestDropZone() distNearest:', distNearest, '_indexClosest:', _indexClosest)
  indexClosest.value = _indexClosest
  // console.log('TagsInput.vue: calcNearestDropZone() setting indexClosest to:', _indexClosest)
}

const performTagReorder = () => {
  // console.log('TagsInput.vue: performTagReorder() called. tagDraggedIndex.value:', tagDraggedIndex.value, 'indexClosest.value:', indexClosest.value)
  if (!tagDragged.value || tagDraggedIndex.value === -1 || indexClosest.value === -1) {
    console.log('TagsInput.vue: performTagReorder() - no valid drag data, skipping')
    indexClosest.value = -1
    return
  }
  // Calculate target insertion position in terms of actual tags (not tagsExist index)
  let indexTagTarget = 0
  for (let i = 0; i < indexClosest.value; i++) {
    if (tagsExist.value[i].type === 'tag') {
      indexTagTarget++
    }
  }
  // Calculate current tag position
  let indexTagCurrent = 0
  for (let i = 0; i < tagDraggedIndex.value; i++) {
    if (tagsExist.value[i].type === 'tag') {
      indexTagCurrent++
    }
  }
  // console.log('TagsInput.vue: performTagReorder() indexTagCurrent:', indexTagCurrent, 'indexTagTarget:', indexTagTarget)
  // Don't do anything if dropping in the same position
  if (indexTagCurrent === indexTagTarget || indexTagCurrent === indexTagTarget - 1) {
    console.log('TagsInput.vue: performTagReorder() - same position, no reordering needed')
    indexClosest.value = -1
    return
  }
  // console.log("props.emitOnEdit: ", props.emitOnEdit, "tagDragged.value: ", tagDragged.value)
  // Handle based on emitOnEdit prop
  if (props.emitOnEdit) {
    if(!tagDragged.value.id){
      console.error('TagsInput.vue: performTagReorder() - tagDragged.value.id is undefined')
      return
    }

    // Emit to parent and wait for approval
    if (props.lockOnTagModify) {
      isLocked.value = true
    }
      emit('tagReorder', {
        tag: tagDragged.value,
        indexOld: indexTagCurrent,
        indexNew: indexTagTarget
      }, (approved, error) => {
        if (approved) {
          executeTagReorder(indexTagCurrent, indexTagTarget)
          emit('tagUpdate', tagsActual.value)
          tagError.value = null // clear any previous errors
        } else {
          const errorMsg = error || 'Failed to reorder tag'
          tagError.value = errorMsg
          console.warn('TagsInput.vue: performTagReorder() - parent rejected reorder:', errorMsg)
        }
      
      if (props.lockOnTagModify) {
        isLocked.value = false
      }
      indexClosest.value = -1
    })
  } else {
    // Direct reordering without parent approval
    executeTagReorder(indexTagCurrent, indexTagTarget)
    indexClosest.value = -1
  }
}

const executeTagReorder = (indexTagCurrent, indexTagTarget) => {
  // console.log('TagsInput.vue: executeTagReorder() moving tag from', indexTagCurrent, 'to', indexTagTarget)

  // Move the tag in the tagsExist array
  const itemDragged = tagsExist.value[tagDraggedIndex.value]
  const spanDragged = tagsExist.value[tagDraggedIndex.value - 1]

  let indexInsertion = 0
  let tagCount = 0
  for (let i = 0; i < tagsExist.value.length; i++) {
    if (tagsExist.value[i].type === 'tag') {
      if (tagCount === indexTagTarget) {
        indexInsertion = i
        break
      }
      tagCount++
    }
    indexInsertion ++;
  }
  indexInsertion -= 1; // insert before the input before the target tag

  if(indexTagCurrent < indexTagTarget){
    // Find the new insertion point in tagsExist
    tagsExist.value.splice(indexInsertion, 0, itemDragged)
    tagsExist.value.splice(indexInsertion, 0, spanDragged)
    deactivateTagInput(indexInsertion)

    tagsExist.value.splice(tagDraggedIndex.value, 1) // remove the tag
    tagsExist.value.splice(tagDraggedIndex.value - 1, 1) // remove the input span before the tag
  }else if(indexTagTarget < indexTagCurrent){
    // Move the tag in the tagsExist array
    tagsExist.value.splice(tagDraggedIndex.value, 1) // remove the tag
    tagsExist.value.splice(tagDraggedIndex.value - 1, 1) // remove the input span before the tag
    
    tagsExist.value.splice(indexInsertion, 0, itemDragged)
    tagsExist.value.splice(indexInsertion, 0, spanDragged)
    deactivateTagInput(indexInsertion)
  }
  // console.log('TagsInput.vue: executeTagReorder() completed')
}

// Public methods for parent component
const submitUpdate = () => {
  emit('tagUpdate', tagsActual.value)
}

// Expose methods for parent
defineExpose({
  submitUpdate,
  tagsExist: tagsActual, // Expose only actual tags
  focusOnTagInput,
  focusOnTag,
  isSearchingTags,
  clearTagInput
})
</script>

<style>
/* CSS Custom Properties - must be unscoped to work properly */
:root {  
  --tags-container-height: 36px;           /* Total container height */
  --tags-container-padding: 4px;           /* Container padding (top/right/bottom/left) */
}
</style>

<style scoped>
/* some common styles shared across components are in base.css */

.tags-input-container {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  height: var(--tags-container-height);
}

.tags-input-container.is-drag {
  cursor: grabbing;
}

.tags-input-container.locked {
  opacity: 0.7;
  pointer-events: none;
}

.tags-input-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0px;
  padding: var(--tags-container-padding);
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  height: 100%;
  box-sizing: border-box;
  align-items: center;
}

.tag-input-span {
  position: relative; /* Required for absolute positioned children */
  background-color: transparent;
  transition: all 0.2s ease;
  align-self: stretch;
  box-sizing: border-box;
  border: none;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  border-radius: 3px;
}

.tag-input-span.is-last:not(.is-drag){
  flex: 1 !important; /* Allow final input to grow and fill remaining space */
}

.tag-input-span.is-drag > .tag-input-field {
  visibility: hidden;
}

.tag-input-span.is-last:not(.is-drag):not(.is-first){
  margin-left: 10px !important;
}


.tag-input-span.is-drag.is-last {
  width: 10px !important;
  min-width: 10px !important; /* Override JavaScript-set minWidth */
  max-width: 10px !important; /* Ensure it stays at 10px */
}

.tag-input-span.is-show {
  width: 100px; /* Start with exactly 100px */
  margin: 0 2px; /* Add small margins for better spacing */
}

.tag-input-span.is-drag {
  width: 10px !important;
  min-width: 10px !important; /* Override JavaScript-set minWidth */
  max-width: 10px !important; /* Ensure it stays at 10px */
  background-color: #dcfce7; /* very light blue */
  opacity: 1 !important;
}

.tag-input-span.is-closest-during-drag.is-drag {
  background-color: #3b82f6 !important; /* Blue background for closest */
  z-index: 10 !important;
}

.tag-input-span.is-first:not(.is-show) {
  margin-left: -10px;
}


.input-focused {
  box-shadow: 0 0 0 1px rgba(26, 115, 232, 0.5);
  outline: none;
}

.tag-input-field.is-drag {
  box-shadow: none !important;
}


.tag-input-between.is-drag.is-closest-during-drag .drop-zone-debug {
  color: white !important;
}

.tag-input-between.is-drag.is-closest-during-drag {
  background-color: #3b82f6 !important;
}

/* Tag styling improvements - SIMPLIFIED */
.tag-selected {
  align-self: stretch;
  transition: all 0.2s ease;
}

.tag-selected[draggable="true"] {
  cursor: grab;
}

.tag-selected[draggable="true"]:active {
  cursor: grabbing;
}

.tag-selected.dragging {
  opacity: 0.5;
}

/* Loading and error states for tags */
.tag-selected.tag-loading {
  background: linear-gradient(90deg, #f0f9ff, #e0f2fe);
  border-color: #0ea5e9;
  opacity: 0.8;
}

.tag-selected.tag-load-fail {
  background: linear-gradient(90deg, #fef2f2, #fee2e2);
  border-color: #ef4444;
  opacity: 0.9;
}

.tag-status-corner {
  position: absolute;
  top: 1px;
  right: 3px;
  font-size: 8px;
  font-weight: bold;
  background-color: #fff;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 1;
}

.tag-status-corner.loading {
  color: #0ea5e9;
  animation: spin 1s linear infinite;
}

.tag-status-corner.fail {
  color: #ef4444;
  background-color: #fee2e2;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Tag operation error banner */
.tag-error-banner {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fee2e2;
  border: 1px solid #ef4444;
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #dc2626;
  z-index: 999;
}

.tag-error-banner .error-icon {
  font-size: 14px;
}

.tag-error-banner .error-message {
  flex: 1;
}

.tag-error-banner .error-dismiss {
  background: none;
  border: none;
  color: #dc2626;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag-error-banner .error-dismiss:hover {
  background: #fca5a5;
  border-radius: 50%;
}

.tag-input-hidden {
  /* Hidden state for input fields that aren't currently shown */
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}


.tag-input-wrapper {
  /* Absolute positioning to fill parent span completely */
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  
  /* Flex container for centering the input field */
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  box-sizing: border-box;
}

.tag-input-field {
  /* Normal flow element inside flex container - much simpler! */
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #5f6368;
  
  /* Let the flex container handle sizing and positioning */
  flex: 1;
  min-width: 0; /* Allow shrinking */
  
  /* Proper cursor behavior */
  white-space: nowrap;
  word-break: keep-all;
  
  /* Remove any explicit height - let content determine height naturally */
  line-height: 1.5;
}

.tag-input-field:empty[data-placeholder]:not(:focus)::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  font-style: italic;
  pointer-events: none;
  /* Placeholder styling for the new flex-based layout */
  display: inline-block;
  text-align: left;
}

.tag-input-hidden:focus,
.tag-input-field:focus {
  outline: none;
}

.tag-suggestions-panel {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  min-width: 200px;
  margin-top: 2px;
}

.tag-search-loading {
  padding: 12px;
  text-align: center;
  border-bottom: 1px solid #f3f4f6;
}

.loading-text {
  color: #6b7280;
  font-size: 12px;
  font-style: italic;
}

.tag-item-search {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-item-search:hover {
  background-color: #f8fafc;
}

.tag-item-search.selected-suggestion {
  background-color: #e3f2fd;
  border-left: 3px solid #1976d2;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tag-item-search.already-added {
  background-color: #f5f5f5;
  opacity: 0.7;
  border-left: 3px solid #10b981;
}

.tag-item-search.already-added:hover {
  background-color: #e8f5e8;
  cursor: default;
}

.tag-item-search.already-added.selected-suggestion {
  background-color: #e8f5e8;
  border-left: 3px solid #10b981;
  opacity: 0.9;
}

.tag-item-search:last-child {
  border-bottom: none;
}

.indicator-already-added {
  position: absolute;
  top: 1px;
  right: 3px;
  font-size: 8px;
  color: #10b981;
  background-color: rgba(16, 185, 129, 0.1);
  padding: 0px 2px;
  border-radius: 6px;
  line-height: 1.1;
  min-width: 0;
  z-index: 1;
  font-weight: 600;
}

:deep(mark) {
  background-color: #fef3c7;
  color: #92400e;
  padding: 0;
  font-weight: 600;
}

.tag-no-results {
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.tag-no-results-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-no-results-text {
  color: #6b7280;
  font-size: 12px;
  font-style: italic;
}

.tag-create-new {
  padding: 8px;
  border-radius: 4px;
  background-color: #f8fafc;
  border: 1px dashed #cbd5e0;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tag-create-new:hover {
  background-color: #e8f4f8;
  border-color: #38bdf8;
}

.tag-create-new span {
  font-size: 12px;
  color: #4b5563;
}

/* Focus states */
.tag-keyboard-focused {
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.5) !important;
  outline: none;
}

</style>
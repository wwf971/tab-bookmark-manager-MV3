import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTagsEdit = defineStore('tagsEdit', () => {
  // State
  const showModal = ref(false)
  const tab = ref(null)
  const tagsInit = ref([])
  const renameMode = ref(false)
  const tagToRename = ref(null)


  const openTagsEdit = (tabData, _tagsInit = []) => {
    tab.value = tabData
    // console.log('TagsEdit.js: openTagsEdit(): _tagsInit:', _tagsInit)
    tagsInit.value = _tagsInit
    renameMode.value = false
    tagToRename.value = null
    showModal.value = true
  }
  const openTagsRename = (tagData, dummyTabData = null) => {
    // If no tab data provided, create a dummy tab for rename-only mode
    tab.value = dummyTabData || {
      id: 'dummy',
      title: 'Tag Rename',
      url: '',
      icon: ''
    }
    tagsInit.value = []
    renameMode.value = true
    tagToRename.value = tagData
    showModal.value = true
  }
  
  const closeTagsEdit = () => {
    showModal.value = false
    tab.value = null
    tagsInit.value = []
    renameMode.value = false
    tagToRename.value = null
  }
  
  return {
    // State
    showModal,
    tab,
    tagsInit,
    renameMode,
    tagToRename,
    
    // Actions
    openTagsEdit,
    openTagsRename,
    closeTagsEdit
  }
}) 
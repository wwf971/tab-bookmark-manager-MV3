import { ref, computed } from 'vue'

export function useTabDisplay() {
  // Display options state
  const showIcon = ref(true)
  const showTitle = ref(true)
  const showUrl = ref(true)
  const columnsPerRow = ref(2) // 1, 2, 3, or 4
  const useResponsiveGrid = ref(false) // Toggle between fixed columns and responsive auto-fit
  
  // Display mode state
  const displayMode = ref('TabsBased') // 'TabsBased' or 'WindowsBased'
  const overviewIconMode = ref('all') // 'all' or 'limited'
  const overviewIconSize = ref(20) // Icon size in pixels (12-48)

  // Computed styles using CSS Grid
  const gridTemplateColumns = computed(() => {
    if (useResponsiveGrid.value) {
      // Auto-fit approach: automatically adjusts columns based on minimum item width
      return `repeat(auto-fit, minmax(${minItemWidth.value}, 1fr))`
    } else {
      // Fixed columns approach: user-controlled number of columns
      return `repeat(${columnsPerRow.value}, 1fr)`
    }
  })


  const minItemWidth = computed(() => {
    // Minimum width for each grid item to prevent them from becoming too small
    switch (columnsPerRow.value) {
      case 1: return '300px'
      case 2: return '250px'
      case 3: return '200px'
      case 4: return '180px'
      default: return '250px'
    }
  })

  // Toggle functions
  const toggleIcon = () => {
    showIcon.value = !showIcon.value
  }

  const toggleTitle = () => {
    showTitle.value = !showTitle.value
  }

  const toggleUrl = () => {
    showUrl.value = !showUrl.value
  }

  const setColumns = (columns) => {
    if (columns >= 1 && columns <= 4) {
      columnsPerRow.value = columns
      useResponsiveGrid.value = false // Switch to fixed columns mode
    }
  }

  const toggleResponsiveGrid = () => {
    useResponsiveGrid.value = !useResponsiveGrid.value
  }

  // Display mode functions
  const setDisplayMode = (mode) => {
    if (mode === 'TabsBased' || mode === 'WindowsBased') {
      displayMode.value = mode
    }
  }

  const setOverviewIconMode = (mode) => {
    if (mode === 'all' || mode === 'limited') {
      overviewIconMode.value = mode
    }
  }

  const setIconSize = (size) => {
    if (size >= 12 && size <= 48) {
      overviewIconSize.value = size
    }
  }

  const increaseIconSize = () => {
    if (overviewIconSize.value < 48) {
      overviewIconSize.value += 2
    }
  }

  const decreaseIconSize = () => {
    if (overviewIconSize.value > 12) {
      overviewIconSize.value -= 2
    }
  }

  const resetIconSize = () => {
    overviewIconSize.value = 20
  }

  const validateIconSize = () => {
    if (overviewIconSize.value < 12) {
      overviewIconSize.value = 12
    } else if (overviewIconSize.value > 48) {
      overviewIconSize.value = 48
    }
  }

  // Reset to defaults
  const resetToDefaults = () => {
    showIcon.value = true
    showTitle.value = true
    showUrl.value = true
    columnsPerRow.value = 2
    useResponsiveGrid.value = false
    displayMode.value = 'TabsBased'
    overviewIconMode.value = 'all'
    overviewIconSize.value = 20
  }

  return {
    // State
    showIcon,
    showTitle,
    showUrl,
    columnsPerRow,
    useResponsiveGrid,
    displayMode,
    overviewIconMode,
    overviewIconSize,
    
    // Computed
    gridTemplateColumns,
    minItemWidth,
    
    // Methods
    toggleIcon,
    toggleTitle,
    toggleUrl,
    setColumns,
    toggleResponsiveGrid,
    setDisplayMode,
    setOverviewIconMode,
    setIconSize,
    increaseIconSize,
    decreaseIconSize,
    resetIconSize,
    validateIconSize,
    resetToDefaults
  }
} 
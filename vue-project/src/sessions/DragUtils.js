class TabDragManager {
  constructor() {
    this.dragState = {
      isDragging: false,
      draggedTab: null,
      draggedTabElement: null,
      sourceWindow: null,
      currentDropPosition: null,
      dropIndicator: null,
      gridInfo: null
    }
    this.dragMoveTimeout = null // throttling for drag move events
  }

  onDragStart(tabElement, tabData, windowId) {
    // called when a tab card starts to be dragged
    // calculate grid, so that we can calculate the 

    const gridContainer = tabElement.closest('.tab-grid')
    if (!gridContainer) return false
    
    // calculate grid information
    const gridInfo = this.calcGridInfo(gridContainer)
    if (!gridInfo) return false
    
    // set up drag state
    this.dragState.isDragging = true
    this.dragState.draggedTab = tabData
    this.dragState.draggedTabElement = tabElement
    this.dragState.sourceWindow = windowId
    this.dragState.gridInfo = gridInfo
    this.dragState.currentDropPosition = null
    
    // add visual feedback to dragged element
    tabElement.style.opacity = '0.5'
    return true
  }

  handleDragMove(event) {
    if (!this.dragState.isDragging) return  
    
    // throttle drag move events to max 60fps (16ms)
    if (this.dragMoveTimeout) return
    
    this.dragMoveTimeout = setTimeout(() => {
      this.dragMoveTimeout = null
      this._processDragMove(event)
    }, 16) // 16ms = 60fps
  }
  
  _processDragMove(event) {
    console.log("TabDragManager: _processDragMove()")
    const gridContainer = this.dragState.draggedTabElement?.closest('.tab-grid')
    if (!gridContainer) return
    
    // Calculate drop position
    const dropPosition = this.calcDropPos(
      event.clientX,
      event.clientY,
      this.dragState.gridInfo,
      gridContainer
    )
    
    this.dragState.currentDropPosition = dropPosition
    
    // Show drop indicator
    if (dropPosition) {
      this.showDropIndicator(dropPosition.indicatorPosition, gridContainer)
    } else {
      this.hideDropIndicator()
    }
  }

  calcGridInfo(gridContainer) {
    const tabs = gridContainer.querySelectorAll('[data-tab-id]')
    if (tabs.length < 2) return null

    const firstTab = tabs[0]
    const secondTab = tabs[1]
    
    const firstRect = firstTab.getBoundingClientRect()
    const secondRect = secondTab.getBoundingClientRect()
    const containerRect = gridContainer.getBoundingClientRect()
    
    // calculate tab dimensions
    const tabWidth = firstRect.width
    const tabHeight = firstRect.height
    
    // calculate grid gap by checking distance between tabs
    let gridGap = 0
    if (secondRect.top === firstRect.top) {
      // same row - calculate horizontal gap
      gridGap = secondRect.left - firstRect.right
    } else {
      // different row - check with next tab in same row if exists
      for (let i = 2; i < tabs.length; i++) {
        const thirdRect = tabs[i].getBoundingClientRect()
        if (thirdRect.top === secondRect.top) {
          gridGap = thirdRect.left - secondRect.right
          break
        }
      }
    }

    // calculate number of columns by checking how many tabs fit in first row
    let columnsPerRow = 1
    const firstRowY = firstRect.top
    for (let i = 1; i < tabs.length; i++) {
      const rect = tabs[i].getBoundingClientRect()
      if (Math.abs(rect.top - firstRowY) < 5) { // 5px tolerance
        columnsPerRow++
      } else {
        break
      }
    }
    
    const firstTabOffset = {
      x: firstRect.left - containerRect.left,
      y: firstRect.top - containerRect.top
    }
    
    console.log("TabDragManager: calcGridInfo()")
    console.log("    tabWidth:", tabWidth)
    console.log("    tabHeight:", tabHeight)
    console.log("    gridGap:", gridGap)
    console.log("    columnsPerRow:", columnsPerRow)
    console.log("    containerRect:", containerRect)
    console.log("    firstTabOffset:", firstTabOffset)
    
    return {
      tabWidth,
      tabHeight,
      gridGap,
      columnsPerRow,
      containerRect,
      firstTabOffset
    }
  }

  calcDropPos(mouseX, mouseY, gridInfo, gridContainer) {
    if (!gridInfo) return null

    const { tabWidth, tabHeight, gridGap, columnsPerRow, containerRect, firstTabOffset } = gridInfo
    
    // convert mouse coordinates to container-relative coordinates
    const relativeX = mouseX - containerRect.left
    const relativeY = mouseY - containerRect.top
    
    
    // calculate which row and column the mouse is in
    const rowHeight = tabHeight + gridGap
    const colWidth = tabWidth + gridGap
    
    // account for the first tab offset
    const adjustedX = relativeX - firstTabOffset.x
    const adjustedY = relativeY - firstTabOffset.y

    console.warn("TabDragManager: calcDropPos(). adjustedX:", adjustedX, "adjustedY:", adjustedY)
    
    // calculate row and column indices
    let rowIndex = Math.floor(adjustedY / rowHeight)
    if(rowIndex < 0) rowIndex = 0
    
    let colIndexFloat = adjustedX / colWidth
    let colIndex = null;
    // intuitive ui behavior for dragging to insert
    if(colIndexFloat - Math.floor(colIndexFloat) > 0.65) {
      colIndex = Math.floor(colIndexFloat) + 1
    } else {
      colIndex = Math.floor(colIndexFloat)
    }
    if(colIndex < 0) colIndex = 0
    
    // Ensure we don't exceed the available columns
    const actualColIndex = Math.min(colIndex, columnsPerRow - 1)
    
    // Get all tabs to determine actual tab count
    const tabs = gridContainer.querySelectorAll('[data-tab-id]')
    const maxIndex = tabs.length
    
    // Calculate the linear index (closest tab to mouse)
    const linearIndex = rowIndex * columnsPerRow + actualColIndex
    
    // targetIndex is simply the closest tab index
    let targetIndex = Math.min(linearIndex, maxIndex - 1)
    
    // Check if mouse is beyond the last tab (insert after last tab)
    const lastTabIndex = maxIndex - 1
    const lastTabRow = Math.floor(lastTabIndex / columnsPerRow)
    const lastTabCol = lastTabIndex % columnsPerRow
    
    const isInsertAfterLast = (rowIndex > lastTabRow) || 
                             (rowIndex === lastTabRow && colIndex > lastTabCol + 0.5)
    
    console.log("TabDragManager: calcDropPos().",
      "rowIndex:", rowIndex, "colIndex:", colIndex,
      "targetIndex:", targetIndex, "isInsertAfterLast:", isInsertAfterLast
    )
    
    // calculate the visual indicator position
    let indicatorX, indicatorY
    
    if (isInsertAfterLast) {
      // Insert after the last tab - show indicator at right edge of last tab
      const lastRowIndex = Math.floor(lastTabIndex / columnsPerRow)
      const lastColIndex = lastTabIndex % columnsPerRow
      
      indicatorX = firstTabOffset.x + (lastColIndex + 1) * colWidth
      indicatorY = firstTabOffset.y + lastRowIndex * rowHeight
      targetIndex = maxIndex // Insert at end
    } else {
      // Normal case - show indicator at left edge of closest tab
      const targetRowIndex = Math.floor(targetIndex / columnsPerRow)
      const targetColIndex = targetIndex % columnsPerRow
      
      indicatorX = firstTabOffset.x + targetColIndex * colWidth
      indicatorY = firstTabOffset.y + targetRowIndex * rowHeight
    }
    
    return {
      targetIndex,
      indicatorPosition: {
        x: indicatorX,
        y: indicatorY,
        height: tabHeight
      },
      rowIndex,
      colIndex: actualColIndex
    }
  }

  showDropIndicator(position, container) {
    // Remove existing indicator
    this.hideDropIndicator()
    
    if (!position) return
    
    // Create indicator element
    const indicator = document.createElement('div')
    indicator.className = 'drag-drop-indicator'
    indicator.style.cssText = `
      position: absolute;
      left: ${position.x}px;
      top: ${position.y}px;
      width: 3px;
      height: ${position.height}px;
      background-color: #1a73e8;
      border-radius: 2px;
      z-index: 1000;
      pointer-events: none;
      box-shadow: 0 0 4px rgba(26, 115, 232, 0.5);
    `
    
    container.appendChild(indicator)
    this.dragState.dropIndicator = indicator
  }

  hideDropIndicator() {
    if (this.dragState.dropIndicator) {
      try {
        this.dragState.dropIndicator.remove()
      } catch (error) {
        // Element might already be removed
      }
      this.dragState.dropIndicator = null
    }
    
    // Also remove any orphaned indicators (safety cleanup)
    const orphanedIndicators = document.querySelectorAll('.drag-drop-indicator')
    orphanedIndicators.forEach(indicator => {
      try {
        indicator.remove()
      } catch (error) {
        // Element might already be removed
      }
    })
  }

  async handleDragEnd(event) {
    console.warn('TabDragManager: handleDragEnd()')

    if (!this.dragState.isDragging) {
      this.cleanupDrag() // always cleanup even if not in dragging state
      return false
    }
    
    let success = false
    
    try {
      const dropPosition = this.dragState.currentDropPosition
      if (dropPosition && this.dragState.draggedTab && this.dragState.sourceWindow) {
        const targetIndex = dropPosition.targetIndex
        const tabId = this.dragState.draggedTab.id
        // move the tab using Chrome API
        await chrome.tabs.move(tabId, {
          windowId: this.dragState.sourceWindow,
          index: targetIndex
        })
        
        success = true
      }
    } catch (error) {
      console.error('Error moving tab:', error)
    }
    // always clean up drag state, regardless of success/failure
    this.cleanupDrag()
    return success
  }

  cleanupDrag() {
    console.warn('TabDragManager: cleanupDrag()')
    // Hide drop indicator first (most important for the bug fix)
    this.hideDropIndicator()
    
    // Clear any pending drag move timeout
    if (this.dragMoveTimeout) {
      clearTimeout(this.dragMoveTimeout)
      this.dragMoveTimeout = null
    }
    
    // Remove visual feedback from dragged element
    if (this.dragState.draggedTabElement) {
      this.dragState.draggedTabElement.style.opacity = ''
    }
    
    // Reset all drag state
    this.dragState.isDragging = false
    this.dragState.draggedTab = null
    this.dragState.draggedTabElement = null
    this.dragState.sourceWindow = null
    this.dragState.currentDropPosition = null
    this.dragState.gridInfo = null
  }

  isDragging() {
    return this.dragState.isDragging
  }

  getDragInfo() {
    return { ...this.dragState }
  }
}

export { TabDragManager }
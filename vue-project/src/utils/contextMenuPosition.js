/**
 * Calculates optimal position for context menu based on mouse event and container constraints
 * 
 * Usage Examples:
 * 
 * // For scrollable grids (search results, remote tabs)
 * const { x, y } = calculateContextMenuPos({
 *   event,
 *   containerSelector: '.search-results-grid',
 *   scrollContainerSelector: '.search-results-grid',
 *   contextMenuRef,
 *   accountForScroll: true
 * })
 * 
 * // For non-scrollable panels (open tabs)
 * const { x, y } = calculateContextMenuPos({
 *   event,
 *   containerSelector: '.tabs-panel',
 *   scrollContainerSelector: '.windows-container',
 *   contextMenuRef,
 *   accountForScroll: false
 * })
 * 
 * @param {Object} options - Configuration object
 * @param {MouseEvent} options.event - The mouse event (right-click)
 * @param {string} options.containerSelector - CSS selector for the positioning container
 * @param {string} options.scrollContainerSelector - CSS selector for the scroll container
 * @param {Object} options.contextMenuRef - Vue ref to the context menu component (optional)
 * @param {number} options.defaultMenuWidth - Default menu width if ref not available (default: 180)
 * @param {number} options.defaultMenuHeight - Default menu height if ref not available (default: 150)
 * @param {boolean} options.accountForScroll - Whether to account for scroll offset (default: true)
 * @returns {Object} - { x, y } coordinates for positioning the menu
 */
export function calculateContextMenuPos({
  event,
  containerSelector,
  scrollContainerSelector,
  contextMenuRef = null,
  defaultMenuWidth = 180,
  defaultMenuHeight = 150,
  accountForScroll = false
}) {
  // Get the container elements
  const container = event.currentTarget.closest(containerSelector)
  const scrollContainer = scrollContainerSelector ? 
    event.currentTarget.closest(scrollContainerSelector) : 
    container
  
  console.log('calculateContextMenuPos(): container:', container)
  console.log('calculateContextMenuPos(): scrollContainer:', scrollContainer)

  if (!container) {
    console.warn('Context menu container not found')
    return { x: event.clientX, y: event.clientY }
  }

  // Get container bounds
  const containerRect = container.getBoundingClientRect()
  const scrollContainerRect = scrollContainer.getBoundingClientRect()

  // Calculate initial position relative to container
  let x = event.clientX - containerRect.left
  let y = event.clientY - containerRect.top

  // Account for scroll offset if requested
  if (accountForScroll && scrollContainer !== container) {
    x += scrollContainer.scrollLeft
    y += scrollContainer.scrollTop
  }

  console.log('calculateContextMenuPos(): scrollContainer.scrollLeft:', scrollContainer.scrollLeft)
  console.log('calculateContextMenuPos(): scrollContainer.scrollTop :', scrollContainer.scrollTop)
  console.log('calculateContextMenuPos(): containerRect.left:', containerRect.left)
  console.log('calculateContextMenuPos(): containerRect.top:', containerRect.top)
  console.log('calculateContextMenuPos(): event.clientX:', event.clientX)
  console.log('calculateContextMenuPos(): event.clientY:', event.clientY)
  console.log('calculateContextMenuPos(): x:', x)
  console.log('calculateContextMenuPos(): y:', y)
    
  return { x: x, y: y }

  // Get menu dimensions
  let menuWidth = defaultMenuWidth
  let menuHeight = defaultMenuHeight

  // Try to get actual menu dimensions if ref is available
  if (contextMenuRef?.value) {
    // Handle both direct element refs and component refs with exposed menuElement
    const menuElement = contextMenuRef.value.menuElement || contextMenuRef.value
    if (menuElement && menuElement.offsetWidth && menuElement.offsetHeight) {
      menuWidth = menuElement.offsetWidth
      menuHeight = menuElement.offsetHeight
    }
  }

  // Adjust position to keep menu within bounds
  let adjustedX = x
  let adjustedY = y

  if (accountForScroll && scrollContainer !== container) {
    // For scrollable containers, use visible area calculations
    const visibleAreaRight = scrollContainer.scrollLeft + containerRect.width
    const visibleAreaBottom = scrollContainer.scrollTop + containerRect.height

    if (x + menuWidth > visibleAreaRight) {
      adjustedX = Math.max(scrollContainer.scrollLeft, visibleAreaRight - menuWidth)
    }

    if (y + menuHeight > visibleAreaBottom) {
      adjustedY = Math.max(scrollContainer.scrollTop, visibleAreaBottom - menuHeight)
    }
  } else {
    // For non-scrollable containers, use viewport bounds
    if (event.clientX + menuWidth > scrollContainerRect.width + scrollContainerRect.left) {
      adjustedX = x - menuWidth
    }

    if (event.clientY + menuHeight > scrollContainerRect.height + scrollContainerRect.top) {
      adjustedY = y - menuHeight
    }
  }

  return { x: adjustedX, y: adjustedY }
} 

// unified scroll detection for search mode
const getVisibleSessionGroup = (searchState) => {
  if (!searchState.value.isSearchActive) return null
  if (typeof document === 'undefined') return null
  
  const scrollContainer = document.querySelector('.content-body')
  if (!scrollContainer) return null
  
  const containerRect = scrollContainer.getBoundingClientRect()
  
  // Find session group headers using data attributes (more reliable than text content)
  const openTabsHeader = document.querySelector('[data-session-group="open"]')
  const remoteTabsHeader = document.querySelector('[data-session-group="remote"]')
  
  const sessionGroupList = [
    [remoteTabsHeader, 'remote'],
    [openTabsHeader, 'open'], 
  ]
  let sessionGroupNameCurrent = sessionGroupList[1][1];
  let isSessionGroupFound = false;
  sessionGroupList.forEach(([header, groupName]) => {
    if (header) {
      const rect = header.getBoundingClientRect()
      if (rect.top <= containerRect.top) { // rect's top is above the scroll container's top
        if (!isSessionGroupFound) {
          sessionGroupNameCurrent = groupName;
          isSessionGroupFound = true;
        }
      }
    }
  })
  return sessionGroupNameCurrent;
}

// in search mode only.
const getVisibleSessionAreaId = (searchState) => {
  if (!searchState.value.isSearchActive) return null
  if (typeof document === 'undefined') return null
  
  const scrollContainer = document.querySelector('.content-body')
  if (!scrollContainer) return null
  
  const containerRect = scrollContainer.getBoundingClientRect()
  
  // Find all session containers (windows and remote sessions)
  const windowContainers = document.querySelectorAll('.window-container[data-window-id]')
  const sessionContainers = document.querySelectorAll('.list-container[data-session-id]')
  
  let sessionAreaId = null
  let minDistance = Infinity
  
  // check window(open session) containers
  windowContainers.forEach(container => {
    const rect = container.getBoundingClientRect()
    if (rect.top <= containerRect.top + 50) { // 50px tolerance
      const distance = containerRect.top - rect.top
      if (distance < minDistance) {
        minDistance = distance
        sessionAreaId = {
          type: 'open',
          id: parseInt(container.dataset.windowId)
        }
      }
    }
  })
  
  // check remote session containers
  sessionContainers.forEach(container => {
    const rect = container.getBoundingClientRect()
    if (rect.top <= containerRect.top + 50) { // 50px tolerance
      const distance = containerRect.top - rect.top
      if (distance < minDistance) {
        minDistance = distance
        sessionAreaId = {
          type: 'remote',
          id: container.dataset.sessionId
        }
      }
    }
  })
  
  return sessionAreaId;
}

const onUnifiedScrollEvent = ({
  scrollEventTimeout, 
  searchState, 
  sessionGroupNameCurrent, 
  sessionCardIdCurrent,
  getSessionCardId,
  isScrollReportPaused
}) => {
  if (!searchState.value.isSearchActive) return
  if (isScrollReportPaused.value) return
  
  // throttle scroll events to max 0.1s frequency
  if (scrollEventTimeout.value) return
  
  scrollEventTimeout.value = setTimeout(() => {
    const sessionGroupNameNew = getVisibleSessionGroup(searchState)
    const newVisibleSession = getVisibleSessionAreaId(searchState)
    
    let hasChanged = false
    
    // check if session group has changed
    if (sessionGroupNameNew && sessionGroupNameNew !== sessionGroupNameCurrent.value) {
      console.log('TabsMainWindow: Session group focus changed from', sessionGroupNameCurrent.value, 'to', sessionGroupNameNew)
      sessionGroupNameCurrent.value = sessionGroupNameNew
      hasChanged = true
    }
    
    // update session card if changed
    if (newVisibleSession) {
      let newSessionCardId
      if (newVisibleSession.type === 'open') {
        newSessionCardId = getSessionCardId(newVisibleSession.id)
      } else if (newVisibleSession.type === 'remote') {
        newSessionCardId = `remote-${newVisibleSession.id}`
      }
      
      if (newSessionCardId && newSessionCardId !== sessionCardIdCurrent.value) {
        console.log('TabsMainWindow: Session card focus changed from', sessionCardIdCurrent.value, 'to', newSessionCardId)
        sessionCardIdCurrent.value = newSessionCardId
        hasChanged = true
      }
    }
    scrollEventTimeout.value = null
  }, 100) // 0.1s = 100ms
}


export {
  getVisibleSessionGroup,
  getVisibleSessionAreaId,
  onUnifiedScrollEvent
}
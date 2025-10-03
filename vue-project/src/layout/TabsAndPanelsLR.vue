<template>
  <div class="tabs-and-panels-lr">
    <!-- Left Sidebar: Tabs -->
    <div class="sidebar" :style="{ width: sidebarWidth }">
      <!-- Header -->
      <div class="sidebar-header">
        <h3>{{ title }}</h3>
      </div>
      
      <!-- Tab List -->
      <div class="tabs-container">
        <div v-for="tab in tabsData" :key="tab.id" class="tab-wrapper">
          <!-- Main Tab -->
          <div class="tab-item">
            <!-- Expand/Collapse Button (only if has subtabs) -->
            <button
              v-if="tab.hasSubtabs"
              @click.stop="onToggleExpand(tab.id)"
              class="expand-btn"
            >
              <span 
                class="expand-icon"
                :class="{ 'expanded': tab.isExpanded }"
              >
                ▶
              </span>
            </button>
            
            <!-- Tab Button -->
            <button
              @click="onTabChange(tab.id)"
              class="tab-btn"
              :class="{ 
                'active': tabActive === tab.id,
                'no-expand': !tab.hasSubtabs
              }"
            >
              {{ tab.label }}
            </button>
          </div>
          
          <!-- Subtabs (if expanded) -->
          <div v-if="tab.hasSubtabs && tab.isExpanded" class="subtabs-container">
            <button
              v-for="subtab in tab.subtabs"
              :key="subtab.id"
              @click="onSubTabChange(subtab.id)"
              class="subtab-btn"
              :class="{ 'active': subtabActive === subtab.id }"
            >
              {{ subtab.label }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="sidebar-footer">
        Active: {{ getActiveLabel() }}
      </div>
    </div>

    <!-- Right Panel: Content -->
    <div class="content-panel">
      <!-- Render panels based on active tab/subtab and their display method -->
      <template v-for="panel in panelsData" :key="panel.id">
        <component
          :is="'div'"
          v-if="panel.vueDisplayMethod === 'v-if' && isActivePanel(panel.id)"
          class="panel-content"
        >
          <component :is="panel.component" v-bind="panel.props" />
        </component>
        <component
          :is="'div'"
          v-show="panel.vueDisplayMethod === 'v-show' && isActivePanel(panel.id)"
          class="panel-content"
        >
          <component :is="panel.component" v-bind="panel.props" />
        </component>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, useSlots, watchEffect } from 'vue'

// Define slot components for comparison
const TabSlot = { name: 'TabSlot' }
const SubTabSlot = { name: 'SubTabSlot' }  
const PanelSlot = { name: 'PanelSlot' }

const props = defineProps({
  title: {
    type: String,
    default: 'Navigation'
  },
  defaultTab: {
    type: String,
    default: null
  },
  defaultSubtab: {
    type: String,
    default: null
  },
  sidebarWidth: {
    type: String,
    default: '200px'
  }
})

const emit = defineEmits(['tab-change', 'subtab-change'])
const slots = useSlots()

// reactive state
const tabActive = ref(null)
const subtabActive = ref(null)
const tabsExpanded = ref(new Set())

// extract tab/subtab/panel configuration from slots
const extractConfig = () => {
  const tabsData = []
  const panelsData = []
  
  if (slots.default) {
    const children = slots.default()
    
    children.forEach((child) => {
      // Check if this is a TabSlot by looking at the component type
      if (child.type === TabSlot || child.type?.name === 'TabSlot') {
        const tabProps = child.props || {}
        const tabId = tabProps.id
        const tabLabel = tabProps.label
        const hasSubtabs = tabProps.hasSubtabs || false
        const vueDisplayMethod = tabProps.vueDisplayMethod || 'v-show'
        
        const subtabsData = []
        
        if (hasSubtabs && child.children?.default) {
          const subtabChildren = child.children.default()
          
          subtabChildren.forEach(subtabChild => {
            if (subtabChild.type === SubTabSlot || subtabChild.type?.name === 'SubTabSlot') {
              const subtabProps = subtabChild.props || {}
              const subtabId = subtabProps.id
              const subtabLabel = subtabProps.label
              const subtabDisplayMethod = subtabProps.vueDisplayMethod || 'v-show'
              
              subtabsData.push({
                id: subtabId,
                label: subtabLabel,
                vueDisplayMethod: subtabDisplayMethod
              })
              
              // extract panel from subtab
              if (subtabChild.children?.default) {
                const panelChildren = subtabChild.children.default()
                panelChildren.forEach(panelChild => {
                  if (panelChild.type === PanelSlot || panelChild.type?.name === 'PanelSlot') {
                    // Extract the actual component from the slot
                    const panelContent = panelChild.children?.default?.()
                    
                    panelsData.push({
                      id: subtabId,
                      component: panelContent?.[0],
                      props: panelChild.props || {},
                      vueDisplayMethod: subtabDisplayMethod
                    })
                  }
                })
              }
            }
          })
        } else {
          // tab without subtabs - extract panel directly
          if (child.children?.default) {
            const panelChildren = child.children.default()
            
            panelChildren.forEach(panelChild => {
              if (panelChild.type === PanelSlot || panelChild.type?.name === 'PanelSlot') {
                // Extract the actual component from the slot
                const panelContent = panelChild.children?.default?.()
                
                panelsData.push({
                  id: tabId,
                  component: panelContent?.[0],
                  props: panelChild.props || {},
                  vueDisplayMethod: vueDisplayMethod
                })
              }
            })
          }
        }
        
        tabsData.push({
          id: tabId,
          label: tabLabel,
          hasSubtabs: hasSubtabs,
          subtabs: subtabsData,
          vueDisplayMethod: vueDisplayMethod,
          isExpanded: tabsExpanded.value.has(tabId)
        })
      }
    })
  }
  
  console.log('TabsAndPanelsLR: Extracted', tabsData.length, 'tabs and', panelsData.length, 'panels')
  
  return { tabsData, panelsData }
}

// computed - make it reactive
const configData = computed(() => extractConfig())
const tabsData = computed(() => configData.value.tabsData)
const panelsData = computed(() => configData.value.panelsData)

// methods
const isActivePanel = (panelId) => {
  if (subtabActive.value) {
    return subtabActive.value === panelId
  }
  return tabActive.value === panelId
}

const onTabChange = (tabId) => {
  const tab = tabsData.value.find(t => t.id === tabId)
  if (!tab) return
  
  tabActive.value = tabId
  
  if (tab.hasSubtabs) {
    // if tab has subtabs, expand it and set first subtab as active
    if (!tabsExpanded.value.has(tabId)) {
      tabsExpanded.value.add(tabId)
    }
    if (tab.subtabs && tab.subtabs.length > 0) {
      subtabActive.value = tab.subtabs[0].id
      emit('subtab-change', tab.subtabs[0].id)
    }
  } else {
    // if tab has no subtabs, clear subtab and emit tab change
    subtabActive.value = null
    emit('tab-change', tabId)
  }
}

const onSubTabChange = (subtabId) => {
  subtabActive.value = subtabId
  emit('subtab-change', subtabId)
}

const onToggleExpand = (tabId) => {
  if (tabsExpanded.value.has(tabId)) {
    tabsExpanded.value.delete(tabId)
    // if collapsing active tab, clear subtab
    if (tabActive.value === tabId) {
      subtabActive.value = null
    }
  } else {
    tabsExpanded.value.add(tabId)
    // if expanding active tab, set first subtab as active
    if (tabActive.value === tabId) {
      const tab = tabsData.value.find(t => t.id === tabId)
      if (tab && tab.subtabs && tab.subtabs.length > 0) {
        subtabActive.value = tab.subtabs[0].id
        emit('subtab-change', tab.subtabs[0].id)
      }
    }
  }
}

const getActiveLabel = () => {
  if (subtabActive.value) {
    const activeTab = tabsData.value.find(t => t.subtabs?.some(s => s.id === subtabActive.value))
    const activeSubtab = activeTab?.subtabs?.find(s => s.id === subtabActive.value)
    return activeSubtab?.label || 'None'
  }
  if (tabActive.value) {
    const tab = tabsData.value.find(t => t.id === tabActive.value)
    return tab?.label || 'None'
  }
  return 'None'
}

// initialize default values
const initDefaults = () => {
  const defaultTabId = props.defaultTab || tabsData.value[0]?.id
  if (defaultTabId) {
    const defaultTab = tabsData.value.find(t => t.id === defaultTabId)
    if (defaultTab) {
      tabActive.value = defaultTabId
      
      if (defaultTab.hasSubtabs) {
        tabsExpanded.value.add(defaultTabId)
        const defaultSubtabId = props.defaultSubtab || defaultTab.subtabs?.[0]?.id
        if (defaultSubtabId) {
          subtabActive.value = defaultSubtabId
        }
      }
    }
  }
}

// initialize on mount - use watchEffect to wait for data to be available
watchEffect(() => {
  if (tabsData.value.length > 0 && !tabActive.value) {
    initDefaults()
  }
})

// expose methods for parent components
defineExpose({
  tabActive,
  subtabActive,
  switchToTab: onTabChange,
  switchToSubtab: onSubTabChange
})
</script>

<style scoped>
.tabs-and-panels-lr {
  display: flex;
  height: 100vh;
  font-family: Arial, sans-serif;
}

.sidebar {
  background-color: #f8f9fa;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 6px 12px;
  border-bottom: 1px solid #dee2e6;
  background-color: #e9ecef;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  color: #495057;
}

.tabs-container {
  flex: 1;
  padding: 0;
}

.tab-wrapper {
  width: 100%;
}

.tab-item {
  display: flex;
  align-items: center;
  width: 100%;
}

.expand-btn {
  width: 20px;
  height: 20px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #6c757d;
  transition: transform 0.2s ease;
  padding: 0;
}

.expand-icon {
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.tab-btn {
  flex: 1;
  padding: 4px;
  padding-left: 0px;
  border: none;
  border-right: 1px solid transparent;
  background-color: transparent;
  color: #495057;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  font-weight: normal;
  transition: all 0.2s ease;
}

.tab-btn.no-expand {
  padding-left: 4px;
}

.tab-btn:hover {
  background-color: #e9ecef;
}

.tab-btn.active {
  border-right: 4px solid #007bff;
  background-color: #f8f9fa;
  color: #007bff;
  font-weight: bold;
}

.subtabs-container {
  display: flex;
  flex-direction: column;
}

.subtab-btn {
  width: 100%;
  padding: 6px 20px;
  border: none;
  border-right: 1px solid transparent;
  background-color: transparent;
  color: #6c757d;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.subtab-btn:hover {
  background-color: #e9ecef;
}

.subtab-btn.active {
  border-right: 3px solid #28a745;
  background-color: #f1f3f4;
  color: #28a745;
}

.sidebar-footer {
  padding: 8px 12px;
  border-top: 1px solid #dee2e6;
  font-size: 12px;
  color: #6c757d;
}

.content-panel {
  flex: 1;
  overflow: auto;
}

.panel-content {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

<script>
// slot components for declarative API
export const TabSlot = {
  name: 'TabSlot',
  props: {
    id: String,
    label: String,
    hasSubtabs: {
      type: Boolean,
      default: false
    },
    vueDisplayMethod: {
      type: String,
      default: 'v-show'
    }
  },
  render() {
    return null // this component is used for configuration only
  }
}

export const SubTabSlot = {
  name: 'SubTabSlot',
  props: {
    id: String,
    label: String,
    vueDisplayMethod: {
      type: String,
      default: 'v-show'
    }
  },
  render() {
    return null // this component is used for configuration only
  }
}

export const PanelSlot = {
  name: 'PanelSlot',
  render() {
    return null // this component is used for configuration only
  }
}
</script>


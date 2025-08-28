<template>
    <div>hello world</div>
    <div v-for="child in ChildList" :key="child.id">
			<component 
				v-for="item in items" 
				:key="item.id"
				:is="toComponentName[item.type]"
				:data="item"
			/>
    </div>
    
    <!-- External Message Testing -->
    <div style="margin-top: 20px; padding: 16px; background: #f0f8ff; border: 1px solid #0066cc; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; color: #0066cc;">Extension Communication Test</h3>
        <button 
            @click="sendHelloMessage"
            :disabled="communicateStore.isMessageSending"
            style="
                padding: 8px 16px; 
                background: #0066cc; 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer;
                font-size: 14px;
                margin-right: 12px;
            "
        >
            {{ communicateStore.isMessageSending ? 'Sending...' : 'Send Hello to SingleFile Extension' }}
        </button>
        <span v-if="communicateStore.lastMessageResult" :style="{ color: communicateStore.lastMessageResult.success ? '#28a745' : '#dc3545' }">
            {{ communicateStore.lastMessageResult.message }}
        </span>
    </div>

</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
const props = defineProps({
	'noteId': {
		type: String,
		required: true,
	},
})

const toComponentName = {
	'rem': 'Rem',
	'image': 'Image',
	'video': 'Video',
}
import { useNoteStore } from '@/network/Note'
import { useCommunicateStore } from '@/network/Communicate'

const noteStore = useNoteStore()
const communicateStore = useCommunicateStore()

onMounted(() => {
    if(props.noteId){
		noteData.value = noteStore.fetchNoteForEdit(props.noteId)[props.noteId]
    }
})

const noteData = ref(null)

const childDict = computed(() => {
	return noteData.value.child_dict
})
// ChildDict[id] contains child data
const childList = computed(() => {
	return noteData.value.child_list
})
// order and indent of children
// each element by {id, indent}

const childRefs = ref([])

const hasEdited = ref(false)

const sendHelloMessage = async () => {
    try {
        console.log("=== NOTE: Attempting to send hello message to SingleFile extension")
        
        const content = `Hello from Note component! Sent at ${new Date().toISOString()}`
        const additionalData = {
            noteId: props.noteId
        }
        
        await communicateStore.sendHelloMessage(content, additionalData)
        
    } catch (error) {
        console.error("=== NOTE: Error sending message:", error)
    }
}

const addChild = (childType) => {
    // generate random id for child
    const childId = 1; // 11 chars, 0-9 and a-z
    const childData = {'type': childType}

    // add child to ChildList
    childList.value.push({id: childId, indent: 0})
    // add child to ChildDict
    childDict.value[childId] = {id: childId, indent: 0}
    // add child to ChildRefs
    childRefs.value.push(childId)

}

</script>





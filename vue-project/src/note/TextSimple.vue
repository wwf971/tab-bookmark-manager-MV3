<template>


    <span>{{ text }}</span>
</template>

<script setup>
import { ref } from 'vue'
defineProps({
    'NoteData': {
        type: String,
        required: false,
        default: '',
    },
    'isDebugMode': {
        type: Boolean,
        required: false,
        default: false,
    },
})

const text = ref(props.text);
const isDebugMode = ref(false);

onMounted(() => {
    isDebugMode.value = props.isDebugMode;
})

const isCursorOnLeftEnd = ref(false);
const isCursorOnRightEnd = ref(false);

defineEmits([
    'keyOnLeftEnd',
    'keyOnRightEnd',
]);

// keyboard events
const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
        isCursorOnLeftEnd.value = true;
    }
}


</script>
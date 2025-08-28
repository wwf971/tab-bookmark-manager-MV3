



<script setup>


const props = defineProps({
  notesOpenId: {
    type: Array,
    required: true
  }
})

const notesOpenId = props.notesOpenId;
const displayAxis = ref('column')
    // if column: note tabs are from top to bottom
    // if row:    note tabs are from left to right

defineEmits([
    'update:notes-open-id',
])


</script>
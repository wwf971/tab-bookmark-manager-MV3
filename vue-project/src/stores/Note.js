import { defineStore } from 'pinia'
import { useNetworkRequest } from './NetworkRequest'
import { ref, computed, reactive, watch } from 'vue'
import { cloneDeep } from 'lodash'
export const useNoteStore = defineStore('note', () => {
	// Get NetworkRequest store for making API calls
	const networkRequest = useNetworkRequest()
	const cacheNotes = ref({})
	const cacheNotesEdited = ref({})

	// each note is a dict, with 'id', 'type', other attributes
	const updateCacheNotes = (notes=[]) => {
		notes.forEach(note => {
			cacheNotes.value[note.id] = note
		})
	}

	const fetchNotes = async (ids=[], use_cache=true) => {
		const notes = {}
		ids.forEach(async (id) => {
			if(use_cache){
			// check if note is already in cache
				if(cacheNotes.value[id]){
					notes[id] = cacheNotes.value[id]
				}
			}

			// fetch from remote server
			const response = await getNoteById(id)
			if(response.status === 200){
				let note = response.data;
				notes[id] = note
				updateCacheNotes([note])
			}else{
				console.error(`Note.js fetchNotes(): Failed to fetch note ${id}: ${response.status}`)
				console.trace()
			}
		})
		return notes
	}

	const fetchNoteForEdit = async (id) => {
		const notes = await fetchNotes([id], false)
		if(notes[id]){
			// deep copy
			cacheNotesEdited.value[id] = cloneDeep(notes[id]);
			return cacheNotesEdited.value[id];
		}else{
			console.error(`Note.js fetchNoteForEdit(): Failed to fetch note ${id}`)
			return null;
		}
	}

	// network request methods
	const searchNote = async (text, is_fuzzy=false) => {
		const post_dict = {
			task: 'search_note',
			text: text
		}
		if(is_fuzzy){
			post_dict.is_fuzzy = is_fuzzy
		}
		const response = await networkRequest.post('/note/', post_dict)
		return response
	}

	const getRecentNote = async (num = 5, type = 'set') => {
		const response = await networkRequest.post('/note/', {
			task: 'get_recent_note',
			num: num,
			type: type
		})
		return response
	}

	const getNoteById = async (id) => {
		const response = await networkRequest.post('/note/', {
			task: 'get_note_by_id',
			id: id
		})
		return response
	}

	const addTextSimple = async (text) => {
		const response = await networkRequest.post('/note/', {
			task: 'add_text_simple',
			text: text
		})
		return response
	}

	const addTitleContent = async (title, content) => {
		const response = await networkRequest.post('/note/', {
			task: 'add_title_content',
			title: title,
			content: content
		})
		return response
	}

	const addKeyValue = async (key, value) => {
		const response = await networkRequest.post('/note/', {
			task: 'add_key_value',
			key: key,
			value: value
		})
		return response
	}

	const addSet = async (name, children = {}) => {
		const response = await networkRequest.post('/note/', {
			task: 'create_set',
			name: name,
			children: children
		})
		return response
	}

	const updateNote = async (id, updateDict) => {
		const response = await networkRequest.post('/note/', {
			task: 'update_note',
			id: id,
			update_dict: updateDict
		})
		return response
	}

	const deleteNote = async (id) => {
		const response = await networkRequest.post('/note/', {
			task: 'delete_note',
			id: id
		})
		return response
	}

	const renameSet = async (id, nameNew) => {
		const response = await networkRequest.post('/note/', {
			task: 'rename_set',
			id: id,
			name_new: nameNew
		})
		return response
	}

	const searchSet = async (name) => {
		const response = await networkRequest.post('/note/', {
			task: 'search_set',
			name: name
		})
		return response
	}

	const addNoteToSet = async (noteId, setId, roleStr = '', roleId = null) => {
		const response = await networkRequest.post('/note/', {
			task: 'add_note_to_set',
			id: noteId,
			set_id: setId,
			role_str: roleStr,
			role_id: roleId
		})
		return response
	}

	const removeNoteFromSet = async (noteId, setId) => {
		const response = await networkRequest.post('/note/', {
			task: 'remove_note_from_set',
			id: noteId,
			set_id: setId
		})
		return response
	}

	const updateNoteRoleInSet = async (noteId, setId, roleStr, roleId) => {
		const response = await networkRequest.post('/note/', {
			task: 'update_note_role_in_set',
			id: noteId,
			set_id: setId,
			role_str: roleStr,
			role_id: roleId
		})
		return response
	}

	// File API methods
	const getFileInfo = async (fileId) => {
		const response = await networkRequest.post('/file/', {
			task: 'get_file_info',
			file_id: fileId
		})
		return response
	}

	const getFileBytes = async (fileId) => {
		const response = await networkRequest.post('/file/', {
			task: 'get_file_bytes',
			file_id: fileId
		})
		return response
	}

	const uploadFile = async (fileBytes, fileName, timeZone) => {
		const response = await networkRequest.post('/file/', {
			task: 'upload_file',
			file_bytes: fileBytes,
			file_name: fileName,
			time_zone: timeZone
		})
		return response
	}

	const deleteFile = async (fileId) => {
		const response = await networkRequest.post('/file/', {
			task: 'delete_file',
			file_id: fileId
		})
		return response
	}

	// Tag management API methods
	const setTagsForNote = async (noteId, tagsName = [], tagsId = []) => {
		const response = await networkRequest.post('/note/', {
			task: 'set_tags_for_note',
			id: noteId,
			tags_name: tagsName,
			tags_id: tagsId
		})
		return response
	}

	const addTagsToNote = async (noteId, tagsName = [], tagsId = []) => {
		const response = await networkRequest.post('/note/', {
			task: 'add_tags_to_note',
			id: noteId,
			tags_name: tagsName,
			tags_id: tagsId
		})
		return response
	}

	const addTagToNoteAtPos = async (noteId, tagId, tagIndex) => {
		const response = await networkRequest.post('/note/', {
			task: 'add_tag_to_note',
			id: noteId,
			tag_id: tagId,
			tag_index: tagIndex
		})
		return response
	}

	const removeTagsFromNote = async (noteId, tagsName = [], tagsId = []) => {
		const response = await networkRequest.post('/note/', {
			task: 'remove_tags_from_note',
			id: noteId,
			tags_name: tagsName,
			tags_id: tagsId
		})
		return response
	}

	const changeTagOrderForNote = async (noteId, tagId, indexNew) => {
		const response = await networkRequest.post('/note/', {
			task: 'change_tag_order_for_note',
			id: noteId,
			tag_id: tagId,
			index_new: indexNew
		})
		return response
	}
	return {
		// Note API
		searchNote,
		getRecentNote,
		getNoteById,
		addTextSimple,
		addTitleContent,
		addKeyValue,
		addSet,
		updateNote,
		deleteNote,
		renameSet,
		searchSet,
		addNoteToSet,
		removeNoteFromSet,
		updateNoteRoleInSet,
		fetchNotes,
		fetchNoteForEdit,

		// File API
		getFileInfo,
		getFileBytes,
		uploadFile,
		deleteFile,
		
		// Tag management API
		setTagsForNote,
		addTagsToNote,
		addTagToNoteAtPos,
		removeTagsFromNote,
		changeTagOrderForNote
	}
})

import { defineStore } from 'pinia'
import { useNetworkRequest } from './NetworkRequest'

export const useBibliographyStore = defineStore('bibliography', () => {
    // Get NetworkRequest store for making API calls
    const networkRequest = useNetworkRequest()

    // Bibliography API methods
    const getAllBib = async () => {
        const response = await networkRequest.post('/bib', {
            task: 'get_all_bib'
        })
        return response
    }

    const addBib = async (name, bibtex, url = null) => {
        const postDict = {
            task: 'add_bib',
            name: name,
            bibtex: bibtex
        }
        if (url !== null) {
            postDict.url = url
        }
        const response = await networkRequest.post('/bib', postDict)
        return response
    }

    const removeBib = async (name) => {
        const response = await networkRequest.post('/bib', {
            task: 'remove_bib',
            name: name
        })
        return response
    }

    const getBib = async (name) => {
        const response = await networkRequest.post('/bib', {
            task: 'get_bib',
            name: name
        })
        return response
    }

    const updateBibtex = async (name, bibtex) => {
        const response = await networkRequest.post('/bib', {
            task: 'update_bibtex',
            name: name,
            bibtex: bibtex
        })
        return response
    }

    const renameBib = async (name, nameNew) => {
        const response = await networkRequest.post('/bib', {
            task: 'rename_bib',
            name: name,
            name_new: nameNew
        })
        return response
    }

    const appendName = async (name, nameNew) => {
        const response = await networkRequest.post('/bib', {
            task: 'append_name',
            name: name,
            name_new: nameNew
        })
        return response
    }

    const removeName = async (name) => {
        const response = await networkRequest.post('/bib', {
            task: 'remove_name',
            name: name
        })
        return response
    }

    const getMetadata = async (name) => {
        const response = await networkRequest.post('/bib', {
            task: 'get_metadata',
            name: name,
            style: 'plain'
        })
        return response
    }

    const getCitation = async (name, style = 'plain') => {
        const response = await networkRequest.post('/bib', {
            task: 'get_citation',
            name: name,
            style: style
        })
        return response
    }

    return {
        // Bibliography API
        getAllBib,
        addBib,
        removeBib,
        getBib,
        updateBibtex,
        renameBib,
        appendName,
        removeName,
        getMetadata,
        getCitation
    }
})
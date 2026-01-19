/**
 * NeuroStudy Capture - API Module
 * 
 * Comunicação com a API do NeuroStudy
 */

import { getToken } from './auth.js';

const API_BASE = 'https://neurostudy.com.br/api';

/**
 * Faz requisição autenticada para a API
 */
async function fetchWithAuth(path, options = {}) {
    const token = await getToken();

    if (!token) {
        throw new Error('Não autenticado');
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        if (response.status === 403 && error.error === 'premium_required') {
            throw new Error('Feature exclusiva para planos Pro/Plus');
        }

        throw new Error(error.message || `Erro ${response.status}`);
    }

    return response.json();
}

/**
 * Busca pastas do usuário
 */
export async function getFolders() {
    try {
        const response = await fetchWithAuth('/extension/folders');
        return response.folders || [];
    } catch (error) {
        console.error('Erro ao buscar pastas:', error);
        throw error;
    }
}

/**
 * Busca estudos de uma pasta
 */
export async function getStudies(folderId) {
    try {
        const response = await fetchWithAuth(`/extension/studies?folderId=${folderId}`);
        return response.studies || [];
    } catch (error) {
        console.error('Erro ao buscar estudos:', error);
        throw error;
    }
}

/**
 * Envia transcrição para um estudo
 */
export async function sendTranscript(studyId, transcript, options = {}) {
    try {
        const response = await fetchWithAuth('/extension/capture', {
            method: 'POST',
            body: JSON.stringify({
                studyId,
                transcript,
                isPrimary: options.isPrimary || false,
                videoTitle: options.videoTitle,
                videoUrl: options.videoUrl
            })
        });

        return response;
    } catch (error) {
        console.error('Erro ao enviar transcrição:', error);
        throw error;
    }
}

/**
 * Cria um novo estudo e envia a transcrição
 */
export async function createStudyWithTranscript(folderId, title, transcript, options = {}) {
    try {
        const response = await fetchWithAuth('/extension/create-and-capture', {
            method: 'POST',
            body: JSON.stringify({
                folderId,
                title,
                transcript,
                videoTitle: options.videoTitle,
                videoUrl: options.videoUrl
            })
        });

        return response;
    } catch (error) {
        console.error('Erro ao criar estudo:', error);
        throw error;
    }
}

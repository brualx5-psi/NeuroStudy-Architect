/**
 * NeuroStudy Capture - Popup Logic
 * 
 * Gerencia estados do popup e comunicação com:
 * - Content script (extração de legendas)
 * - Background worker (autenticação)
 * - API NeuroStudy (envio de fontes)
 */

import { login, logout, getAuthState, checkPlanAccess } from '../lib/auth.js';
import { sendTranscript, getFolders, getStudies } from '../lib/api.js';

// Estado global
let currentTranscript = null;
let currentPlatform = null;
let currentVideoInfo = null;

// Elementos DOM
const elements = {
    loadingState: null,
    loginState: null,
    upgradeState: null,
    captureState: null,
    loginBtn: null,
    logoutBtn: null,
    sendBtn: null,
    userEmail: null,
    detectionStatus: null,
    detectionIcon: null,
    detectionText: null,
    captureForm: null,
    folderSelect: null,
    studySelect: null,
    primarySource: null,
    statusMessage: null
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Cache de elementos DOM
    elements.loadingState = document.getElementById('loading-state');
    elements.loginState = document.getElementById('login-state');
    elements.upgradeState = document.getElementById('upgrade-state');
    elements.captureState = document.getElementById('capture-state');
    elements.loginBtn = document.getElementById('login-btn');
    elements.logoutBtn = document.getElementById('logout-btn');
    elements.sendBtn = document.getElementById('send-btn');
    elements.userEmail = document.getElementById('user-email');
    elements.detectionStatus = document.getElementById('detection-status');
    elements.detectionIcon = document.getElementById('detection-icon');
    elements.detectionText = document.getElementById('detection-text');
    elements.captureForm = document.getElementById('capture-form');
    elements.folderSelect = document.getElementById('folder-select');
    elements.studySelect = document.getElementById('study-select');
    elements.primarySource = document.getElementById('primary-source');
    elements.statusMessage = document.getElementById('status-message');

    // Event listeners
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.sendBtn.addEventListener('click', handleSend);
    elements.folderSelect.addEventListener('change', handleFolderChange);

    // Inicializar estado
    await initializeState();
});

/**
 * Inicializa o estado do popup baseado na autenticação
 */
async function initializeState() {
    try {
        const authState = await getAuthState();

        if (!authState.isAuthenticated) {
            showState('login');
            return;
        }

        // Verificar se é plano pago
        const hasAccess = await checkPlanAccess();

        if (!hasAccess) {
            showState('upgrade');
            return;
        }

        // Usuário autenticado e com plano válido
        showState('capture');
        elements.userEmail.textContent = authState.user?.email || 'Usuário';

        await loadUserData();
        await checkCurrentPage();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        showState('login');
    }
}

/**
 * Mostra um estado específico do popup
 */
function showState(state) {
    elements.loadingState.classList.add('hidden');
    elements.loginState.classList.add('hidden');
    elements.upgradeState.classList.add('hidden');
    elements.captureState.classList.add('hidden');

    switch (state) {
        case 'loading':
            elements.loadingState.classList.remove('hidden');
            break;
        case 'login':
            elements.loginState.classList.remove('hidden');
            break;
        case 'upgrade':
            elements.upgradeState.classList.remove('hidden');
            break;
        case 'capture':
            elements.captureState.classList.remove('hidden');
            break;
    }
}

/**
 * Carrega pastas e estudos do usuário
 */
async function loadUserData() {
    try {
        const folders = await getFolders();

        elements.folderSelect.innerHTML = '';

        if (folders.length === 0) {
            elements.folderSelect.innerHTML = '<option value="">Nenhuma pasta encontrada</option>';
            return;
        }

        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            elements.folderSelect.appendChild(option);
        });

        // Carregar estudos da primeira pasta
        if (folders.length > 0) {
            await handleFolderChange();
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showStatusMessage('Erro ao carregar pastas', 'error');
    }
}

/**
 * Handler para mudança de pasta
 */
async function handleFolderChange() {
    const folderId = elements.folderSelect.value;

    if (!folderId) {
        elements.studySelect.innerHTML = '<option value="">Selecione uma pasta</option>';
        return;
    }

    try {
        elements.studySelect.innerHTML = '<option value="">Carregando...</option>';

        const studies = await getStudies(folderId);

        elements.studySelect.innerHTML = '';

        if (studies.length === 0) {
            elements.studySelect.innerHTML = '<option value="">Nenhum estudo nesta pasta</option>';
            return;
        }

        studies.forEach(study => {
            const option = document.createElement('option');
            option.value = study.id;
            option.textContent = study.title;
            elements.studySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar estudos:', error);
        elements.studySelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

/**
 * Verifica se a página atual tem vídeo detectável
 */
async function checkCurrentPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.id) {
            updateDetectionStatus('warning', '⚠️', 'Não foi possível acessar a página atual');
            return;
        }

        // Enviar mensagem para content script
        chrome.tabs.sendMessage(tab.id, { type: 'CHECK_PLATFORM' }, (response) => {
            if (chrome.runtime.lastError) {
                updateDetectionStatus('warning', '⚠️', 'Abra uma página de curso para capturar legendas');
                return;
            }

            if (response?.detected) {
                currentPlatform = response.platform;
                currentVideoInfo = response.videoInfo;

                updateDetectionStatus(
                    'success',
                    '✅',
                    `Detectado: ${response.platform}\n${response.videoInfo?.title || 'Vídeo encontrado'}`
                );

                elements.captureForm.classList.remove('hidden');
            } else {
                updateDetectionStatus('warning', '🔍', 'Nenhum vídeo com legenda detectado nesta página');
            }
        });
    } catch (error) {
        console.error('Erro ao verificar página:', error);
        updateDetectionStatus('error', '❌', 'Erro ao verificar página');
    }
}

/**
 * Atualiza o status de detecção
 */
function updateDetectionStatus(type, icon, text) {
    elements.detectionStatus.className = `status-box ${type}`;
    elements.detectionIcon.textContent = icon;
    elements.detectionText.textContent = text;
}

/**
 * Handler de login
 */
async function handleLogin() {
    try {
        elements.loginBtn.disabled = true;
        elements.loginBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Conectando...';

        await login();

        // Recarregar para atualizar estado
        await initializeState();
    } catch (error) {
        console.error('Erro no login:', error);
        showStatusMessage('Erro ao conectar. Tente novamente.', 'error');
        elements.loginBtn.disabled = false;
        elements.loginBtn.innerHTML = 'Conectar com NeuroStudy';
    }
}

/**
 * Handler de logout
 */
async function handleLogout() {
    try {
        await logout();
        showState('login');
    } catch (error) {
        console.error('Erro no logout:', error);
    }
}

/**
 * Handler de envio de transcrição
 */
async function handleSend() {
    const studyId = elements.studySelect.value;

    if (!studyId) {
        showStatusMessage('Selecione um estudo', 'error');
        return;
    }

    try {
        elements.sendBtn.disabled = true;
        showStatusMessage('Capturando legenda...', 'loading');

        // Solicitar extração ao content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const extractionResult = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TRANSCRIPT' }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error('Falha na comunicação com a página'));
                    return;
                }

                if (response?.success) {
                    resolve(response);
                } else {
                    reject(new Error(response?.error || 'Falha ao extrair legenda'));
                }
            });
        });

        currentTranscript = extractionResult.transcript;

        showStatusMessage('Enviando para NeuroStudy...', 'loading');

        // Enviar para API
        const result = await sendTranscript(studyId, currentTranscript, {
            isPrimary: elements.primarySource.checked,
            videoTitle: currentVideoInfo?.title,
            videoUrl: tab.url
        });

        showStatusMessage('✅ Transcrição enviada com sucesso!', 'success');

        // Fechar popup após 2 segundos
        setTimeout(() => {
            window.close();
        }, 2000);

    } catch (error) {
        console.error('Erro ao enviar:', error);
        showStatusMessage(`❌ ${error.message}`, 'error');
    } finally {
        elements.sendBtn.disabled = false;
    }
}

/**
 * Mostra mensagem de status
 */
function showStatusMessage(message, type) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = type;
    elements.statusMessage.classList.remove('hidden');
}

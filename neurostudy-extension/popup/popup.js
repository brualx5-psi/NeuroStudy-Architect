/**
 * NeuroStudy Capture - Popup Logic (Self-contained)
 * 
 * Versão sem imports externos para compatibilidade com Chrome Extensions
 */

// ============== STARTUP DIAGNOSTICS ==============
console.log('[Popup] Script loaded');
console.log('[Popup] chrome.identity exists:', typeof chrome !== 'undefined' && typeof chrome.identity !== 'undefined');
console.log('[Popup] chrome.identity.getRedirectURL exists:', typeof chrome !== 'undefined' && typeof chrome.identity !== 'undefined' && typeof chrome.identity.getRedirectURL === 'function');
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('[Popup] Manifest permissions:', chrome.runtime.getManifest().permissions);
}

// ============== CONFIG ==============
const API_BASE = 'https://neurostudy.com.br';

// ============== AUTH FUNCTIONS ==============
function getAuthParam(url, key) {
    const searchValue = url.searchParams.get(key);
    if (searchValue) {
        return searchValue;
    }
    if (url.hash && url.hash.length > 1) {
        const hashParams = new URLSearchParams(url.hash.slice(1));
        return hashParams.get(key);
    }
    return null;
}

async function login() {
    const redirectUri = chrome.identity.getRedirectURL('callback');
    console.log('[Auth] Redirect URI:', redirectUri);

    const authUrl = new URL(`${API_BASE}/api/extension`);
    authUrl.searchParams.set('action', 'authorize');
    authUrl.searchParams.set('redirect_uri', redirectUri);

    try {
        const responseUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true
        });

        console.log('[Auth] Response URL:', responseUrl);

        const url = new URL(responseUrl);
        const accessToken = getAuthParam(url, 'access_token');
        const refreshToken = getAuthParam(url, 'refresh_token');
        const expiresAt = getAuthParam(url, 'expires_at');
        const expiresIn = getAuthParam(url, 'expires_in');
        const error = getAuthParam(url, 'error');

        if (error) {
            throw new Error(`Erro de autenticação: ${error}`);
        }

        if (!accessToken) {
            throw new Error('Token não encontrado na resposta');
        }

        // Salvar no storage
        const expiresAtValue = expiresAt
            ? parseInt(expiresAt)
            : (expiresIn ? Date.now() + (parseInt(expiresIn) * 1000) : Date.now() + 3600000);

        await chrome.storage.local.set({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAtValue
        });

        // Buscar dados do usuário
        const userResponse = await fetch(`${API_BASE}/api/extension?action=plan`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (userResponse.ok) {
            const userData = await userResponse.json();
            await chrome.storage.local.set({
                user: { planName: userData.planName },
                plan_name: userData.planName
            });
        }

        return { success: true };
    } catch (error) {
        console.error('[Auth] Login error:', error);
        throw error;
    }
}

async function logout() {
    await chrome.storage.local.remove([
        'access_token',
        'refresh_token',
        'user',
        'expires_at',
        'plan_name'
    ]);
}

async function getAuthState() {
    const data = await chrome.storage.local.get(['access_token', 'user', 'expires_at']);

    if (!data.access_token) {
        return { isAuthenticated: false };
    }

    if (data.expires_at && Date.now() > data.expires_at) {
        await logout();
        return { isAuthenticated: false };
    }

    return {
        isAuthenticated: true,
        user: data.user
    };
}

async function getToken() {
    const { access_token } = await chrome.storage.local.get('access_token');
    return access_token;
}

async function checkPlanAccess() {
    try {
        const { plan_name } = await chrome.storage.local.get('plan_name');

        // Se já tem cache, usar
        if (plan_name) {
            return plan_name !== 'free';
        }

        // Buscar da API
        const token = await getToken();
        if (!token) return false;

        const response = await fetch(`${API_BASE}/api/extension?action=plan`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return false;

        const { planName } = await response.json();
        await chrome.storage.local.set({ plan_name: planName });

        return planName !== 'free';
    } catch (error) {
        console.error('[Auth] Plan check error:', error);
        return false;
    }
}

// ============== API FUNCTIONS ==============
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
        throw new Error(error.message || `Erro ${response.status}`);
    }

    return response.json();
}

async function getFolders() {
    try {
        const response = await fetchWithAuth('/api/extension?action=folders');
        return response.folders || [];
    } catch (error) {
        console.error('[API] Get folders error:', error);
        return [];
    }
}

async function getStudies(folderId) {
    try {
        const response = await fetchWithAuth(`/api/extension?action=studies&folderId=${folderId}`);
        return response.studies || [];
    } catch (error) {
        console.error('[API] Get studies error:', error);
        return [];
    }
}

async function sendTranscript(studyId, transcript, options = {}) {
    return await fetchWithAuth('/api/extension?action=capture', {
        method: 'POST',
        body: JSON.stringify({
            studyId,
            transcript,
            isPrimary: options.isPrimary || false,
            videoTitle: options.videoTitle,
            videoUrl: options.videoUrl
        })
    });
}

// ============== UI STATE ==============
let currentTranscript = null;
let currentPlatform = null;
let currentVideoInfo = null;

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

// ============== INITIALIZATION ==============
document.addEventListener('DOMContentLoaded', async () => {
    // Cache DOM elements
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

    // Initialize
    await initializeState();
});

async function initializeState() {
    try {
        const authState = await getAuthState();

        if (!authState.isAuthenticated) {
            showState('login');
            return;
        }

        const hasAccess = await checkPlanAccess();

        if (!hasAccess) {
            showState('upgrade');
            return;
        }

        showState('capture');
        elements.userEmail.textContent = authState.user?.email || 'Usuário';

        await loadUserData();
        await checkCurrentPage();
    } catch (error) {
        console.error('[Init] Error:', error);
        showState('login');
    }
}

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

        if (folders.length > 0) {
            await handleFolderChange();
        }
    } catch (error) {
        console.error('[LoadData] Error:', error);
        showStatusMessage('Erro ao carregar pastas', 'error');
    }
}

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
        console.error('[FolderChange] Error:', error);
        elements.studySelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

async function checkCurrentPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.id) {
            updateDetectionStatus('warning', '⚠️', 'Não foi possível acessar a página atual');
            return;
        }

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
        console.error('[CheckPage] Error:', error);
        updateDetectionStatus('error', '❌', 'Erro ao verificar página');
    }
}

function updateDetectionStatus(type, icon, text) {
    elements.detectionStatus.className = `status-box ${type}`;
    elements.detectionIcon.textContent = icon;
    elements.detectionText.textContent = text;
}

async function handleLogin() {
    try {
        elements.loginBtn.disabled = true;
        elements.loginBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Conectando...';

        await login();

        await initializeState();
    } catch (error) {
        console.error('[Login] Error:', error);
        showStatusMessage('Erro ao conectar. Tente novamente.', 'error');
        elements.loginBtn.disabled = false;
        elements.loginBtn.innerHTML = 'Conectar com NeuroStudy';
    }
}

async function handleLogout() {
    try {
        await logout();
        showState('login');
    } catch (error) {
        console.error('[Logout] Error:', error);
    }
}

async function handleSend() {
    const studyId = elements.studySelect.value;

    if (!studyId) {
        showStatusMessage('Selecione um estudo', 'error');
        return;
    }

    try {
        elements.sendBtn.disabled = true;
        showStatusMessage('Capturando legenda...', 'loading');

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

        const result = await sendTranscript(studyId, currentTranscript, {
            isPrimary: elements.primarySource.checked,
            videoTitle: currentVideoInfo?.title,
            videoUrl: tab.url
        });

        showStatusMessage('✅ Transcrição enviada com sucesso!', 'success');

        setTimeout(() => {
            window.close();
        }, 2000);

    } catch (error) {
        console.error('[Send] Error:', error);
        showStatusMessage(`❌ ${error.message}`, 'error');
    } finally {
        elements.sendBtn.disabled = false;
    }
}

function showStatusMessage(message, type) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = type;
    elements.statusMessage.classList.remove('hidden');
}

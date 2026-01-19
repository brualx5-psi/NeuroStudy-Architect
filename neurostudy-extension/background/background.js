/**
 * NeuroStudy Capture - Background Service Worker
 * 
 * Gerencia comunicação entre popup, content scripts e API
 */

// Listener para instalação da extensão
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[NeuroStudy Capture] Extensão instalada!');

        // Abrir página de boas-vindas
        chrome.tabs.create({
            url: 'https://www.neurostudy.com.br/extension/welcome'
        });
    } else if (details.reason === 'update') {
        console.log('[NeuroStudy Capture] Extensão atualizada para versão:', chrome.runtime.getManifest().version);
    }
});

// Listener para mensagens do popup ou content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Log para debug
    console.log('[Background] Mensagem recebida:', message.type);

    switch (message.type) {
        case 'GET_AUTH_STATE':
            chrome.storage.local.get(['access_token', 'user'], (data) => {
                sendResponse({
                    isAuthenticated: !!data.access_token,
                    user: data.user
                });
            });
            return true; // async response

        case 'CLEAR_AUTH':
            chrome.storage.local.remove(['access_token', 'refresh_token', 'user', 'expires_at', 'plan_name'], () => {
                sendResponse({ success: true });
            });
            return true; // async response

        case 'OPEN_TAB':
            chrome.tabs.create({ url: message.url });
            sendResponse({ success: true });
            return false;

        default:
            console.log('[Background] Mensagem não tratada:', message.type);
    }
});

// Badge de status (opcional)
function updateBadge(status) {
    switch (status) {
        case 'ready':
            chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
            chrome.action.setBadgeText({ text: '✓' });
            break;
        case 'error':
            chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
            chrome.action.setBadgeText({ text: '!' });
            break;
        default:
            chrome.action.setBadgeText({ text: '' });
    }
}

console.log('[NeuroStudy Capture] Background service worker started');

/**
 * NeuroStudy Capture - Auth Module
 * 
 * Gerencia autenticação OAuth com NeuroStudy via Supabase
 */

const API_BASE = 'https://neurostudy.com.br';

/**
 * Inicia fluxo de login OAuth
 */
export async function login() {
    const redirectUri = chrome.identity.getRedirectURL('callback');

    // Construir URL de autorização
    const authUrl = new URL(`${API_BASE}/api/extension/authorize`);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');

    try {
        // Abrir janela de autenticação
        const responseUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true
        });

        // Extrair código de autorização
        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
            throw new Error(`Erro de autenticação: ${error}`);
        }

        if (!code) {
            throw new Error('Código de autorização não encontrado');
        }

        // Trocar código por token
        const tokenResponse = await fetch(`${API_BASE}/api/extension/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                redirect_uri: redirectUri
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            throw new Error(errorData.message || 'Falha ao obter token');
        }

        const { access_token, refresh_token, user, expires_at } = await tokenResponse.json();

        // Salvar no storage da extensão
        await chrome.storage.local.set({
            access_token,
            refresh_token,
            user,
            expires_at
        });

        return { user };
    } catch (error) {
        console.error('Erro no login:', error);
        throw error;
    }
}

/**
 * Faz logout e limpa dados
 */
export async function logout() {
    await chrome.storage.local.remove([
        'access_token',
        'refresh_token',
        'user',
        'expires_at',
        'plan_name'
    ]);
}

/**
 * Obtém o estado de autenticação atual
 */
export async function getAuthState() {
    const data = await chrome.storage.local.get([
        'access_token',
        'user',
        'expires_at'
    ]);

    if (!data.access_token) {
        return { isAuthenticated: false };
    }

    // Verificar se token expirou
    if (data.expires_at && Date.now() > data.expires_at) {
        // TODO: Implementar refresh token
        await logout();
        return { isAuthenticated: false };
    }

    return {
        isAuthenticated: true,
        user: data.user
    };
}

/**
 * Obtém o token de acesso atual
 */
export async function getToken() {
    const { access_token } = await chrome.storage.local.get('access_token');
    return access_token;
}

/**
 * Verifica se o usuário tem plano Pro/Plus
 */
export async function checkPlanAccess() {
    try {
        const token = await getToken();

        if (!token) {
            return false;
        }

        // Verificar cache primeiro
        const { plan_name, plan_checked_at } = await chrome.storage.local.get([
            'plan_name',
            'plan_checked_at'
        ]);

        // Cache válido por 5 minutos
        if (plan_name && plan_checked_at && (Date.now() - plan_checked_at) < 5 * 60 * 1000) {
            return plan_name !== 'free';
        }

        // Buscar plano da API
        const response = await fetch(`${API_BASE}/api/user/plan`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error('Erro ao verificar plano');
            return false;
        }

        const { planName } = await response.json();

        // Salvar em cache
        await chrome.storage.local.set({
            plan_name: planName,
            plan_checked_at: Date.now()
        });

        return planName !== 'free';
    } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        return false;
    }
}

/**
 * Extension API - Consolidated Endpoint
 * 
 * Handles all extension routes in a single serverless function
 * POST /api/extension { action: 'folders' | 'studies' | 'capture' | 'plan' }
 * GET /api/extension?action=authorize&redirect_uri=...
 */

import { getAuthContext } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendJson, readJson } from './_lib/http.js';
import type { PlanName } from './_lib/planLimits.js';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://neurostudy.com.br';

function getRequestUrl(req: any) {
    const host = req.headers?.host || 'neurostudy.com.br';
    if (!req.url) {
        return null;
    }
    return new URL(req.url, `https://${host}`);
}

function getQueryParam(req: any, requestUrl: URL | null, key: string): string | null {
    const queryValue = req.query?.[key];
    if (typeof queryValue === 'string') {
        return queryValue;
    }
    if (Array.isArray(queryValue) && queryValue.length > 0) {
        return queryValue[0];
    }
    return requestUrl?.searchParams.get(key) ?? null;
}

function isValidExtensionRedirect(value: string) {
    return value.startsWith('chrome-extension://') || value.includes('chromiumapp.org');
}

export default async function handler(req: any, res: any) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Get action from query string (for GET) or body (for POST)
    const requestUrl = getRequestUrl(req);
    const actionFromQuery = getQueryParam(req, requestUrl, 'action');
    const action = actionFromQuery || (req.method === 'POST' ? (await readJson<{ action?: string }>(req)).action : null);

    try {
        switch (action) {
            case 'authorize':
                return handleAuthorize(req, res, requestUrl);
            case 'callback':
                return handleCallback(req, res, requestUrl);
            case 'folders':
                return handleFolders(req, res);
            case 'studies':
                return handleStudies(req, res);
            case 'capture':
                return handleCapture(req, res);
            case 'plan':
                return handlePlan(req, res);
            default:
                return sendJson(res, 400, { error: 'action_required', validActions: ['authorize', 'callback', 'folders', 'studies', 'capture', 'plan'] });
        }
    } catch (err: any) {
        console.error('[extension] Error:', err);
        return sendJson(res, 500, { error: err.message });
    }
}

// ============== AUTHORIZE ==============
async function handleAuthorize(req: any, res: any, requestUrl: URL | null) {
    const redirectUri = getQueryParam(req, requestUrl, 'redirect_uri');

    if (!redirectUri) {
        return sendJson(res, 400, { error: 'redirect_uri required' });
    }

    if (!isValidExtensionRedirect(redirectUri)) {
        return sendJson(res, 400, { error: 'invalid_redirect_uri' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;

    if (!supabaseUrl) {
        return sendJson(res, 500, { error: 'supabase_not_configured' });
    }

    // Redireciona sempre para um callback do nosso dominio para evitar depender do ID da extensao
    const callbackUrl = new URL('/api/extension/callback', SITE_URL);
    callbackUrl.searchParams.set('extension_redirect', redirectUri);

    const authUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authUrl.searchParams.set('provider', 'google');
    authUrl.searchParams.set('redirect_to', callbackUrl.toString());
    // Mantem o redirect original no state como redundancia
    authUrl.searchParams.set('state', redirectUri);

    res.redirect(302, authUrl.toString());
}

// ============== CALLBACK ==============
async function handleCallback(req: any, res: any, requestUrl: URL | null) {
    const code = getQueryParam(req, requestUrl, 'code');
    const extensionRedirect = getQueryParam(req, requestUrl, 'extension_redirect');
    const stateRedirect = getQueryParam(req, requestUrl, 'state');
    const safeExtensionRedirect = extensionRedirect && isValidExtensionRedirect(extensionRedirect)
        ? extensionRedirect
        : null;
    const redirectTarget = safeExtensionRedirect
        || (stateRedirect && isValidExtensionRedirect(stateRedirect) ? stateRedirect : null);
    const accessToken = getQueryParam(req, requestUrl, 'access_token');
    const refreshToken = getQueryParam(req, requestUrl, 'refresh_token');
    const expiresAt = getQueryParam(req, requestUrl, 'expires_at');
    const expiresIn = getQueryParam(req, requestUrl, 'expires_in');

    if (accessToken && redirectTarget) {
        const redirectUrl = new URL(redirectTarget);
        redirectUrl.searchParams.set('access_token', accessToken);
        if (refreshToken) {
            redirectUrl.searchParams.set('refresh_token', refreshToken);
        }
        if (expiresAt) {
            redirectUrl.searchParams.set('expires_at', expiresAt);
        }
        if (expiresIn) {
            redirectUrl.searchParams.set('expires_in', expiresIn);
        }
        return res.redirect(302, redirectUrl.toString());
    }

    if (code && redirectTarget) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return sendJson(res, 500, { error: 'supabase_not_configured' });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code as string);

        if (error || !session) {
            return sendJson(res, 400, { error: 'invalid_code' });
        }

        const redirectUrl = new URL(redirectTarget);
        redirectUrl.searchParams.set('access_token', session.access_token);
        redirectUrl.searchParams.set('refresh_token', session.refresh_token);
        redirectUrl.searchParams.set('expires_at', String(session.expires_at || Date.now() + 3600000));

        return res.redirect(302, redirectUrl.toString());
    }

    // Fallback: se os tokens vierem na hash (fluxo implicito), repassa para a extensao via HTML
    const htmlRedirectTarget = redirectTarget && isValidExtensionRedirect(redirectTarget)
        ? redirectTarget
        : null;

    const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>NeuroStudy - Callback</title></head>
<body>
<p>Concluindo login da extensao...</p>
<script>
(function() {
  const isValidRedirect = (value) => typeof value === 'string' && (value.startsWith('chrome-extension://') || value.includes('chromiumapp.org'));
  const target = ${htmlRedirectTarget ? `'${htmlRedirectTarget}'` : 'null'};
  const fallback = '${SITE_URL}';
  const finalTarget = isValidRedirect(target) ? target : fallback;
  const url = new URL(finalTarget);

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const readParam = (key) => hashParams.get(key) || searchParams.get(key);

  ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'provider_token', 'error'].forEach((key) => {
    const value = readParam(key);
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  window.location.replace(url.toString());
})();
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
}

// ============== FOLDERS ==============
async function handleFolders(req: any, res: any) {
    const auth = await getAuthContext(req);
    if (!auth) {
        return sendJson(res, 401, { error: 'unauthorized' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return sendJson(res, 500, { error: 'database_not_configured' });
    }

    const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', auth.userId)
        .single();

    if (error) {
        return sendJson(res, 200, { folders: [] });
    }

    const folders = (data?.data?.folders || []).map((f: any) => ({
        id: f.id,
        name: f.name
    }));

    return sendJson(res, 200, { folders });
}

// ============== STUDIES ==============
async function handleStudies(req: any, res: any) {
    const auth = await getAuthContext(req);
    if (!auth) {
        return sendJson(res, 401, { error: 'unauthorized' });
    }

    const folderId = req.query.folderId as string;
    if (!folderId) {
        return sendJson(res, 400, { error: 'folderId_required' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return sendJson(res, 500, { error: 'database_not_configured' });
    }

    const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', auth.userId)
        .single();

    if (error) {
        return sendJson(res, 200, { studies: [] });
    }

    const studies = (data?.data?.studies || [])
        .filter((s: any) => s.folderId === folderId)
        .map((s: any) => ({
            id: s.id,
            title: s.title
        }));

    return sendJson(res, 200, { studies });
}

// ============== CAPTURE ==============
async function handleCapture(req: any, res: any) {
    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    const auth = await getAuthContext(req);
    if (!auth) {
        return sendJson(res, 401, { error: 'unauthorized' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return sendJson(res, 500, { error: 'database_not_configured' });
    }

    // Check plan
    const { data: usageData } = await supabase
        .from('user_usage')
        .select('plan_name')
        .eq('user_id', auth.userId)
        .single();

    const planName: PlanName = (usageData?.plan_name as PlanName) || 'free';

    if (planName === 'free') {
        return sendJson(res, 403, {
            error: 'premium_required',
            message: 'A captura de legendas é exclusiva para assinantes Starter e Pro.'
        });
    }

    const body = await readJson<{
        studyId: string;
        transcript: string;
        isPrimary?: boolean;
        videoTitle?: string;
        videoUrl?: string;
    }>(req);

    if (!body.studyId || !body.transcript) {
        return sendJson(res, 400, { error: 'studyId and transcript required' });
    }

    const { data: userData, error: fetchError } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', auth.userId)
        .single();

    if (fetchError) {
        return sendJson(res, 404, { error: 'user_data_not_found' });
    }

    const data = userData?.data || { folders: [], studies: [] };
    const studies = data.studies || [];
    const studyIndex = studies.findIndex((s: any) => s.id === body.studyId);

    if (studyIndex === -1) {
        return sendJson(res, 404, { error: 'study_not_found' });
    }

    const newSource = {
        id: `ext-${Date.now()}`,
        type: 'VIDEO',
        name: body.videoTitle || `Vídeo capturado - ${new Date().toLocaleString('pt-BR')}`,
        content: body.videoUrl || '',
        textContent: body.transcript,
        dateAdded: Date.now(),
        isPrimary: body.isPrimary || false,
        capturedByExtension: true
    };

    if (!studies[studyIndex].sources) {
        studies[studyIndex].sources = [];
    }

    if (body.isPrimary) {
        studies[studyIndex].sources.forEach((s: any) => { s.isPrimary = false; });
    }

    studies[studyIndex].sources.push(newSource);
    studies[studyIndex].updatedAt = Date.now();

    await supabase
        .from('user_data')
        .update({ data: { ...data, studies } })
        .eq('user_id', auth.userId);

    return sendJson(res, 200, { success: true, sourceId: newSource.id });
}

// ============== PLAN ==============
async function handlePlan(req: any, res: any) {
    const auth = await getAuthContext(req);
    if (!auth) {
        return sendJson(res, 401, { error: 'unauthorized' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return sendJson(res, 500, { error: 'database_not_configured' });
    }

    const { data } = await supabase
        .from('user_usage')
        .select('plan_name')
        .eq('user_id', auth.userId)
        .single();

    return sendJson(res, 200, { planName: data?.plan_name || 'free' });
}

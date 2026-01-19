/**
 * Extension OAuth - Callback Endpoint
 * 
 * Recebe callback do Supabase e redireciona para a extensão com o token
 * GET /api/extension/callback?code=...&extension_redirect=...
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { code, extension_redirect, access_token, refresh_token } = req.query;

    // Se recebeu tokens diretamente (hash fragment flow)
    if (access_token && extension_redirect) {
        const redirectUrl = new URL(extension_redirect as string);
        redirectUrl.searchParams.set('access_token', access_token as string);
        if (refresh_token) {
            redirectUrl.searchParams.set('refresh_token', refresh_token as string);
        }
        return res.redirect(302, redirectUrl.toString());
    }

    // Se recebeu código (authorization code flow)
    if (code && extension_redirect) {
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseAnonKey) {
                return res.status(500).json({ error: 'supabase_not_configured' });
            }

            const supabase = createClient(supabaseUrl, supabaseAnonKey);

            // Trocar código por sessão
            const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code as string);

            if (error || !session) {
                console.error('[extension/callback] Error:', error);
                return res.status(400).json({ error: 'invalid_code' });
            }

            // Redirecionar para extensão com tokens
            const redirectUrl = new URL(extension_redirect as string);
            redirectUrl.searchParams.set('access_token', session.access_token);
            redirectUrl.searchParams.set('refresh_token', session.refresh_token);
            redirectUrl.searchParams.set('expires_at', String(session.expires_at || Date.now() + 3600000));

            return res.redirect(302, redirectUrl.toString());
        } catch (err: any) {
            console.error('[extension/callback] Exception:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(400).json({ error: 'missing_parameters' });
}

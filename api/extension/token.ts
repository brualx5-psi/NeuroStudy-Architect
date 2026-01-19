/**
 * Extension - Token Exchange Endpoint
 * 
 * Alternativa para troca de código por token via POST
 * POST /api/extension/token
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { readJson, sendJson } from '../_lib/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS para extensões
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    try {
        const body = await readJson<{ code: string; redirect_uri: string }>(req);

        if (!body.code) {
            return sendJson(res, 400, { error: 'code_required' });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return sendJson(res, 500, { error: 'supabase_not_configured' });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Trocar código por sessão
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(body.code);

        if (error || !session) {
            console.error('[extension/token] Error:', error);
            return sendJson(res, 400, { error: 'invalid_code', message: error?.message });
        }

        return sendJson(res, 200, {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at || Date.now() + 3600000,
            user: {
                id: session.user.id,
                email: session.user.email
            }
        });
    } catch (err: any) {
        console.error('[extension/token] Exception:', err);
        return sendJson(res, 500, { error: err.message });
    }
}

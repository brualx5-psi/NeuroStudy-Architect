/**
 * User Plan Endpoint
 * 
 * Retorna o plano do usuário
 * GET /api/user/plan
 */

import { getAuthContext } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req: any, res: any) {
    // CORS para extensões
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    try {
        // Autenticar usuário
        const auth = await getAuthContext(req);
        if (!auth) {
            return sendJson(res, 401, { error: 'unauthorized' });
        }

        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return sendJson(res, 500, { error: 'database_not_configured' });
        }

        // Buscar plano do usuário
        const { data, error } = await supabase
            .from('user_usage')
            .select('plan_name')
            .eq('user_id', auth.userId)
            .single();

        if (error) {
            // Usuário novo = plano free
            return sendJson(res, 200, { planName: 'free' });
        }

        return sendJson(res, 200, {
            planName: data?.plan_name || 'free'
        });
    } catch (err: any) {
        console.error('[user/plan] Exception:', err);
        return sendJson(res, 500, { error: err.message });
    }
}

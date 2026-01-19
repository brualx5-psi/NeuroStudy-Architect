/**
 * Extension - List Studies Endpoint
 * 
 * Retorna os estudos de uma pasta
 * GET /api/extension/studies?folderId=xxx
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

        const folderId = req.query.folderId as string;
        if (!folderId) {
            return sendJson(res, 400, { error: 'folderId_required' });
        }

        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return sendJson(res, 500, { error: 'database_not_configured' });
        }

        // Buscar dados do usuário
        const { data, error } = await supabase
            .from('user_data')
            .select('data')
            .eq('user_id', auth.userId)
            .single();

        if (error) {
            console.error('[extension/studies] Error:', error);
            return sendJson(res, 200, { studies: [] });
        }

        const userData = data?.data || {};
        const studies = userData.studies || [];

        // Filtrar estudos da pasta
        const folderStudies = studies
            .filter((s: any) => s.folderId === folderId)
            .map((s: any) => ({
                id: s.id,
                title: s.title,
                mode: s.mode,
                updatedAt: s.updatedAt
            }));

        return sendJson(res, 200, { studies: folderStudies });
    } catch (err: any) {
        console.error('[extension/studies] Exception:', err);
        return sendJson(res, 500, { error: err.message });
    }
}

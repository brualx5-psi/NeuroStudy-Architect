/**
 * Extension - List Folders Endpoint
 * 
 * Retorna as pastas do usuário
 * GET /api/extension/folders
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

        // Buscar dados do usuário
        const { data, error } = await supabase
            .from('user_data')
            .select('data')
            .eq('user_id', auth.userId)
            .single();

        if (error) {
            console.error('[extension/folders] Error:', error);
            // Se não encontrou, retorna lista vazia (usuário novo)
            return sendJson(res, 200, { folders: [] });
        }

        const userData = data?.data || {};
        const folders = userData.folders || [];

        // Retornar apenas id e nome das pastas
        const simplifiedFolders = folders.map((f: any) => ({
            id: f.id,
            name: f.name
        }));

        return sendJson(res, 200, { folders: simplifiedFolders });
    } catch (err: any) {
        console.error('[extension/folders] Exception:', err);
        return sendJson(res, 500, { error: err.message });
    }
}

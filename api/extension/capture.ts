/**
 * Extension - Capture Transcript Endpoint
 * 
 * Adiciona transcrição capturada a um estudo
 * POST /api/extension/capture
 * 
 * Requer plano Pro ou Starter (não disponível para Free)
 */

import { getAuthContext } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';
import type { PlanName } from '../_lib/planLimits.js';

type CaptureBody = {
    studyId: string;
    transcript: string;
    isPrimary?: boolean;
    videoTitle?: string;
    videoUrl?: string;
};

export default async function handler(req: any, res: any) {
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
        // Autenticar usuário
        const auth = await getAuthContext(req);
        if (!auth) {
            return sendJson(res, 401, { error: 'unauthorized' });
        }

        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return sendJson(res, 500, { error: 'database_not_configured' });
        }

        // Verificar plano do usuário
        const { data: usageData } = await supabase
            .from('user_usage')
            .select('plan_name')
            .eq('user_id', auth.userId)
            .single();

        const planName: PlanName = (usageData?.plan_name as PlanName) || 'free';

        // Bloquear para plano Free
        if (planName === 'free') {
            return sendJson(res, 403, {
                error: 'premium_required',
                message: 'A captura de legendas é exclusiva para assinantes Starter e Pro.',
                action: 'upgrade',
                upgradeUrl: 'https://neurostudy.com.br/plans'
            });
        }

        // Ler body
        const body = await readJson<CaptureBody>(req);

        if (!body.studyId || !body.transcript) {
            return sendJson(res, 400, { error: 'studyId and transcript required' });
        }

        // Buscar dados do usuário
        const { data: userData, error: fetchError } = await supabase
            .from('user_data')
            .select('data')
            .eq('user_id', auth.userId)
            .single();

        if (fetchError) {
            console.error('[extension/capture] Fetch error:', fetchError);
            return sendJson(res, 404, { error: 'user_data_not_found' });
        }

        const data = userData?.data || { folders: [], studies: [] };
        const studies = data.studies || [];

        // Encontrar o estudo
        const studyIndex = studies.findIndex((s: any) => s.id === body.studyId);
        if (studyIndex === -1) {
            return sendJson(res, 404, { error: 'study_not_found' });
        }

        // Criar nova fonte
        const newSource = {
            id: `ext-${Date.now()}`,
            type: 'VIDEO',
            name: body.videoTitle || `Vídeo capturado - ${new Date().toLocaleString('pt-BR')}`,
            content: body.videoUrl || '',
            textContent: body.transcript,
            mimeType: 'text/plain',
            dateAdded: Date.now(),
            isPrimary: body.isPrimary || false,
            capturedByExtension: true
        };

        // Adicionar fonte ao estudo
        if (!studies[studyIndex].sources) {
            studies[studyIndex].sources = [];
        }

        // Se marcado como principal, desmarcar as outras
        if (body.isPrimary) {
            studies[studyIndex].sources.forEach((s: any) => {
                s.isPrimary = false;
            });
        }

        studies[studyIndex].sources.push(newSource);
        studies[studyIndex].updatedAt = Date.now();

        // Salvar no banco
        const { error: updateError } = await supabase
            .from('user_data')
            .update({ data: { ...data, studies } })
            .eq('user_id', auth.userId);

        if (updateError) {
            console.error('[extension/capture] Update error:', updateError);
            return sendJson(res, 500, { error: 'failed_to_save' });
        }

        return sendJson(res, 200, {
            success: true,
            sourceId: newSource.id,
            message: 'Transcrição adicionada com sucesso!'
        });
    } catch (err: any) {
        console.error('[extension/capture] Exception:', err);
        return sendJson(res, 500, { error: err.message });
    }
}

/**
 * Checkout API - Generates dynamic Mercado Pago subscription links
 *
 * GET /api/checkout?plan=pro_mensal
 *
 * Returns the subscription link with the user's ID as external_reference,
 * ensuring the webhook can always match the payment to the correct user.
 */

import { getAuthContext } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendJson } from './_lib/http.js';
import type { IncomingMessage, ServerResponse } from 'http';

// Mapeamento de planos para preapproval_plan_id do Mercado Pago
const PLAN_MAP: Record<string, { planId: string; label: string }> = {
    starter_mensal: { planId: 'd5db97d0d27a4c11a006800f8ee6e552', label: 'Starter Mensal' },
    starter_anual: { planId: '854c80057c0e420683c129a07273f7c8', label: 'Starter Anual' },
    pro_mensal: { planId: '02935c0c251e465eb1ce329ab2bc98f2', label: 'Pro Mensal' },
    pro_anual: { planId: 'a7e0f68a4c4f4ddca4c2ae512a8a1db5', label: 'Pro Anual' },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        return res.end();
    }

    if (req.method !== 'GET') {
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const planKey = url.searchParams.get('plan');

    if (!planKey || !PLAN_MAP[planKey]) {
        return sendJson(res, 400, {
            error: 'invalid_plan',
            valid: Object.keys(PLAN_MAP),
        });
    }

    // Authenticate user
    const auth = await getAuthContext(req);
    if (!auth?.userId) {
        // Fallback: return static link without external_reference
        const fallbackUrl = `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${PLAN_MAP[planKey].planId}`;
        console.log('[Checkout] Usuário não autenticado, retornando link estático');
        return sendJson(res, 200, { url: fallbackUrl, method: 'static' });
    }

    // Get user email from Supabase for the payer_email hint
    let userEmail = auth.email || '';
    const supabase = getSupabaseAdmin();
    if (supabase && !userEmail) {
        const { data } = await supabase
            .from('users')
            .select('email')
            .eq('id', auth.userId)
            .single();
        if (data?.email) userEmail = data.email;
    }

    const { planId } = PLAN_MAP[planKey];

    // Build dynamic subscription URL with external_reference
    // external_reference = userId so the webhook can always find the user
    const checkoutUrl = new URL('https://www.mercadopago.com.br/subscriptions/checkout');
    checkoutUrl.searchParams.set('preapproval_plan_id', planId);
    checkoutUrl.searchParams.set('external_reference', auth.userId);
    if (userEmail) {
        checkoutUrl.searchParams.set('payer_email', userEmail);
    }

    console.log(`[Checkout] Link gerado: plan=${planKey}, userId=${auth.userId}, email=${userEmail}`);

    return sendJson(res, 200, {
        url: checkoutUrl.toString(),
        method: 'dynamic',
        plan: planKey,
    });
}

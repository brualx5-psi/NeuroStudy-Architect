/**
 * Subscription API - Mercado Pago
 *
 * POST /api/subscription?action=cancel
 * Cancels current user's Mercado Pago subscription (preapproval) and downgrades to free.
 */

import { getAuthContext } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendJson } from './_lib/http.js';

async function cancelMercadoPagoSubscription(subscriptionId: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN_not_configured');

  const resp = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'cancelled' })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[subscription.cancel] Mercado Pago error', resp.status, text);
    throw new Error('mercadopago_cancel_failed');
  }

  return resp.json().catch(() => ({}));
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const action = req.query?.action;
  if (!action) return sendJson(res, 400, { error: 'action_required' });

  const auth = await getAuthContext(req);
  if (!auth?.userId) return sendJson(res, 401, { error: 'unauthorized' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return sendJson(res, 500, { error: 'supabase_not_available' });

  try {
    if (action !== 'cancel') {
      return sendJson(res, 400, { error: 'invalid_action' });
    }

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, email, mp_subscription_id, subscription_status')
      .eq('id', auth.userId)
      .single();

    if (userErr || !userRow) {
      console.error('[subscription.cancel] user not found', userErr);
      return sendJson(res, 404, { error: 'user_not_found' });
    }

    const subscriptionId = (userRow as any).mp_subscription_id as string | null;
    if (!subscriptionId) {
      return sendJson(res, 400, { error: 'no_active_subscription' });
    }

    await cancelMercadoPagoSubscription(subscriptionId);

    // Downgrade immediately (webhook will also confirm)
    await supabase
      .from('users')
      .update({
        subscription_status: 'free',
        mp_subscription_id: null,
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', auth.userId);

    return sendJson(res, 200, { ok: true });
  } catch (err: any) {
    console.error('[subscription] error', err);
    return sendJson(res, 500, { error: err?.message || 'internal_error' });
  }
}

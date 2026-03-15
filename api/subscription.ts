/**
 * Subscription API - Mercado Pago
 *
 * POST /api/subscription?action=cancel
 * Cancels current user's Mercado Pago subscription (preapproval) and downgrades to free.
 *
 * POST /api/subscription?action=sync
 * Tries to find the latest authorized Mercado Pago subscription for the current user and updates the plan.
 */

import { getAuthContext } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendJson } from './_lib/http.js';
import { sendCancelledEmail } from './_lib/email.js';
import { asaasFetch } from './_lib/asaas.js';

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

async function cancelAsaasSubscription(subscriptionId: string) {
  const resp = await asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
  });

  if (!resp.resp.ok) {
    console.error('[subscription.cancel] Asaas error', resp.resp.status, resp.payload || resp.text);
    throw new Error('asaas_cancel_failed');
  }

  return resp.payload;
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
    if (!['cancel', 'sync'].includes(action)) {
      return sendJson(res, 400, { error: 'invalid_action' });
    }

    // Shared user row

    let { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, email, full_name, mp_subscription_id, asaas_subscription_id, subscription_status')
      .eq('id', auth.userId)
      .single();

    // If the auth user exists but there is no profile row yet, create it.
    if ((userErr as any)?.code === 'PGRST116' || (!userRow && userErr)) {
      try {
        await supabase.from('users').insert({
          id: auth.userId,
          email: auth.email || null,
          subscription_status: 'free'
        });

        const retry = await supabase
          .from('users')
          .select('id, email, full_name, mp_subscription_id, asaas_subscription_id, subscription_status')
          .eq('id', auth.userId)
          .single();

        userRow = retry.data as any;
        userErr = retry.error as any;
      } catch (e) {
        console.error('[subscription] failed to auto-create user row', e);
      }
    }

    if (userErr || !userRow) {
      console.error('[subscription] user not found', userErr);
      return sendJson(res, 404, { error: 'user_not_found' });
    }

    if (action === 'cancel') {
      const asaasId = (userRow as any).asaas_subscription_id as string | null;
      const mpId = (userRow as any).mp_subscription_id as string | null;

      if (!asaasId && !mpId) {
        return sendJson(res, 400, { error: 'no_active_subscription' });
      }

      // Prefer Asaas when present
      if (asaasId) {
        await cancelAsaasSubscription(asaasId);
      } else if (mpId) {
        await cancelMercadoPagoSubscription(mpId);
      }

      const prevPlan = (userRow as any).subscription_status || 'free';

      // Downgrade immediately (webhook will also confirm)
      await supabase
        .from('users')
        .update({
          subscription_status: 'free',
          mp_subscription_id: null,
          asaas_subscription_id: null,
          subscription_updated_at: new Date().toISOString()
        })
        .eq('id', auth.userId);

      // Fire-and-forget email
      if ((userRow as any).email && prevPlan !== 'free') {
        sendCancelledEmail({
          toEmail: (userRow as any).email,
          name: (userRow as any).full_name,
          previousPlanName: prevPlan
        }).catch((e) => console.error('[subscription.cancel] email failed (ignored)', e));
      }

      return sendJson(res, 200, { ok: true });
    }

    // action === 'sync'

    // If user is on Asaas, try to sync from Asaas payments
    const asaasId = (userRow as any).asaas_subscription_id as string | null;
    if (asaasId) {
      const list = await asaasFetch(`/subscriptions/${encodeURIComponent(asaasId)}/payments?limit=20&offset=0`, { method: 'GET' });
      if (!list.resp.ok) {
        console.error('[subscription.sync] Asaas list payments failed', list.resp.status, list.payload || list.text);
        return sendJson(res, 502, { error: 'asaas_list_payments_failed' });
      }

      const payments = (list.payload as any)?.data;
      const paid = Array.isArray(payments) ? payments.find((p: any) => ['RECEIVED', 'CONFIRMED'].includes(String(p?.status || '').toUpperCase())) : null;

      if (!paid) {
        // maybe created but not paid yet
        return sendJson(res, 200, { ok: false, status: 'pending' });
      }

      const ext = String(paid?.externalReference || '').trim();
      // ext format: userId:plan:cycle
      const parts = ext.split(':');
      const plan = (parts[1] || '').toLowerCase();
      if (!['starter', 'pro'].includes(plan)) {
        return sendJson(res, 200, { ok: false, status: 'plan_not_mapped', externalReference: ext });
      }

      await supabase
        .from('users')
        .update({
          subscription_status: plan,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq('id', auth.userId);

      return sendJson(res, 200, { ok: true, planName: plan });
    }

    // Fallback: legacy Mercado Pago sync
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) return sendJson(res, 500, { error: 'MERCADOPAGO_ACCESS_TOKEN_not_configured' });

    const email = String((userRow as any).email || '').trim();
    if (!email) return sendJson(res, 400, { error: 'user_email_missing' });

    // Map plan_id -> plan
    const PLAN_ID_MAP: Record<string, 'starter' | 'pro'> = {
      // starter
      '1b3bff62d1f44f70878a89508e94c346': 'starter',
      'd5db97d0d27a4c11a006800f8ee6e552': 'starter',
      '854c80057c0e420683c129a07273f7c8': 'starter',
      // pro
      '87f2fd4ff4544ade8568359886acd3aa': 'pro',
      '02935c0c251e465eb1ce329ab2bc98f2': 'pro',
      'a7e0f68a4c4f4ddca4c2ae512a8a1db5': 'pro',
    };

    const search = async (status: string) => {
      const url = `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(email)}&status=${encodeURIComponent(status)}&sort=date_created&order=desc&limit=1`;
      const mpResp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const mpPayload = await mpResp.json().catch(() => ({} as any));
      if (!mpResp.ok) {
        console.error('[subscription.sync] Mercado Pago error', mpResp.status, mpPayload);
        return { ok: false as const, error: 'mercadopago_search_failed' as const };
      }

      const result = (mpPayload as any)?.results?.[0];
      return { ok: true as const, result };
    };

    const authorized = await search('authorized');
    if (!authorized.ok) {
      return sendJson(res, 502, { error: authorized.error });
    }

    const result = (authorized as any).result;
    if (!result?.id) {
      // If there's a pending subscription, inform UI.
      const pending = await search('pending');
      if (pending.ok && (pending as any).result?.id) {
        return sendJson(res, 200, { ok: false, status: 'pending' });
      }
      return sendJson(res, 200, { ok: false, status: 'not_found' });
    }

    const planId = String(result.preapproval_plan_id || '');
    const planName = PLAN_ID_MAP[planId];
    if (!planName) {
      return sendJson(res, 200, { ok: false, status: 'plan_not_mapped', planId });
    }

    const now = new Date().toISOString();
    await supabase
      .from('users')
      .update({
        subscription_status: planName,
        mp_subscription_id: String(result.id),
        subscription_updated_at: now
      })
      .eq('id', auth.userId);

    return sendJson(res, 200, {
      ok: true,
      planName,
      planId,
      subscriptionId: String(result.id),
      status: String(result.status || 'authorized')
    });
  } catch (err: any) {
    console.error('[subscription] error', err);
    return sendJson(res, 500, { error: err?.message || 'internal_error' });
  }
}

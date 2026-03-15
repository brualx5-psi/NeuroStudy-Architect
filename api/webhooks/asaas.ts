import type { IncomingMessage, ServerResponse } from 'http';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';
import { requireAsaasWebhookToken } from '../_lib/asaas.js';
import { sendWelcomeEmail, sendCancelledEmail } from '../_lib/email.js';

type PlanName = 'free' | 'starter' | 'pro';

interface AsaasWebhookPayload {
  id?: string;
  event?: string;
  dateCreated?: string;
  payment?: {
    id?: string;
    subscription?: string | null;
    customer?: string;
    status?: string;
    externalReference?: string | null;
    description?: string | null;
    invoiceUrl?: string | null;
    billingType?: string | null;
    value?: number;
  };
}

function parseExternalReference(externalReference: string | null | undefined): { userId?: string; plan?: PlanName; cycle?: string } {
  if (!externalReference) return {};
  const parts = String(externalReference).split(':').map((s) => s.trim()).filter(Boolean);
  const [userId, plan, cycle] = parts;
  const p = (plan || '').toLowerCase();
  const planName = (p === 'starter' || p === 'pro') ? (p as any) : undefined;
  return { userId, plan: planName, cycle };
}

async function updateUserPlanById(userId: string, planName: PlanName, asaasSubscriptionId?: string | null): Promise<{ ok: boolean; prevPlan?: string; email?: string | null; fullName?: string | null; }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false };

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, subscription_status')
    .eq('id', userId)
    .single();

  if (error || !user) {
    console.error('[Asaas Webhook] user not found', { userId, error });
    return { ok: false };
  }

  const prevPlan = (user as any).subscription_status;

  const { error: updErr } = await supabase
    .from('users')
    .update({
      subscription_status: planName,
      asaas_subscription_id: asaasSubscriptionId || null,
      subscription_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updErr) {
    console.error('[Asaas Webhook] update failed', updErr);
    return { ok: false, prevPlan, email: (user as any).email, fullName: (user as any).full_name };
  }

  return { ok: true, prevPlan, email: (user as any).email, fullName: (user as any).full_name };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    // Token in header asaas-access-token
    requireAsaasWebhookToken(req.headers as any);

    const payload = await readJson<AsaasWebhookPayload>(req);

    const event = String(payload?.event || '').trim();
    const payment = payload?.payment || {};

    const subscriptionId = payment.subscription ? String(payment.subscription) : null;
    const { userId, plan } = parseExternalReference(payment.externalReference);

    console.log('[Asaas Webhook] received', {
      event,
      webhookId: payload?.id,
      paymentId: payment?.id,
      subscriptionId,
      status: payment?.status,
      externalReference: payment?.externalReference,
    });

    // We only manage access based on payment events.
    if (!event || !payment?.id) {
      return sendJson(res, 200, { ok: true, ignored: true });
    }

    // Determine target plan:
    // - when paid/confirmed -> plan from externalReference
    // - when overdue/refunded/deleted/chargeback -> free
    const paidEvents = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
    const cancelEvents = new Set([
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'PAYMENT_REFUNDED',
      'PAYMENT_PARTIALLY_REFUNDED',
      'PAYMENT_CHARGEBACK_REQUESTED',
      'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
    ]);

    if (!userId) {
      // We can’t match user without externalReference in MVP.
      console.warn('[Asaas Webhook] missing userId in externalReference', { externalReference: payment.externalReference });
      return sendJson(res, 200, { ok: true, ignored: true, reason: 'missing_external_reference' });
    }

    if (paidEvents.has(event)) {
      if (!plan || plan === 'free') {
        console.warn('[Asaas Webhook] paid event but plan missing', { externalReference: payment.externalReference });
        return sendJson(res, 200, { ok: true, ignored: true, reason: 'plan_missing' });
      }

      const result = await updateUserPlanById(userId, plan, subscriptionId);

      if (result.ok && result.prevPlan !== plan && result.email) {
        sendWelcomeEmail({
          toEmail: result.email,
          name: result.fullName,
          planName: plan as any,
        }).catch((e) => console.error('[Asaas Webhook] welcome email failed (ignored)', e));
      }

      return sendJson(res, 200, { ok: true });
    }

    if (cancelEvents.has(event)) {
      const result = await updateUserPlanById(userId, 'free', subscriptionId);

      if (result.ok && result.prevPlan && result.prevPlan !== 'free' && result.email) {
        sendCancelledEmail({
          toEmail: result.email,
          name: result.fullName,
          previousPlanName: result.prevPlan as any,
        }).catch((e) => console.error('[Asaas Webhook] cancelled email failed (ignored)', e));
      }

      return sendJson(res, 200, { ok: true });
    }

    // Other events are informational
    return sendJson(res, 200, { ok: true, ignored: true, event });
  } catch (err: any) {
    const status = err?.statusCode || 500;
    console.error('[Asaas Webhook] error', err);
    return sendJson(res, status, { error: err?.message || 'internal_error' });
  }
}

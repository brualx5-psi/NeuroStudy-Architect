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

async function logWebhookEvent(params: {
  eventId: string;
  event: string;
  paymentId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  externalReference?: string | null;
  userId?: string | null;
  action?: string;
  reason?: string;
  payload: any;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    // Table should be created in Supabase (see docs/SQL in repo): asaas_webhook_events
    await supabase.from('asaas_webhook_events').insert([{
      id: params.eventId,
      event: params.event,
      payment_id: params.paymentId || null,
      subscription_id: params.subscriptionId || null,
      payment_status: params.status || null,
      external_reference: params.externalReference || null,
      user_id: params.userId || null,
      action: params.action || null,
      reason: params.reason || null,
      payload: params.payload,
      created_at: new Date().toISOString(),
    }]).throwOnError();
  } catch (e: any) {
    // Ignore duplicates / missing table errors in prod to avoid breaking payments.
    const msg = String(e?.message || e);
    if (!msg.toLowerCase().includes('duplicate') && !msg.toLowerCase().includes('already exists')) {
      console.warn('[Asaas Webhook] log ignored', msg);
    }
  }
}

async function updateUserPlanById(userId: string, planName: PlanName, asaasSubscriptionId?: string | null): Promise<{ ok: boolean; prevPlan?: string; email?: string | null; fullName?: string | null; currentSubId?: string | null; }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false };

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, subscription_status, asaas_subscription_id')
    .eq('id', userId)
    .single();

  if (error || !user) {
    console.error('[Asaas Webhook] user not found', { userId, error });
    return { ok: false };
  }

  const prevPlan = (user as any).subscription_status;
  const currentSubId = (user as any).asaas_subscription_id as string | null;

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
    return { ok: false, prevPlan, currentSubId, email: (user as any).email, fullName: (user as any).full_name };
  }

  return { ok: true, prevPlan, currentSubId, email: (user as any).email, fullName: (user as any).full_name };
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

    const webhookId = payload?.id ? String(payload.id) : null;
    const eventId = webhookId || `${event}:${payment?.id || 'no-payment'}`;

    console.log('[Asaas Webhook] received', {
      event,
      webhookId: webhookId || undefined,
      eventId,
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
      await logWebhookEvent({
        eventId,
        event,
        paymentId: payment?.id || null,
        subscriptionId,
        status: payment?.status || null,
        externalReference: payment?.externalReference || null,
        userId: null,
        action: 'ignored',
        reason: 'missing_external_reference',
        payload,
      });
      return sendJson(res, 200, { ok: true, ignored: true, reason: 'missing_external_reference' });
    }

    if (paidEvents.has(event)) {
      if (!plan || plan === 'free') {
        console.warn('[Asaas Webhook] paid event but plan missing', { externalReference: payment.externalReference });
        await logWebhookEvent({
          eventId,
          event,
          paymentId: payment?.id || null,
          subscriptionId,
          status: payment?.status || null,
          externalReference: payment?.externalReference || null,
          userId,
          action: 'ignored',
          reason: 'plan_missing',
          payload,
        });
        return sendJson(res, 200, { ok: true, ignored: true, reason: 'plan_missing' });
      }

      // For paid events, we accept switching to a new subscriptionId (user re-subscribed),
      // but we still record the new subscriptionId as the official one.
      const result = await updateUserPlanById(userId, plan, subscriptionId);

      await logWebhookEvent({
        eventId,
        event,
        paymentId: payment?.id || null,
        subscriptionId,
        status: payment?.status || null,
        externalReference: payment?.externalReference || null,
        userId,
        action: 'update_plan',
        reason: 'paid_event',
        payload,
      });

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
      // IMPORTANT: never downgrade to free if the cancel event refers to a different subscription.
      // This prevents old/duplicate subscriptions from overriding the current active one.
      const supabase = getSupabaseAdmin();
      const { data: userRow } = supabase ? await supabase
        .from('users')
        .select('asaas_subscription_id')
        .eq('id', userId)
        .single() : { data: null } as any;

      const currentSubId = (userRow as any)?.asaas_subscription_id as string | null;
      const subMatches = !currentSubId || (subscriptionId && currentSubId === subscriptionId);

      if (!subMatches) {
        console.warn('[Asaas Webhook] cancel event ignored (subscription mismatch)', {
          userId,
          currentSubId,
          subscriptionId,
          event,
        });
        await logWebhookEvent({
          eventId,
          event,
          paymentId: payment?.id || null,
          subscriptionId,
          status: payment?.status || null,
          externalReference: payment?.externalReference || null,
          userId,
          action: 'ignored',
          reason: 'subscription_mismatch',
          payload,
        });
        return sendJson(res, 200, { ok: true, ignored: true, reason: 'subscription_mismatch' });
      }

      const result = await updateUserPlanById(userId, 'free', subscriptionId);

      await logWebhookEvent({
        eventId,
        event,
        paymentId: payment?.id || null,
        subscriptionId,
        status: payment?.status || null,
        externalReference: payment?.externalReference || null,
        userId,
        action: 'update_plan',
        reason: 'cancel_event',
        payload,
      });

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
    await logWebhookEvent({
      eventId,
      event,
      paymentId: payment?.id || null,
      subscriptionId,
      status: payment?.status || null,
      externalReference: payment?.externalReference || null,
      userId,
      action: 'ignored',
      reason: 'unhandled_event',
      payload,
    });
    return sendJson(res, 200, { ok: true, ignored: true, event });
  } catch (err: any) {
    const status = err?.statusCode || 500;
    console.error('[Asaas Webhook] error', err);
    return sendJson(res, status, { error: err?.message || 'internal_error' });
  }
}

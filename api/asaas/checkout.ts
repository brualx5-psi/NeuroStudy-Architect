import { getAuthContext } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';
import { asaasFetch } from '../_lib/asaas.js';

// MVP: link hospedado (invoiceUrl)

type PlanName = 'starter' | 'pro';
type Cycle = 'MONTHLY' | 'YEARLY';

const PLANS: Record<string, { plan: PlanName; cycle: Cycle; value: number; description: string; }> = {
  starter_mensal: { plan: 'starter', cycle: 'MONTHLY', value: 59.9, description: 'NeuroStudy Starter (Mensal)' },
  starter_anual: { plan: 'starter', cycle: 'YEARLY', value: 299, description: 'NeuroStudy Starter (Anual)' },
  pro_mensal: { plan: 'pro', cycle: 'MONTHLY', value: 99.9, description: 'NeuroStudy Pro (Mensal)' },
  pro_anual: { plan: 'pro', cycle: 'YEARLY', value: 599, description: 'NeuroStudy Pro (Anual)' },
};

function addDaysISO(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function findOrCreateCustomer({ name, email, cpfCnpj }: { name: string; email: string; cpfCnpj: string; }) {
  // Search customer by email
  const q = `/customers?email=${encodeURIComponent(email)}&limit=1`;
  const search = await asaasFetch(q, { method: 'GET' });
  if (!search.resp.ok) {
    console.error('[asaas.checkout] customer search failed', search.resp.status, search.payload || search.text);
    throw new Error('asaas_customer_search_failed');
  }

  const data = (search.payload as any)?.data;
  const found = Array.isArray(data) ? data[0] : null;
  if (found?.id) {
    // Ensure cpfCnpj exists (some accounts require it to create subscription/payments)
    const hasCpf = String((found as any)?.cpfCnpj || (found as any)?.cpf_cnpj || '').replace(/\D+/g, '');
    if (!hasCpf && cpfCnpj) {
      const upd = await asaasFetch(`/customers/${encodeURIComponent(String(found.id))}`, {
        method: 'POST',
        body: JSON.stringify({ cpfCnpj }),
      });
      if (!upd.resp.ok) {
        console.error('[asaas.checkout] customer update cpfCnpj failed', upd.resp.status, upd.payload || upd.text);
      } else {
        return upd.payload as any;
      }
    }
    return found;
  }

  const create = await asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: name || email, email, cpfCnpj }),
  });

  if (!create.resp.ok) {
    console.error('[asaas.checkout] customer create failed', create.resp.status, create.payload || create.text);
    throw new Error('asaas_customer_create_failed');
  }

  return create.payload as any;
}

async function createSubscription({ customerId, externalReference, description, value, cycle }: {
  customerId: string;
  externalReference: string;
  description: string;
  value: number;
  cycle: Cycle;
}) {
  // nextDueDate controls first charge date.
  // For MVP, charge ASAP (today + 0/1). Using +0 can fail depending on time; +1 is safer.
  const nextDueDate = addDaysISO(0);

  // billingType:
  // - CREDIT_CARD / BOLETO / PIX
  // Hosted invoice page supports multiple methods depending on account config.
  // We'll use UNDEFINED to let payer choose when supported.
  const payload = {
    customer: customerId,
    billingType: 'UNDEFINED',
    nextDueDate,
    value,
    cycle,
    description,
    externalReference,
  } as any;

  const resp = await asaasFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!resp.resp.ok) {
    console.error('[asaas.checkout] subscription create failed', resp.resp.status, resp.payload || resp.text);
    // Fallback: if UNDEFINED is not accepted, retry with PIX
    const retry = await asaasFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ ...payload, billingType: 'PIX' }),
    });
    if (!retry.resp.ok) {
      console.error('[asaas.checkout] subscription create retry failed', retry.resp.status, retry.payload || retry.text);
      throw new Error('asaas_subscription_create_failed');
    }
    return retry.payload as any;
  }

  return resp.payload as any;
}

async function getFirstPaymentInvoiceUrl(subscriptionId: string): Promise<string | null> {
  const resp = await asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=10&offset=0`, { method: 'GET' });
  if (!resp.resp.ok) {
    console.error('[asaas.checkout] list payments failed', resp.resp.status, resp.payload || resp.text);
    return null;
  }

  const payments = (resp.payload as any)?.data;
  const first = Array.isArray(payments) ? payments[0] : null;
  const url = first?.invoiceUrl || first?.bankSlipUrl || null;
  return url;
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const auth = await getAuthContext(req);
  if (!auth?.userId) return sendJson(res, 401, { error: 'unauthorized' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return sendJson(res, 500, { error: 'supabase_not_available' });

  try {
    const body = await readJson<{ sku?: string }>(req);
    const sku = String(body?.sku || '').trim();
    if (!sku || !PLANS[sku]) return sendJson(res, 400, { error: 'invalid_sku' });

    const planDef = PLANS[sku];

    const { data: userRow } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', auth.userId)
      .single();

    const email = String((userRow as any)?.email || auth.email || '').trim();
    if (!email) return sendJson(res, 400, { error: 'user_email_missing' });

    const name = String((userRow as any)?.full_name || '').trim() || email;

    const { data: billingRow, error: billingErr } = await supabase
      .from('user_billing')
      .select('cpf_cnpj')
      .eq('user_id', auth.userId)
      .single();

    if (billingErr || !billingRow?.cpf_cnpj) {
      return sendJson(res, 400, { error: 'cpf_required' });
    }

    const cpfCnpj = String((billingRow as any).cpf_cnpj || '').trim();
    if (!cpfCnpj) return sendJson(res, 400, { error: 'cpf_required' });

    const customer = await findOrCreateCustomer({ name, email, cpfCnpj });

    const externalReference = `${auth.userId}:${planDef.plan}:${planDef.cycle}`;

    const subscription = await createSubscription({
      customerId: customer.id,
      externalReference,
      description: planDef.description,
      value: planDef.value,
      cycle: planDef.cycle,
    });

    const invoiceUrl = subscription?.invoiceUrl || (await getFirstPaymentInvoiceUrl(subscription.id));

    // Store subscription id immediately (helps support + later webhooks)
    await supabase
      .from('users')
      .update({
        asaas_subscription_id: String(subscription.id || ''),
        subscription_updated_at: new Date().toISOString(),
      })
      .eq('id', auth.userId);

    return sendJson(res, 200, {
      ok: true,
      provider: 'asaas',
      sku,
      plan: planDef.plan,
      cycle: planDef.cycle,
      subscriptionId: subscription?.id,
      invoiceUrl,
    });
  } catch (err: any) {
    console.error('[asaas.checkout] error', err);
    return sendJson(res, 500, { error: err?.message || 'internal_error' });
  }
}

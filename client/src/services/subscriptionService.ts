import { supabase } from './supabase';

async function getAuthToken() {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not_authenticated');
  return token;
}

export async function createAsaasCheckout(sku: 'starter_mensal' | 'starter_anual' | 'pro_mensal' | 'pro_anual'): Promise<{ ok: boolean; invoiceUrl?: string | null; subscriptionId?: string; error?: string; }> {
  const token = await getAuthToken();

  const resp = await fetch('/api/asaas/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ sku })
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // surface known errors
    const msg = payload?.error || 'asaas_checkout_failed';
    const e: any = new Error(msg);
    (e as any).code = msg;
    throw e;
  }
  return payload as any;
}

export async function saveBillingCpfCnpj(cpfCnpj: string): Promise<{ ok: boolean }>{
  const token = await getAuthToken();

  const resp = await fetch('/api/billing/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ cpfCnpj })
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = payload?.error || 'billing_profile_save_failed';
    throw new Error(msg);
  }
  return payload as { ok: boolean };
}

export async function cancelSubscription(): Promise<{ ok: boolean }>{
  const token = await getAuthToken();

  const resp = await fetch('/api/subscription?action=cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = payload?.error || 'cancel_failed';
    throw new Error(msg);
  }
  return payload as { ok: boolean };
}

export async function syncSubscription(): Promise<{ ok: boolean; planName?: string; status?: string }>{
  const token = await getAuthToken();

  const resp = await fetch('/api/subscription?action=sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = payload?.error || 'sync_failed';
    throw new Error(msg);
  }
  return payload as { ok: boolean; planName?: string; status?: string };
}


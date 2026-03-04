import { supabase } from './supabase';

export async function cancelSubscription(): Promise<{ ok: boolean }> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not_authenticated');

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

/**
 * Get a dynamic checkout URL from the backend.
 * The URL includes the user's ID as external_reference so the webhook
 * can always match the payment to the correct user.
 */
export async function getCheckoutUrl(planKey: string): Promise<string> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  // Build request with optional auth
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`/api/checkout?plan=${encodeURIComponent(planKey)}`, {
    method: 'GET',
    headers,
  });

  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(payload?.error || 'checkout_failed');
  }
  return payload.url as string;
}

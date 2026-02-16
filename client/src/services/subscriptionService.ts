import { supabase } from './supabase';

export async function cancelSubscription(): Promise<{ ok: boolean }>{
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

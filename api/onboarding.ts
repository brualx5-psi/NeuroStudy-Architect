/**
 * POST /api/onboarding
 * Called by the frontend right after a new user row is created.
 * Sends a signup welcome email (free plan, no billing mention).
 * Safe to call multiple times — silently skips if email already sent.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { getAuthContext } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendJson } from './_lib/http.js';
import { sendSignupWelcomeEmail } from './_lib/email.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const allowedOrigin = process.env.PUBLIC_SITE_URL || 'https://neurostudy.com.br';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  const auth = await getAuthContext(req);
  if (!auth?.userId) return sendJson(res, 401, { error: 'unauthorized' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return sendJson(res, 500, { error: 'supabase_not_available' });

  const { data: user } = await supabase
    .from('users')
    .select('id, email, full_name, signup_email_sent')
    .eq('id', auth.userId)
    .single();

  if (!user) return sendJson(res, 404, { error: 'user_not_found' });

  // Skip if already sent (idempotent)
  if ((user as any).signup_email_sent) {
    return sendJson(res, 200, { ok: true, skipped: true });
  }

  const email = String((user as any).email || auth.email || '').trim();
  if (!email) return sendJson(res, 200, { ok: true, skipped: true, reason: 'no_email' });

  try {
    await sendSignupWelcomeEmail({ toEmail: email, name: (user as any).full_name });

    // Mark as sent so we don't resend on future logins
    await supabase
      .from('users')
      .update({ signup_email_sent: true })
      .eq('id', auth.userId);

    console.log('[onboarding] signup welcome email sent', { userId: auth.userId, email });
    return sendJson(res, 200, { ok: true });
  } catch (e: any) {
    console.error('[onboarding] signup email failed (ignored)', e?.message);
    return sendJson(res, 200, { ok: true, emailError: e?.message });
  }
}

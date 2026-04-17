/**
 * Admin: send a test welcome email
 *
 * POST /api/admin/testEmail
 * Body: { toEmail: string, name?: string, plan?: 'starter'|'pro'|'free' }
 *
 * Requires logged-in admin user (users.is_admin = true).
 */

import { getAuthContext } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';
import { sendPlanUpgradeEmail, sendSignupWelcomeEmail } from '../_lib/email.js';

type Body = {
  toEmail?: string;
  name?: string;
  plan?: 'free' | 'starter' | 'pro';
};

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  const auth = await getAuthContext(req);
  if (!auth?.userId) return sendJson(res, 401, { error: 'unauthorized' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return sendJson(res, 500, { error: 'supabase_not_available' });

  const { data: adminRow } = await supabase
    .from('users')
    .select('id, is_admin')
    .eq('id', auth.userId)
    .single();

  if (!(adminRow as any)?.is_admin) return sendJson(res, 403, { error: 'forbidden' });

  let body: Body = {};
  try {
    body = await readJson<Body>(req);
  } catch {
    return sendJson(res, 400, { error: 'invalid_json' });
  }

  const toEmail = String(body.toEmail || '').trim();
  if (!toEmail || !toEmail.includes('@')) return sendJson(res, 400, { error: 'toEmail_invalid' });

  const plan = (body.plan || 'starter') as any;

  const diagnostics = {
    ZEPTOMAIL_TOKEN: process.env.ZEPTOMAIL_TOKEN ? 'set' : 'MISSING',
    ZEPTOMAIL_FROM_EMAIL: process.env.ZEPTOMAIL_FROM_EMAIL || 'MISSING',
    ZEPTOMAIL_FROM_NAME: process.env.ZEPTOMAIL_FROM_NAME || '(default: NeuroStudy)',
  };

  const type = String((body as any).type || 'upgrade');

  try {
    const result = type === 'signup'
      ? await sendSignupWelcomeEmail({ toEmail, name: body.name || null })
      : await sendPlanUpgradeEmail({ toEmail, name: body.name || null, planName: plan });
    return sendJson(res, 200, { ok: true, diagnostics, result });
  } catch (e: any) {
    const msg = String(e?.message || e);
    return sendJson(res, 500, { ok: false, diagnostics, error: msg });
  }
}

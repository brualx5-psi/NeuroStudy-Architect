/**
 * Admin: Manual plan override (temporary)
 *
 * POST /api/admin/overridePlan
 * Body: { userId: string, plan: 'free'|'starter'|'pro'|null, hours?: number, reason?: string }
 *
 * Requires logged-in admin user (users.is_admin = true).
 */

import { getAuthContext } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';

type PlanName = 'free' | 'starter' | 'pro';

type Body = {
  userId?: string;
  plan?: PlanName | null;
  hours?: number;
  reason?: string;
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

  // Check admin
  const { data: adminRow, error: adminErr } = await supabase
    .from('users')
    .select('id, is_admin')
    .eq('id', auth.userId)
    .single();

  if (adminErr || !adminRow || !(adminRow as any).is_admin) {
    return sendJson(res, 403, { error: 'forbidden' });
  }

  let body: Body = {};
  try {
    body = await readJson<Body>(req);
  } catch {
    return sendJson(res, 400, { error: 'invalid_json' });
  }

  const userId = String(body.userId || '').trim();
  if (!userId) return sendJson(res, 400, { error: 'userId_required' });

  const plan = body.plan === null ? null : (String(body.plan || '').toLowerCase() as any);
  const allowed = plan === null || plan === 'free' || plan === 'starter' || plan === 'pro';
  if (!allowed) return sendJson(res, 400, { error: 'invalid_plan' });

  const hoursRaw = typeof body.hours === 'number' ? body.hours : 24;
  const hours = Math.max(1, Math.min(24 * 30, Math.floor(hoursRaw))); // 1h .. 30d

  const expiresAt = plan
    ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    : null;

  const reason = String(body.reason || '').trim().slice(0, 500) || null;

  const { error: updErr } = await supabase
    .from('users')
    .update({
      manual_plan_override: plan,
      manual_override_expires_at: expiresAt,
      manual_override_reason: reason,
      manual_override_by: auth.userId,
    })
    .eq('id', userId);

  if (updErr) {
    console.error('[admin.overridePlan] update failed', updErr);
    return sendJson(res, 500, { error: 'update_failed' });
  }

  return sendJson(res, 200, {
    ok: true,
    userId,
    plan,
    expiresAt,
    hours: plan ? hours : null,
  });
}

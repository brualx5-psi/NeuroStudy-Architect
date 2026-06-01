import { getAuthContext } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { sendJson, readJson } from '../_lib/http.js';
import { setCorsHeaders } from '../_lib/cors.js';

function cleanCpfCnpj(v: string) {
  return String(v || '').replace(/\D+/g, '');
}

function isValidLen(v: string) {
  // Basic length check only (11 CPF / 14 CNPJ)
  return v.length === 11 || v.length === 14;
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const auth = await getAuthContext(req);
  if (!auth?.userId) return sendJson(res, 401, { error: 'unauthorized' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return sendJson(res, 500, { error: 'supabase_not_available' });

  try {
    const body = await readJson<{ cpfCnpj?: string }>(req);
    const cpfCnpj = cleanCpfCnpj(body?.cpfCnpj || '');
    if (!cpfCnpj || !isValidLen(cpfCnpj)) {
      return sendJson(res, 400, { error: 'invalid_cpf_cnpj' });
    }

    const now = new Date().toISOString();

    // Upsert by user_id
    const { error } = await supabase
      .from('user_billing')
      .upsert({
        user_id: auth.userId,
        cpf_cnpj: cpfCnpj,
        updated_at: now,
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[billing.profile] upsert failed', error);
      return sendJson(res, 500, { error: 'billing_profile_save_failed' });
    }

    return sendJson(res, 200, { ok: true });
  } catch (err: any) {
    console.error('[billing.profile] error', err);
    return sendJson(res, 500, { error: err?.message || 'internal_error' });
  }
}

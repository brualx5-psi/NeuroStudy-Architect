import { getAuthContext } from '../_lib/auth.js';
import { buildLimitResponse } from '../_lib/limitResponses.js';
import { getClientIp, readJson, sendJson } from '../_lib/http.js';
import { rateLimit } from '../_lib/rateLimit.js';
import { canPerformAction } from '../_lib/usageLimits.js';
import { generateDiagram } from '../_lib/gemini.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { ensureUsageRow, getCurrentMonth, getUserAccess, incrementUsage, toUsageSnapshot } from '../_lib/usageStore.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const auth = await getAuthContext(req);
  if (!auth) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  const ip = getClientIp(req);
  const rateKey = `diagram:${auth.userId || ip}`;
  const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 30 });
  if (!rate.allowed) {
    return sendJson(res, 429, buildLimitResponse('rate_limited'));
  }

  const body = await readJson<{ description: string }>(req);

  const { planName, isAdmin } = await getUserAccess(auth.userId);
  const month = getCurrentMonth();
  const usageRow = await ensureUsageRow(auth.userId, month, planName);
  const usageSnapshot = toUsageSnapshot(usageRow);

  const check = canPerformAction(planName, usageSnapshot, [], 'chat', { textInput: body.description || '', isAdmin });
  if (!check.allowed) {
    return sendJson(res, 402, buildLimitResponse(check.reason || 'monthly_tokens_exhausted', check.actionSuggestion));
  }

  try {
    const { code, url, usageTokens } = await generateDiagram(planName, body.description || '');

    // Optional: fetch rendered image and upload to Supabase Storage, then return a public URL.
    // This avoids client-side CORS/CSP issues with third-party renderers (mermaid.ink).
    let publicUrl = url;
    const supabase = getSupabaseAdmin();
    const bucket = process.env.SUPABASE_DIAGRAMS_BUCKET || 'diagrams';

    if (supabase && url) {
      try {
        const imageRes = await fetch(url);
        if (!imageRes.ok) throw new Error(`failed_to_fetch_mermaid_image status=${imageRes.status}`);
        const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
        const bytes = new Uint8Array(await imageRes.arrayBuffer());

        const fileExt = contentType.includes('png') ? 'png' : 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const objectPath = `${auth.userId}/${fileName}`;

        const upload = await supabase.storage.from(bucket).upload(objectPath, bytes, {
          contentType,
          upsert: true
        });
        if (upload.error) throw upload.error;

        const pub = supabase.storage.from(bucket).getPublicUrl(objectPath);
        publicUrl = pub?.data?.publicUrl || url;
      } catch (e: any) {
        console.warn('[diagram] upload_failed', e?.message || e);
      }
    }

    if (process.env.DEBUG_DIAGRAM_LOGS === '1') {
      console.log('[diagram] apiResponse', { codeChars: (code || '').length, hasUrl: !!url, hasPublicUrl: !!publicUrl });
    }

    await incrementUsage(auth.userId, month, planName, {
      tokens_estimated: check.estimatedTokens || 0,
      tokens_used: usageTokens || 0
    });

    return sendJson(res, 200, {
      code,
      url: publicUrl,
      usage: {
        estimatedTokens: check.estimatedTokens || 0,
        actualTokens: usageTokens || null
      }
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: 'gemini_error', message: error?.message || 'Gemini error' });
  }
}

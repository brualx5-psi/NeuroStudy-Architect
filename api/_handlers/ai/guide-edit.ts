import { getAuthContext } from '../../_lib/auth.js';
import { buildLimitResponse } from '../../_lib/limitResponses.js';
import { getClientIp, readJson, sendJson } from '../../_lib/http.js';
import { rateLimit } from '../../_lib/rateLimit.js';
import { canPerformAction } from '../../_lib/usageLimits.js';
import { proposeGuideEdit } from '../../_lib/gemini.js';
import { applyGuideOperations } from '../../_lib/guideEdit.js';
import { buildProviderLimitPayload } from '../../_lib/providerLimits.js';
import { ensureUsageRow, getCurrentMonth, getUserAccess, incrementUsage, toUsageSnapshot } from '../../_lib/usageStore.js';

/**
 * Devolve uma PROPOSTA de roteiro editado. Nada e persistido aqui: o cliente
 * mostra as mudancas e so grava depois que o aluno clica em aprovar.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const auth = await getAuthContext(req);
  if (!auth) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  const ip = getClientIp(req);
  const rateKey = `guide-edit:${auth.userId || ip}`;
  const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 20 });
  if (!rate.allowed) {
    return sendJson(res, 429, buildLimitResponse('rate_limited'));
  }

  const body = await readJson<{
    guide: any;
    instruction: string;
    history?: Array<{ role: string; text: string; id?: string }>;
  }>(req);

  const instruction = String(body?.instruction || '').trim();
  if (!body?.guide || !instruction) {
    return sendJson(res, 400, { error: 'missing_guide_or_instruction' });
  }

  const { planName, isAdmin } = await getUserAccess(auth.userId);
  const month = getCurrentMonth();
  const usageRow = await ensureUsageRow(auth.userId, month, planName);
  const usageSnapshot = toUsageSnapshot(usageRow);

  const check = canPerformAction(planName, usageSnapshot, [], 'chat', {
    textInput: instruction,
    chatHistory: body.history || [],
    isAdmin
  });
  if (!check.allowed) {
    return sendJson(res, 402, buildLimitResponse(check.reason || 'monthly_tokens_exhausted', check.actionSuggestion));
  }

  try {
    const { reply, summary, operations, usageTokens } = await proposeGuideEdit(
      planName,
      body.guide,
      instruction,
      body.history || []
    );

    const { guide, changes, rejected } = applyGuideOperations(body.guide, operations);
    const estimatedTokens = check.estimatedTokens || 0;

    await incrementUsage(auth.userId, month, planName, {
      chat_messages: 1,
      tokens_estimated: estimatedTokens,
      tokens_used: usageTokens || 0,
      chat_tokens_estimated: estimatedTokens,
      chat_tokens_used: usageTokens || 0
    });

    return sendJson(res, 200, {
      reply,
      summary,
      changes,
      rejected,
      // Só devolvemos o roteiro proposto quando algo realmente mudou.
      guide: changes.length ? guide : null,
      usage: {
        estimatedTokens,
        actualTokens: usageTokens || null
      }
    });
  } catch (error: any) {
    console.error('[guide-edit] Gemini error:', error?.message || error);
    const providerLimit = buildProviderLimitPayload(error);
    if (providerLimit) {
      return sendJson(res, providerLimit.status, providerLimit.body);
    }
    return sendJson(res, 500, { error: 'gemini_error', message: error?.message || 'Gemini error' });
  }
}

import { getAuthContext } from '../_lib/auth.js';
import { buildLimitResponse } from '../_lib/limitResponses.js';
import { getClientIp, readJson, sendJson } from '../_lib/http.js';
import { rateLimit } from '../_lib/rateLimit.js';
import { canPerformAction } from '../_lib/usageLimits.js';
import { generateQuiz } from '../_lib/gemini.js';
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
  const rateKey = `quiz:${auth.userId || ip}`;
  const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 10 });
  if (!rate.allowed) {
    return sendJson(res, 429, buildLimitResponse('rate_limited'));
  }

  const body = await readJson<{
    guide: any;
    config?: { quantity: number; difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'; distribution?: { mc: number; open: number } };
  }>(req);

  const { planName, isAdmin } = await getUserAccess(auth.userId);
  const month = getCurrentMonth();
  const usageRow = await ensureUsageRow(auth.userId, month, planName);
  const usageSnapshot = toUsageSnapshot(usageRow);
  const textInput = JSON.stringify(body.guide || {});

  const check = canPerformAction(planName, usageSnapshot, [], 'quiz', { textInput, isAdmin });
  if (!check.allowed) {
    return sendJson(res, 402, buildLimitResponse(check.reason || 'monthly_tokens_exhausted', check.actionSuggestion));
  }

  try {
    const { quiz, usageTokens } = await generateQuiz(planName, body.guide || {}, body.config);
    await incrementUsage(auth.userId, month, planName, {
      tokens_estimated: check.estimatedTokens || 0,
      tokens_used: usageTokens || 0
    });

    return sendJson(res, 200, {
      quiz,
      usage: {
        estimatedTokens: check.estimatedTokens || 0,
        actualTokens: usageTokens || null
      }
    });
  } catch (error: any) {
    if (error?.message === 'INVALID_JSON_FROM_MODEL') {
      return sendJson(res, 502, {
        error: 'gemini_parse_error',
        message: 'Falha ao interpretar a resposta da IA. Tente novamente.'
      });
    }

    return sendJson(res, 500, { error: 'gemini_error', message: error?.message || 'Gemini error' });
  }
}

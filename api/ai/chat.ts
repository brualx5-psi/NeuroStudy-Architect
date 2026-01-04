import { getAuthContext } from '../_lib/auth';
import { buildLimitResponse } from '../_lib/limitResponses';
import { getClientIp, readJson, sendJson } from '../_lib/http';
import { rateLimit } from '../_lib/rateLimit';
import { canPerformAction } from '../_lib/usageLimits';
import { sendChatMessage } from '../_lib/gemini';
import { ensureUsageRow, getCurrentMonth, getUserPlan, incrementUsage, toUsageSnapshot } from '../_lib/usageStore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const auth = await getAuthContext(req);
  if (!auth) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  const ip = getClientIp(req);
  const rateKey = `chat:${auth.userId || ip}`;
  const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 30 });
  if (!rate.allowed) {
    return sendJson(res, 429, buildLimitResponse('rate_limited'));
  }

  const body = await readJson<{
    history: Array<{ role: string; text: string }>;
    message: string;
  }>(req);

  const planName = await getUserPlan(auth.userId);
  const month = getCurrentMonth();
  const usageRow = await ensureUsageRow(auth.userId, month, planName);
  const usageSnapshot = toUsageSnapshot(usageRow);

  const check = canPerformAction(planName, usageSnapshot, [], 'chat', {
    textInput: body.message,
    chatHistory: body.history || []
  });
  if (!check.allowed) {
    return sendJson(res, 402, buildLimitResponse(check.reason || 'monthly_tokens_exhausted', check.actionSuggestion));
  }

  try {
    const { text, usageTokens } = await sendChatMessage(planName, body.history || [], body.message || '');
    const estimatedTokens = check.estimatedTokens || 0;

    await incrementUsage(auth.userId, month, planName, {
      chat_messages: 1,
      tokens_estimated: estimatedTokens,
      tokens_used: usageTokens || 0,
      chat_tokens_estimated: estimatedTokens,
      chat_tokens_used: usageTokens || 0
    });

    return sendJson(res, 200, {
      text,
      usage: {
        estimatedTokens,
        actualTokens: usageTokens || null
      }
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: 'gemini_error', message: error?.message || 'Gemini error' });
  }
}

import { getAuthContext } from '../_lib/auth';
import { buildLimitResponse } from '../_lib/limitResponses';
import { getClientIp, readJson, sendJson } from '../_lib/http';
import { rateLimit } from '../_lib/rateLimit';
import { canPerformAction } from '../_lib/usageLimits';
import { transcribeMedia } from '../_lib/gemini';
import { ensureUsageRow, getCurrentMonth, getUserPlan, incrementUsage, toUsageSnapshot } from '../_lib/usageStore';

const getApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  return apiKey;
};

const waitForFileActive = async (fileName: string, apiKey: string) => {
  let state = 'PROCESSING';
  let attempts = 0;
  while (state === 'PROCESSING' && attempts < 20) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const checkResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
    const checkResult = await checkResponse.json();
    state = checkResult.state;
    attempts += 1;
    if (state === 'FAILED') throw new Error('File processing failed');
  }
  return state;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const auth = await getAuthContext(req);
  if (!auth) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  const ip = getClientIp(req);
  const rateKey = `youtube:${auth.userId || ip}`;
  const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 10 });
  if (!rate.allowed) {
    return sendJson(res, 429, buildLimitResponse('rate_limited'));
  }

  const body = await readJson<{
    action: 'start' | 'transcribe';
    mimeType?: string;
    fileSize?: number;
    displayName?: string;
    fileUri?: string;
    fileName?: string;
    durationMinutes?: number;
  }>(req);

  const planName = await getUserPlan(auth.userId);
  const month = getCurrentMonth();
  const usageRow = await ensureUsageRow(auth.userId, month, planName);
  const usageSnapshot = toUsageSnapshot(usageRow);

  const minutes = body.durationMinutes || 0;
  const check = canPerformAction(planName, usageSnapshot, [], 'youtube', { youtubeMinutes: minutes });
  if (!check.allowed) {
    return sendJson(res, 402, buildLimitResponse(check.reason || 'monthly_limit', check.actionSuggestion));
  }

  try {
    if (body.action === 'start') {
      const apiKey = getApiKey();
      const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
      const initialResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(body.fileSize || 0),
          'X-Goog-Upload-Header-Content-Type': body.mimeType || 'application/octet-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file: { display_name: body.displayName || 'User Upload' } })
      });

      const uploadHeader = initialResponse.headers.get('x-goog-upload-url');
      if (!uploadHeader) {
        return sendJson(res, 500, { error: 'upload_start_failed' });
      }

      return sendJson(res, 200, { uploadUrl: uploadHeader });
    }

    if (body.action === 'transcribe') {
      const apiKey = getApiKey();
      if (!body.fileUri || !body.fileName || !body.mimeType) {
        return sendJson(res, 400, { error: 'missing_file_data' });
      }

      await waitForFileActive(body.fileName, apiKey);
      const { transcript, usageTokens } = await transcribeMedia(planName, body.fileUri, body.mimeType);
      const estimatedTokens = transcript ? Math.ceil(transcript.length / 4) : 0;

      await incrementUsage(auth.userId, month, planName, {
        youtube_minutes_used: minutes,
        tokens_estimated: estimatedTokens,
        tokens_used: usageTokens || 0
      });

      return sendJson(res, 200, {
        transcript,
        usage: {
          estimatedTokens,
          actualTokens: usageTokens || null
        }
      });
    }

    return sendJson(res, 400, { error: 'invalid_action' });
  } catch (error: any) {
    return sendJson(res, 500, { error: 'gemini_error', message: error?.message || 'Gemini error' });
  }
}

import { getAuthContext } from '../_lib/auth.js';
import { buildLimitResponse } from '../_lib/limitResponses.js';
import { getClientIp, readJson, sendJson } from '../_lib/http.js';
import { rateLimit } from '../_lib/rateLimit.js';
import { generateStudyGuide } from '../_lib/gemini.js';
import { ensureUsageRow, getCurrentMonth, getUserPlan, incrementUsage, toUsageSnapshot } from '../_lib/usageStore.js';
import { prepareSourcesForRoadmap, SourceErrorCode } from '../_lib/sourceResolver.js';

// Mapeamento de erros para respostas humanizadas
const ERROR_RESPONSES: Record<SourceErrorCode, { status: number; message: string; suggestion?: string }> = {
  UNSUPPORTED_LINK_REQUIRES_TRANSCRIPT: {
    status: 422,
    message: 'Este link parece exigir login ou não oferece transcrição acessível.',
    suggestion: 'Envie o arquivo de vídeo/áudio, cole a transcrição/legenda, ou use um link do YouTube.'
  },
  VIDEO_TOO_LONG: {
    status: 422,
    message: 'Vídeo muito longo para o seu plano.',
    suggestion: 'Divida em partes menores ou envie apenas um trecho.'
  },
  ROADMAP_TOO_LARGE: {
    status: 422,
    message: 'Conteúdo muito extenso para processar de uma vez.',
    suggestion: 'Divida em 2 roteiros ou remova algumas fontes.'
  },
  TOO_MANY_SOURCES: {
    status: 422,
    message: 'Muitas fontes para um único roteiro.',
    suggestion: 'Remova algumas fontes e tente novamente.'
  },
  MONTHLY_LIMIT: {
    status: 402,
    message: 'Limite mensal atingido.',
    suggestion: 'Aguarde o próximo mês ou faça upgrade do plano.'
  },
  FETCH_FAILED: {
    status: 422,
    message: 'Não foi possível baixar a transcrição do link.',
    suggestion: 'Cole a transcrição manualmente ou use outro link.'
  }
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
  const rateKey = `roadmap:${auth.userId || ip}`;
  const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 10 });
  if (!rate.allowed) {
    return sendJson(res, 429, buildLimitResponse('rate_limited'));
  }

  const body = await readJson<{
    sources: any[];
    mode: string;
    isBook?: boolean;
  }>(req);

  const planName = await getUserPlan(auth.userId);
  const month = getCurrentMonth();
  const usageRow = await ensureUsageRow(auth.userId, month, planName);
  const usageSnapshot = toUsageSnapshot(usageRow);

  // NOVA VALIDAÇÃO UNIFICADA: prepara e valida TODAS as fontes antes de chamar IA
  const prepareResult = await prepareSourcesForRoadmap(
    body.sources || [],
    planName,
    {
      youtube_minutes_used: usageSnapshot.youtube_minutes_used,
      roadmaps_created: usageSnapshot.roadmaps_created,
      monthly_tokens_used: usageSnapshot.monthly_tokens_used
    },
    auth.userId // Admin bypass: se for admin, pode usar qualquer link
  );

  // Se validação falhou, retornar erro humanizado
  if (!prepareResult.success) {
    const errorCode = prepareResult.error || 'MONTHLY_LIMIT';
    const errorResponse = ERROR_RESPONSES[errorCode] || ERROR_RESPONSES.MONTHLY_LIMIT;

    return sendJson(res, errorResponse.status, {
      error: errorCode,
      message: prepareResult.errorMessage || errorResponse.message,
      suggestion: errorResponse.suggestion,
      actionSuggestion: prepareResult.actionSuggestion
    });
  }

  try {
    // Usar fontes normalizadas para gerar roteiro
    const sourcesForGemini = (prepareResult.sources || []).map(s => ({
      id: s.id,
      name: s.name,
      type: s.originalType,
      content: s.extractedText,
      textContent: s.extractedText,
      isPrimary: false
    }));

    // Marcar primeira fonte como primária
    if (sourcesForGemini.length > 0) {
      sourcesForGemini[0].isPrimary = true;
    }

    const { guide, usageTokens } = await generateStudyGuide(
      planName,
      sourcesForGemini,
      body.mode || 'NORMAL',
      Boolean(body.isBook)
    );

    // Incrementar uso APÓS sucesso
    await incrementUsage(auth.userId, month, planName, {
      roadmaps_created: 1,
      tokens_estimated: prepareResult.estimatedTokens || 0,
      tokens_used: usageTokens || 0,
      youtube_minutes_used: prepareResult.totalDurationMinutes || 0
    });

    return sendJson(res, 200, {
      guide,
      usage: {
        estimatedTokens: prepareResult.estimatedTokens || 0,
        actualTokens: usageTokens || null,
        totalDurationMinutes: prepareResult.totalDurationMinutes || 0
      }
    });
  } catch (error: any) {
    console.error('[roadmap] Gemini error:', error?.message);
    return sendJson(res, 500, { error: 'gemini_error', message: error?.message || 'Erro ao gerar roteiro' });
  }
}

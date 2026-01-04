import { getAuthContext } from '../_lib/auth.js';
import { buildLimitResponse } from '../_lib/limitResponses.js';
import { getClientIp, readJson, sendJson } from '../_lib/http.js';
import { rateLimit } from '../_lib/rateLimit.js';
import { canPerformAction } from '../_lib/usageLimits.js';
import { callGemini } from '../_lib/gemini.js';
import { ensureUsageRow, getCurrentMonth, getUserPlan, incrementUsage, toUsageSnapshot } from '../_lib/usageStore.js';

type WebResearchMode = 'grounding' | 'deep_research' | 'quality';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const auth = await getAuthContext(req);
  if (!auth) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  const ip = getClientIp(req);
  const rateKey = `web:${auth.userId || ip}`;
  const rate = rateLimit(rateKey, { windowMs: 60_000, limit: 10 });
  if (!rate.allowed) {
    return sendJson(res, 429, buildLimitResponse('rate_limited'));
  }

  const body = await readJson<{
    mode: WebResearchMode;
    query?: string;
    articles?: any[];
    title?: string;
    abstractText?: string;
    assessmentType?: 'amstar' | 'rob2' | 'nos' | 'agree';
  }>(req);

  const planName = await getUserPlan(auth.userId);
  const month = getCurrentMonth();
  const usageRow = await ensureUsageRow(auth.userId, month, planName);
  const usageSnapshot = toUsageSnapshot(usageRow);

  const check = canPerformAction(planName, usageSnapshot, [], 'web_search');
  if (!check.allowed) {
    return sendJson(res, 402, buildLimitResponse(check.reason || 'web_search_limit', check.actionSuggestion));
  }

  try {
    if (body.mode === 'deep_research') {
      const prompt = `Voce e um pesquisador cientifico experiente. Analise estes artigos sobre "${body.query || ''}" e forneca:

ARTIGOS ENCONTRADOS:
${JSON.stringify(body.articles || [], null, 2)}

TAREFA:
1. Resuma em 2-3 frases o que a literatura cientifica diz sobre este tema.
2. Identifique os 3 principais consensos ou descobertas.
3. Sugira 2-3 termos de busca mais especificos (em ingles) para encontrar estudos melhores.
4. Indique se ha alguma lacuna ou controversia no tema.

Responda de forma concisa e util para um estudante. Use bullet points. Maximo 200 palavras.`;

      const { text, usageTokens } = await callGemini({
        planName,
        taskType: 'chat',
        prompt,
        responseMimeType: 'text/plain'
      });

      await incrementUsage(auth.userId, month, planName, {
        web_searches_used: 1,
        tokens_estimated: 0,
        tokens_used: usageTokens || 0
      });

      return sendJson(res, 200, { insight: text, usage: { actualTokens: usageTokens || null } });
    }

    if (body.mode === 'grounding') {
      const prompt = `Voce e um assistente de pesquisa cientifica. Busque artigos cientificos sobre: "${body.query || ''}"

TAREFA: Encontre 10-15 artigos cientificos relevantes (priorizando meta-analises, revisoes sistematicas e guidelines).

Para cada artigo encontrado, retorne um JSON com esta estrutura:
{
  "articles": [
    {
      "title": "Titulo do artigo",
      "author": "Primeiro autor ou organizacao",
      "year": 2024,
      "type": "meta-analysis" | "systematic-review" | "guideline" | "rct" | "cohort" | "other",
      "description": "Breve descricao do que o estudo descobriu (1-2 frases)",
      "url": "URL do artigo ou DOI"
    }
  ]
}

IMPORTANTE:
- Priorize artigos de revistas cientificas renomadas (Lancet, NEJM, JAMA, Cochrane, etc.)
- Inclua o DOI ou link direto sempre que possivel
- Foque em estudos recentes (ultimos 5-10 anos)
- Retorne APENAS o JSON, sem markdown ou explicacoes`;

      const { text, usageTokens } = await callGemini({
        planName,
        taskType: 'chat',
        prompt,
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json'
      });

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const articles = Array.isArray(parsed?.articles) ? parsed.articles : parsed;

      await incrementUsage(auth.userId, month, planName, {
        web_searches_used: 1,
        tokens_estimated: 0,
        tokens_used: usageTokens || 0
      });

      return sendJson(res, 200, { articles, usage: { actualTokens: usageTokens || null } });
    }

    if (body.mode === 'quality') {
      let prompt = '';
      if (body.assessmentType === 'amstar') {
        prompt = `Voce e um especialista em avaliacao de evidencias cientificas. Analise esta meta-analise/revisao sistematica usando criterios simplificados do AMSTAR 2.

TITULO: ${body.title}
RESUMO: ${body.abstractText || 'Nao disponivel'}

Baseado nas informacoes disponiveis, avalie de 0-16 pontos considerando:
1. Protocolo registrado previamente?
2. Busca abrangente na literatura?
3. Justificativa para exclusao de estudos?
4. Avaliacao de risco de vies?
5. Metodos estatisticos apropriados?
6. Heterogeneidade discutida?
7. Conflitos de interesse declarados?

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [numero de 0 a 16]
QUALIDADE: [Alta/Moderada/Baixa/Criticamente Baixa]
RESUMO: [1 frase sobre a qualidade metodologica]`;
      } else if (body.assessmentType === 'rob2') {
        prompt = `Voce e um especialista em avaliacao de evidencias cientificas. Analise este Ensaio Clinico Randomizado (RCT) usando os dominios do RoB 2 (Risk of Bias 2).

TITULO: ${body.title}
RESUMO: ${body.abstractText || 'Nao disponivel'}

Avalie os 5 dominios do RoB 2:
1. Randomizacao adequada?
2. Desvios das intervencoes pretendidas?
3. Dados de desfecho faltantes?
4. Mensuracao do desfecho adequada?
5. Selecao dos resultados reportados?

RESPONDA EXATAMENTE NESTE FORMATO:
RISCO: [Baixo/Algumas Preocupacoes/Alto]
SCORE: [numero de 1 a 5, onde 5=baixo risco, 1=alto risco]
RESUMO: [1 frase sobre o risco de vies do estudo]`;
      } else if (body.assessmentType === 'nos') {
        prompt = `Voce e um especialista em avaliacao de evidencias. Analise este estudo de coorte/caso-controle usando a Newcastle-Ottawa Scale (NOS).

TITULO: ${body.title}
RESUMO: ${body.abstractText || 'Nao disponivel'}

Avalie os 3 dominios do NOS (total 9 estrelas):
1. SELECAO (4 estrelas): representatividade, selecao controles, definicao exposicao
2. COMPARABILIDADE (2 estrelas): controle de confundidores
3. DESFECHO (3 estrelas): avaliacao, seguimento adequado

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [numero de 0 a 9]
QUALIDADE: [Alta (7-9)/Moderada (4-6)/Baixa (0-3)]
RESUMO: [1 frase sobre a qualidade metodologica]`;
      } else if (body.assessmentType === 'agree') {
        prompt = `Voce e um especialista em avaliacao de guidelines clinicas. Analise esta diretriz usando criterios do AGREE II.

TITULO: ${body.title}
RESUMO: ${body.abstractText || 'Nao disponivel'}

Avalie os 6 dominios do AGREE II:
1. Escopo e Proposito
2. Envolvimento das Partes Interessadas
3. Rigor do Desenvolvimento
4. Clareza da Apresentacao
5. Aplicabilidade
6. Independencia Editorial

RESPONDA EXATAMENTE NESTE FORMATO:
SCORE: [numero de 1 a 7, onde 7=excelente]
RECOMENDACAO: [Fortemente Recomendada/Recomendada com Modificacoes/Nao Recomendada]
RESUMO: [1 frase sobre a qualidade da diretriz]`;
      }

      const { text, usageTokens } = await callGemini({
        planName,
        taskType: 'chat',
        prompt,
        responseMimeType: 'text/plain'
      });

      await incrementUsage(auth.userId, month, planName, {
        web_searches_used: 1,
        tokens_estimated: 0,
        tokens_used: usageTokens || 0
      });

      return sendJson(res, 200, { result: text, usage: { actualTokens: usageTokens || null } });
    }

    return sendJson(res, 400, { error: 'invalid_mode' });
  } catch (error: any) {
    return sendJson(res, 500, { error: 'gemini_error', message: error?.message || 'Gemini error' });
  }
}

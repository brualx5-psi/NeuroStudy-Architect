import { GoogleGenAI, Schema, Type } from '@google/genai';
import { PLAN_LIMITS, PlanName, TokenTaskType } from './planLimits.js';

const MODEL_FLASH = 'gemini-2.0-flash';
const MODEL_PRO = 'gemini-pro-latest';

type TaskType =
  | 'chat'
  | 'tool'
  | 'transcription'
  | 'studyGuide'
  | 'quiz'
  | 'flashcard'
  | 'slides'
  | 'diagram';

type CallGeminiOptions = {
  planName: PlanName;
  taskType: TokenTaskType;
  prompt: string;
  model?: string;
  responseMimeType?: string;
  responseSchema?: Schema;
  temperature?: number;
  systemInstruction?: string;
  parts?: Array<{ text?: string; fileData?: { mimeType: string; fileUri: string } }>;
  tools?: any[];
  timeoutMs?: number;
};

const getApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  return apiKey;
};

const getClient = () => new GoogleGenAI({ apiKey: getApiKey() });

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), timeoutMs))
  ]);
};

const fetchWithRetry = async <T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if ((error?.status === 429 || error?.message?.includes('429') || error?.status === 503) && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

const selectModel = (
  taskType: TaskType,
  contentLength: number = 0,
  sourceCount: number = 1,
  isBook: boolean = false
): string => {
  // Use Flash model for most tasks - it's more stable and faster
  // PRO model only for heavy study guides
  const alwaysFlashTasks: TaskType[] = ['chat', 'tool', 'transcription', 'diagram', 'quiz', 'flashcard'];
  if (alwaysFlashTasks.includes(taskType)) return MODEL_FLASH;

  if (taskType === 'studyGuide' || taskType === 'slides') {
    if (isBook || contentLength > 50000 || sourceCount >= 3) {
      return MODEL_PRO;
    }
  }

  return MODEL_FLASH;
};

const getTextFromResponse = (response: any) => {
  if (!response) return '';
  if (typeof response.text === 'function') return response.text();
  if (typeof response.text === 'string') return response.text;
  return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const getUsageTokens = (response: any) => {
  const usage = response?.usageMetadata;
  if (!usage) return null;
  if (typeof usage.totalTokenCount === 'number') return usage.totalTokenCount;
  if (typeof usage.totalTokens === 'number') return usage.totalTokens;
  const prompt = usage.promptTokenCount ?? 0;
  const candidates = usage.candidatesTokenCount ?? usage.candidatesTokens ?? 0;
  const total = prompt + candidates;
  return total > 0 ? total : null;
};

const parseJsonArray = (raw: string) => {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  const tryParse = (input: string) => {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    const sliced = cleaned.slice(start, end + 1);
    const slicedParsed = tryParse(sliced);
    if (slicedParsed) return slicedParsed;
  }

  throw new Error('INVALID_JSON_FROM_MODEL');
};

export const callGemini = async (options: CallGeminiOptions) => {
  const ai = getClient();
  const maxOutputTokens = PLAN_LIMITS[options.planName].max_output_tokens[options.taskType];

  const config: any = {
    temperature: options.temperature ?? 0.3
  };

  if (options.responseMimeType) config.responseMimeType = options.responseMimeType;
  if (options.responseSchema) config.responseSchema = options.responseSchema;
  if (options.systemInstruction) config.systemInstruction = options.systemInstruction;
  if (options.tools) config.tools = options.tools;
  if (typeof maxOutputTokens === 'number' && maxOutputTokens > 0) {
    config.maxOutputTokens = maxOutputTokens;
  }

  const contents = options.parts?.length
    ? { role: 'user', parts: options.parts }
    : { parts: [{ text: options.prompt }] };

  const request = {
    model: options.model || MODEL_FLASH,
    contents,
    config
  };

  const timeoutMs = options.timeoutMs ?? 60_000;
  const response = await fetchWithRetry(() =>
    withTimeout(ai.models.generateContent(request), timeoutMs)
  );
  const text = getTextFromResponse(response);
  return { text, response, usageTokens: getUsageTokens(response) };
};

const COMMON_PROPERTIES = {
  subject: { type: Type.STRING },
  overview: { type: Type.STRING },
  globalApplication: { type: Type.STRING },
  coreConcepts: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        concept: { type: Type.STRING },
        definition: { type: Type.STRING }
      },
      required: ['concept', 'definition']
    }
  },
  supportConcepts: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        concept: { type: Type.STRING },
        definition: { type: Type.STRING }
      },
      required: ['concept', 'definition']
    }
  },
  checkpoints: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        mission: { type: Type.STRING },
        timestamp: { type: Type.STRING },
        lookFor: { type: Type.STRING },
        noteExactly: { type: Type.STRING },
        drawExactly: { type: Type.STRING },
        drawLabel: { type: Type.STRING, enum: ['essential', 'suggestion', 'none'] },
        question: { type: Type.STRING }
      },
      required: ['mission', 'timestamp', 'lookFor', 'noteExactly', 'drawExactly', 'question']
    }
  }
};

const CHAPTERS_PROPERTY = {
  chapters: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        content: { type: Type.STRING, description: 'Texto corrido e fluido explicando o capitulo.' },
        paretoChunk: { type: Type.STRING, description: 'A essencia 80/20 deste capitulo.' },
        reflectionQuestion: { type: Type.STRING, description: 'Pergunta para o aluno verificar o conceito chave.' },
        coreConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              concept: { type: Type.STRING },
              definition: { type: Type.STRING },
              tools: {
                type: Type.OBJECT,
                properties: {
                  feynman: { type: Type.STRING },
                  example: { type: Type.STRING },
                  interdisciplinary: { type: Type.STRING }
                },
                nullable: true
              }
            },
            required: ['concept', 'definition']
          }
        },
        supportConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              concept: { type: Type.STRING },
              definition: { type: Type.STRING },
              tools: {
                type: Type.OBJECT,
                properties: {
                  example: { type: Type.STRING }
                },
                nullable: true
              }
            },
            required: ['concept', 'definition']
          },
          nullable: true
        }
      },
      required: ['title', 'paretoChunk', 'content', 'coreConcepts', 'reflectionQuestion']
    }
  }
};

type StudySourceInput = {
  id: string;
  name: string;
  type: string;
  content: string;
  textContent?: string;
  isPrimary?: boolean;
};

export const generateStudyGuide = async (
  planName: PlanName,
  sources: StudySourceInput[],
  mode: string,
  isBook: boolean
) => {
  const schemaProperties = isBook ? { ...COMMON_PROPERTIES, ...CHAPTERS_PROPERTY } : { ...COMMON_PROPERTIES };
  const finalSchema: Schema = {
    type: Type.OBJECT,
    properties: schemaProperties,
    required: isBook ? ['subject', 'overview', 'coreConcepts', 'chapters'] : ['subject', 'overview', 'coreConcepts', 'checkpoints']
  };

  const primarySource = sources.find((s) => s.isPrimary) || sources[0];
  const complementarySources = sources.filter((s) => s.id !== primarySource.id);

  const MAX_CHARS_PER_COMPLEMENT = 50000;
  let combinedContext = 'FONTE PRINCIPAL (Use esta estrutura como base):\n';
  combinedContext += `[ID: PRIMARY, NOME: ${primarySource.name}, TIPO: ${primarySource.type}]\n`;
  const primaryText = primarySource.textContent || primarySource.content;
  combinedContext += `${primaryText.slice(0, 100000)}\n\n`;

  if (complementarySources.length > 0) {
    combinedContext += 'FONTES COMPLEMENTARES (Use apenas para enriquecer/aprofundar):\n';
    complementarySources.forEach((src, idx) => {
      const sourceText = src.textContent || src.content;
      combinedContext += `[ID: REF_${idx + 1}, NOME: ${src.name}]\n${sourceText.slice(0, MAX_CHARS_PER_COMPLEMENT)}...\n\n`;
    });
  }

  let structureInstruction = '';
  const primaryName = primarySource.name.toLowerCase();
  if (primarySource.type === 'VIDEO' || primaryName.includes('transcri')) {
    structureInstruction = `
    ESTRUTURA OBRIGATORIA (Baseada em VIDEO/AULA):
    - O esqueleto do roteiro (Checkpoints) DEVE seguir a cronologia da Fonte Principal.
    - Use Timestamps [MM:SS] baseados na Fonte Principal.
    - Se uma informacao vier de uma Fonte Complementar, insira no momento logico correspondente da aula, citando a fonte (ex: "Conforme Apostila X").
    `;
  } else {
    structureInstruction = `
    ESTRUTURA OBRIGATORIA (Baseada em TEXTO/LIVRO):
    - O esqueleto do roteiro DEVE seguir os Topicos/Capitulos da Fonte Principal.
    - PROIBIDO INVENTAR TIMESTAMPS. Use "N/A" ou deixe vazio se o campo for obrigatorio.
    - Use "Secoes" ou "Titulos" como marcadores de progresso.
    - O campo 'chapters' e OBRIGATORIO. O campo 'checkpoints' e OPCIONAL (ou deixe vazio se redundante).
    - Integre o conteudo das Fontes Complementares dentro dos topicos da Fonte Principal.
    `;
  }

  let modeInstructions = '';
  if (isBook) {
    switch (mode) {
      case 'SURVIVAL':
        modeInstructions = 'MODO LIVRO: SOBREVIVENCIA. Gere TODOS os capitulos, mas com resumo curto (1 paragrafo) em cada um.';
        break;
      case 'HARD':
        modeInstructions = 'MODO LIVRO: HARD. Gere TODOS os capitulos com analise profunda e detalhada em cada um.';
        break;
      case 'NORMAL':
      default:
        modeInstructions = 'MODO LIVRO: NORMAL. Gere TODOS os capitulos com analise equilibrada (Principio de Pareto) em cada um.';
        break;
    }
  }

  const MASTER_PROMPT = `
  IDIOMA OBRIGATÓRIO: Responda SEMPRE em Português do Brasil (pt-BR). Nunca use inglês.
  
  Voce e o NeuroStudy Architect.
  CONTEXTO: (${isBook ? 'LIVRO COMPLETO' : 'Material de Estudo'}).
  MISSAO: Analisar e criar um guia pratico baseado em Neurociencia.

  ${structureInstruction}

  ${isBook ? `
  MODO LIVRO AVANCADO (ESTRUTURA HIERARQUICA):
  1. ADVANCE ORGANIZER ('overview'):
     - O QUE E: Preparacao cognitiva. Diga o que esperar do livro como um todo.
  2. PARETO GLOBAL ('coreConcepts' fora dos capitulos - OPCIONAL/VAZIO se redundante):
     - De preferencia por colocar conceitos DENTRO dos capitulos. Use o global apenas se for transversal.

  3. CAPITULOS ('chapters') - A ALMA DO GUIA:
     - REGRA DE OURO 1: Voce DEVE gerar uma entrada para CADA um dos capitulos do livro. Se o livro tem 20 capitulos, o array deve ter 20 itens.
     - REGRA DE OURO 2: O campo 'title' e SAGRADO. Deve conter o NOME REAL do capitulo.
         - PROIBIDO ABSOLUTAMENTE usar "N/A", "Unknown" ou "Capitulo X" sem nome.
         - Se o indice nao estiver claro, LEIA o conteudo e crie um titulo descritivo.

     Para CADA capitulo:
     - 'title': Titulo do Capitulo (ex: "Capitulo 1: Introducao a Ansiedade"). NAO USE "N/A".
     - 'content': TEXTO CORRIDO e NARRATIVO. Nao faca topicos. Explique o capitulo como um professor contando uma historia.
         * MODO SOBREVIVENCIA: 1 paragrafo curto e direto (mas faca para todos os capitulos).
         * MODO NORMAL: Texto fluido, completo e denso.
     - 'paretoChunk': O "Insight de Ouro" (80/20) especifico deste capitulo.
     - 'coreConcepts': Extraia 2 ou 3 conceitos-chave DESTE capitulo. Defina-os aqui.
     - 'supportConcepts': Se as Fontes Complementares trouxerem algo sobre este capitulo, insira aqui.
     - 'reflectionQuestion': Uma pergunta direta para o aluno testar se entendeu a essencia do capitulo.
  ` : ''}

  ${mode === 'PARETO' && !isBook ? `
  MODO PARETO 80/20 (EXTREMO):
  - Foco: VELOCIDADE e ESSENCIA.
  - "Core Concepts": Maximo 3-5 conceitos CRUCIAIS.
  - "Support Concepts": NAO GERE. Deixe vazio [].
  ` : mode === 'PARETO' && isBook ? '' : mode === 'HARD' ? `
  MODO HARD (PROFUNDO):
  - Foco: DETALHE e DOMINIO TECNICO.
  - O QUE FAZER: Explique os porques, com nuances e excecoes.
  - "Core Concepts": 10-15 conceitos robustos e tecnicos. Explique o "como" e o "porque".
  - "Support Concepts": Liste os conceitos secundarios (os 80%) para que o aluno saiba que existem, mas sem aprofundar.
  - "Checkpoints": Alta complexidade. "noteExactly" deve ser um resumo tecnico estruturado.
  ` : `
  MODO NORMAL (NEUROSTUDY PADRAO):
  - Foco: EQUILIBRIO e RETENCAO.
  - "Core Concepts": 6-8 conceitos fundamentais. Explicacao clara e conectada.
  - "Support Concepts": Cite os topicos perifericos (Contexto/Curiosidade) brevemente.
  - "Checkpoints": Equilibrados.
  `}

  ${!isBook ? `
  CHECKPOINTS OBRIGATORIOS:
  Para cada checkpoint, voce DEVE preencher:
  - "noteExactly": O QUE ANOTAR NO CADERNO. Gere um conteudo substancial, mas ESTRUTURADO.
      - Use Topicos (bullets) ou frases curtas e potentes.
      - NAO gere "paredoes de texto" denso.
      - Deve ser algo que valha a pena copiar e revisar depois.
  - "drawExactly": Uma instrucao visual clara do que desenhar (ex: 'Desenhe um triangulo com...').
  ` : ''}

  Estrategia Adicional: ${modeInstructions}

  INSTRUCOES ESPECIFICAS PARA CAMPO 'overview' (Advance Organizer):
  ${mode === 'PARETO' ? `
  - ESTILO: ARTIGO "BOTTOM LINE UP FRONT" (Jornalistico/Executivo).
  - Escreva um texto corrido, denso e direto.
  - OMITA analogias, metaforas ou introducoes suaves.
  - Comece IMEDIATAMENTE entregando o valor central (os 20%).
  - Use paragrafos curtos e objetivos.
  - Tom: Profissional, eficiente e acelerado.
  ` : `
  - RESUMO ULTRA-CONCISO.
  - Responda apenas: "Do que trata esta aula?"
  - Use TEXTO DIRETO e PRATICO. Seja o mais breve possivel (aprox. 2 a 5 linhas), sem perder informacoes cruciais.
  - Sem "Era uma vez" ou analogias longas aqui. Va direto ao ponto.
  `}

  REGRAS DE OURO:
  1. HIERARQUIA: A Fonte Principal manda na ordem. As complementares mandam na profundidade.
  2. CITACOES: Sempre que usar uma info chave de uma complementar, cite a origem (ex: "Ref: Artigo Y").

  JSON estrito e valido.

  REGRAS CRITICAS DE CHECKPOINTS:
  1. MICRO-LEARNING: Divida o conteudo em 'checkpoints' de LUA (Leitura/Visualizacao Unica Ativa) de 5 a 7 minutos no maximo.
  2. VIDEO/AUDIO/TRANSCRIPT: Se a entrada for baseada em tempo (video, audio ou transcricao com timestamps), o campo 'timestamp' DEVE conter o intervalo EXATO (ex: "00:00 - 05:30").
  3. EVITE TEDIO: Crie checkpoints curtos e acionaveis. Se o video tem 1 hora, teremos ~10 checkpoints.
  4. 'mission': Diga exatamente o que fazer nesses 5 min (ex: "Assista dos 10:00 aos 15:00 focando em...").
  `;

  const parts = [{ text: combinedContext }];
  const contentLength = combinedContext.length;
  const sourceCount = sources.length;
  const selectedModel = selectModel('studyGuide', contentLength, sourceCount, isBook);

  const { text, response, usageTokens } = await callGemini({
    planName,
    taskType: 'roadmap',
    prompt: combinedContext,
    model: selectedModel,
    responseMimeType: 'application/json',
    responseSchema: finalSchema,
    systemInstruction: MASTER_PROMPT,
    parts,
    temperature: 0.3,
    timeoutMs: 120_000
  });

  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const guide = JSON.parse(cleanText) as any;

  if (guide.chapters) {
    guide.bookChapters = guide.chapters;
    delete guide.chapters;
  }

  if (guide.checkpoints) {
    guide.checkpoints = guide.checkpoints.map((cp: any, index: number) => ({
      ...cp,
      id: `cp-${Date.now()}-${index}`,
      completed: false
    }));
  }

  return { guide, usageTokens, rawResponse: response };
};

export const generateSlides = async (planName: PlanName, guide: any) => {
  const prompt = `
  Crie uma apresentacao de Slides (.pdf style) sobre: "${guide.subject}".
  Contexto: Baseie-se no guia de estudo fornecido.

  Gere um JSON com uma lista de slides. Cada slide deve ter:
  - "title": Titulo impactante.
  - "bullets": Array de 3 a 5 pontos chave (texto curto).
  - "speakerNotes": O que falar nesse slide (roteiro para o apresentador).

  Estrutura sugerida:
  1. Capa
  2. Introducao/Contexto
  3. Conceitos Chave (1 slide por conceito principal)
  4. Aplicacao Pratica
  5. Conclusao/Proximos Passos

  Retorne APENAS o JSON estrito: [{ "title": "...", "bullets": ["..."], "speakerNotes": "..." }, ...]
  `;

  const selectedModel = selectModel('slides', JSON.stringify(guide).length);
  const { text, usageTokens, response } = await callGemini({
    planName,
    taskType: 'roadmap',
    prompt,
    model: selectedModel,
    responseMimeType: 'application/json',
    temperature: 0.3
  });

  const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim() || '[]');
  return { slides: Array.isArray(parsed) ? parsed : [], usageTokens, rawResponse: response };
};

export const generateQuiz = async (
  planName: PlanName,
  guide: any,
  config?: { quantity: number; distribution?: { mc: number; open: number } }
) => {
  const qty = config?.quantity || 6;
  const mcCount = config?.distribution?.mc ?? Math.ceil(qty / 2);
  const openCount = config?.distribution?.open ?? Math.floor(qty / 2);

  const prompt = `
  Voce e um especialista em avaliacao educacional baseada em Neurociencia.
  
  TEMA: ${guide.subject}
  
  CRIE UM QUIZ DE ALTA QUALIDADE com ${qty} questoes:
  - ${mcCount} questoes de Alternativa (type: 'multiple_choice')
  - ${openCount} questoes Dissertativas (type: 'open')

  DISTRIBUICAO DE DIFICULDADE:
  - 40% easy (compreensao basica)
  - 40% medium (aplicacao em situacao nova)
  - 20% hard (analise, comparacao, padroes)

  Cubra os principais topicos do guia sem repetir o mesmo subtema.

  REGRAS PARA QUESTOES DE QUALIDADE:
  - Evite memorização trivial; foque raciocinio e transferencia
  - Para medium/hard, use mini-casos ou cenarios breves
  - Enunciados curtos, claros e auto-contidos
  - Evite enunciados negativos (ex: "Qual NAO e...")

  REGRAS PARA ALTERNATIVAS (multiple_choice):
  - SEMPRE 4 opcoes mutuamente exclusivas
  - Alternativas erradas = ERROS COMUNS de estudantes (nao aleatorias)
  - PROIBIDO usar "Todas as anteriores" ou "Nenhuma das anteriores"
  - Sem pistas gramaticais na alternativa correta

  FORMATO JSON OBRIGATORIO:
  [
    {
      "type": "multiple_choice",
      "difficulty": "easy" | "medium" | "hard",
      "topic": "subtema curto",
      "question": "pergunta aqui",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "feedback curto: por que correta e por que distratores errados"
    },
    {
      "type": "open",
      "difficulty": "medium",
      "topic": "subtema",
      "question": "pergunta dissertativa",
      "correctAnswer": "criterios-chave da resposta esperada",
      "explanation": "o que uma boa resposta deve conter"
    }
  ]

  Retorne APENAS o JSON, sem comentarios, sem bloco markdown e sem texto extra.
  `;


  const selectedModel = selectModel('quiz');
  const { text, usageTokens, response } = await callGemini({
    planName,
    taskType: 'quiz',
    prompt,
    model: selectedModel,
    responseMimeType: 'application/json'
  });

  // Check for empty response before parsing
  if (!text || text.trim() === '' || text.trim() === '[]') {
    console.error('[generateQuiz] Gemini returned empty response');
    throw new Error('INVALID_JSON_FROM_MODEL');
  }

  let parsed: any[];
  try {
    parsed = parseJsonArray(text);
  } catch (error) {
    console.error('[generateQuiz] Failed to parse model JSON. Raw:', text.slice(0, 300));
    throw error;
  }

  const quiz = parsed.map((q, index) => ({
    ...q,
    id: q.id || `quiz-${Date.now()}-${index}`
  }));

  return { quiz, usageTokens, rawResponse: response };
};

export const generateFlashcards = async (planName: PlanName, guide: any) => {
  const selectedModel = selectModel('flashcard');

  const prompt = `
  Voce e um especialista em Spaced Repetition e Active Recall.
  
  TEMA: ${guide.subject}
  
  Crie flashcards baseados APENAS nos conceitos centrais do guia (nao invente).

  QUANTIDADE: 10-14 cartoes.

  REGRAS DE QUALIDADE:
  - Um cartao = UMA ideia/fato (atomico). PROIBIDO lista longa ou varios conceitos no mesmo cartao.
  - Frente (front): curta (max 90 chars), especifica e sem ambiguidade. Use "gatilho" + contexto minimo.
  - Verso (back): conciso (max 180 chars), direto e memorizavel.

  VARIE OS TIPOS DE RECALL:
  1) Definicao em 1 frase
  2) Diferenca A vs B (1 frase)
  3) Exemplo ou contraexemplo
  4) "Se/entao" (aplicacao rapida)
  5) Erro comum + correcao (1-2 cartoes)

  Quando util, use estilo cloze: "X e ____ porque ____".

  FORMATO JSON (apenas isso, sem markdown):
  [
    { "front": "...", "back": "..." }
  ]

  Retorne APENAS o JSON.
  `;

  const { text, usageTokens, response } = await callGemini({
    planName,
    taskType: 'flashcards',
    prompt,
    responseMimeType: 'application/json',
    model: selectedModel
  });

  // Check for empty response
  if (!text || text.trim() === '' || text.trim() === '[]') {
    console.error('[generateFlashcards] Gemini returned empty response');
    throw new Error('INVALID_JSON_FROM_MODEL');
  }

  let parsed: any[];
  try {
    parsed = parseJsonArray(text);
  } catch (error) {
    console.error('[generateFlashcards] Failed to parse JSON. Raw:', text.slice(0, 300));
    throw error;
  }

  const flashcards = parsed.map((f, index) => ({
    ...f,
    id: f.id || `fc-${Date.now()}-${index}`
  }));

  return { flashcards, usageTokens, rawResponse: response };
};

export const sendChatMessage = async (
  planName: PlanName,
  history: Array<{ role: string; text: string }>,
  message: string
) => {
  const ai = getClient();
  const chat = ai.chats.create({
    model: MODEL_FLASH,
    history: history.slice(-5).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    config: { systemInstruction: 'Mentor de Aprendizado.' }
  });

  const response = await chat.sendMessage({ message });
  const text = response?.text || '';
  return { text, usageTokens: getUsageTokens(response), rawResponse: response };
};

export const generateTool = async (
  planName: PlanName,
  toolType: 'explainLikeIm5' | 'analogy' | 'realWorldApplication' | 'interdisciplinary',
  topic: string,
  context: string,
  targetDomain?: string
) => {
  const safeTopic = topic || 'o tema do estudo';
  const safeContext = context?.slice(0, 1000) || 'Contexto nao disponivel';
  const safeDomain = targetDomain && targetDomain.trim() !== '' ? targetDomain : null;

  let prompt = '';
  switch (toolType) {
    case 'explainLikeIm5':
      prompt = `Explique "${safeTopic}" usando o Metodo Feynman.
      Contexto: ${safeContext.slice(0, 500)}
      O tom deve ser fascinante e revelador. Use uma metafora brilhante se possivel.
      Mantenha curto (max 3 frases), mas impactante.`;
      break;
    case 'realWorldApplication':
      prompt = `Como "${safeTopic}" e usado no mundo real?
      Contexto: ${safeContext.slice(0, 500)}
      De um exemplo pratico (MAX 3 LINHAS), curto e util.`;
      break;
    case 'analogy':
      prompt = `Crie uma analogia criativa para explicar "${safeTopic}".
      Contexto: ${safeContext.slice(0, 300)}
      Seja criativo e use comparacoes do dia-a-dia.`;
      break;
    case 'interdisciplinary':
      const domainInstruction = safeDomain
        ? `AREA ALVO: "${safeDomain}" - conecte ESPECIFICAMENTE com esta area.`
        : 'AREA ALVO: Escolha uma area INESPERADA (arte, fisica, biologia, economia, musica, arquitetura, gastronomia, esportes, etc).';
      prompt = `Voce e um especialista em conexoes interdisciplinares e pensamento sistemico.

      TEMA DO ESTUDO: "${safeTopic}"
      CONTEXTO: ${safeContext.slice(0, 800)}

      ${domainInstruction}

      SUA MISSAO: Revelar uma conexao SURPREENDENTE e EDUCATIVA entre o tema e outra area.

      CRITERIOS DE QUALIDADE:
      1. A conexao deve ser REAL (baseada em ciencia, historia ou fatos verificaveis)
      2. Deve gerar um "AHA!" no estudante - uma insight que ele nunca teria sozinho
      3. Deve APROFUNDAR a compreensao do tema original, nao apenas curiosidade
      4. Use um exemplo concreto ou caso real quando possivel

      ESTRUTURA DA RESPOSTA (3-5 frases):
      - Frase 1: A ponte entre as areas (o que conecta)
      - Frases 2-3: O "como" e "por que" (a mecanica da conexao)
      - Frase final: O insight pratico (como isso ajuda a entender melhor o tema)

      PROIBIDO: Markdown (**, #, etc), conexoes obvias, informacoes inventadas.
      Escreva em texto fluido e natural.`;
      break;
    default:
      throw new Error('Ferramenta invalida.');
  }

  const selectedModel = selectModel('tool');
  const { text, usageTokens, response } = await callGemini({
    planName,
    taskType: 'chat',
    prompt,
    model: selectedModel,
    responseMimeType: 'text/plain'
  });
  return { content: text || '', usageTokens, rawResponse: response };
};

export const generateDiagram = async (planName: PlanName, desc: string) => {
  const safeDesc = desc || 'Mapa conceitual do tema estudado';
  const prompt = `
    Crie um diagrama Mermaid.js (graph TD) visualmente organizado para: "${safeDesc}".

    REGRAS OBRIGATORIAS:
    1. Use APENAS sintaxe Mermaid valida (graph TD).
    2. Use IDs simples sem caracteres especiais (ex: A, B, C ou node1, node2).
    3. Textos dos nos devem estar entre colchetes: A[Texto do No]
    4. Conexoes simples: A --> B
    5. Maximo 8-12 nos para manter legibilidade.
    6. Adicione estilos classDef para cores (opcional).

    EXEMPLO DE FORMATO CORRETO:
    graph TD
        A[Conceito Principal] --> B[Sub-conceito 1]
        A --> C[Sub-conceito 2]
        B --> D[Detalhe]
        classDef principal fill:#6366f1,stroke:#333,color:white
        class A principal

    Retorne APENAS o codigo mermaid. Sem markdown, sem crases, sem explicacao.
    `;

  const selectedModel = selectModel('diagram');
  const { text, usageTokens, response } = await callGemini({
    planName,
    taskType: 'chat',
    prompt,
    model: selectedModel,
    responseMimeType: 'text/plain'
  });

  let code = (text || '')
    .replace(/```mermaid/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*mermaid\s*/i, '')
    .trim();

  if (!code.toLowerCase().startsWith('graph')) {
    if (code.includes('-->') || code.includes('---')) {
      code = `graph TD\n${code}`;
    } else {
      return { code: '', url: '', usageTokens, rawResponse: response };
    }
  }

  const encoded = Buffer.from(code, 'utf8').toString('base64');
  const url = `https://mermaid.ink/img/${encoded}?bgColor=FFFFFF`;
  return { code, url, usageTokens, rawResponse: response };
};

export const evaluateOpenAnswer = async (
  planName: PlanName,
  question: string,
  userAnswer: string,
  expectedAnswer: string
) => {
  const prompt = `
    Avalie a resposta do aluno.
    Pergunta: "${question}"
    Resposta Esperada (Gabarito): "${expectedAnswer}"
    Resposta do Aluno: "${userAnswer}"

    Sua tarefa:
    1. Classifique como: 'correct' (acertou a essencia), 'partial' (acertou parte ou foi vago), 'wrong' (errou ou fugiu do tema).
    2. De um feedback curto (max 2 frases) explicando o porque.

    Retorne APENAS JSON: { "status": "correct" | "partial" | "wrong", "feedback": "..." }
    `;
  const { text, usageTokens, response } = await callGemini({
    planName,
    taskType: 'chat',
    prompt,
    responseMimeType: 'application/json'
  });
  const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
  return { result: parsed, usageTokens, rawResponse: response };
};

export const transcribeMedia = async (
  planName: PlanName,
  fileUri: string,
  mimeType: string
) => {
  const prompt = `
  ATUAR COMO: Especialista em Transcricao.
  TAREFA: Transcrever o arquivo de midia exato.

  REGRAS:
  1. TIMESTAMPS: [MM:SS] a cada minuto.
  2. Identifique falantes.
  3. Texto corrido e legivel.
  `;

  const selectedModel = selectModel('transcription');
  const { text, response, usageTokens } = await callGemini({
    planName,
    taskType: 'chat',
    prompt,
    model: selectedModel,
    parts: [
      { text: prompt },
      { fileData: { mimeType, fileUri } }
    ],
    responseMimeType: 'text/plain',
    timeoutMs: 120_000
  });

  return { transcript: text || '', usageTokens, rawResponse: response };
};

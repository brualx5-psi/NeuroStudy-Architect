import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGuide, ChatMessage, SlideContent as Slide, QuizQuestion, Flashcard, StudyMode, StudySource } from "../types";

const getApiKey = (): string | undefined => {
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
};

const MODEL_NAME = 'gemini-2.0-flash';

// ESQUEMA COMPLETO RESTAURADO
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
        definition: { type: Type.STRING },
      },
      required: ["concept", "definition"],
    },
  },
  supportConcepts: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        concept: { type: Type.STRING },
        definition: { type: Type.STRING },
      },
      required: ["concept", "definition"],
    },
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
        drawLabel: { type: Type.STRING, enum: ["essential", "suggestion", "none"] },
        question: { type: Type.STRING },
      },
      required: ["mission", "timestamp", "lookFor", "noteExactly", "drawExactly", "question"],
    },
  }
};

const CHAPTERS_PROPERTY = {
  chapters: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        content: { type: Type.STRING, description: "Texto corrido e fluido explicando o capítulo." },
        paretoChunk: { type: Type.STRING, description: "A essência 80/20 deste capítulo." },
        reflectionQuestion: { type: Type.STRING, description: "Uma pergunta para o aluno verificar se entendeu o conceito chave." },
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
                  interdisciplinary: { type: Type.STRING },
                },
                nullable: true
              }
            },
            required: ["concept", "definition"]
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
            required: ["concept", "definition"]
          },
          nullable: true
        }
      },
      required: ["title", "paretoChunk", "content", "coreConcepts", "reflectionQuestion"]
    }
  }
};

export async function uploadFileToGemini(file: Blob | File, mimeType: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");
  // Removido conversão Base64 manual para evitar estouro de memória com arquivos grandes

  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
  const initialResponse = await fetch(uploadUrl, { method: 'POST', headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': file.size.toString(), 'X-Goog-Upload-Header-Content-Type': mimeType, 'Content-Type': 'application/json', }, body: JSON.stringify({ file: { display_name: 'User Upload' } }) });
  const uploadHeader = initialResponse.headers.get('x-goog-upload-url');
  if (!uploadHeader) throw new Error("Falha ao iniciar upload no Google AI.");

  const uploadResponse = await fetch(uploadHeader, { method: 'POST', headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0', 'Content-Length': file.size.toString(), }, body: file });
  const uploadResult = await uploadResponse.json();
  const fileUri = uploadResult.file.uri;
  const fileName = uploadResult.file.name; // Resource name: files/xyz

  // POLLING: Wait for file to be ACTIVE
  let state = uploadResult.file.state;
  while (state === 'PROCESSING') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const checkResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
    const checkResult = await checkResponse.json();
    state = checkResult.state;
    if (state === 'FAILED') throw new Error("O processamento do arquivo falhou no Google AI.");
  }

  return fileUri;
}

async function fetchWithRetry<T>(operation: () => Promise<T>, retries = 3, delay = 5000): Promise<T> {
  try { return await operation(); } catch (error: any) {
    if ((error.status === 429 || error.message?.includes('429') || error.status === 503) && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

const safeGenerate = async (ai: GoogleGenAI, prompt: string, schemaMode = true): Promise<string> => {
  return fetchWithRetry(async () => {
    const config: any = {};
    if (schemaMode) config.responseMimeType = "application/json";
    const response = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts: [{ text: prompt }] }, config });
    let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    return text || "";
  });
};

// Função específica para Transcrição de Mídia (Áudio/Vídeo)
export const transcribeMedia = async (fileUri: string, mimeType: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
  ATUAR COMO: Especialista em Transcrição.
  TAREFA: Transcrever o arquivo de mídia exato.
  
  REGRAS:
  1. TIMESTAMPS: [MM:SS] a cada minuto.
  2. Identifique falantes.
  3. Texto corrido e legível.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: mimeType,
              fileUri: fileUri,
            },
          },
        ]
      }
    });

    const text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    return text || "";
  } catch (error) {
    console.error("Erro na transcrição:", error);
    throw new Error("Falha ao transcrever mídia.");
  }
};

export const generateStudyGuide = async (sources: StudySource[], mode: StudyMode = StudyMode.NORMAL, isBinary: boolean = false, isBook: boolean = false): Promise<StudyGuide> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Chave de API não encontrada.");
  const ai = new GoogleGenAI({ apiKey });
  const schemaProperties = isBook ? { ...COMMON_PROPERTIES, ...CHAPTERS_PROPERTY } : { ...COMMON_PROPERTIES };
  const finalSchema: Schema = { type: Type.OBJECT, properties: schemaProperties, required: isBook ? ["subject", "overview", "coreConcepts", "chapters"] : ["subject", "overview", "coreConcepts", "checkpoints"] };

  // 1. Identificar Fonte Principal e Complementares
  const primarySource = sources.find(s => s.isPrimary) || sources[0];
  const complementarySources = sources.filter(s => s.id !== primarySource.id);

  console.log(`[GeminiService] Gerando guia com Principal: ${primarySource.name} (${primarySource.type}) e ${complementarySources.length} complementares.`);

  // 2. Construir Conteúdo do Prompt (Texto Combinado com Referências)
  const MAX_CHARS_PER_COMPLEMENT = 50000; // Limite de segurança
  let combinedContext = `FONTE PRINCIPAL (Use esta estrutura como base):\n`;
  combinedContext += `[ID: PRIMARY, NOME: ${primarySource.name}, TIPO: ${primarySource.type}]\n`;
  combinedContext += `${primarySource.content.slice(0, 100000)}\n\n`; // Limite maior para principal

  if (complementarySources.length > 0) {
    combinedContext += `FONTES COMPLEMENTARES (Use apenas para enriquecer/aprofundar):\n`;
    complementarySources.forEach((src, idx) => {
      combinedContext += `[ID: REF_${idx + 1}, NOME: ${src.name}]\n${src.content.slice(0, MAX_CHARS_PER_COMPLEMENT)}...\n\n`;
    });
  }

  // 3. Definir Estrutura baseada no Tipo da Fonte Principal
  let structureInstruction = "";
  // Se for Video ou tiver transcrição no nome, é cronológico.
  if (primarySource.type === 'VIDEO' || primarySource.name.includes("[Transcrição]")) {
    structureInstruction = `
    ESTRUTURA OBRIGATÓRIA (Baseada em VÍDEO/AULA):
    - O esqueleto do roteiro (Checkpoints) DEVE seguir a cronologia da Fonte Principal.
    - Use Timestamps [MM:SS] baseados na Fonte Principal.
    - Se uma informação vier de uma Fonte Complementar, insira no momento lógico correspondente da aula, citando a fonte (ex: "Conforme Apostila X").
    `;
  } else {
    structureInstruction = `
    ESTRUTURA OBRIGATÓRIA (Baseada em TEXTO/LIVRO):
    - O esqueleto do roteiro DEVE seguir os Tópicos/Capítulos da Fonte Principal.
    - PROIBIDO INVENTAR TIMESTAMPS. Use "N/A" ou deixe vazio se o campo for obrigatório.
    - Use "Seções" ou "Títulos" como marcadores de progresso.
    - O campo 'chapters' é OBRIGATÓRIO. O campo 'checkpoints' é OPCIONAL (ou deixe vazio se redundante).
    - Integre o conteúdo das Fontes Complementares dentro dos tópicos da Fonte Principal.
    `;
  }

  let modeInstructions = "";
  if (isBook) {
    switch (mode) {
      case StudyMode.SURVIVAL: modeInstructions = `MODO LIVRO: SOBREVIVÊNCIA. Gere TODOS os capítulos, mas com resumo curto (1 parágrafo) em cada um.`; break;
      case StudyMode.HARD: modeInstructions = `MODO LIVRO: HARD. Gere TODOS os capítulos com análise profunda e detalhada em cada um.`; break;
      case StudyMode.NORMAL: default: modeInstructions = `MODO LIVRO: NORMAL. Gere TODOS os capítulos com análise equilibrada (Princípio de Pareto) em cada um.`; break;
    }
  } else {
    // ...
  }

  // LÓGICA DE PROMPT ADAPTATIVA (LIVRO vs MATERIAL vs PARETO)
  const MASTER_PROMPT = `
  Você é o NeuroStudy Architect. 
  CONTEXTO: (${isBook ? 'LIVRO COMPLETO' : 'Material de Estudo'}). 
  MISSÃO: Analisar e criar um guia prático baseado em Neurociência.

  ${structureInstruction}

  ${isBook ? `
  📚 MODO LIVRO AVANÇADO (ESTRUTURA HIERÁRQUICA):
  1. ADVANCE ORGANIZER ('overview'):
     - O QUE É: Preparação cognitiva. Diga o que esperar do livro como um todo.
  2. PARETO GLOBAL ('coreConcepts' fora dos capítulos - OPCIONAL/VAZIO se redundante):
     - Dê preferência por colocar conceitos DENTRO dos capítulos. Use o global apenas se for transversal.
  
  3. CAPÍTULOS ('chapters') - A ALMA DO GUIA:
     - REGRA DE OURO 1: Você DEVE gerar uma entrada para CADA um dos capítulos do livro. Se o livro tem 20 capítulos, o array deve ter 20 itens.
     - REGRA DE OURO 2: O campo 'title' é SAGRADO. Deve conter o NOME REAL do capítulo.
         - PROIBIDO ABSOLUTAMENTE usar "N/A", "Unknown" ou "Capítulo X" sem nome.
         - Se o índice não estiver claro, LEIA o conteúdo e crie um título descritivo.

     Para CADA capítulo:
     - 'title': Título do Capítulo (ex: "Capítulo 1: Introdução à Ansiedade"). NÃO USE "N/A".
     - 'content': TEXTO CORRIDO e NARRATIVO. Não faça tópicos. Explique o capítulo como um professor contando uma história.
         * MODO SOBREVIVÊNCIA: 1 parágrafo curto e direto (mas faça para todos os capítulos).
         * MODO NORMAL: Texto fluido, completo e denso.
     - 'paretoChunk': O "Insight de Ouro" (80/20) específico deste capítulo.
     - 'coreConcepts': Extraia 2 ou 3 conceitos-chave DESTE capítulo. Defina-os aqui.
     - 'supportConcepts': Se as Fontes Complementares trouxerem algo sobre este capítulo, insira aqui.
     - 'reflectionQuestion': Uma pergunta direta para o aluno testar se entendeu a essência do capítulo.
  ` : ''}
  
  ${mode === StudyMode.PARETO && !isBook ? `
  🔥 MODO PARETO 80/20 (EXTREMO):
  - Foco: VELOCIDADE e ESSÊNCIA.
  - "Core Concepts": Máximo 3-5 conceitos CRUCIAIS.
  - "Support Concepts": NÃO GERE. Deixe vazio [].
  ` : mode === StudyMode.PARETO && isBook ? '' : mode === StudyMode.HARD ? `
  🚀 MODO HARD (PROFUNDO):
  - Foco: DETALHE e DOMÍNIO TÉCNICO.
  - O QUE FAZER: Explique os porquês, com nuances e exceções.
  - "Core Concepts": 10-15 conceitos robustos e técnicos. Explique o "como" e o "porquê".
  - "Support Concepts": Liste os conceitos secundários (os 80%) para que o aluno saiba que existem, mas sem aprofundar.
  - "Checkpoints": Alta complexidade. "noteExactly" deve ser um resumo técnico estruturado.
  ` : `
  ⚖️ MODO NORMAL (NEUROSTUDY PADRÃO):
  - Foco: EQUILÍBRIO e RETENÇÃO.
  - "Core Concepts": 6-8 conceitos fundamentais. Explicação clara e conectada.
  - "Support Concepts": Cite os tópicos periféricos (Contexto/Curiosidade) brevemente.
  - "Checkpoints": Equilibrados.
  `}
  
  ${!isBook ? `
  CHECKPOINTS OBRIGATÓRIOS:
  Para cada checkpoint, você DEVE preencher:
  - "noteExactly": O QUE ANOTAR NO CADERNO. Gere um conteúdo substancial, mas **ESTRUTURADO**.
      - Use Tópicos (bullets) ou frases curtas e potentes.
      - NÃO gere "paredões de texto" denso.
      - Deve ser algo que valha a pena copiar e revisar depois.
  - "drawExactly": Uma instrução visual clara do que desenhar (ex: 'Desenhe um triângulo com...').
  ` : ''}
  
  Estratégia Adicional: ${modeInstructions} 
  
  INSTRUÇÕES ESPECÍFICAS PARA CAMPO 'overview' (Advance Organizer):
  ${mode === StudyMode.PARETO ? `
  - ESTILO: ARTIGO "BOTTOM LINE UP FRONT" (Jornalístico/Executivo).
  - Escreva um texto corrido, denso e direto.
  - OMITA analogias, metáforas ou introduções suaves.
  - Comece IMEDIATAMENTE entregando o valor central (os 20%).
  - Use parágrafos curtos e objetivos.
  - Tom: Profissional, eficiente e acelerado.
  ` : `
  - RESUMO ULTRA-CONCISO.
  - Responda apenas: "Do que trata esta aula?"
  - Use TEXTO DIRETO e PRÁTICO. Seja o mais breve possível (aprox. 2 a 5 linhas), sem perder informações cruciais.
  - Sem "Era uma vez" ou analogias longas aqui. Vá direto ao ponto.
  `}

  REGRAS DE OURO:
  1. HIERARQUIA: A Fonte Principal manda na ordem. As complementares mandam na profundidade.
  2. CITAÇÕES: Sempre que usar uma info chave de uma complementar, cite a origem (ex: "Ref: Artigo Y").
  
  JSON estrito e válido.
  
  ⚠️ REGRAS CRÍTICAS DE CHECKPOINTS:
  1. MICRO-LEARNING: Divida o conteúdo em 'checkpoints' de LUA (Leitura/Visualização Única Ativa) de **5 a 7 minutos** no máximo.
  2. VIDEO/AUDIO/TRANSCRIPT: Se a entrada for baseada em tempo (vídeo, áudio ou transcrição com timestamps), o campo 'timestamp' DEVE conter o intervalo EXATO (ex: "00:00 - 05:30").
  3. EVITE TÉDIO: Crie checkpoints curtos e acionáveis. Se o vídeo tem 1 hora, teremos ~10 checkpoints.
  4. 'mission': Diga exatamente o que fazer nesses 5 min (ex: "Assista dos 10:00 aos 15:00 focando em...").
  `;

  const parts: any[] = [];
  // Para MVP multi-fonte, vamos simplificar e enviar tudo como texto combinado.
  // Futuramente, se mantivermos suporte a PDF Binário real + Texto, precisaremos de lógica mista.
  // Como 'combinedContext' já tem tudo, enviamos ele.
  parts.push({ text: combinedContext });

  return fetchWithRetry(async () => {
    const response = await ai.models.generateContent({ model: MODEL_NAME, contents: { role: 'user', parts: parts }, config: { systemInstruction: MASTER_PROMPT, responseMimeType: "application/json", responseSchema: finalSchema, temperature: 0.3 } });
    let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    if (!text) text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const guide = JSON.parse(cleanText) as StudyGuide & { chapters?: any[] };

    // CORREÇÃO CRÍTICA: Mapeia 'chapters' do Schema JSON para 'bookChapters' da Interface
    if (guide.chapters) {
      guide.bookChapters = guide.chapters;
      delete guide.chapters;
    }

    if (guide.checkpoints) {
      guide.checkpoints = guide.checkpoints.map((cp, index) => ({
        ...cp,
        id: `cp-${Date.now()}-${index}`, // Garante ID único
        completed: false
      }));
    }
    return guide;
  });
};

export const generateTool = async (
  toolType: 'explainLikeIm5' | 'analogy' | 'realWorldApplication' | 'interdisciplinary',
  topic: string,
  context: string,
  targetDomain?: string // New optional parameter
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });
  let prompt = '';
  switch (toolType) {
    case 'explainLikeIm5': prompt = `Explique "${topic}" (Contexto: ${context.slice(0, 500)}) usando o Método Feynman. O tom deve ser fascinante e revelador. Use uma metáfora brilhante se possível. Mantenha curto (max 3 frases), mas impactante.`; break;
    case 'realWorldApplication': prompt = `Como "${topic}" (Contexto: ${context.slice(0, 500)}) é usado no mundo real? Dê um exemplo prático (MAX 3 LINHAS), curto e útil.`; break;
    case 'analogy': prompt = `Crie uma analogia para "${topic}".`; break;
    case 'interdisciplinary':
      const domain = targetDomain ? `com a área de ${targetDomain}` : 'com outra área do conhecimento inusitada';
      prompt = `Conecte "${topic}" ${domain}. Mostre como os conceitos se cruzam de forma surpreendente.\n\nIMPORTANTE: Escreva um texto fluído e curto. NÃO use formatação markdown como negrito (**) ou itálico (*). Apenas texto puro.`;
      break;
    default: throw new Error("Ferramenta inválida.");
  }
  return safeGenerate(ai, prompt, false);
};

export const generateDiagram = async (desc: string): Promise<{ code: string, url: string }> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("Erro API"); const ai = new GoogleGenAI({ apiKey });
  try {
    const prompt = `
    Crie um diagrama Mermaid.js (graph TD) visualmente rico para: "${desc}".
    - Use cores vibrantes e harmônicas (ex: fill:#f9f,stroke:#333,stroke-width:2px).
    - Aplique estilos (classDef) para nós principais e secundários.
    - O diagrama deve ser bonito, não o padrão preto e branco.
    - Retorne APENAS o código mermaid graph TD. Sem markdown.
    `;
    const response = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts: [{ text: prompt }] } });
    let code = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    code = code.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    return {
      code,
      url: `https://mermaid.ink/img/${btoa(unescape(encodeURIComponent(code)))}?bgColor=FFFFFF`
    };
  } catch (e) { return { code: "", url: "" }; }
};

export const generateSlides = async (guide: StudyGuide): Promise<Slide[]> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("API Key missing"); const ai = new GoogleGenAI({ apiKey });
  try { return JSON.parse((await safeGenerate(ai, `Crie Slides JSON sobre: "${guide.subject}".`)).replace(/```json/g, '').replace(/```/g, '').trim() || "[]"); } catch { return []; }
};

export const generateQuiz = async (guide: StudyGuide, mode: StudyMode, config?: { quantity: number, distribution?: { mc: number, open: number } }): Promise<QuizQuestion[]> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("API Key missing"); const ai = new GoogleGenAI({ apiKey });
  const qty = config?.quantity || 6;
  const mcCount = config?.distribution?.mc ?? Math.ceil(qty / 2);
  const openCount = config?.distribution?.open ?? Math.floor(qty / 2);

  const prompt = `
  Crie um Quiz DE ALTO NÍVEL (Neuroscience-based) sobre: ${guide.subject}.
  TOTAL DE QUESTÕES: ${qty}.
  DISTRIBUIÇÃO OBRIGATÓRIA:
  - ${mcCount} questões de Múltipla Escolha (type: 'multiple_choice').
  - ${openCount} questões Dissertativas (type: 'open').

  Para questões 'open', o campo 'correctAnswer' deve conter a "Resposta Esperada/Gabarito" (texto ideal).
  Foco: Testar compreensão profunda e aplicação. JSON estrito.
  `;
  try { return JSON.parse((await safeGenerate(ai, prompt)).replace(/```json/g, '').replace(/```/g, '').trim() || "[]"); } catch { return []; }
};

export const evaluateOpenAnswer = async (question: string, userAnswer: string, expectedAnswer: string): Promise<{ status: 'correct' | 'partial' | 'wrong', feedback: string }> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("API Key missing"); const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    Avalie a resposta do aluno.
    Pergunta: "${question}"
    Resposta Esperada (Gabarito): "${expectedAnswer}"
    Resposta do Aluno: "${userAnswer}"

    Sua tarefa:
    1. Classifique como: 'correct' (acertou a essência), 'partial' (acertou parte ou foi vago), 'wrong' (errou ou fugiu do tema).
    2. Dê um feedback curto (max 2 frases) explicando o porquê.

    Retorne APENAS JSON: { "status": "correct" | "partial" | "wrong", "feedback": "..." }
    `;
  try {
    const res = await safeGenerate(ai, prompt);
    return JSON.parse(res.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (e) {
    return { status: 'partial', feedback: "Erro ao avaliar. Considere sua resposta comparada ao gabarito." };
  }
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("API Key missing"); const ai = new GoogleGenAI({ apiKey });
  try { return JSON.parse((await safeGenerate(ai, `Crie Flashcards OTIMIZADOS PARA MEMORIZAÇÃO (Spaced Repetition) sobre: ${guide.subject}. Foco: Pergunta gatilho -> Resposta direta e clara. JSON estrito.`)).replace(/```json/g, '').replace(/```/g, '').trim() || "[]"); } catch { return []; }
};

export const sendChatMessage = async (history: ChatMessage[], msg: string, studyGuide: StudyGuide | null = null): Promise<string> => {
  const apiKey = getApiKey(); if (!apiKey) return "Erro."; const ai = new GoogleGenAI({ apiKey });
  try { const chat = ai.chats.create({ model: MODEL_NAME, history: history.slice(-5).map(m => ({ role: m.role, parts: [{ text: m.text }] })), config: { systemInstruction: "Mentor de Aprendizado." } }); const res = await chat.sendMessage({ message: msg }); return res.text || ""; } catch { return "Erro."; }
};

export const refineContent = async (text: string, task: string): Promise<string> => {
  const apiKey = getApiKey(); if (!apiKey) return "Erro."; const ai = new GoogleGenAI({ apiKey });
  return await safeGenerate(ai, `Melhore: "${text}"`, false);
};

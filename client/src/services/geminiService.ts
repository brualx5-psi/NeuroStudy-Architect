import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGuide, ChatMessage, SlideContent as Slide, QuizQuestion, Flashcard, StudyMode } from "../types";

const getApiKey = (): string | undefined => {
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
};

// --- CONFIGURAÇÃO ---
const MODEL_NAME = 'gemini-2.0-flash'; 

// Schemas (mantidos como estavam)
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
      required: ["mission", "timestamp", "lookFor", "noteExactly", "question"],
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
        summary: { type: Type.STRING },
        practicalApplication: { type: Type.STRING },
        coreConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { concept: { type: Type.STRING }, definition: { type: Type.STRING } },
            required: ["concept", "definition"]
          }
        },
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              coreConcepts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { concept: { type: Type.STRING }, definition: { type: Type.STRING } },
                  required: ["concept", "definition"]
                }
              }
            },
            required: ["title", "coreConcepts"]
          }
        }
      },
      required: ["title", "summary", "coreConcepts"]
    }
  }
};

// --- FUNÇÃO AUXILIAR: UPLOAD DE ARQUIVO (FILE API) ---
async function uploadFileToGemini(base64Data: string, mimeType: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
  const initialResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': blob.size.toString(),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'User Upload' } })
  });

  const uploadHeader = initialResponse.headers.get('x-goog-upload-url');
  if (!uploadHeader) throw new Error("Falha ao iniciar upload no Google AI.");

  const uploadResponse = await fetch(uploadHeader, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Length': blob.size.toString(),
    },
    body: blob
  });

  const uploadResult = await uploadResponse.json();
  return uploadResult.file.uri;
}

// --- RETRY LOGIC ---
async function fetchWithRetry<T>(operation: () => Promise<T>, retries = 3, delay = 5000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if ((error.status === 429 || error.message?.includes('429') || error.status === 503) && retries > 0) {
      console.warn(`[Gemini] Limite (429). Aguardando ${delay}ms...`);
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
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts: [{ text: prompt }] },
            config
        });
        let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
        return text || "";
    });
};

export const generateStudyGuide = async (
  content: string,
  mimeType: string,
  mode: StudyMode = StudyMode.NORMAL,
  isBinary: boolean = false,
  isBook: boolean = false
): Promise<StudyGuide> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Chave de API não encontrada.");

  const ai = new GoogleGenAI({ apiKey });

  const schemaProperties = isBook ? { ...COMMON_PROPERTIES, ...CHAPTERS_PROPERTY } : { ...COMMON_PROPERTIES };
  const finalSchema: Schema = {
    type: Type.OBJECT,
    properties: schemaProperties,
    required: ["subject", "overview", "coreConcepts", "checkpoints"],
  };

  let modeInstructions = "";
  if (isBook) {
    switch (mode) {
      case StudyMode.SURVIVAL:
        modeInstructions = `
        MODO LIVRO: SOBREVIVÊNCIA (Estrutura Completa, Densidade Mínima)
        - ESTRUTURA: Liste TODOS os capítulos do livro original no array 'chapters'.
        - DENSIDADE: Para cada capítulo, escreva um resumo de apenas 1 FRASE (a ideia central).
        - CONCEITOS DO CAPÍTULO: Apenas 1 conceito chave por capítulo.
        - SUPORTE: NÃO GERE 'supportConcepts'.
        `;
        break;
      case StudyMode.HARD:
        modeInstructions = `
        MODO LIVRO: HARD (Estrutura Completa, Densidade Máxima)
        - ESTRUTURA: Liste TODOS os capítulos e suas seções.
        - DENSIDADE: Resumo detalhado de cada capítulo, cobrindo nuances e exemplos.
        - CONCEITOS: Extraia todos os conceitos relevantes.
        - SUPORTE: Gere uma lista robusta em 'supportConcepts' para contextualização global.
        `;
        break;
      case StudyMode.NORMAL:
      default:
        modeInstructions = `
        MODO LIVRO: NORMAL (Estrutura Completa, Densidade Pareto)
        - ESTRUTURA: Liste TODOS os capítulos.
        - DENSIDADE: Aplique Pareto (20% essencial) em CADA capítulo individualmente.
        - RESUMO DO CAPÍTULO: 1 parágrafo conciso.
        - SUPORTE: Gere 'supportConcepts' para contextualizar.
        `;
        break;
    }
  } else {
    const noChaptersInstruction = "NÃO GERE 'chapters'. O conteúdo não é um livro.";
    if (mode === StudyMode.HARD) {
      modeInstructions = `MODO: TURBO 🚀 (Completo). ${noChaptersInstruction} SUPORTE: OBRIGATÓRIO.`;
    } else if (mode === StudyMode.SURVIVAL) {
      modeInstructions = `MODO: SOBREVIVÊNCIA ⚡. ${noChaptersInstruction} SUPORTE: NÃO PREENCHA.`;
    } else {
      modeInstructions = `MODO: NORMAL 📚. ${noChaptersInstruction} SUPORTE: OBRIGATÓRIO.`;
    }
  }

  const MASTER_PROMPT = `
  Você é o NeuroStudy Architect.
  CONTEXTO: Conteúdo (${isBook ? 'LIVRO' : 'Material'}).
  MISSÃO:
  1. Analisar.
  2. Estratégia: ${modeInstructions}
  3. REGRAS DE DESENHO: Se necessário, use 'drawLabel' ('essential'/'suggestion') e descreva em 'drawExactly'.
  4. JSON estrito.
  `;

  const parts: any[] = [];
  if (isBinary) {
     const isVideoOrAudio = mimeType.startsWith('video/') || mimeType.startsWith('audio/');
     const isLargeFile = content.length > 15 * 1024 * 1024; 

     if (isVideoOrAudio || isLargeFile) {
         try {
             console.log("Arquivo grande ou mídia detectada. Usando File API...");
             const fileUri = await uploadFileToGemini(content, mimeType);
             parts.push({ fileData: { mimeType: mimeType, fileUri: fileUri } });
             if (isVideoOrAudio) parts.push({ text: "Analise este arquivo de mídia completo. Transcreva mentalmente." });
         } catch (e) {
             console.error("Erro upload:", e);
             throw new Error("Falha ao processar arquivo grande. Tente comprimir.");
         }
     } else {
         parts.push({ inlineData: { mimeType: mimeType, data: content } });
     }
     parts.push({ text: "Gere o roteiro de aprendizado." });
  } else {
     parts.push({ text: content });
  }

  return fetchWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { role: 'user', parts: parts },
      config: {
        systemInstruction: MASTER_PROMPT,
        responseMimeType: "application/json",
        responseSchema: finalSchema,
        temperature: 0.3,
      },
    });

    let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    if (!text) text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const guide = JSON.parse(cleanText) as StudyGuide;
    
    if (guide.checkpoints) {
        guide.checkpoints = guide.checkpoints.map(cp => ({ ...cp, completed: false }));
    }
    return guide;
  });
};

// --- FUNÇÃO FALTANTE: generateTool (CORREÇÃO DO ERRO) ---
export const generateTool = async (
  toolType: 'explainLikeIm5' | 'analogy' | 'realWorldApplication' | 'mnemonics' | 'interdisciplinary',
  topic: string,
  context: string
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Chave de API não encontrada.");
  const ai = new GoogleGenAI({ apiKey });
  const model = MODEL_NAME;

  let prompt = '';

  switch (toolType) {
    case 'explainLikeIm5':
      prompt = `
        Atue como um professor especialista no MÉTODO FEYNMAN.
        O aluno quer aprender sobre: "${topic}".
        Contexto do estudo: "${context.slice(0, 500)}...".

        Siga rigorosamente os passos do Método Feynman:
        1. **Explicação Simples:** Explique o conceito em linguagem plana, evitando jargões técnicos. Imagine que está explicando para uma pessoa inteligente de 12 anos.
        2. **Identifique Lacunas (O "Porquê"):** Antecipe uma dúvida comum e responda brevemente.
        3. **Analogia Poderosa:** Crie uma analogia do mundo real para consolidar o entendimento.

        Formate a resposta com marcadores claros e emojis para tornar a leitura leve.
      `;
      break;

    case 'realWorldApplication':
      prompt = `
        Com base no conceito "${topic}", forneça um **Exemplo Real e Prático**.
        Contexto: "${context.slice(0, 500)}...".

        Não explique a teoria novamente. Vá direto para a prática.
        - Descreva um cenário onde isso é usado hoje.
        - Ou conte uma breve história/estudo de caso real.
        - Mostre o impacto disso na vida cotidiana ou profissional.
        
        Seja inspirador e concreto.
      `;
      break;

    case 'analogy':
      prompt = `Crie uma analogia criativa e memorável para explicar "${topic}" (Contexto: ${context.slice(0, 300)}). Use algo do cotidiano (como culinária, esportes, trânsito) para que o conceito grude na mente.`;
      break;

    case 'mnemonics':
      prompt = `Crie um mnemônico (sigla, rima ou frase associativa) para ajudar a memorizar os pontos chaves de: "${topic}". Explique como usar o mnemônico.`;
      break;

    case 'interdisciplinary':
      prompt = `Conecte o conceito "${topic}" com outra área do conhecimento totalmente diferente (ex: Arte, História, Biologia, Economia) para mostrar sua versatilidade. Explique a conexão.`;
      break;
      
    default:
        throw new Error("Tipo de ferramenta inválido.");
  }

  // safeGenerate aqui retorna o texto puro (schemaMode: false)
  return safeGenerate(ai, prompt, false);
};
// --- FIM DA FUNÇÃO FALTANTE ---


export const generateDiagram = async (desc: string): Promise<string> => { 
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Erro de API.");
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts: [{ text: `Crie um diagrama Mermaid.js (graph TD) simples para: "${desc}". Use nós e setas. Retorne SOMENTE o código.` }] }
        });
        
        let code = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
        code = code.replace(/```mermaid/g, '').replace(/```/g, '').trim();
        
        // Uso de btoa (base64 encoding) para URL do Mermaid.ink
        const encoded = btoa(unescape(encodeURIComponent(code)));
        return `https://mermaid.ink/img/${encoded}?bgColor=FFFFFF`;
    } catch (e) {
        console.error("Erro diagrama:", e);
        return "";
    }
};

export const generateSlides = async (guide: StudyGuide): Promise<Slide[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    try {
        const text = await safeGenerate(ai, `Crie Slides JSON sobre: "${guide.subject}".`);
        if (!text) return [];
        // Certifique-se que o tipo SlideContent é mapeado corretamente
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim() || "[]");
    } catch { return []; }
};

export const generateQuiz = async (guide: StudyGuide, mode: StudyMode, config?: any): Promise<QuizQuestion[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    try {
        const prompt = `Crie um Quiz JSON com ${config?.quantity || 6} perguntas sobre ${guide.subject}.`;
        const text = await safeGenerate(ai, prompt);
        if (!text) return [];
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim() || "[]");
    } catch { return []; }
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    try {
        const text = await safeGenerate(ai, `Crie Flashcards JSON sobre: ${guide.subject}.`);
        if (!text) return [];
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim() || "[]");
    } catch { return []; }
};

export const sendChatMessage = async (history: ChatMessage[], msg: string, studyGuide: StudyGuide | null = null): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return "Erro de API Key.";
    const ai = new GoogleGenAI({ apiKey });
    let systemInstruction = "Você é um Mentor de Aprendizado.";
    if (studyGuide) systemInstruction += ` O usuário estuda: ${studyGuide.subject}.`;
    try {
      const chat = ai.chats.create({ 
          model: MODEL_NAME, 
          history: history.slice(-5).map(m=>({role:m.role, parts:[{text:m.text}]})),
          config: { systemInstruction }
      });
      const res = await chat.sendMessage({ message: msg });
      return res.text || "";
    } catch (e) {
      return "Erro ao conectar com o professor virtual.";
    }
};

export const refineContent = async (text: string, task: string): Promise<string> => { 
    const apiKey = getApiKey();
    if (!apiKey) return "Erro.";
    const ai = new GoogleGenAI({ apiKey });
    return await safeGenerate(ai, `Melhore este texto (${task}): "${text}"`, false);
};

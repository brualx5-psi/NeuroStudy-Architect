import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGuide, ChatMessage, SlideContent as Slide, QuizQuestion, Flashcard, StudyMode } from "../types";

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
        summary: { type: Type.STRING },
        practicalApplication: { type: Type.STRING },
        coreConcepts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, definition: { type: Type.STRING } }, required: ["concept", "definition"] } },
        sections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, coreConcepts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, definition: { type: Type.STRING } }, required: ["concept", "definition"] } } }, required: ["title", "coreConcepts"] } }
      },
      required: ["title", "summary", "coreConcepts"]
    }
  }
};

async function uploadFileToGemini(base64Data: string, mimeType: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
  const initialResponse = await fetch(uploadUrl, { method: 'POST', headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': blob.size.toString(), 'X-Goog-Upload-Header-Content-Type': mimeType, 'Content-Type': 'application/json', }, body: JSON.stringify({ file: { display_name: 'User Upload' } }) });
  const uploadHeader = initialResponse.headers.get('x-goog-upload-url');
  if (!uploadHeader) throw new Error("Falha ao iniciar upload no Google AI.");
  const uploadResponse = await fetch(uploadHeader, { method: 'POST', headers: { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0', 'Content-Length': blob.size.toString(), }, body: blob });
  const uploadResult = await uploadResponse.json();
  return uploadResult.file.uri;
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

export const generateStudyGuide = async (content: string, mimeType: string, mode: StudyMode = StudyMode.NORMAL, isBinary: boolean = false, isBook: boolean = false): Promise<StudyGuide> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Chave de API não encontrada.");
  const ai = new GoogleGenAI({ apiKey });
  const schemaProperties = isBook ? { ...COMMON_PROPERTIES, ...CHAPTERS_PROPERTY } : { ...COMMON_PROPERTIES };
  const finalSchema: Schema = { type: Type.OBJECT, properties: schemaProperties, required: ["subject", "overview", "coreConcepts", "checkpoints"] };
  let modeInstructions = "";
  if (isBook) {
    switch (mode) {
      case StudyMode.SURVIVAL: modeInstructions = `MODO LIVRO: SOBREVIVÊNCIA. Resumo de 1 frase por capítulo.`; break;
      case StudyMode.HARD: modeInstructions = `MODO LIVRO: HARD. Resumo detalhado.`; break;
      case StudyMode.NORMAL: default: modeInstructions = `MODO LIVRO: NORMAL. Princípio de Pareto.`; break;
    }
  } else {
    const noChaptersInstruction = "NÃO GERE 'chapters'.";
    if (mode === StudyMode.HARD) modeInstructions = `MODO: TURBO. ${noChaptersInstruction} Suporte OBRIGATÓRIO.`;
    else if (mode === StudyMode.SURVIVAL) modeInstructions = `MODO: SOBREVIVÊNCIA. ${noChaptersInstruction} Sem suporte.`;
    else modeInstructions = `MODO: NORMAL. ${noChaptersInstruction} Suporte OBRIGATÓRIO.`;
  }

  // LÓGICA DE PROMPT ADAPTATIVA (LIVRO vs MATERIAL vs PARETO)
  const MASTER_PROMPT = `
  Você é o NeuroStudy Architect. 
  CONTEXTO: (${isBook ? 'LIVRO COMPLETO' : 'Material de Estudo'}). 
  MISSÃO: Analisar e criar um guia prático baseado em Neurociência.

  ${isBook ? `
  ⚠️ ESTRUTURA DE LIVRO DETECTADA (PARETO DUPLO):
  1. PARETO DO LIVRO (Global): No campo 'coreConcepts', extraia a essência de todo o livro (a "Big Picture").
  2. PARETO DOS CAPÍTULOS (Local): Em cada capítulo, filtre apenas o que é acionável e relevante.
  ` : ''}
  
  ${mode === StudyMode.PARETO ? `
  🔥 MODO PARETO 80/20 (EXTREMO):
  - Foco: VELOCIDADE e ESSÊNCIA.
  - O QUE FAZER: Identifique os 20% de informação que dão 80% do resultado.
  - Core Concepts: Máximo 3-5 conceitos CRUCIAIS.
  - Elimine: Histórias, introduções longas, "palha".
  - Estilo: Direto ao ponto, sem rodeios.
  ` : mode === StudyMode.HARD ? `
  🚀 MODO HARD (PROFUNDO):
  - Foco: DETALHE e DOMÍNIO TÉCNICO.
  - O QUE FAZER: Explique os porquês, com nuances e exceções.
  - Core Concepts: 10-15 conceitos robustos.
  - Checkpoints: Alta complexidade para testar compreensão real.
  ` : `
  ⚖️ MODO NORMAL (NEUROSTUDY PADRÃO):
  - Foco: EQUILÍBRIO e RETENÇÃO.
  - PRINCÍPIO: Use a Regra de Pareto para filtrar o excesso, mas mantenha a "cola" (contexto) que faz o conteúdo fazer sentido.
  - Core Concepts: 6-8 conceitos fundamentais ben explicados.
  - Checkpoints: Equilibrados para fixação ativa.
  `}
  
  CHECKPOINTS OBRIGATÓRIOS:
  Para cada checkpoint, você DEVE preencher:
  - "noteExactly": Uma frase curta e poderosa para o aluno copiar no caderno.
  - "drawExactly": Uma instrução visual clara do que desenhar (ex: 'Desenhe um triângulo com...').
  
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
  - Seu objetivo é PREPARAR O TERRENO (Schema Theory).
  - Crie uma "Ponte Cognitiva": Comece com uma analogia ou cenário familiar.
  - Conecte o novo conhecimento com algo que quase todo mundo já sabe.
  - Termine explicando a relevância prática.
  `}
  
  JSON estrito e válido.
  `;

  const parts: any[] = [];
  if (isBinary) {
    const isVideoOrAudio = mimeType.startsWith('video/') || mimeType.startsWith('audio/');
    if (isVideoOrAudio || content.length > 15 * 1024 * 1024) {
      try {
        const fileUri = await uploadFileToGemini(content, mimeType);
        parts.push({ fileData: { mimeType: mimeType, fileUri: fileUri } });
        if (isVideoOrAudio) parts.push({ text: "Analise esta mídia." });
      } catch (e) { throw new Error("Falha ao processar arquivo."); }
    } else { parts.push({ inlineData: { mimeType: mimeType, data: content } }); }
    parts.push({ text: "Gere o roteiro." });
  } else { parts.push({ text: content }); }
  return fetchWithRetry(async () => {
    const response = await ai.models.generateContent({ model: MODEL_NAME, contents: { role: 'user', parts: parts }, config: { systemInstruction: MASTER_PROMPT, responseMimeType: "application/json", responseSchema: finalSchema, temperature: 0.3 } });
    let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    if (!text) text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const guide = JSON.parse(cleanText) as StudyGuide;
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
  context: string
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });
  let prompt = '';
  switch (toolType) {
    case 'explainLikeIm5': prompt = `Explique "${topic}" (Contexto: ${context.slice(0, 500)}) usando o Método Feynman: Explicação simples, lacunas e analogia.`; break;
    case 'realWorldApplication': prompt = `Dê um exemplo prático real de "${topic}" (Contexto: ${context.slice(0, 500)}).`; break;
    case 'analogy': prompt = `Crie uma analogia para "${topic}".`; break;
    case 'interdisciplinary': prompt = `Conecte "${topic}" com outra área do conhecimento.`; break;
    default: throw new Error("Ferramenta inválida.");
  }
  return safeGenerate(ai, prompt, false);
};

export const generateDiagram = async (desc: string): Promise<string> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("Erro API"); const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({ model: MODEL_NAME, contents: { parts: [{ text: `Diagrama Mermaid.js (graph TD) para: "${desc}". Só código.` }] } });
    let code = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    code = code.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    return `https://mermaid.ink/img/${btoa(unescape(encodeURIComponent(code)))}?bgColor=FFFFFF`;
  } catch (e) { return ""; }
};

export const generateSlides = async (guide: StudyGuide): Promise<Slide[]> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("API Key missing"); const ai = new GoogleGenAI({ apiKey });
  try { return JSON.parse((await safeGenerate(ai, `Crie Slides JSON sobre: "${guide.subject}".`)).replace(/```json/g, '').replace(/```/g, '').trim() || "[]"); } catch { return []; }
};

export const generateQuiz = async (guide: StudyGuide, mode: StudyMode, config?: any): Promise<QuizQuestion[]> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("API Key missing"); const ai = new GoogleGenAI({ apiKey });
  try { return JSON.parse((await safeGenerate(ai, `Crie Quiz JSON com ${config?.quantity || 6} perguntas sobre ${guide.subject}.`)).replace(/```json/g, '').replace(/```/g, '').trim() || "[]"); } catch { return []; }
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
  const apiKey = getApiKey(); if (!apiKey) throw new Error("API Key missing"); const ai = new GoogleGenAI({ apiKey });
  try { return JSON.parse((await safeGenerate(ai, `Crie Flashcards JSON sobre: ${guide.subject}.`)).replace(/```json/g, '').replace(/```/g, '').trim() || "[]"); } catch { return []; }
};

export const sendChatMessage = async (history: ChatMessage[], msg: string, studyGuide: StudyGuide | null = null): Promise<string> => {
  const apiKey = getApiKey(); if (!apiKey) return "Erro."; const ai = new GoogleGenAI({ apiKey });
  try { const chat = ai.chats.create({ model: MODEL_NAME, history: history.slice(-5).map(m => ({ role: m.role, parts: [{ text: m.text }] })), config: { systemInstruction: "Mentor de Aprendizado." } }); const res = await chat.sendMessage({ message: msg }); return res.text || ""; } catch { return "Erro."; }
};

export const refineContent = async (text: string, task: string): Promise<string> => {
  const apiKey = getApiKey(); if (!apiKey) return "Erro."; const ai = new GoogleGenAI({ apiKey });
  return await safeGenerate(ai, `Melhore: "${text}"`, false);
};

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGuide, ChatMessage, Slide, QuizQuestion, Flashcard, StudyMode, InputType } from "../types";

// Ensure process is defined for TS
declare var process: any;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    overview: { type: Type.STRING },
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
    },
  },
  required: ["subject", "overview", "coreConcepts", "checkpoints"],
};

const getApiKey = (): string | undefined => {
  return process.env.API_KEY;
};

// Helper para buscar metadados reais do DOI (para evitar alucinações)
const fetchDoiMetadata = async (doi: string): Promise<{ title: string, abstract: string } | null> => {
  try {
    const cleanDoi = doi.trim().replace(/^doi:/i, '').replace(/^https?:\/\/doi\.org\//i, '');
    const response = await fetch(`https://api.crossref.org/works/${cleanDoi}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const item = data.message;
    
    const title = item.title?.[0] || '';
    const abstract = item.abstract || "Resumo não disponível via API pública.";
    
    return { title, abstract };
  } catch (e) {
    console.warn("Failed to fetch DOI metadata", e);
    return null;
  }
};

export const generateStudyGuide = async (
  content: string,
  mimeType: string,
  mode: StudyMode = StudyMode.NORMAL,
  isBinary: boolean = false
): Promise<StudyGuide> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.error("ERRO: API Key não encontrada no process.env");
    throw new Error("Chave de API não configurada.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash'; 

  // --- INSTRUÇÕES DO MODO ---
  let modeInstructions = "";
  if (mode === StudyMode.HARD) {
    modeInstructions = `
    MODO: HARD (HARDCORE / Detalhe Máximo).
    - Objetivo: Domínio total do conteúdo. Sem atalhos.
    - Quebre o conteúdo em checkpoints PEQUENOS e frequentes.
    - Seja extremamente específico e técnico.
    `;
  } else if (mode === StudyMode.SURVIVAL) {
    modeInstructions = `
    MODO: SOBREVIVÊNCIA (O Mínimo Viável).
    - Objetivo: Salvar o dia com o menor esforço possível.
    - Crie POUCOS checkpoints (max 3 ou 4).
    - Foque APENAS no essencial (Pareto 80/20).
    `;
  } else if (mode === StudyMode.PARETO) {
    modeInstructions = `
    MODO: PARETO 80/20 (RESUMO CORRIDO).
    SUA ÚNICA MISSÃO: Identificar os 20% do conteúdo que entregam 80% do valor.
    Escreva um RESUMO DENSO E CORRIDO no campo 'overview'.
    Deixe 'checkpoints' e 'coreConcepts' vazios.
    `;
  } else {
    modeInstructions = `
    MODO: NORMAL (Equilibrado).
    - Blocos médios.
    - Organização padrão para rotina de estudos.
    `;
  }

  let contentInstructions = "";
  if (isBinary && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
    contentInstructions = "O conteúdo é um VÍDEO/ÁUDIO. Use 'timestamps' para dividir os checkpoints.";
  } else if (isBinary && mimeType.startsWith('image/')) {
    contentInstructions = "O conteúdo é uma IMAGEM. Transcreva o texto visível.";
  } else {
    contentInstructions = "O conteúdo é TEXTO (PDF/Artigo/Livro/Site).";
  }

  const MASTER_PROMPT = `
Você é um Arquiteto de Aprendizagem Especialista.
Tarefa: Transformar o conteúdo seguindo o modo: ${mode}.
IDIOMA OBRIGATÓRIO DE SAÍDA: PORTUGUÊS DO BRASIL (pt-BR) 🇧🇷.
Se o conteúdo original estiver em inglês ou outra língua, TRADUZA TUDO para Português do Brasil.

${modeInstructions}
${contentInstructions}

SAÍDA OBRIGATÓRIA: JSON VÁLIDO seguindo o schema.
`;

  const parts = [];
  const doiRegex = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i;
  const isDoi = !isBinary && doiRegex.test(content);

  if (isDoi) {
    const identifier = content.trim();
    const metadata = await fetchDoiMetadata(identifier);
    if (metadata && metadata.title) {
        parts.push({ text: `DOI: ${identifier}. Título Real: ${metadata.title}. Resumo: ${metadata.abstract}. Use isso para gerar o roteiro.` });
    } else {
        parts.push({ text: `DOI: ${identifier}. Use seu conhecimento interno sobre este paper.` });
    }
  } else if (isBinary) {
    parts.push({ inlineData: { mimeType: mimeType, data: content } });
    parts.push({ text: "Analise este arquivo e crie o roteiro." });
  } else {
    parts.push({ text: content });
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { role: 'user', parts: parts },
      config: {
        systemInstruction: MASTER_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const guide = JSON.parse(text) as StudyGuide;
    if (guide.checkpoints) {
        guide.checkpoints = guide.checkpoints.map(cp => ({ ...cp, completed: false }));
    }
    return guide;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateSlides = async (guide: StudyGuide): Promise<Slide[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Chave API não encontrada");
  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash';

  const prompt = `Crie 5-8 slides educacionais JSON sobre: ${guide.subject}. Baseado em: ${guide.overview}. IDIOMA: PORTUGUÊS DO BRASIL.`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json" } 
  });
  return JSON.parse(response.text || "[]") as Slide[];
};

export const generateQuiz = async (guide: StudyGuide, mode: StudyMode, config?: any): Promise<QuizQuestion[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Chave API não encontrada");
  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash';
  
  const prompt = `Crie um Quiz JSON com 6 perguntas sobre ${guide.subject}. Misture múltipla escolha e aberta. IDIOMA: PORTUGUÊS DO BRASIL.`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "[]") as QuizQuestion[];
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Chave API não encontrada");
  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash';
  
  const prompt = `Crie 10 Flashcards JSON (front/back) sobre ${guide.subject}. IDIOMA: PORTUGUÊS DO BRASIL.`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "[]") as Flashcard[];
};

export const sendChatMessage = async (history: ChatMessage[], newMessage: string, context?: any): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "Erro de Configuração: API Key não encontrada.";
  
  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.0-flash'; // Modelo mais rápido para chat
  
  const chat = ai.chats.create({ model: modelName, history: history.slice(-5).map(m => ({ role: m.role, parts: [{ text: m.text }] })) });
  const result = await chat.sendMessage({ message: newMessage });
  return result.text || "...";
};

export const refineContent = async (text: string, task: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "Erro.";
  const ai = new GoogleGenAI({ apiKey });
  // FORCE PORTUGUESE OUTPUT IN INSTRUCTION
  const instruction = `Task: ${task}. Content to analyze: "${text}".
  CRITICAL INSTRUCTION: OUTPUT MUST BE IN PORTUGUESE (BRAZIL/PT-BR) 🇧🇷.
  Even if the input text is English, TRANSLATE AND ADAPT THE EXPLANATION TO PORTUGUESE.
  Keep it concise and educational.`;
  
  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: instruction }] } });
  return response.text || "";
};

export const generateDiagram = async (desc: string): Promise<string> => {
  return ""; // Placeholder
};
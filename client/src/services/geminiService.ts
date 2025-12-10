import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGuide, ChatMessage, Slide, QuizQuestion, Flashcard, StudyMode, InputType } from "../types";

// Função para pegar a chave com segurança no Vite
const getApiKey = (): string | undefined => {
  // Apenas use import.meta.env, que é o padrão do Vite.
  // Verifica os dois nomes possíveis para garantir compatibilidade com sua Vercel.
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
};

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

const fetchDoiMetadata = async (doi: string): Promise<{ title: string, abstract: string } | null> => {
  try {
    const cleanDoi = doi.trim().replace(/^doi:/i, '').replace(/^https?:\/\/doi\.org\//i, '');
    const response = await fetch(`https://api.crossref.org/works/${cleanDoi}`);
    if (!response.ok) return null;
    const data = await response.json();
    const item = data.message;
    return { title: item.title?.[0] || '', abstract: item.abstract || "Resumo não disponível." };
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
  if (!apiKey) throw new Error("Chave de API não encontrada (VITE_GEMINI_API_KEY).");

  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-2.5-flash'; 

  let modeInstructions = "MODO: NORMAL.";
  if (mode === StudyMode.HARD) modeInstructions = "MODO: HARD (Detalhe Máximo).";
  if (mode === StudyMode.SURVIVAL) modeInstructions = "MODO: SOBREVIVÊNCIA (Essencial).";
  if (mode === StudyMode.PARETO) modeInstructions = "MODO: PARETO 80/20 (Resumo denso).";

  const MASTER_PROMPT = `
  Atue como Arquiteto de Aprendizagem.
  Modo: ${mode}.
  Idioma: PORTUGUÊS DO BRASIL (pt-BR).
  ${modeInstructions}
  SAÍDA: APENAS JSON VÁLIDO.
  `;

  const parts = [{ text: content }];
  if (isBinary) {
     parts[0] = { inlineData: { mimeType: mimeType, data: content } } as any;
     parts.push({ text: "Analise o arquivo." });
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { role: 'user', parts: parts },
      config: {
        systemInstruction: MASTER_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    // CORREÇÃO CRÍTICA: Extração de texto robusta
    let text = "";
    if (typeof (response as any).text === 'function') {
        text = (response as any).text();
    } else if ((response as any).text) {
        text = (response as any).text;
    } else {
        // Tenta pegar de candidates se o atalho .text não existir
        text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (!text) throw new Error("Sem resposta da IA.");

    // LIMPEZA DE MARKDOWN (O "Pulo do Gato")
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const guide = JSON.parse(cleanText) as StudyGuide;
    
    if (guide.checkpoints) {
        guide.checkpoints = guide.checkpoints.map(cp => ({ ...cp, completed: false }));
    }
    return guide;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const generateSlides = async (guide: StudyGuide): Promise<Slide[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: `Crie slides JSON para: ${guide.subject}. Baseado em: ${guide.overview}` }] },
        config: { responseMimeType: "application/json" }
    });
    
    let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(text || "[]");
};

export const generateQuiz = async (guide: StudyGuide, mode: StudyMode, config?: any): Promise<QuizQuestion[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: `Crie um Quiz JSON para: ${guide.subject}` }] },
        config: { responseMimeType: "application/json" }
    });
    
    let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text || "[]");
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: `Crie Flashcards JSON para: ${guide.subject}` }] },
        config: { responseMimeType: "application/json" }
    });
    
    let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text || "[]");
};

export const sendChatMessage = async (history: ChatMessage[], msg: string, studyGuide: StudyGuide | null = null): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return "Erro de API Key.";
    const ai = new GoogleGenAI({ apiKey });
    
    let systemInstruction = "Você é um professor virtual socrático e prestativo.";
    if (studyGuide) {
        systemInstruction += ` O aluno está estudando: ${studyGuide.subject}. Contexto: ${studyGuide.overview}.`;
    }

    const chat = ai.chats.create({ 
        model: 'gemini-2.5-flash', 
        history: history.slice(-5).map(m=>({role:m.role, parts:[{text:m.text}]})),
        config: { systemInstruction }
    });
    
    const res = await chat.sendMessage({ message: msg });
    return res.text || "";
};

export const refineContent = async (text: string, task: string): Promise<string> => { 
    const apiKey = getApiKey();
    if (!apiKey) return "Erro de API Key.";
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: `Refine (${task}): ${text}` }] } });
    const raw = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
    return raw || "";
};

export const generateDiagram = async (desc: string): Promise<string> => { return ""; };
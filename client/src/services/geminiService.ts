
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGuide, ChatMessage, Slide, QuizQuestion, Flashcard, StudyMode, InputType } from "../types";

// Função para pegar a chave com segurança, evitando crash se process não estiver definido
const getApiKey = (): string | undefined => {
  try {
    // Tenta acessar via process.env (padrão substituído pelo bundler)
    return process.env.API_KEY;
  } catch (e) {
    // Fallback para window.process caso o runtime não tenha substituído
    return (window as any).process?.env?.API_KEY;
  }
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

export const generateStudyGuide = async (
  content: string,
  mimeType: string,
  mode: StudyMode = StudyMode.NORMAL,
  isBinary: boolean = false
): Promise<StudyGuide> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Chave de API não encontrada.");

  const ai = new GoogleGenAI({ apiKey });
  
  // CRITICAL: Use gemini-3-pro-preview for deep reasoning and image analysis
  const modelName = 'gemini-3-pro-preview'; 

  let modeInstructions = "MODO: NORMAL.";
  if (mode === StudyMode.HARD) modeInstructions = "MODO: HARD (Detalhe Máximo e Profundidade).";
  if (mode === StudyMode.SURVIVAL) modeInstructions = "MODO: SOBREVIVÊNCIA (Apenas o essencial para passar).";
  if (mode === StudyMode.PARETO) modeInstructions = "MODO: PARETO 80/20 (Foque nos 20% do conteúdo que geram 80% do resultado).";

  const MASTER_PROMPT = `
  Atue como o melhor Arquiteto de Aprendizagem do mundo.
  Modo de Estudo: ${mode}.
  Idioma: PORTUGUÊS DO BRASIL (pt-BR).
  
  ${modeInstructions}

  SEU OBJETIVO:
  Transformar o conteúdo fornecido (Texto, PDF, Vídeo ou Imagem) em um GUIA DE ESTUDO ATIVO estruturado.
  Não apenas resuma. Crie um roteiro de ações para o estudante.
  
  PARA IMAGENS:
  Se o conteúdo for uma imagem (foto de caderno, slide, esquema), analise visualmente cada detalhe, transcreva textos manuscritos e explique diagramas com precisão antes de criar o roteiro.

  SAÍDA OBRIGATÓRIA: APENAS JSON VÁLIDO seguindo o schema.
  `;

  const parts: any[] = [];
  
  if (isBinary) {
     // Para PDF, Imagem, Vídeo
     parts.push({ inlineData: { mimeType: mimeType, data: content } });
     parts.push({ text: "Analise este arquivo/imagem detalhadamente e gere o roteiro de estudos." });
  } else {
     // Para Texto, URL, DOI
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
        // Configuração de Pensamento para o Gemini 3 Pro
        thinkingConfig: { thinkingBudget: 32768 } 
      },
    });

    const text = response.text || "";

    if (!text) throw new Error("Sem resposta da IA.");

    // Limpeza robusta de Markdown JSON
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const guide = JSON.parse(cleanText) as StudyGuide;
    
    // Inicializa status de checkpoints
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
        contents: { parts: [{ text: `Crie slides JSON para apresentação de aula sobre: ${guide.subject}. Baseado no overview: ${guide.overview}` }] },
        config: { responseMimeType: "application/json" }
    });
    
    let text = response.text || "";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(text || "[]");
};

export const generateQuiz = async (guide: StudyGuide, mode: StudyMode, config?: any): Promise<QuizQuestion[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Crie um Quiz JSON desafiador para: ${guide.subject}. Dificuldade: ${config?.difficulty || 'mista'}. Quantidade: ${config?.quantity || 6} questões.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    });
    
    let text = response.text || "";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text || "[]");
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: `Crie Flashcards JSON (Frente/Verso) para memorização de: ${guide.subject}` }] },
        config: { responseMimeType: "application/json" }
    });
    
    let text = response.text || "";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text || "[]");
};

export const sendChatMessage = async (history: ChatMessage[], msg: string, studyGuide: StudyGuide | null = null): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return "Erro de API Key.";
    const ai = new GoogleGenAI({ apiKey });
    
    let systemInstruction = "Você é um professor virtual socrático e prestativo. Ajude o aluno a entender profundamente.";
    if (studyGuide) {
        systemInstruction += ` O aluno está estudando: ${studyGuide.subject}. Contexto do guia: ${studyGuide.overview}.`;
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
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: `Refine este conteúdo com a tarefa (${task}): "${text}"` }] } });
    return response.text || "";
};

export const generateDiagram = async (desc: string): Promise<string> => { return ""; };

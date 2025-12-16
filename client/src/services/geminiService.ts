import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGuide, ChatMessage, Slide, QuizQuestion, Flashcard, StudyMode } from "../types";

const getApiKey = (): string | undefined => {
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
};

// --- CONFIGURAÇÃO ---
const MODEL_NAME = 'gemini-2.0-flash'; 

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
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
    // --- NOVO: CONCEITOS DE SUPORTE ---
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
          // --- REGRA DE DESENHO ATUALIZADA ---
          drawLabel: { type: Type.STRING, enum: ["essential", "suggestion", "none"] },
          question: { type: Type.STRING },
        },
        required: ["mission", "timestamp", "lookFor", "noteExactly", "question", "drawLabel"],
      },
    },
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
  },
  required: ["subject", "overview", "coreConcepts", "checkpoints"],
};

export const generateStudyGuide = async (
  content: string,
  mimeType: string,
  mode: StudyMode = StudyMode.NORMAL,
  isBinary: boolean = false,
  isBook: boolean = false
): Promise<StudyGuide> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Chave de API não encontrada (VITE_GEMINI_API_KEY).");
  }

  const ai = new GoogleGenAI({ apiKey });

  let modeInstructions = "";

  if (isBook) {
    switch (mode) {
      case StudyMode.SURVIVAL:
        modeInstructions = `
        MODO LIVRO: SOBREVIVÊNCIA (Pareto Global 80/20)
        - OBJETIVO: Extrair apenas o núcleo vital (20%).
        - CONCEITOS DE SUPORTE: NÃO GERE. Mantenha o array vazio.
        - CHECKPOINTS: Mínimos.
        `;
        break;
      case StudyMode.HARD:
        modeInstructions = `
        MODO LIVRO: HARD (Análise Profunda)
        - OBJETIVO: Resumo exaustivo.
        - CONCEITOS DE SUPORTE: Gere uma lista robusta em 'supportConcepts' com definições contextuais, históricas ou teóricas que complementam os Core Concepts.
        - CHECKPOINTS: Detalhados.
        `;
        break;
      case StudyMode.NORMAL:
      default:
        modeInstructions = `
        MODO LIVRO: NORMAL
        - OBJETIVO: Equilíbrio.
        - CONCEITOS DE SUPORTE: Gere 'supportConcepts' para contextualizar os temas principais, mas sem excesso de detalhes.
        `;
        break;
    }
  } else {
    // --- LÓGICA PADRÃO (AULAS/ARTIGOS) ---
    if (mode === StudyMode.HARD) {
      modeInstructions = `
      MODO: TURBO 🚀 (Análise Completa)
      - OBJETIVO: Extração máxima.
      - CONCEITOS DE SUPORTE: OBRIGATÓRIO. Preencha 'supportConcepts' com teorias de base, exceções à regra e detalhes técnicos.
      - DESENHOS: Use drawLabel='essential' para diagramas complexos.
      `;
    } else if (mode === StudyMode.SURVIVAL) {
      modeInstructions = `
      MODO: SOBREVIVÊNCIA ⚡ (Pareto Absoluto)
      - OBJETIVO: Apenas o essencial.
      - CONCEITOS DE SUPORTE: NÃO PREENCHA. Deixe o array vazio []. Foco total no Core.
      - DESENHOS: Apenas se crítico (drawLabel='essential').
      `;
    } else if (mode === StudyMode.PARETO) {
      modeInstructions = `
      MODO: PARETO 80/20.
      - OBJETIVO: Resumo executivo.
      - CONCEITOS DE SUPORTE: Não necessário.
      - CHECKPOINTS: Array vazio [].
      `;
    } else {
      modeInstructions = `
      MODO: NORMAL 📚
      - OBJETIVO: Equilíbrio.
      - CONCEITOS DE SUPORTE: OBRIGATÓRIO. Adicione conceitos que ajudem a entender o "porquê" e o "como" dos conceitos centrais.
      `;
    }
  }

  const MASTER_PROMPT = `
  Você é o NeuroStudy Architect.
  CONTEXTO: O usuário enviou um conteúdo (${isBook ? 'LIVRO COMPLETO' : 'Material de Estudo'}) para processamento.
  
  SUA MISSÃO:
  1. Ler e interpretar o conteúdo.
  2. Aplicar a estratégia: ${modeInstructions}
  3. REGRAS DE DESENHO (drawLabel):
     - 'essential': O diagrama é indispensável para entender o ponto.
     - 'suggestion': O diagrama ajuda, mas não é obrigatório.
     - 'none': Não há necessidade de desenho.
     - Se 'drawLabel' for 'essential' ou 'suggestion', preencha 'drawExactly' com instruções claras.
  4. CONCEITOS DE SUPORTE (supportConcepts):
     - Diferencie claramente dos 'coreConcepts'. Core = O que cai na prova/essencial. Support = Contexto, causas, exemplos adicionais.
  5. Gerar JSON estrito seguindo o schema.

  IDIOMA: Português do Brasil (pt-BR).
  `;

  const parts: any[] = [];
  if (isBinary) {
     parts.push({ inlineData: { mimeType: mimeType, data: content } });
     parts.push({ text: "Gere o roteiro de aprendizado." });
  } else {
     parts.push({ text: content });
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { role: 'user', parts: parts },
      config: {
        systemInstruction: MASTER_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
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
  } catch (error: any) {
    console.error("[Gemini] Erro:", error);
    throw new Error(error.message || "Erro na API Gemini.");
  }
};

// ... (Mantenha as outras funções: generateSlides, generateQuiz, etc. iguais ao anterior) ...
const safeGenerate = async (ai: GoogleGenAI, prompt: string, schemaMode = true): Promise<string> => {
    try {
        const config: any = {};
        if (schemaMode) config.responseMimeType = "application/json";
        
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts: [{ text: prompt }] },
            config
        });
        
        let text = typeof (response as any).text === 'function' ? (response as any).text() : (response as any).text;
        return text || "";
    } catch (e) {
        console.error("Erro no safeGenerate:", e);
        return "";
    }
};

export const generateSlides = async (guide: StudyGuide): Promise<Slide[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    const text = await safeGenerate(ai, `Crie Slides JSON sobre: "${guide.subject}".`);
    if (!text) return [];
    try {
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim() || "[]");
    } catch { return []; }
};

export const generateQuiz = async (guide: StudyGuide, mode: StudyMode, config?: any): Promise<QuizQuestion[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Crie um Quiz JSON com ${config?.quantity || 6} perguntas sobre ${guide.subject}.`;
    const text = await safeGenerate(ai, prompt);
    if (!text) return [];
    try {
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim() || "[]");
    } catch { return []; }
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    const text = await safeGenerate(ai, `Crie Flashcards JSON sobre: ${guide.subject}.`);
    if (!text) return [];
    try {
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

export const generateDiagram = async (desc: string): Promise<string> => { return ""; };

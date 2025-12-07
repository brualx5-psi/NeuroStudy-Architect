
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StudyGuide, ChatMessage, Slide, QuizQuestion, Flashcard, StudyMode, InputType } from "../types";

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

// Helper to fetch real metadata from CrossRef to avoid AI hallucinations
const fetchDoiMetadata = async (doi: string): Promise<{ title: string, abstract: string } | null> => {
  try {
    // Clean DOI
    const cleanDoi = doi.trim().replace(/^doi:/i, '').replace(/^https?:\/\/doi\.org\//i, '');
    const response = await fetch(`https://api.crossref.org/works/${cleanDoi}`);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const item = data.message;
    
    const title = item.title?.[0] || '';
    // CrossRef abstracts are often XML/JATS, so we might need simple cleanup or just pass it raw
    // Usually abstracts are not always available freely via CrossRef, but Titles are.
    // If abstract is missing, getting the title is already a HUGE help for the AI.
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
  if (!process.env.API_KEY) {
    throw new Error("API_KEY not found in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash'; 

  // --- MODE SPECIFIC INSTRUCTIONS ---
  let modeInstructions = "";
  if (mode === StudyMode.TURBO) {
    modeInstructions = `
    MODO: TURBO (Detalhe Máximo).
    - Quebre o conteúdo em checkpoints PEQUENOS e frequentes (alta granularidade).
    - Seja extremamente específico em 'noteExactly'.
    - Ideal para quem quer extrair 100% da aula.
    `;
  } else if (mode === StudyMode.SURVIVAL) {
    modeInstructions = `
    MODO: SOBREVIVÊNCIA (Essencial apenas).
    - Crie POUCOS checkpoints, abrangendo grandes blocos de tempo.
    - Foque APENAS no Pareto 80/20 absoluto. Ignore detalhes menores.
    - Sínteses curtas e diretas.
    `;
  } else {
    modeInstructions = `
    MODO: NORMAL (Equilibrado).
    - Blocos médios, nem muito picotado, nem muito raso.
    - Organização padrão para rotina de estudos.
    `;
  }

  // --- CONTENT TYPE INSTRUCTIONS ---
  let contentInstructions = "";
  if (isBinary && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
    contentInstructions = "O conteúdo é um VÍDEO/ÁUDIO. Use 'timestamps' (ex: 00:00-05:00) para dividir os checkpoints.";
  } else if (isBinary && mimeType.startsWith('image/')) {
    contentInstructions = "O conteúdo é uma IMAGEM (Foto de caderno ou livro). Transcreva o texto visível e manuscrito. Use 'Página' ou 'Seção Visual' como timestamp.";
  } else {
    contentInstructions = "O conteúdo é TEXTO (PDF/Artigo/Livro/Site). Use 'Seções' ou 'Páginas' ou 'Tópicos' no campo timestamp para localizar o aluno.";
  }

  const MASTER_PROMPT = `
Você é um Arquiteto de Aprendizagem Especialista baseada em Neurociência.
Sua tarefa é transformar o conteúdo fornecido em um "Roteiro de Estudo Ativo" seguindo rigorosamente o método "A Ciência por Trás da Mágica".

IDIOMA DE SAÍDA: PORTUGUÊS DO BRASIL (pt-BR).

${modeInstructions}
${contentInstructions}

IMPORTANTE: Se o conteúdo original estiver em INGLÊS, TRADUZA e ADAPTE para PT-BR.

Regras de Saída (JSON):
1. **subject**: Título da aula/tema.
2. **overview**: Resumo de 2-3 linhas (Advance Organizer).
3. **coreConcepts**: Identifique os conceitos essenciais que representam 80% do aprendizado (Pareto).
    - NÃO SE LIMITE A 4 CONCEITOS.
    - Liste QUANTOS FOREM NECESSÁRIOS para cobrir o essencial (pode ser 2, 6, 8, etc.).
    - A quantidade depende da densidade do conteúdo e do modo (${mode}).
4. **checkpoints**: Divida o conteúdo conforme o MODO escolhido.
    - **mission**: Objetivo do trecho.
    - **timestamp**: Localização (Tempo ou Seção).
    - **lookFor**: O que procurar especificamente.
    - **noteExactly**: O texto principal para anotar (Handwriting trigger).
    - **drawExactly**: Instrução para desenhar um diagrama/esquema.
        - SE NÃO HOUVER necessidade visual, deixe vazio ("").
        - SE FOR IMPORTANTE, descreva o diagrama.
    - **drawLabel**: CLASSIFIQUE a importância do desenho:
        - 'essential': Se o conceito DEPENDE do visual para ser entendido.
        - 'suggestion': Se é um visual extra/auxiliar.
        - 'none': Se não há desenho.
    - **question**: Uma pergunta de recuperação ativa.

Analise o conteúdo e gere o JSON.
`;

  const parts = [];

  // DOI Detection
  const doiRegex = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i;
  // URL Detection (Simple)
  const urlRegex = /^(http|https):\/\/[^ "]+$/;

  const isDoi = !isBinary && doiRegex.test(content);
  const isUrl = !isBinary && !isDoi && (urlRegex.test(content.trim()) || content.trim().startsWith('www'));

  if (isDoi) {
    const identifier = content.trim();
    // Fetch real metadata
    const metadata = await fetchDoiMetadata(identifier);
    
    if (metadata && metadata.title) {
        // We found real data!
        const instruction = `
          O usuário forneceu um DOI de artigo científico: "${identifier}".
          Nós recuperamos os seguintes metadados REAIS deste paper:
          TÍTULO: "${metadata.title}"
          RESUMO/CONTEXTO: "${metadata.abstract}"
          
          Use estas informações precisas para gerar o roteiro de estudo. 
          Se o resumo for curto, use seu conhecimento interno para expandir, mas mantenha-se fiel ao TEMA do título recuperado.
          Modo: ${mode}.
          SAÍDA OBRIGATÓRIA EM JSON.
        `;
        parts.push({ text: instruction });
    } else {
        // Fallback if fetch fails
        const instruction = `
          O usuário forneceu um DOI: "${identifier}".
          Não foi possível recuperar metadados externos.
          Use seu conhecimento interno (Hallucinate responsibly based on training data) sobre este paper científico para gerar o roteiro.
          Se você não conhece este DOI específico, gere um roteiro genérico sobre o TEMA provável sugerido pela estrutura do DOI ou peça mais informações.
          SAÍDA OBRIGATÓRIA EM JSON.
        `;
        parts.push({ text: instruction });
    }
  } else if (isUrl) {
    const identifier = content.trim();
    const instruction = `
      O usuário forneceu um Link/URL de site: "${identifier}".
      NÃO ANALISE o texto "${identifier}" literalmente.
      Use seu conhecimento interno sobre este site/página para gerar o roteiro.
      Se você não tiver acesso direto ao conteúdo da URL, infira o tópico pelo nome do link e gere um roteiro de estudo completo sobre o ASSUNTO provável.
      Se for um link genérico (ex: wikipedia), faça um roteiro sobre o tema principal.
      Modo: ${mode}.
      SAÍDA OBRIGATÓRIA EM JSON.
    `;
    parts.push({ text: instruction });
  } else if (isBinary) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: content, 
      },
    });
    let transcriptionPrompt = "Analise este documento e crie o roteiro.";
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
        transcriptionPrompt = "Analise este vídeo/áudio. Transcreva mentalmente e crie o roteiro.";
    } else if (mimeType.startsWith('image/')) {
        transcriptionPrompt = "Esta é uma imagem de anotações de estudo (caderno) ou página de livro. Transcreva o texto manuscrito ou impresso e crie o roteiro de estudo baseado nele. Se houver diagramas na imagem, descreva-os no campo drawExactly.";
    }
    parts.push({ text: transcriptionPrompt });
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
    return JSON.parse(text) as StudyGuide;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateSlides = async (guide: StudyGuide): Promise<Slide[]> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash';

  const prompt = `
  Crie slides educacionais (5-8 slides) baseados neste roteiro: ${guide.subject}.
  SAÍDA JSON: { title, bullets[], speakerNotes }.
  Resumo: ${guide.overview}
  Conceitos: ${JSON.stringify(guide.coreConcepts)}
  Pontos: ${JSON.stringify(guide.checkpoints.map(c => c.noteExactly))}
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        speakerNotes: { type: Type.STRING },
      },
      required: ["title", "bullets", "speakerNotes"],
    },
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { role: 'user', parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json", responseSchema: schema },
  });

  return JSON.parse(response.text || "[]") as Slide[];
};

export const generateQuiz = async (
    guide: StudyGuide, 
    mode: StudyMode, 
    config?: { quantity: number, difficulty: 'easy' | 'medium' | 'hard' | 'mixed' }
): Promise<QuizQuestion[]> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash';

  let questionCount = config?.quantity || 6;
  if (!config) {
    if (mode === StudyMode.SURVIVAL) questionCount = 3;
    if (mode === StudyMode.TURBO) questionCount = 10;
  }

  const difficultyPrompt = config?.difficulty && config.difficulty !== 'mixed' 
    ? `DIFICULDADE FIXA: Todas as perguntas devem ser nível **${config.difficulty.toUpperCase()}**.`
    : `
      REGRAS DE DIFICULDADE (Distribua conforme apropriado):
      - **FÁCIL**: Perguntas de memória direta, definições literais e identificação de conceitos óbvios.
      - **MÉDIO**: Perguntas de compreensão e aplicação simples. Explicar com próprias palavras ou dar exemplos.
      - **DIFÍCIL**: Perguntas de análise, comparação sofisticada, crítica e integração entre ideias diferentes.

      Distribuição sugerida para o modo ${mode}:
      ${mode === StudyMode.SURVIVAL ? "Maioria Fáceis e Médias. Foco no essencial." : ""}
      ${mode === StudyMode.NORMAL ? "Equilibrado: 30% Fácil, 40% Médio, 30% Difícil." : ""}
      ${mode === StudyMode.TURBO ? "Desafiador: Inclua mais questões Difíceis de análise crítica." : ""}
    `;

  const context = {
      subject: guide.subject,
      overview: guide.overview,
      concepts: guide.coreConcepts,
      keyPoints: guide.checkpoints.map(c => ({ mission: c.mission, note: c.noteExactly }))
  };

  const prompt = `
  Com base no CONTEXTO ABAIXO, crie um Quiz de revisão com exatamente ${questionCount} questões.
  
  ${difficultyPrompt}

  Misture Múltipla Escolha e Dissertativas.
  
  IMPORTANTE SOBRE 'correctAnswer':
  - Se for 'multiple_choice', 'correctAnswer' DEVE ser apenas o NÚMERO do índice da opção correta em formato string ("0", "1", "2", "3").
  - Se for 'open', 'correctAnswer' deve ser o texto da resposta esperada.

  SAÍDA EM JSON.

  CONTEXTO DO ESTUDO: 
  ${JSON.stringify(context).substring(0, 30000)} 
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['multiple_choice', 'open'] },
        difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswer: { type: Type.STRING, description: "Index string '0'-'3' for multiple choice, or text for open" },
        explanation: { type: Type.STRING },
      },
      required: ["id", "type", "difficulty", "question", "correctAnswer", "explanation"],
    },
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { role: 'user', parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  return JSON.parse(response.text || "[]") as QuizQuestion[];
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash';

  const context = {
      subject: guide.subject,
      concepts: guide.coreConcepts,
      checkpoints: guide.checkpoints.map(c => c.noteExactly)
  };

  const prompt = `
  Crie um conjunto de 10-15 Flashcards estilo Anki baseados neste estudo.
  Frente: Pergunta ou Termo.
  Verso: Resposta ou Definição (curta e direta).
  Foque em conceitos chave e fatos importantes.
  
  CONTEXTO: ${JSON.stringify(context).substring(0, 30000)}

  SAÍDA JSON: Array de { id, front, back }
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        front: { type: Type.STRING },
        back: { type: Type.STRING },
      },
      required: ["id", "front", "back"],
    },
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { role: 'user', parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  return JSON.parse(response.text || "[]") as Flashcard[];
};

export const sendChatMessage = async (
  history: ChatMessage[],
  newMessage: string,
  studyGuideContext?: StudyGuide | null
): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-pro-preview';

  let contextString = "";
  if (studyGuideContext) {
    contextString = `
    CONTEXTO DO ESTUDO: "${studyGuideContext.subject}"
    Resumo: "${studyGuideContext.overview}"
    Checkpoints: ${studyGuideContext.checkpoints.map(cp => cp.mission).join(', ')}
    `;
  }

  const systemInstruction = `
  Você é um Professor Tutor Socrático. Ajude o aluno a entender o conteúdo.
  ${contextString}
  Responda em Português do Brasil. Seja didático e breve.
  `;

  const recentHistory = history.slice(-10).map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  try {
    const chat = ai.chats.create({
      model: modelName,
      history: recentHistory,
      config: { systemInstruction, temperature: 0.7 }
    });
    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "Sem resposta.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Erro ao conectar.";
  }
};

export const refineContent = async (text: string, task: 'simplify' | 'example' | 'mnemonic'): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash';

  let prompt = "";
  if (task === 'simplify') prompt = `Explique (ELI5) em PT-BR: "${text}". SEJA BREVE. Máximo 2 frases. Direto ao ponto, sem introduções.`;
  if (task === 'example') prompt = `Dê UM exemplo real curto em PT-BR de: "${text}". Vá direto ao exemplo. Máximo 2 frases.`;
  if (task === 'mnemonic') prompt = `Crie UM Mnemônico criativo em PT-BR para: "${text}". Apenas o mnemônico e a explicação curta.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { role: 'user', parts: [{ text: prompt }] },
  });
  return response.text || "Erro.";
};

export const generateDiagram = async (description: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API_KEY not found");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-2.5-flash-image'; 

  const prompt = `Create a clear, educational, white-background diagram visualizing: ${description}. Clean academic style.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: prompt }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    throw new Error("No image.");
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

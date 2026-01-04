import { ChatMessage, StudyGuide, SlideContent as Slide, QuizQuestion, Flashcard, StudyMode, StudySource } from '../types';
import { supabase } from './supabase';

export class UsageLimitError extends Error {
  reason: string;
  actions: string[];
  status: number;

  constructor(reason: string, message: string, actions: string[], status: number) {
    super(message);
    this.name = 'UsageLimitError';
    this.reason = reason;
    this.actions = actions;
    this.status = status;
  }
}

export const isUsageLimitError = (error: unknown): error is UsageLimitError => {
  return error instanceof UsageLimitError;
};

const getAuthHeaders = async () => {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 402 || response.status === 429) {
      throw new UsageLimitError(
        payload.reason || 'monthly_limit',
        payload.message || 'Limite atingido.',
        payload.actions || [],
        response.status
      );
    }
    throw new Error(payload.message || 'Erro na requisicao.');
  }

  return payload as T;
};

export async function uploadFileForTranscription(
  file: Blob | File,
  mimeType: string,
  durationMinutes?: number
): Promise<{ fileUri: string; fileName: string }> {
  const start = await postJson<{ uploadUrl: string }>('/api/youtube/transcribe', {
    action: 'start',
    mimeType,
    fileSize: file.size,
    displayName: 'name' in file ? file.name : 'User Upload',
    durationMinutes
  });

  const uploadResponse = await fetch(start.uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Length': file.size.toString()
    },
    body: file
  });
  const uploadResult = await uploadResponse.json();
  if (!uploadResult?.file?.uri || !uploadResult?.file?.name) {
    throw new Error('Falha ao enviar arquivo para transcricao.');
  }

  return { fileUri: uploadResult.file.uri, fileName: uploadResult.file.name };
}

export const transcribeMedia = async (
  fileUri: string,
  fileName: string,
  mimeType: string,
  durationMinutes?: number
): Promise<string> => {
  const response = await postJson<{ transcript: string }>('/api/youtube/transcribe', {
    action: 'transcribe',
    fileUri,
    fileName,
    mimeType,
    durationMinutes
  });
  return response.transcript || '';
};

export const generateStudyGuide = async (
  sources: StudySource[],
  mode: StudyMode = StudyMode.NORMAL,
  _isBinary: boolean = false,
  isBook: boolean = false
): Promise<StudyGuide> => {
  const response = await postJson<{ guide: StudyGuide }>('/api/ai/roadmap', {
    sources,
    mode,
    isBook
  });
  return response.guide;
};

export const generateTool = async (
  toolType: 'explainLikeIm5' | 'analogy' | 'realWorldApplication' | 'interdisciplinary',
  topic: string,
  context: string,
  targetDomain?: string
): Promise<string> => {
  const response = await postJson<{ content: string }>('/api/ai/tool', {
    toolType,
    topic,
    context,
    targetDomain
  });
  return response.content || '';
};

export const generateDiagram = async (desc: string): Promise<{ code: string; url: string }> => {
  return await postJson<{ code: string; url: string }>('/api/ai/diagram', {
    description: desc
  });
};

export const generateSlides = async (guide: StudyGuide): Promise<Slide[]> => {
  const response = await postJson<{ slides: Slide[] }>('/api/ai/slides', { guide });
  return response.slides || [];
};

export const generateQuiz = async (
  guide: StudyGuide,
  _mode: StudyMode,
  config?: { quantity: number; distribution?: { mc: number; open: number } }
): Promise<QuizQuestion[]> => {
  const response = await postJson<{ quiz: QuizQuestion[] }>('/api/ai/quiz', {
    guide,
    config
  });
  return response.quiz || [];
};

export const evaluateOpenAnswer = async (
  question: string,
  userAnswer: string,
  expectedAnswer: string
): Promise<{ status: 'correct' | 'partial' | 'wrong'; feedback: string }> => {
  const response = await postJson<{ result: { status: 'correct' | 'partial' | 'wrong'; feedback: string } }>(
    '/api/ai/evaluate',
    {
      question,
      userAnswer,
      expectedAnswer
    }
  );
  return response.result;
};

export const generateFlashcards = async (guide: StudyGuide): Promise<Flashcard[]> => {
  const response = await postJson<{ flashcards: Flashcard[] }>('/api/ai/flashcards', { guide });
  return response.flashcards || [];
};

export const sendChatMessage = async (
  history: ChatMessage[],
  msg: string,
  _studyGuide: StudyGuide | null = null
): Promise<string> => {
  const response = await postJson<{ text: string }>('/api/ai/chat', {
    history,
    message: msg
  });
  return response.text || '';
};

export const refineContent = async (text: string, _task: string): Promise<string> => {
  const response = await postJson<{ text: string }>('/api/ai/chat', {
    history: [],
    message: `Melhore: "${text}"`
  });
  return response.text || '';
};

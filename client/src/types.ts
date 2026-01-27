export enum InputType {
  TEXT = 'TEXT',
  PDF = 'PDF',
  URL = 'URL',
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  DOI = 'DOI',
  EPUB = 'EPUB',
  MOBI = 'MOBI'
}

export enum StudyMode {
  SURVIVAL = 'SURVIVAL',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  PARETO = 'PARETO'
}

export interface CoreConcept {
  concept: string;
  definition: string;
  tools?: {
    feynman?: string;
    example?: string;
    interdisciplinary?: string;
  };
}

// CHECKPOINT COMPLETO RESTAURADO
export interface Checkpoint {
  id: string;
  mission: string;
  timestamp: string;
  lookFor: string;      // "O que procurar"
  noteExactly: string;  // "Escreva exatamente isso"
  drawExactly: string;  // "Desenhe exatamente isso"
  drawLabel?: 'essential' | 'suggestion' | 'none';
  question: string;
  imageUrl?: string;    // Para retrocompatibilidade ou cache visual
  diagramCode?: string; // O código Mermaid editável
  completed?: boolean;
}

export interface StudyGuide {
  subject: string;
  title: string;
  overview: string;
  globalApplication?: string;
  coreConcepts: CoreConcept[];

  bookChapters?: {
    title: string;
    content: string; // Texto corrido do capítulo
    paretoChunk: string; // Resumo Pareto (80/20)
    coreConcepts: CoreConcept[]; // Conceitos locais deste capítulo
    supportConcepts?: CoreConcept[]; // Conceitos complementares integrados aqui
    reflectionQuestion?: string; // Pergunta de auto-reflexão
    completed?: boolean;
  }[];
  // Globais tornam-se opcionais ou específicos de outros modos
  supportConcepts?: CoreConcept[];
  checkpoints?: Checkpoint[];
  quiz?: QuizQuestion[];
  flashcards?: Flashcard[];

  diagramUrl?: string;
  diagramCode?: string;
  tools?: {
    mnemonics?: string;
    interdisciplinary?: string;
    realWorldApplication?: string;
    explainLikeIm5?: string;
  };
}

// Prompt Helper para limitar texto de Aplicação Real
const REAL_WORLD_INSTRUCTION = "Exemplo prático, curto e direto (máximo 3 linhas) de como esse conceito é usado na vida real ou profissional.";

export interface StudySession {
  id: string;
  folderId: string;
  title: string;
  sources: StudySource[];
  mode: StudyMode;
  isBook?: boolean;

  guide: StudyGuide | null;
  slides: SlideContent[] | null;
  quiz: QuizQuestion[] | null;
  flashcards: Flashcard[] | null;

  createdAt: number;
  updatedAt: number;
  nextReviewDate?: number;
  reviewStep?: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
}

export interface StudySource {
  id: string;
  type: InputType;
  name: string;
  content: string;
  textContent?: string;
  durationMinutes?: number;
  mimeType?: string;
  dateAdded: number;
  isPrimary?: boolean;
}

export interface ProcessingState {
  isLoading: boolean;
  error: string | null;
  step: 'idle' | 'transcribing' | 'analyzing' | 'generating' | 'slides' | 'quiz' | 'flashcards';
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: number;
}

export interface SlideContent {
  title: string;
  bullets: string[];
  speakerNotes: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'open';
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string; // Subtopic of the question
  question: string;
  options?: string[];
  correctAnswer: number | string; // Index for MC, Expected Answer text for Open
  explanation: string;
}

export type FlashcardDifficulty = 'easy' | 'medium' | 'hard' | 'unrated';

export interface Flashcard {
  id?: string;
  front: string;
  back: string;
  difficulty?: FlashcardDifficulty;
  lastReviewedAt?: number;
}

// === PERFIL DO USUÁRIO (Onboarding) ===
export type StudyArea = 'health' | 'engineering' | 'law' | 'marketing' | 'general';
export type Purpose = 'vestibular' | 'exam' | 'graduation' | 'postgrad' | 'professional';
export type ExamType = 'oab' | 'concursos' | 'enem' | 'residencia' | 'none';
export type SourceType = 'video' | 'pdf' | 'text' | 'mixed';
export type PreferredSource = 'auto' | 'pubmed' | 'openalex' | 'grounding';

export interface UserProfile {
  name?: string;
  studyArea: StudyArea;
  purpose: Purpose;
  examType?: ExamType; // Só quando purpose='exam'
  primarySourceType: SourceType;
  preferredSource: PreferredSource;
  profileVersion: number;
  hasCompletedOnboarding: boolean;
  createdAt: string;
}

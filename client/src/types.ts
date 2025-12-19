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
  imageUrl?: string;    // Para guardar o diagrama gerado
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
    paretoChunk: string; // Resumo Pareto do capítulo (80/20)
    completed?: boolean; // Controle de leitura
  }[];
  supportConcepts?: CoreConcept[];
  checkpoints?: Checkpoint[];
  quiz?: QuizQuestion[];
  flashcards?: Flashcard[];

  diagramUrl?: string;
  tools?: {
    mnemonics?: string;
    interdisciplinary?: string;
    realWorldApplication?: string;
    explainLikeIm5?: string;
  };
}

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
  mimeType?: string;
  dateAdded: number;
}

export interface ProcessingState {
  isLoading: boolean;
  error: string | null;
  step: 'idle' | 'transcribing' | 'analyzing' | 'generating' | 'slides' | 'quiz' | 'flashcards';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface SlideContent {
  title: string;
  bullets: string[];
  speakerNotes: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

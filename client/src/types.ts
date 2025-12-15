export enum InputType {
  TEXT = 'TEXT',
  PDF = 'PDF',
  DOI = 'DOI',
  VIDEO = 'VIDEO',
  URL = 'URL',
  IMAGE = 'IMAGE'
}

export enum StudyMode {
  HARD = 'HARD',
  NORMAL = 'NORMAL',
  SURVIVAL = 'SURVIVAL',
  PARETO = 'PARETO'
}

export interface CoreConcept {
  concept: string;
  definition: string;
}

// --- NOVAS ESTRUTURAS PARA LIVROS ---
export interface BookSection {
  title: string;
  coreConcepts: CoreConcept[];
  supportConcepts?: CoreConcept[];
  connections?: string;
  checklist?: string[];
}

export interface BookChapter {
  title: string;
  summary: string;
  coreConcepts: CoreConcept[];
  supportConcepts?: CoreConcept[];
  practicalApplication?: string;
  sections?: BookSection[];
}
// ------------------------------------

export interface Checkpoint {
  mission: string;
  timestamp: string;
  lookFor: string;
  noteExactly: string;
  drawExactly: string;
  drawLabel?: 'essential' | 'suggestion' | 'none';
  question: string;
  imageUrl?: string;
  completed: boolean;
  completedAt?: number;
}

export interface StudyGuide {
  subject: string;
  overview: string;
  globalApplication?: string; // Novo: Para o modo Sobrevivência de Livros
  coreConcepts: CoreConcept[];
  checkpoints: Checkpoint[];
  chapters?: BookChapter[]; // Novo: Lista de capítulos
}

export interface Slide {
  title: string;
  bullets: string[];
  speakerNotes: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'open';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface StudySource {
  id: string;
  type: InputType;
  name: string;
  content: string;
  mimeType?: string;
  dateAdded: number;
}

export interface StudySession {
  id: string;
  folderId: string;
  title: string;
  sources: StudySource[];
  mode: StudyMode;
  isBook?: boolean; // Novo: Flag para saber se é modo Livro
  guide: StudyGuide | null;
  slides: Slide[] | null;
  quiz: QuizQuestion[] | null;
  flashcards: Flashcard[] | null;
  createdAt: number;
  updatedAt: number;
  nextReviewDate?: number;
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  parentId?: string;
}

export interface ProcessingState {
  isLoading: boolean;
  error: string | null;
  step: 'idle' | 'analyzing' | 'transcribing' | 'generating' | 'slides' | 'quiz' | 'flashcards' | 'diagram' | 'complete';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
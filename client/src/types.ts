
// Fix for "Cannot find name 'process'" error in client-side code
declare var process: any;

export enum InputType {
  TEXT = 'TEXT',
  PDF = 'PDF',
  DOI = 'DOI',
  VIDEO = 'VIDEO',
  URL = 'URL',
  IMAGE = 'IMAGE'
}

export enum StudyMode {
  HARD = 'HARD', // Antigo TURBO
  NORMAL = 'NORMAL',
  SURVIVAL = 'SURVIVAL', // Antigo ESSENTIAL
  PARETO = 'PARETO' // Novo modo exclusivo para a Landing Page
}

export interface CoreConcept {
  concept: string;
  definition: string;
}

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
  coreConcepts: CoreConcept[];
  checkpoints: Checkpoint[];
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
  guide: StudyGuide | null;
  slides: Slide[] | null;
  quiz: QuizQuestion[] | null;
  flashcards: Flashcard[] | null;
  createdAt: number;
  updatedAt: number;
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

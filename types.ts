
export enum InputType {
  TEXT = 'TEXT',
  PDF = 'PDF',
  DOI = 'DOI',
  VIDEO = 'VIDEO',
  URL = 'URL',
  IMAGE = 'IMAGE'
}

export enum StudyMode {
  TURBO = 'TURBO',
  NORMAL = 'NORMAL',
  SURVIVAL = 'SURVIVAL'
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
  drawLabel?: 'essential' | 'suggestion' | 'none'; // New: Classify importance of drawing
  question: string;
  imageUrl?: string; // New: Store generated diagram URL
}

export interface StudyGuide {
  subject: string;
  overview: string;
  coreConcepts: CoreConcept[];
  checkpoints: Checkpoint[];
}

// New Types for Slides and Quiz
export interface Slide {
  title: string;
  bullets: string[];
  speakerNotes: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'open';
  difficulty: 'easy' | 'medium' | 'hard'; // New difficulty level
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer: string; // Index (0-3) or text
  explanation: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

// Study Management Types
export interface StudySource {
  id: string;
  type: InputType;
  name: string;
  content: string; // Text or Base64
  mimeType?: string;
  dateAdded: number;
}

export interface StudySession {
  id: string;
  folderId: string;
  title: string;
  sources: StudySource[];
  mode: StudyMode; // Track selected mode
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
  parentId?: string; // New: For subfolders
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

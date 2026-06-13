export interface User {
  id: string;
  email: string;
  name: string;
  subscription_status: 'free' | 'pro';
}

export interface DocumentInfo {
  id: string;
  user_id: string;
  title: string;
  raw_text_content: string;
  upload_date: string;
}

export interface SummaryInfo {
  id: string;
  document_id: string;
  quick_read_json: string[];
  deep_dive_json: {
    notes: string[];
    formulas?: string[];
    definitions: { term: string; definition: string }[];
  };
  eli5_text: string;
}

export interface Flashcard {
  id: string;
  document_id: string;
  question_text: string;
  answer_text: string;
  review_status: 'learning' | 'mastered';
}

export interface QuizQuestion {
  id: string;
  document_id: string;
  question_text: string;
  options_array: string[];
  correct_option_index: number;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface StudyKit {
  document: DocumentInfo;
  summary: SummaryInfo;
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
}

export interface QuickStats {
  totalFlashcardsMastered: number;
  averageQuizScore: number;
}

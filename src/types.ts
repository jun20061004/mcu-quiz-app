export type QuestionType = 'fill' | 'single' | 'judge' | 'short' | 'code';

export interface Question {
  id: string;
  chapter: number;
  chapterTitle: string;
  type: QuestionType;
  question: string;
  options: string[];
  answer: string[];
  explanation: string;
  hasErrata: boolean;
}

export type StudyMode = 'memorize' | 'practice' | 'wrong' | 'exam';

export interface UserAnswerRecord {
  questionId: string;
  userAnswer: string[];
  isCorrect: boolean;
  timestamp: number;
}

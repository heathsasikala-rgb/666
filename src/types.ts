export interface Question {
  id: string;
  originalText: string;
  originalImage?: string;
  knowledgePoint: string;
  options?: string[];
  userAnswer?: string;
  correctAnswer?: string;
  analogies: Analogy[];
  createdAt: number;
}

export interface Analogy {
  id: string;
  text: string;
  answer: string;
  analysis: string;
}

export type AppTab = 'recognition' | 'bank';

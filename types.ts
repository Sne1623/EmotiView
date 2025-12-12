
export enum SentimentType {
  POSITIVE = 'Positive',
  NEGATIVE = 'Negative',
  NEUTRAL = 'Neutral',
}

export interface AnalysisResult {
  id: string;
  text: string;
  sentiment: SentimentType;
  confidence: number;
  keywords: string[];
  emotion: string;      // New: Specific emotion (e.g., Joy, Anger)
  emotionEmoji: string; // New: Emoji representing the emotion
  isSarcastic: boolean; // New: Sarcasm flag
  explanation: string;  // New: Natural language explanation of the result
  timestamp: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  fill: string;
}

export interface BatchProgress {
  total: number;
  processed: number;
  errors: number;
  isProcessing: boolean;
}

export interface ErrorDetails {
  title: string;
  message: string;
  solution?: string;
  code?: string;
  status?: number;
}

export type InputMode = 'single' | 'batch';
export type FilterType = 'ALL' | SentimentType;
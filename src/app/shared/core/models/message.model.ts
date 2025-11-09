import type { Annotation } from './annotation.model';

export type MessageRole = 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string; // ISO 8601 (UTC, with Z)
  annotations?: Annotation[];
}


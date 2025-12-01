import type { Annotation } from './annotation.model';

export type MessageRole = 'user' | 'assistant' | 'reasoning';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string; // ISO 8601 (UTC, with Z)
  annotations?: Annotation[];
  /**
   * Optional pointer to the assistant message this reasoning belongs to.
   * When absent, treat it as standalone reasoning content.
   */
  reasoningParentId?: string | null;
  /**
   * Additional metadata that may accompany reasoning responses.
   */
  metadata?: Record<string, unknown>;
}


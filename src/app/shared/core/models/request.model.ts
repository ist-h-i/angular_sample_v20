import type { RequestStatus } from './request-status.model';
import type { Message } from './message.model';

export interface RequestDetail {
  request_id: string;
  title: string;
  query_text: string;
  status: RequestStatus;
  last_updated: string; // ISO 8601 (UTC, with Z)
  ai_model?: string | null;
  messages?: Message[];
  status_detail?: string;
}

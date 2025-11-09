import type { RequestStatus } from './request-status.model';

export interface RequestHistory {
  request_history_id: string;
  title: string;
  status: RequestStatus;
  last_updated: string; // ISO 8601 (UTC, with Z)
}


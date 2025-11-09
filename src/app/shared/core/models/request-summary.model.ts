import type { RequestStatus } from './request-status.model';

// Lightweight summary used by GET /requests/status
export interface RequestSummary {
  request_id: string;
  title: string;
  snippet: string;
  status: RequestStatus;
  last_updated: string; // ISO 8601 (UTC, with Z)
}


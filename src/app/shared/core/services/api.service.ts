import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import type { InitialData } from '../models/initial-data.model';
import type { RequestSummary } from '../models/request-summary.model';
import type { RequestDetail } from '../models/request.model';
import type { RequestStatus } from '../models/request-status.model';
import type { User } from '../models/user.model';

export interface CreateRequestPayload {
  query_text: string;
  request_history_id?: string | null;
}

export interface CreateRequestResponse {
  request_id: string;
  submitted_at: string;
  status_url: string;
  result_url: string;
}

export interface RequestStatusResponse {
  request_id: string;
  status: RequestStatus;
  last_updated?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  // --- Mock setup (moved from facade) ---
  // Toggle to switch between mock and real API per method
  private readonly useMock = true;

  private mockRequests: Record<string, RequestSummary> = {
    'req-1001': {
      request_id: 'req-1001',
      title: '調査：Angular v20 Signals のベストプラクティス',
      snippet: 'Signals 導入時に押さえるべきネイティブ API の使いかたや移行パターン...',
      status: 'completed',
      last_updated: new Date().toISOString(),
    },
    'req-1002': {
      request_id: 'req-1002',
      title: '最近の DX ドキュメントまとめ',
      snippet: '最新の開発者体験改善施策を中心に要点を整理...',
      status: 'processing',
      last_updated: new Date().toISOString(),
    },
  };

  private mockDetails: Record<string, RequestDetail> = {
    'req-1001': {
      request_id: 'req-1001',
      title: '調査：Angular v20 Signals のベストプラクティス',
      query_text: 'Angular v20 Signals の導入時に押さえるべきポイントや移行戦略を整理してください。',
      status: 'completed',
      last_updated: new Date().toISOString(),
      messages: [
        {
          role: 'user',
          content:
            'Angular v20 Signals の導入を検討しているのですが、既存のコンポーネントやサービスをどうやって移行すればよいか、加えて運用時に気をつけることを知りたいです。',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content:
            '以下のようなステップで Signals を活用すると、初期導入と既存コードの移行がスムーズになります。\n' +
            '1. 基盤となるステートを `signal` で定義し、`effect` や `computed` を使って派生値を管理します。これにより変更追跡の粒度が明示化され、変更通知の過剰な再計算を抑えられます。\n' +
            '2. 既存の `@Input`/`@Output` を使うコンポーネントは、`signal` を引数で渡して直接参照するか、`computed` で内部状態を再構築します。副作用の発生源を明確にするため、`effect` をサービスやコンポーネントの `onDestroy` で停止します。\n' +
            '3. サービス側は `signal` を持ち、ストアとして作用させることで、購読不要な状態共有を実現できます。これにより zone.js の監視外でも状態更新が動作します。\n' +
            '4. 運用ではテストカバレッジを強化し、`signal` の mutate／reset をユースケースごとに確認してください。`toSignal` など既存 Observable との橋渡しでは、互換性を保つために明示的にライフサイクルを管理するのがおすすめです。\n' +
            '5. ドキュメントの改善：チームが一貫した `signal` 命名やアクセサリの方針を共有すれば、Signals 周りのコードレビューが容易になります。\n' +
            '参照資料: https://angular.dev/guide/signals',
          timestamp: new Date().toISOString(),
          annotations: [
            {
              url: 'https://angular.dev/guide/signals',
              title: 'Angular Signals ガイド',
              snippet:
                'Signals では状態と副作用を明示的に分離することで、より細かいレンダリング制御と簡潔な依存関係管理が可能になります。',
            },
          ],
        },
      ],
    },
    'req-1002': {
      request_id: 'req-1002',
      title: '最近の DX ドキュメントまとめ',
      query_text: '最新の開発者体験を改善する取り組みを特に注目点と併せてまとめてください。',
      status: 'processing',
      last_updated: new Date().toISOString(),
    },
  };

  private readonly mockThinkingStreams: Record<string, string[]> = {
    'req-1001': [
      `Phase 1: Deconstruct the Request
・Process 1: Identify key terms such as "neural network" and "learns."
・Process 2: Determine the user's likely knowledge level.

`,
      `Phase 2: Structure the Explanation
・Process 3: Outline key concepts like neurons, weights, and backpropagation.
・Process 4: Formulate a simple analogy (e.g., learning to ride a bike).

`,
    ],
    'req-1002': [
      `Phase 1: Deconstruct the Request
・Process 1: Review the DX document topics mentioned.
・Process 2: Note the expected deliverable format.

`,
      `Phase 2: Structure the Explanation
・Process 3: Surface the key takeaways and decisions.
・Process 4: Link to supporting references for clarity.

`,
    ],
    default: [
      `Phase 1: Deconstruct the Request
・Process 1: Capture the main goals.
・Process 2: Note any constraints mentioned.

`,
      `Phase 2: Structure the Explanation
・Process 3: Provide reasoning steps.
・Process 4: Offer a concise summary.

`,
    ],
  };

  private mockUser: User = {
    id: '1012835',
    name_initial: 'TY',
    name_full: 'Taro Yamada',
    is_admin: true,
    is_support: false,
  };

  private promote(s: RequestStatus): RequestStatus {
    if (s === 'pending') return Math.random() > 0.6 ? 'processing' : 'pending';
    if (s === 'processing') return Math.random() > 0.7 ? 'completed' : 'processing';
    return s;
  }

  private buildMockThinkingChunks(id: string): string[] {
    const candidate = this.mockThinkingStreams[id];
    if (candidate && candidate.length > 0) {
      return candidate;
    }
    return this.mockThinkingStreams['default'];
  }

  // GET /initial-data
  getInitialData(): Observable<InitialData> {
    if (this.useMock) {
      const request_histories = Object.values(this.mockRequests).map((s) => ({
        request_history_id: s.request_id,
        title: s.title,
        status: s.status,
        last_updated: s.last_updated,
      }));
      return of({ user: this.mockUser, request_histories });
    }
    return this.http.get<InitialData>('/initial-data');
  }

  // POST /requests
  createRequest(payload: CreateRequestPayload): Observable<CreateRequestResponse> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const queryText = payload.query_text ?? '';
      const title = payload.query_text?.slice(0, 48) || 'New Request';
      const historyId =
        typeof payload.request_history_id === 'string' &&
        !!this.mockRequests[payload.request_history_id]
          ? payload.request_history_id
          : null;
      const requestId = historyId ?? `req-${Date.now()}`;

      if (historyId) {
        const existing = this.mockRequests[historyId];
        this.mockRequests[historyId] = {
          request_id: historyId,
          title: existing?.title ?? title,
          snippet: queryText,
          status: 'pending',
          last_updated: now,
        };
        const detail = this.mockDetails[historyId];
        const updatedMessages = [...(detail?.messages ?? [])];
        updatedMessages.push({
          role: 'user',
          content: queryText,
          timestamp: now,
        });
        this.mockDetails[historyId] = {
          ...(detail ?? {}),
          request_id: historyId,
          title: detail?.title ?? existing?.title ?? title,
          query_text: detail?.query_text ?? queryText,
          status: 'pending',
          last_updated: now,
          messages: updatedMessages,
        };
      } else {
        this.mockRequests[requestId] = {
          request_id: requestId,
          title,
          snippet: queryText,
          status: 'pending',
          last_updated: now,
        };
        this.mockDetails[requestId] = {
          request_id: requestId,
          title,
          query_text: queryText,
          status: 'pending',
          last_updated: now,
        };
      }
      return of({
        request_id: requestId,
        submitted_at: now,
        status_url: `/requests/${requestId}/status`,
        result_url: `/requests/${requestId}/result`,
      });
    }
    return this.http.post<CreateRequestResponse>('/requests', payload);
  }

  createResultStream(id: string): EventSource | null {
    if (this.useMock) {
      const chunks = this.buildMockThinkingChunks(id);
      return new MockResultEventSource(id, chunks) as unknown as EventSource;
    }
    if (typeof EventSource === 'undefined') {
      return null;
    }
    return new EventSource(`/requests/${encodeURIComponent(id)}/result`);
  }

  // GET /requests/status — list of lightweight summaries for the current user
  getRequestsStatus(): Observable<RequestSummary[]> {
    if (this.useMock) {
      const next: Record<string, RequestSummary> = {};
      for (const [id, r] of Object.entries(this.mockRequests)) {
        const status = this.promote(r.status);
        next[id] = { ...r, status, last_updated: new Date().toISOString() };
      }
      this.mockRequests = next;
      return of(Object.values(this.mockRequests));
    }
    return this.http.get<RequestSummary[]>('/requests/status');
  }

  // GET /requests/{id}
  getRequestById(id: string): Observable<RequestDetail> {
    if (this.useMock) {
      const summary = this.mockRequests[id];
      const base = this.mockDetails[id];
      if (!summary || !base) {
        // minimal not found-ish behavior: pending detail with unknowns
        return of({
          request_id: id,
          title: 'Unknown Request',
          query_text: '',
          status: 'failed',
          last_updated: new Date().toISOString(),
        });
      }
      // reflect latest status from summary
      const detail: RequestDetail = {
        ...base,
        status: summary.status,
        last_updated: summary.last_updated,
      };
      // When completed, ensure messages exist
      if (detail.status === 'completed' && !detail.messages) {
        const ts = new Date().toISOString();
        detail.messages = [
          { role: 'user', content: base.query_text, timestamp: ts },
          {
            role: 'assistant',
            content: 'Here is the summarized content with key points and references.',
            timestamp: ts,
            annotations: [
              {
                url: 'https://example.com/article',
                title: 'Example Article',
                snippet: 'Excerpt from the source',
              },
            ],
          },
        ];
      }
      return of(detail);
    }
    return this.http.get<RequestDetail>(`/requests/${encodeURIComponent(id)}`);
  }

  // GET /requests/{id}/status
  getRequestStatusById(id: string): Observable<RequestStatusResponse> {
    if (this.useMock) {
      const cur = this.mockRequests[id];
      if (!cur) {
        // When not found, simulate 404-like response by keeping status as failed
        return of({ request_id: id, status: 'failed', last_updated: new Date().toISOString() });
      }
      const nextStatus: RequestStatus = this.promote(cur.status);
      const updated = { ...cur, status: nextStatus, last_updated: new Date().toISOString() };
      this.mockRequests[id] = updated;
      const detail = this.mockDetails[id];
      if (detail) {
        detail.status = nextStatus;
        detail.last_updated = updated.last_updated;
        if (nextStatus === 'completed' && !detail.messages) {
          const ts = new Date().toISOString();
          detail.messages = [
            { role: 'user', content: detail.query_text, timestamp: ts },
            {
              role: 'assistant',
              content: 'This is a final generated response for your request.',
              timestamp: ts,
              annotations: [
                {
                  url: 'https://example.com/article',
                  title: 'Example Article',
                  snippet: 'Excerpt from the source',
                },
              ],
            },
          ];
        }
      }
      return of({ request_id: id, status: updated.status, last_updated: updated.last_updated });
    }
    return this.http.get<RequestStatusResponse>(`/requests/${encodeURIComponent(id)}/status`);
  }

  // GET /request — fetch all requests for the current user (full refresh)
  getRequests(): Observable<RequestSummary[]> {
    if (this.useMock) {
      return of(Object.values(this.mockRequests));
    }
    return this.http.get<RequestSummary[]>('/request');
  }
}
class MockResultEventSource extends EventTarget {
  readonly url: string;
  readonly withCredentials = false;
  private _readyState: number = EventSource.CONNECTING;
  get readyState(): number {
    return this._readyState;
  }
  onopen: ((this: EventSource, ev: Event) => any) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent<any>) => any) | null = null;
  onerror: ((this: EventSource, ev: Event) => any) | null = null;

  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly requestId: string, private readonly payloads: string[]) {
    super();
    this.url = `/requests/${encodeURIComponent(requestId)}/result`;
    this.scheduleOpen();
  }

  close(): void {
    this.clearTimer();
    this._readyState = EventSource.CLOSED;
  }

  private scheduleOpen(): void {
    this.timerId = setTimeout(() => {
      this._readyState = EventSource.OPEN;
      const openEvent = new Event('open');
      this.dispatchEvent(openEvent);
      if (typeof this.onopen === 'function') {
        this.onopen.call(this as unknown as EventSource, openEvent);
      }
      this.emitChunk(0);
    }, 220);
  }

  private emitChunk(index: number): void {
    if (this.readyState === EventSource.CLOSED) return;
    if (index >= this.payloads.length) {
      this.sendMessage('[DONE]');
      this._readyState = EventSource.CLOSED;
      return;
    }
    const chunk = this.payloads[index];
    this.sendMessage(chunk);
    this.timerId = setTimeout(() => this.emitChunk(index + 1), 420);
  }

  private sendMessage(payload: string): void {
    const message = new MessageEvent('message', { data: payload });
    this.dispatchEvent(message);
    if (typeof this.onmessage === 'function') {
      this.onmessage.call(this as unknown as EventSource, message);
    }
  }

  private clearTimer(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}

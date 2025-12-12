import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map } from 'rxjs/operators';
import type { InitialData } from '../models/initial-data.model';
import type { RequestSummary } from '../models/request-summary.model';
import type { RequestDetail } from '../models/request.model';
import type { RequestStatus } from '../models/request-status.model';
import type { User } from '../models/user.model';
import type { EnvironmentVariable } from '../models/environment-variable.model';
import type {
  AdminDefaultModel,
  AdminDefaultModelPayload,
  AdminInitialResponse,
  AdminModel,
  AdminModelPayload,
  AdminUserThread,
  AdminUserPayload,
  AdminUserRecord,
} from '../models/admin.model';

export interface CreateRequestPayload {
  query_text: string;
  request_history_id?: string | null;
  ai_model_id?: string | null;
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

  isMockMode(): boolean {
    return this.useMock;
  }

  private mockRequests: Record<string, RequestSummary> = {
    'req-1001': {
      request_id: 'req-1001',
      title: '調査：Angular v20 Signals のベストプラクティス',
      snippet: 'Signals 導入時に押さえるべきネイティブ API の使いかたや移行パターン...',
      status: 'pending',
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

  private readonly mockThinkingProcesses: Record<string, string> = {
    'req-1001': `Phase 1: Deconstruct the Request
・Process 1: Identify key terms such as "neural network" and "learns."
・Process 2: Determine the user's likely knowledge level.

Phase 2: Structure the Explanation
・Process 3: Outline key concepts like neurons, weights, and backpropagation.
・Process 4: Formulate a simple analogy (e.g., learning to ride a bike).

`,
    'req-1002': `Phase 1: Deconstruct the Request
・Process 1: Review the DX document topics mentioned.
・Process 2: Note the expected deliverable format.

Phase 2: Structure the Explanation
・Process 3: Surface the key takeaways and decisions.
・Process 4: Link to supporting references for clarity.

`,
    default: `Phase 1: Deconstruct the Request
・Process 1: Capture the main goals.
・Process 2: Note any constraints mentioned.

Phase 2: Structure the Explanation
・Process 3: Provide reasoning steps.
・Process 4: Offer a concise summary.

`,
  };

  private mockDetails: Record<string, RequestDetail> = {
    'req-1001': {
      request_id: 'req-1001',
      title: '調査：Angular v20 Signals のベストプラクティス',
      query_text: 'Angular v20 Signals の導入時に押さえるべきポイントや移行戦略を整理してください。',
      status: 'pending',
      last_updated: new Date().toISOString(),
      thinking_process: this.mockThinkingProcesses['req-1001'],
      messages: [
        {
          role: 'user',
          content:
            'Angular v20 Signals の導入を検討しているのですが、既存のコンポーネントやサービスをどうやって移行すればよいか、加えて運用時に気をつけることを知りたいです。',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'reasoning',
          content:
            'ユーザーのゴールを分解し、移行手順と運用時のリスクを整理しています。Signals への置き換えポイントや計測観点を抽出中です。',
          timestamp: new Date().toISOString(),
          metadata: { stage: 'analysis' },
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
      thinking_process: this.mockThinkingProcesses['req-1002'],
    },
  };

  private mockUser: User = {
    id: '1012835',
    name_initial: 'TY',
    name_full: 'Taro Yamada',
    is_admin: true,
    is_support: false,
  };

  private mockEnvironmentVariables: EnvironmentVariable[] = [
    {
      key: 'NODE_ENV',
      value: 'development',
      description: 'ランタイムの現在モード',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'API_BASE_URL',
      value: '/api',
      description: 'バックエンドへのベース URL',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'FEATURE_NEW_INBOX',
      value: 'enabled',
      description: '新しいインボックス UI を切り替えるフラグ',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'MAX_CONCURRENT_REQUESTS',
      value: '12',
      description: '同時リクエストの上限',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'AI_MODEL_GPT4O_MINI_NAME',
      value: 'gpt-4o-mini',
      description: 'gpt-4o-mini を使うモデル',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'AI_MODEL_GPT4O_MINI_CALLS_PER_MINUTE',
      value: '60',
      description: '1 分あたりの gpt-4o-mini 呼び出し上限',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'AI_MODEL_GPT4O_MINI_CALLS_PER_MONTH',
      value: '120000',
      description: '月間の gpt-4o-mini 呼び出し上限',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'AI_MODEL_GPT4O_MINI_REASONING_EFFORT',
      value: 'medium',
      description: 'gpt-4o-mini の推論精度パラメータ',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'AI_MODEL_GPT4O_8K_NAME',
      value: 'gpt-4o-8k',
      description: 'より大型の gpt-4o-8k モデル',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'AI_MODEL_GPT4O_8K_CALLS_PER_MINUTE',
      value: '30',
      description: '1 分あたりの gpt-4o-8k 呼び出し上限',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'AI_MODEL_GPT4O_8K_CALLS_PER_MONTH',
      value: '50000',
      description: '月間の gpt-4o-8k 呼び出し上限',
      last_updated: new Date().toISOString(),
    },
    {
      key: 'AI_MODEL_GPT4O_8K_REASONING_EFFORT',
      value: 'high',
      description: 'gpt-4o-8k の推論精度パラメータ',
      last_updated: new Date().toISOString(),
    },
  ];

  private mockAdminUsers: AdminUserRecord[] = [
    {
      userId: 'u-1001',
      admin: true,
      support: false,
      active: true,
      models: ['gpt-4o-mini', 'gpt-4o-8k'],
      isAc: true,
      allowedSpend: 150000,
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'u-1002',
      admin: false,
      support: true,
      active: true,
      models: ['gpt-4o-mini'],
      isAc: false,
      allowedSpend: 30000,
      updatedAt: new Date().toISOString(),
    },
    {
      userId: 'u-1003',
      admin: false,
      support: false,
      active: false,
      models: [],
      isAc: false,
      allowedSpend: 0,
      updatedAt: new Date().toISOString(),
    },
  ];

  private mockAdminModels: AdminModel[] = [
    {
      id: 'model-1',
      name: 'GPT-4o Mini',
      modelId: 'gpt-4o-mini',
      endpoint: '/openai/gpt-4o-mini',
      reasoningEffort: 'medium',
      isVerify: true,
      timeoutSec: 30,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'model-2',
      name: 'GPT-4o 8k',
      modelId: 'gpt-4o-8k',
      endpoint: '/openai/gpt-4o-8k',
      reasoningEffort: 'high',
      isVerify: true,
      timeoutSec: 45,
      updatedAt: new Date().toISOString(),
    },
  ];

  private mockAdminDefaultModels: AdminDefaultModel[] = [
    {
      id: 'default-1',
      swarmGroup: 'default',
      modelIds: ['gpt-4o-mini', 'gpt-4o-8k'],
      orderNumber: 1,
      allowedSpend: 50000,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'default-2',
      swarmGroup: 'support',
      modelIds: ['gpt-4o-mini'],
      orderNumber: 2,
      allowedSpend: 10000,
      updatedAt: new Date().toISOString(),
    },
  ];

  private mockAdminThreads: AdminUserThread[] = [
    {
      userId: 'u-1001',
      statusCounts: { completed: 320, pending: 8 },
    },
    {
      userId: 'u-1002',
      statusCounts: { completed: 120, pending: 4 },
    },
    {
      userId: 'u-1003',
      statusCounts: { completed: 28, pending: 0, failed: 2 },
    },
    {
      userId: 'u-1004',
      statusCounts: { completed: 780, pending: 12 },
    },
    {
      userId: 'u-1005',
      statusCounts: { completed: 8, pending: 1 },
    },
    {
      userId: 'u-1006',
      statusCounts: { completed: 180, pending: 3, failed: 1 },
    },
  ];

  private promote(s: RequestStatus): RequestStatus {
    if (s === 'pending') return Math.random() > 0.6 ? 'processing' : 'pending';
    if (s === 'processing') return Math.random() > 0.7 ? 'completed' : 'processing';
    return s;
  }

  private nextId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private cloneAdminUser(user: AdminUserRecord): AdminUserRecord {
    return {
      ...user,
      models: [...user.models],
    };
  }

  private cloneAdminModel(model: AdminModel): AdminModel {
    return { ...model };
  }

  private cloneAdminDefaultModel(defaultModel: AdminDefaultModel): AdminDefaultModel {
    return { ...defaultModel, modelIds: [...defaultModel.modelIds] };
  }

  private cloneAdminThread(thread: AdminUserThread): AdminUserThread {
    return { userId: thread.userId, statusCounts: { ...thread.statusCounts } };
  }

  private buildAdminInitialResponse(): AdminInitialResponse {
    return {
      users: this.mockAdminUsers.map((user) => this.cloneAdminUser(user)),
      models: this.mockAdminModels.map((model) => ({ ...model })),
      defaultModels: this.mockAdminDefaultModels.map((entry) =>
        this.cloneAdminDefaultModel(entry),
      ),
      threads: this.mockAdminThreads.map((entry) => this.cloneAdminThread(entry)),
    };
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
      return null;
    }
    if (typeof EventSource === 'undefined') {
      return null;
    }
    return new EventSource(`/requests/${encodeURIComponent(id)}/result`);
  }

  // GET /requests/status — list of lightweight summaries for the current user
  getRequestsStatus(): Observable<RequestSummary[]> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const next: Record<string, RequestSummary> = {};
      for (const [id, r] of Object.entries(this.mockRequests)) {
        next[id] = { ...r, last_updated: now };
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
            role: 'reasoning',
            content: 'リクエストの意図を確認し、要約の構造と参照元を決めています。',
            timestamp: ts,
            metadata: { stage: 'planning' },
          },
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
      const progressStatus = (status: RequestStatus): RequestStatus => {
        if (status === 'pending') return 'processing';
        if (status === 'processing') return 'completed';
        return status;
      };
      const nextStatus: RequestStatus = progressStatus(cur.status);
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
                role: 'reasoning',
                content: '回答のアウトラインを整理し、参照する情報源を確定しています。',
                timestamp: ts,
                metadata: { stage: 'drafting' },
              },
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

  // GET /admin/environment  Eenvironment variables each admin can view/edit
  getEnvironmentVariables(): Observable<EnvironmentVariable[]> {
    if (this.useMock) {
      return of(this.mockEnvironmentVariables.map((entry) => ({ ...entry })));
    }
    return this.http.get<EnvironmentVariable[]>('/admin/environment');
  }

  // POST /admin/environment  Ereplace env values
  updateEnvironmentVariables(payload: EnvironmentVariable[]): Observable<EnvironmentVariable[]> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const existingEntries = Object.fromEntries(
        this.mockEnvironmentVariables.map((entry) => [entry.key, entry]),
      );
      const next = payload.map((entry) => {
        const prev = existingEntries[entry.key];
        return {
          ...entry,
          description: entry.description?.trim() || prev?.description || '環境変数',
          last_updated: now,
        };
      });
      this.mockEnvironmentVariables = next;
      return of(next.map((entry) => ({ ...entry })));
    }
    return this.http.post<EnvironmentVariable[]>('/admin/environment', payload);
  }

  // GET /admin  Einitial admin data
  getAdminInitialData(): Observable<AdminInitialResponse> {
    if (this.useMock) {
      return of(this.buildAdminInitialResponse());
    }
    return this.http.get<AdminInitialResponse>('/admin');
  }

  // POST /admin/addUser
  addAdminUser(payload: AdminUserPayload): Observable<AdminUserRecord> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const record: AdminUserRecord = {
        userId: payload.userId,
        admin: Boolean(payload.isAdmin),
        support: Boolean(payload.isSupport),
        active: payload.isActive ?? true,
        models: payload.models ?? [],
        isAc: payload.isAc ?? false,
        allowedSpend: payload.allowedSpend,
        updatedAt: now,
      };
      const existingIndex = this.mockAdminUsers.findIndex((user) => user.userId === record.userId);
      if (existingIndex >= 0) {
        this.mockAdminUsers[existingIndex] = record;
      } else {
        this.mockAdminUsers = [...this.mockAdminUsers, record];
      }
      return of(this.cloneAdminUser(record));
    }
    return this.http.post<AdminUserRecord>('/admin/addUser', payload);
  }

  // POST /admin/updateUser
  updateAdminUser(payload: AdminUserPayload): Observable<AdminUserRecord> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const existing =
        this.mockAdminUsers.find((user) => user.userId === payload.userId) ??
        ({
          userId: payload.userId,
          admin: false,
          support: false,
          active: false,
          models: [],
        } as AdminUserRecord);
      const updated: AdminUserRecord = {
        ...existing,
        admin: payload.isAdmin ?? existing.admin,
        support: payload.isSupport ?? existing.support,
        active: payload.isActive ?? existing.active,
        models: payload.models ?? existing.models,
        isAc: payload.isAc ?? existing.isAc,
        allowedSpend: payload.allowedSpend ?? existing.allowedSpend,
        updatedAt: now,
      };
      const idx = this.mockAdminUsers.findIndex((user) => user.userId === updated.userId);
      if (idx >= 0) {
        this.mockAdminUsers[idx] = updated;
      } else {
        this.mockAdminUsers = [...this.mockAdminUsers, updated];
      }
      return of(this.cloneAdminUser(updated));
    }
    return this.http.post<AdminUserRecord>('/admin/updateUser', payload);
  }

  // GET /admin/users  ECSV download
  downloadAdminUsersCsv(): Observable<Blob> {
    if (this.useMock) {
      const header = 'userId,isActive,isAdmin,isSupport,models,isAc,allowedSpend,updatedAt';
      const rows = this.mockAdminUsers.map((user) =>
        [
          user.userId,
          user.active,
          user.admin,
          user.support,
          user.models.join('|'),
          user.isAc ?? false,
          user.allowedSpend ?? '',
          user.updatedAt ?? '',
        ].join(','),
      );
      const csv = [header, ...rows].join('\n');
      return of(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    }
    return this.http.get('/admin/users', { responseType: 'blob' });
  }

  downloadAdminUsageCsv(): Observable<Blob> {
    if (this.useMock) {
      const statusKeys = Array.from(
        this.mockAdminThreads.reduce((set, thread) => {
          Object.keys(thread.statusCounts).forEach((key) => set.add(key));
          return set;
        }, new Set<string>()),
      );
      const header = ['userId', ...statusKeys, 'total'].join(',');
      const rows = this.mockAdminThreads.map((thread) => {
        const total = statusKeys.reduce(
          (sum, status) => sum + (thread.statusCounts[status] ?? 0),
          0,
        );
        const entries = statusKeys.map((status) => thread.statusCounts[status] ?? 0);
        return [thread.userId, ...entries, total].join(',');
      });
      const csv = [header, ...rows].join('\n');
      return of(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    }
    return this.http.get('/admin/usage', { responseType: 'blob' });
  }

  // POST /admin/uploadUser (multipart)
  uploadAdminUsersCsv(file: File): Observable<AdminUserRecord[]> {
    if (this.useMock) {
      const parseBoolean = (value: string | undefined) => {
        const normalized = (value ?? '').trim().toLowerCase();
        return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
      };
      return from(file.text()).pipe(
        map((text) => text.replace(/^\ufeff/, '')),
        map((text) => text.trim()),
        map((text) => {
          const lines = text.split(/\r?\n/).filter(Boolean);
          const entries: AdminUserRecord[] = [];
          for (const line of lines.slice(1)) {
            const [userId, isActive, isAdmin, isSupport, models, isAc, allowedSpend, updatedAt] =
              line.split(',').map((part) => part.trim());
            if (!userId) continue;
            const spendValue = allowedSpend ? Number(allowedSpend) : undefined;
            const parsedSpend =
              typeof spendValue === 'number' && Number.isFinite(spendValue) ? spendValue : undefined;
            const record: AdminUserRecord = {
              userId,
              active: parseBoolean(isActive),
              admin: parseBoolean(isAdmin),
              support: parseBoolean(isSupport),
              models: (models ?? '')
                .split('|')
                .map((m) => m.trim())
                .filter(Boolean),
              isAc: parseBoolean(isAc),
              allowedSpend: parsedSpend,
              updatedAt: updatedAt || new Date().toISOString(),
            };
            entries.push(record);
          }
          if (entries.length) {
            this.mockAdminUsers = entries;
          }
          return this.mockAdminUsers.map((entry) => this.cloneAdminUser(entry));
        }),
      );
    }
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AdminUserRecord[]>('/admin/uploadUser', formData);
  }

  // GET /admin/events  Ezip download
  getAdminEventsArchive(): Observable<Blob> {
    if (this.useMock) {
      const csv = ['timestamp,level,message', '2024-12-05T09:00:00Z,INFO,Job started'].join('\n');
      return of(new Blob([csv], { type: 'application/zip' }));
    }
    return this.http.get('/admin/events', { responseType: 'blob' });
  }

  // POST /admin/addModel
  addAdminModel(payload: AdminModelPayload): Observable<AdminModel> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const model: AdminModel = {
        ...payload,
        id: this.nextId('model'),
        updatedAt: now,
      };
      this.mockAdminModels = [...this.mockAdminModels, model];
      return of({ ...model });
    }
    return this.http.post<AdminModel>('/admin/addModel', payload);
  }

  // POST /admin/updateModel
  updateAdminModel(id: string, payload: AdminModelPayload): Observable<AdminModel> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const existing =
        this.mockAdminModels.find((model) => model.id === id) ??
        ({
          id,
          name: payload.name,
          modelId: payload.modelId,
          endpoint: payload.endpoint,
        } as AdminModel);
      const updated: AdminModel = {
        ...existing,
        ...payload,
        updatedAt: now,
      };
      const idx = this.mockAdminModels.findIndex((model) => model.id === id);
      if (idx >= 0) {
        this.mockAdminModels[idx] = updated;
      } else {
        this.mockAdminModels = [...this.mockAdminModels, updated];
      }
      return of({ ...updated });
    }
    return this.http.post<AdminModel>('/admin/updateModel', { id, ...payload });
  }

  // DELETE /admin/deleteModel/{id}
  deleteAdminModel(id: string): Observable<void> {
    if (this.useMock) {
      this.mockAdminModels = this.mockAdminModels.filter((model) => model.id !== id);
      return of(void 0);
    }
    return this.http.delete<void>(`/admin/deleteModel/${encodeURIComponent(id)}`);
  }

  // POST /admin/addDefaultModel
  addDefaultModel(payload: AdminDefaultModelPayload): Observable<AdminDefaultModel> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const entry: AdminDefaultModel = {
        ...payload,
        id: this.nextId('default'),
        updatedAt: now,
      };
      this.mockAdminDefaultModels = [...this.mockAdminDefaultModels, entry];
      return of(this.cloneAdminDefaultModel(entry));
    }
    return this.http.post<AdminDefaultModel>('/admin/addDefaultModel', payload);
  }

  // POST /admin/updateDefaultModel
  updateDefaultModel(id: string, payload: AdminDefaultModelPayload): Observable<AdminDefaultModel> {
    if (this.useMock) {
      const now = new Date().toISOString();
      const existing =
        this.mockAdminDefaultModels.find((entry) => entry.id === id) ??
        ({
          id,
          modelIds: payload.modelIds,
          swarmGroup: payload.swarmGroup,
          orderNumber: payload.orderNumber,
        } as AdminDefaultModel);
      const updated: AdminDefaultModel = {
        ...existing,
        ...payload,
        updatedAt: now,
      };
      const idx = this.mockAdminDefaultModels.findIndex((entry) => entry.id === id);
      if (idx >= 0) {
        this.mockAdminDefaultModels[idx] = updated;
      } else {
        this.mockAdminDefaultModels = [...this.mockAdminDefaultModels, updated];
      }
      return of(this.cloneAdminDefaultModel(updated));
    }
    return this.http.post<AdminDefaultModel>('/admin/updateDefaultModel', { id, ...payload });
  }

  // DELETE /admin/deleteDefaultModel/{id}
  deleteDefaultModel(id: string): Observable<void> {
    if (this.useMock) {
      this.mockAdminDefaultModels = this.mockAdminDefaultModels.filter(
        (entry) => entry.id !== id && entry.swarmGroup !== id,
      );
      return of(void 0);
    }
    return this.http.delete<void>(`/admin/deleteDefaultModel/${encodeURIComponent(id)}`);
  }
}

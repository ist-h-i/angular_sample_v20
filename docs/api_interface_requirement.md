# API — リクエスト / レスポンス詳細仕様（Day1 草案）

## API URI の命名規則（RESTful）
- このドキュメントで記載する API エンドポイントは原則として RESTful な命名規則を採用します。主なルールは以下の通りです。
- リソースは複数（複数形）を用いる
- HTTP メソッドで意味を表す
- GET: 取得、POST: 作成、PUT: 更新（PATCH は本プロジェクトでは使用しない）、DELETE: 削除（原則は論理削除。物理削除が必要な場合は管理者用の別エンドポイントを検討）
- リソースの階層はスラッシュで表現し、ID はパスパラメータで指定
- フィルタ & ページング、検索などはクエリパラメータで指定する
- 非同期ジョブ系呼び出しは適切なステータスコードを使い分ける
  - 例: リクエスト受理 202 Accepted / 作成 201 Created
- 一貫性のためブラウザ（小文字ヘッダー）を使用
- エラー時は統一フォーマットで返却し、HTTP ステータスコードを適切に利用する

## 認証・認可

**共通必須ヘッダー（CPによりSSOで追加される）**
- X-NOM-GCD-UID: `<string>` // コンテンツプロバイダ（CP）側のクライアント UID。すべての API 呼び出しで必須。
- X-NOM-LDAP-Token: `<string>` // CP が発行する TEA/LDAP トークン（任意の運用により必須化する場合もあり）。Day1 では全 API に渡される前提で検証する。

**認証・認可のタイミング**
- すべての API エンドポイントで CP ヘッダー（X-NOM-GCD-UID, X-NOM-LDAP-Token）を検証します。これらのヘッダーは認可・アクセス制御やユーザ紐付けに利用されるため、クライアントは必ずリクエストに含めてください。（CP経由でアクセスする場合、自動でリクエストに含められる。）

## エラー応答（共通）
- ステータスコード: 400 / 401 / 403 / 404 / 429 / 500
- ボディ例：
```json
{
  "error": {
    "code": "string_code",
    "message": "Human readable message",
    "details": {}
  }
}
```

---

### ## GET /initial-data
**目的:** Header など、Token 情報をもとに、ホーム画面起動時にクライアントが必要とする初期データを返す。Day1ではユーザー情報と直近の requestHistories をまとめて返却し、WEBはそれを用いてホーム画面の表示を行う。

- **リクエスト**
  - クエリパラメータ: なし
- **レスポンス**
  - ステータス: 200 OK
  - ボディ例:
```json
{
  "user": {
    "id": "1012835",
    "name_initial": "TY",
    "name_full": "Taro Yamada",
    "is_admin": true,
    "is_support": false
  },
  "request_histories": [
    {
      "request_history_id": "conv-123",
      "title": "Research about XY",
      "status": "pending",
      "last_updated": "2025-10-28T12:34:56Z"
    }
  ]
}
```
- **エラー**
  - 401 Unauthorized

---

### ## POST /requests
**目的:** 新しいリクエストを登録する。このエンドポイントは非同期処理型で、リクエストを受け付けた時点で内部の request_id（GUID）を返し、バックグラウンドでオーケストレーションへ登録して処理を行う。

- **リクエスト**
  - ボディ（Day1 最小構成）:
```json
{
  "query_text": "Summarize latest news about Y",
  "request_history_id": "conv-123"
}
```
- **バリデーション**
  - query_text: 必須、文字でないと
  - request_history_id: 任意
- **レスポンス（非同期処理型）**
  - ステータス: 202 Accepted
  - ボディ例:
```json
{
  "request_id": "req-789",
  "submitted_at": "2025-10-28T12:35:00Z",
  "status_url": "/requests/req-789/status",
  "result_url": "/requests/req-789/result"
}
```
- **エラー**
  - 400 Bad Request – バリデーションエラー
  - 401 Unauthorized
  - 429 Too Many Requests – 同時実行上限を超えた場合（例: user has 3 concurrent requests limit）

---

### ## GET /requests/status
**目的:** 指定なしで当該ユーザーが持つリクエストのステータス一覧（軽い情報）を返す。

- **リクエスト**
  - クエリパラメータ: なし
- **レスポンス（例）**
  - ステータス: 200 OK
  - ボディ例:
```json
{
  "request_id": "req-789",
  "title": "Research about X",
  "snippet": "Last message snippet...",
  "status": "pending",
  "last_updated": "2025-10-28T12:35:10Z"
}
```
- **エラー**
  - 401 Unauthorized

---

### ## GET /requests/{id}
**目的:** ユーザに紐づく指定リクエストの情報と最新ステータスを返す。UI のエントリの履歴選択時に使用され、各パインのヘッダ表示および初期ステータス表示を1回のリクエストで完了できるようにする。デフォルトでは metadata や直近の会話履歴（snapshot）を返す。過去の完全なメッセージ履歴を常に含めたくない場合はクエリパラメータで制御する案も検討可（例: `?include=messages=false`）。

- **リクエスト**
  - パスパラメータ: `id` = `request_id`
  - ヘッダー: CP headers（X-NOM-GCD-UID, X-NOM-LDAP-Token）
  - バリデータ: request を作成したユーザと情報のリソースが一致することを確認する
- **レスポンス（例: status=completed を含む場合）**
  - ステータス: 200 OK
  - ボディ例:
```json
{
  "request_id": "req-789",
  "title": "Research about X",
  "query_text": "Summarize latest news about Y",
  "last_updated": "2025-10-28T12:36:20Z",
  "status": "completed",
  "messages": [
    {
      "role": "user",
      "content": "summary text by LLM or user message...",
      "timestamp": "2025-10-28T12:36:20Z"
    },
    {
      "role": "assistant",
      "content": "assistant reply or generated content...",
      "timestamp": "2025-10-28T12:36:20Z",
      "annotations": [
        {
          "url": "https://example.com/article",
          "title": "Example Article",
          "snippet": "Excerpt from the source"
        }
      ]
    }
  ]
}
```
- **レスポンス（例: processing/pending）**
```json
{
  "request_id": "req-789",
  "title": "Research about X",
  "query_text": "Summarize latest news about Y",
  "last_updated": "2025-10-28T12:35:10Z",
  "status": "processing",
  "status_detail": "(something. depends on OpenAI responses API spec)"
}
```
- **エラー**
  - 404 Not Found – 不明な request_id
  - 401 Unauthorized
  - 403 Forbidden – 当該リソースの閲覧権限がない場合（他ユーザの private リクエスト等）

---

### ## GET /requests/{id}/status
**目的:** 指定したリクエストの処理状況をポーリングする。Day1ではOpenAI等の外部プロバイダの仕様を確認するまで最小構成のレスポンスに留める。

- **リクエスト**
  - パスパラメータ: `id` = `request_id`
  - ヘッダー: Authorization（/ または CP headers）
  - メモ: 自分が作成した `request_id` の範囲で省略可能
- **レスポンス（Day1: 最小構成）**
  - **中間:**
```json
{
  "request_id": "req-789",
  "status": "processing",
  "last_updated": "2025-10-28T12:35:10Z"
}
```
  - **完了（最終）:**
```json
{
  "request_id": "req-789",
  "status": "completed",
  "updated_at": "2025-10-28T12:36:20Z"
}
```
- **エラー**
  - 404 Not Found – 不明な request_id
  - 401 Unauthorized

---

### ## GET /requests/{id}/result
**目的:** `request.status` が `completed` になった後に最終結果を取得する。Day1では、最新のAIレスポンス（生成中のdelta含む）をストリームで返却する方式（SSE: Server‑Sent Events）を採用する。過去履歴や重いメタデータは `/requests/{id}` で取得する。

- **リクエスト**
  - パスパラメータ: `id` = `request_id`
  - ヘッダー（CP headers）: X-NOM-GCD-UID, X-NOM-LDAP-Token
- **レスポンス（Day1: Stream / SSE）**
  - ステータス: 200 OK
  - ヘッダー例:
    - Content-Type: text/event-stream; charset=UTF-8
    - Cache-Control: no-cache
    - Connection: keep-alive
  - 備考: SSE の message フォーマットについては、最終的なペイロード仕様は要確認だが、「AIからのメッセージ本体の delta」と「annotations（引用・参考）」が含まれる想定。
- **エラー**
  - 401 Unauthorized

---

## 1. 設計書（整形版）

### 1.1 サマリ
- 製品名: **API（Day1）**
- 認証: CP発行の `X-NOM-GCD-UID` と `X-NOM-LDAP-Token`（SSO経由で自動付与）
- レスポンス形式: `application/json`（SSEは `text/event-stream`）
- タイムスタンプ: ISO 8601 / UTC (`Z`)

### 1.2 共通仕様
- **ページング**: `page`, `per_page`（将来拡張）
- **並行実行上限**: ユーザー毎に同時進行リクエスト上限（例: 3）。超過は `429`。
- **エラー形式**
```json
{
  "error": {
    "code": "string_code",
    "message": "Human readable message",
    "details": {}
  }
}
```
- **主なエラーコード**
  - `400` バリデーション
  - `401` 未認証／トークン不正
  - `403` 権限不足
  - `404` リソースなし
  - `429` レート／同時実行超過
  - `500` サーバ内部

### 1.3 エンドポイント一覧
| Method | Path | 説明 |
|---|---|---|
| GET | `/initial-data` | 初期データ（ユーザー + 直近履歴） |
| POST | `/requests` | 非同期リクエスト作成 |
| GET | `/requests/status` | 自ユーザーのリクエスト一覧（軽量） |
| GET | `/requests/{id}` | リクエスト詳細（最新スナップショット） |
| GET | `/requests/{id}/status` | ステータスポーリング |
| GET | `/requests/{id}/result` | SSE による最終結果ストリーム |

### 1.4 データモデル（概略）
```json
// User
{
  "id": "string",
  "name_initial": "string",
  "name_full": "string",
  "is_admin": true,
  "is_support": false
}

// RequestHistory (軽量)
{
  "request_history_id": "string",
  "title": "string",
  "status": "pending|processing|completed|failed",
  "last_updated": "2025-10-28T12:34:56Z"
}

// Request (詳細)
{
  "request_id": "string",
  "title": "string",
  "query_text": "string",
  "status": "pending|processing|completed|failed",
  "last_updated": "2025-10-28T12:34:56Z",
  "messages": [
    {
      "role": "user|assistant|system",
      "content": "string",
      "timestamp": "2025-10-28T12:34:56Z",
      "annotations": [
        { "url": "string", "title": "string", "snippet": "string" }
      ]
    }
  ]
}

# チャット送信フロー（Step1→3 / Step4）アニメーション実装設計

## 背景 / 対象フロー
チャット入力後に以下のフローが走る前提：

1. APIにリクエスト送信
2. APIからレスポンス受信（受付確定 / requestId 取得）
3. リクエストキューにカード追加
4. ステータスが `completed` になるまでポーリング（`pending` / `processing`）
5. `completed` になったら結果取得（必要なら SSE/再取得）

課題：**Step1→Step2（requestId 取得前）** は画面変化が乏しく、ユーザーが「固まった」と誤解しやすい。

本設計は以下を「別個」に定義する：
- **Step1→2：送信中（requestId 取得前）**
- **Step2：受付確定（レスポンス受信）**
- **Step4：処理中（ポーリング中）**

## 現状コードとの対応（既存）
- 送信：`src/app/features/chat-panel/components/pages/chat-panel/chat-panel.ts`
- リクエスト作成/監視：`src/app/features/request-queue/components/pages/request-queue/request.facade.ts`
- キュー表示：`src/app/features/request-queue/components/pages/request-queue/request-queue.ts`
- カードUI：`src/app/features/request-queue/components/ui/request/request.ts|html|scss`

補足：`request.scss` には既に `pending/processing` の **ループアニメ（pulse + shimmer）** と、新規カードの **ハイライト（is-new）** がある。今回の設計では、**Step1→2（送信中）/ Step2（受付確定）/ Step4（継続処理中）** が見た目で混ざらないように、段階ごとにアニメーションを分離する。

---

## 1) 状態モデル（UIが必要とする最小）

### Request（キュー側）
API由来の状態：
- `pending`：キュー投入済み（まだ実処理前/または準備中）
- `processing`：処理中
- `completed`：完了
- `failed`：失敗

UI演出のために必要な「一時的フラグ」（APIには送らない）：
- `justAccepted`：Step2直後の一瞬（〜400ms）
- `justCompleted`：完了遷移直後の一瞬（〜600ms）
- `justFailed`：失敗遷移直後の一瞬（〜600ms）

> 実装は `Request` コンポーネント内で `status` の前回値を記憶し、遷移検知でフラグを立て、`setTimeout` で自動クリアする（後述）。

### Chat Message（チャット側）
Step2アニメは「直前に送ったユーザーメッセージ」に紐づくため、最小で以下を保持：
- `lastSentMessageKey`：送信したメッセージを特定するキー（現状は `timestamp` を利用可能）
- `lastSentMessageJustAccepted`：Step2直後の一瞬（〜400ms）
- `lastSentMessageFailed`：送信失敗時の一瞬（〜900ms、任意）

（追加）Step1→2 の送信中表示には `lastSentMessageSubmitting`（in-flight 中）を使う。

> 既存 `Message` 型はメタ情報を持たないため、**メッセージ配列を汚さず**、ChatPanel側の一時シグナルで制御する設計とする。

---

## 2) アニメーション0：Step1→2（送信中 / requestId 取得前）

### 目的（UX）
- 送信クリック直後から「送信が開始された」ことを即時に伝え、固まり誤解を防ぐ
- Step2（受付確定の1回演出）/ Step4（処理中ループ）と見た目を分離する
- “待ち”が長い時はテキストで補助する（段階的に強調）

### トリガー（実装）
- 開始：`ChatPanel.sendMessage()` でメッセージを追加した直後（= `submitRequest` 開始直前）
- 終了：`submitRequest` の Promise が `resolve/reject` した瞬間（= Step2 到達 or 送信失敗）

> ちらつき防止：150ms 以内に Step2 が返った場合は「送信中表示」を出さず、Step2 演出に直行（推奨）。

### 仕様（見た目）
**0-1. 送信ボタンのインジケータ（最優先）**
- クリック直後に “押下” のマイクロインタラクション（`scale(1 → 0.96 → 1)`）
- in-flight 中は送信アイコンをスピナー/ローディングリングに置換し、ボタンを `disabled`
- 目安：押下 90ms、スピナーは Step2 まで

**0-2. 送った吹き出しの「送信中」**
- 対象：直前に送ったユーザーメッセージの吹き出し
- 表現：吹き出し右下に `…`（3 dots）をループ表示（または極小スピナー）
- 付随：吹き出しを少し薄く（`opacity: 0.9`）+ 枠をわずかに変えて「未確定」を示す
- 目安：Step2 到達まで（最短 150ms 遅延表示）

**0-3.（新規リクエスト時）キュー側のプレースホルダカード**
- 条件：`requestHistoryId == null`（= まだカードが存在しない）
- 表現：カード位置に skeleton（タイトル/本文の灰色バー）+ status pill「Sending…」
- アニメ：skeleton shimmer（1.2〜1.6s ループ）
  - Step4 の shimmer と混同しないよう、色を neutral（グレー/青）寄りにする
- Step2 `resolve` 時：プレースホルダが実カードへ cross-fade + 既存 `is-new` ハイライトにバトンタッチ（A-2）

**0-4.（既存カード時）カードの軽い“送信中”表示（任意）**
- 条件：`requestHistoryId != null`（= 既存カードがある）
- 表現：カード枠を薄く青く + 上部 2px バーのみ表示（色は Step4 と異なる）
- Step2 `resolve` 時：Step2 演出へ（チャット側）/ status が `pending` になったら Step4 に遷移

**0-5. 失敗時**
- 送信中表示を解除し、チャット吹き出しを既存の fail 演出へ
- プレースホルダカードがある場合は短くフェードアウトし、エラートースト

### CSS設計（例：キー・クラス）
- チャット側：
  - `.message--sending`
  - `.message__sending-dots`（`@keyframes chatSendingDots`）
- 送信ボタン：
  - `.chat-panel__send-btn.is-sending`（`@keyframes chatSendSpinner`）
- キュー側（プレースホルダ/既存）：
  - `.rq-card-inner.is-submitting`（Step4 の `is-busy` と別扱い）
  - `@keyframes rqSkeletonShimmer`（色は neutral）

### A11y / Reduced Motion
- `prefers-reduced-motion: reduce` では dots/spinner を停止し、「送信中…」の静的表示に置換
- `aria-busy` を送信ボタン/プレースホルダカードに付与（頻繁な `aria-live` 更新は避ける）

---

## 3) アニメーションA：Step2（APIレスポンス受信＝受付確定）

### 目的（UX）
- ユーザー操作（送信）が「受付された」ことを即時に伝える
- Step4（処理中ループ）とは明確に違う、**短く・軽い**フィードバックにする
- 送信ボタン/メッセージ/キューカードのうち、視線が一番集まる **チャット側** に主演出、キュー側は副演出

### トリガー（実装）
- `RequestFacade.submitRequest(...)` の Promise が resolve した瞬間（CreateRequestResponse受信）
- 対象メッセージは `sendMessage()` で生成した `Message.timestamp` をキーとして紐付ける

#### 実装ポイント（推奨）
- `ChatPanel.sendMessage()` 内で `const messageKey = newMsg.timestamp;` を保持し、
  - `submitRequest(...).then(() => flashAccept(messageKey))`
  - `.catch(() => flashFail(messageKey))`

### 仕様（見た目）
**A-1. チャット吹き出しの「受付確定」**
- 対象：直前に送ったユーザーメッセージの吹き出し
- 動き：小さなポップ（`scale(1 → 1.03 → 1)`）+ 影を一瞬強く
- 同時に、吹き出し右下に小さな ✓ を「線が描かれる」ように表示（SVG stroke）
- 目安：240–320ms（1回だけ）

**A-2. キューカードの「追加フィードバック」**
- 既存の `isNew` ハイライトを維持（カード全体が軽く光る）
- 追加で入れたい場合のみ：
  - `rqNewHighlight` に `opacity` と `translateY` を少し足し、**挿入感**を強める（250–350ms）

### CSS設計（例：キー・クラス）
チャット側（新規追加想定）：
- クラス：`.message--accepted`（一時的に付与）
- keyframes：
  - `@keyframes chatAcceptedPop`
  - `@keyframes chatAcceptedCheckStroke`

キュー側（既存活用 + 任意調整）：
- 既存：`.rq-card-inner.is-new { animation: rqNewHighlight ... }`
- 注意：`request.scss` は `rqStatusPulse` が重複定義されているため、**新規追加する場合は名前衝突を避ける**

### A11y / Reduced Motion
- ✓ やポップは `prefers-reduced-motion: reduce` では **フェードのみ** に落とす（scale/loopを停止）
- `aria-live` を乱発しない（視覚効果は非テキスト、スクリーンリーダーには既存の送信/ステータス表示で十分）

---

## 4) アニメーションB：Step4（ポーリング中＝処理中の継続表示）

### 目的（UX）
- 「いま処理中」＝継続状態を示す（ユーザーが待てる）
- Step2の短い演出とは別物として、**ループ/継続** を感じる表現にする
- `pending`（待ち列）と `processing`（実行中）で、色/速度を少し変えても良い

### トリガー（実装）
`Request.status` が以下の間：
- `pending` / `processing`：継続アニメON
- `completed` / `failed`：継続アニメOFF → 遷移アニメ（1回）へ

ポーリング自体は既に `RequestFacade.runPoll()` が担うため、UI側は **statusの変化に追随**するだけでよい。

### 仕様（見た目）
**B-1. ステータスピル（既存の強化）**
- `pending/processing` の間は pulse + shimmer（現状実装あり）
- 追加提案：`processing` のみ shimmer を少し速く、`pending` は少し遅く（状態の違いが直感的）
- 追加提案：視覚的にだけ `…` を付ける（スクリーンリーダーには読ませない）

**B-2. カード上部のインディターミネート進捗バー（推奨・新規）**
- カード上辺に 2px のバーを表示
- `pending/processing` 中：バーが左→右へ流れる（1.2–1.6s ループ）
- `completed` 遷移時：バーが一瞬で 100% に到達 → ✓ 表示へ（200–300ms）

**B-3. 完了/失敗の「遷移」演出（1回だけ）**
- `pending/processing -> completed`：
  - ループ停止
  - ✓ を短くポップ表示（200ms）
  - 必要ならカード枠を一瞬だけグリーンにハイライト（600msで収束）
- `pending/processing -> failed`：
  - ループ停止
  - 赤系の短いシェイク（150–220ms）+ ステータスを error に切替

### 実装案（Angular / どこでフラグを作るか）
`Request` コンポーネントに `OnChanges` を追加し、`request.status` の前回値を保持する。
- 前回 `pending/processing` で、今回 `completed` → `justCompleted=true`（タイマーでクリア）
- 前回 `pending/processing` で、今回 `failed` → `justFailed=true`（タイマーでクリア）
- Step2直後の `justAccepted` は `RequestQueue` 側で `isNew` と同時に付与するか、`isNew` を Step2扱いとして流用する

> 既に `RequestQueue` は `isNew` を 1800ms だけ付けているため、Step2（受付確定）の副演出はそれで足りる。  
> Step4（継続処理中）は **status依存**（`pending/processing`）で、isNewとは独立。

### CSS設計（例：キー・クラス）
- `.rq-card-inner.is-busy`：ループ系（progress bar / skeleton等）
- `.rq-card-inner.is-just-completed`：完了遷移（1回）
- `.rq-card-inner.is-just-failed`：失敗遷移（1回）

keyframes（例）：
- `@keyframes rqIndeterminateBar`
- `@keyframes rqCompletePop`
- `@keyframes rqFailShake`
- `@keyframes rqEllipsis`（任意）

### A11y / Reduced Motion
- ループ系は `prefers-reduced-motion: reduce` で停止し、静的なハイライトに置換
- status pill は既に `role="status"` と `aria-live="polite"` を持つため、アニメ追加時も **DOMの頻繁な差し替え**（テキストの点滅）を避ける

---

## 5) 実装タスク（最小差分）

### Step1→2（送信中 / requestId 取得前）
- `src/app/features/chat-panel/components/pages/chat-panel/chat-panel.ts`
  - `submitRequest` 実行中フラグ（例：`lastSentMessageSubmitting`）を追加し、送信ボタンを `disabled` + ローディング表示
- `src/app/features/chat-panel/components/ui/chat/chat.ts|html|scss`
  - `@Input()` で送信中キー/フラグを受け、該当メッセージに `message--sending` + `…` 表示（CSS）
- （任意）`src/app/features/request-queue/components/pages/request-queue/request.facade.ts`
  - 新規作成（`requestHistoryId==null`）の場合に「プレースホルダ表示用の一時状態」を持つ（requestId 取得後に差し替え）
- （任意）`src/app/features/request-queue/components/pages/request-queue/request-queue.ts`
  - facade の一時状態を描画し、Step2 `resolve` で実カードへスムーズに差し替える

### Step2（チャット側）
- `src/app/features/chat-panel/components/pages/chat-panel/chat-panel.ts`
  - `submitRequest` の resolve 時に「受付確定」を点灯させる一時シグナルを追加
- `src/app/features/chat-panel/components/ui/chat/chat.ts|html|scss`
  - `@Input()` で受付確定キーを受け、該当メッセージにクラス付与 + ✓ 演出（CSS）

### Step4（キュー側）
- `src/app/features/request-queue/components/ui/request/request.ts|html|scss`
  - `pending/processing` の間の「継続」演出（既存の pulse/shimmer は活用）
  - 完了/失敗の「遷移」演出を 1 回だけ発火（前回statusを保持）

---

## 6) テスト観点（軽量）
- Step1→2：送信→`submitRequest` の in-flight 中
  - 送信ボタンが `disabled` になり、送信中の視覚インジケータが出る
  - 対象の吹き出しに `message--sending` が付与される（150ms 以上遅延時のみ、など）
- Step2：送信→`submitRequest` resolve → 対象の吹き出しに `message--accepted` が一定時間付与される
- Step4：`pending/processing` の間は busy クラスが付く、`completed` 遷移で busy が外れ `is-just-completed` が短時間付く
- `prefers-reduced-motion` の場合、ループアニメが停止する（E2E/視認でも可）

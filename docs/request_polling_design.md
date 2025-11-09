# Request Queue のポーリング設計

## 目的
- UI 上に表示されている `request-queue` の各リクエストについて、状態が `pending` にある間だけ専用のステータス取得を続ける。
- 「更新」ボタン（既存の一覧更新トリガ）を押したタイミングでは、ポーリングの間隔をリセットして即時取得を促す。

## モニタリングのスコープ
- 各リクエストに対して一つの `MonitorEntry` を保持し、その中で `pollingId`/`lastInterval`/`consecutiveErrors` を管理する。
- `startAutoMonitor(requestId)` で新規エントリを作成し、`runPoll()` の再帰的ループでリクエスト専用のステータス GET（`/requests/{requestId}/status`）を実行する。
- UI で `request-queue` に追加されたエントリや、サマリ（`/requests/status` からのバルク結果）から `store` にリクエスト情報を登録・更新するたびに `resetMonitorForRequest(requestId)` を呼び、ポーリング間隔を再初期化する。

## ポーリング対象の絞り込み
- `startAutoMonitor` 呼び出し時点で `store.getRequest(requestId)?.status` を確認し、文字列で `pending` 以外の場合はポーリングを開始しない（condition 1）。
- `runPoll()` の開始時とステータス更新後に再度リクエストの状態を取得し、`pending` でなければ `unsubscribe()` でタイムアウトを解除し、`autoMonitors` からエントリを削除する（condition 2 と 3）。
- ステータスチェック処理中に `null`/`undefined` になったり `pending` 以外になった場合でも即時停止することで、無駄なリクエストを防ぐ。

## 段階的バックオフ
- `REQUEST_POLLING_CONFIG` から `requestPollingIntervalMs`（初期値 1000ms）、`requestPollingMultiplier`（1.2）および最大/最小間隔を読み取り、`computeNextInterval(current)` で次のタイミングを決定。
- 次回のスケジュールでは、`lastInterval × multiplier` に対して `min`/`max` を適用しつつ、0.1 倍のランダムさいｔも加えた `jitter` を混ぜる。
- `scheduleNext(entry)` を呼び出すと `setTimeout(runPoll, nextInterval)` を再登録する。`consecutiveErrors` が上限（デフォルト 5）を超えるとポーリングを打ち切る。

## 更新ボタンでのリセット
- 「更新」ボタンなどから `refreshStatuses()` 相当の一括取得が発生したとき、各リクエストに対して `resetMonitorForRequest(requestId)` を呼び出すことで `lastInterval` を `requestPollingIntervalMs` まで強制的に引き下げて即時再ポーリングする。
- `resetMonitorForRequest` は既存 `pollingId` を `clearTimeout` した後、`setTimeout` で次のポーリングを最短間隔で再スケジュールする。これによりマルチ係数による伸長を打ち消し、ユーザー主導の最新チェックに応答する。

## エラーハンドリングと終了
- `runPoll()` 内で `fetchRequestStatus(requestId)` が `success` を返せば `consecutiveErrors` を 0 にリセットし、結果のチャンクやステータスを `store` に反映。
- `error` もしくは例外が発生した場合は `consecutiveErrors` をインクリメントし、最大値超過時に `unsubscribe()` でモニターを停止。
- 正常終了（ステータスが `completed` など）もしくは `pending` 以外の状態になると `applySuccessPayload()` の中で `unsubscribe()` を呼び出し、タイムアウトを解除。

## UI 側との連携
- `request-queue` ページの `request.facade.ts` や `request-queue.ts` 内から `RequestFacade` を通じて `startAutoMonitor`/`stopAutoMonitor` を呼び出す。
- リスト更新や「更新」ボタン押下時には `refreshStatuses()` を起動し、全リクエストに対して `resetMonitorForRequest` を順次呼ぶことで間隔を再調整。
- 非同期リクエスト完了通知は `watch` されたストア経由で UI に伝播し、ステータスバッジやストリームチャンクを更新する。

## まとめ
1. `pending` のみ個別監視し、ステータス変化で即時停止。  
2. ポーリング間隔はマルチ係数＋ジッターで自動的に拡張。  
3. 「更新」ボタンで間隔を最小値にリセットし、ユーザー主導の即時チェックに対応。  
4. エラー連続時は安全に停止しつつ、正常時には `store` を更新して UI 表示と同期。

## 0. この設計の強み（活かすべき核）

* **SSOT=YAML** を徹底していて、DBを“派生データ”に限定しているのは最高に強い。
* **GitOps化（UI→Git操作への変換）**は、監査・復元・差分理解の観点で正しい。
* **重複統合を仕様の前提に置いた**のが現場寄りで偉い（現実に耐える）。

---

## 1. まず足すべき「非機能要件（NFR）」最小セット

MVPでも、ここが無いと「動くけど怖くて使えない」になりがち。

### 1.1 信頼性・復旧

* **Repoの破損/途中失敗**に備え、Git操作は「途中で止まっても戻せる」ことを要件化

  * 例: 各Git操作の前後で `git status` と `HEAD` を記録（ログ）
* **DBバックアップ**（SQLiteのコピー）と **spec/flows のバックアップ**（zip）をUIから実行できる（MVPでも価値大）

### 1.2 セキュリティ（MVPでも必須の最低ライン）

* APIは **ローカル運用前提でも**「意図しないファイルアクセス禁止（パストラバーサル対策）」を要件化
* LLMに渡す情報を **明示的に限定**（specとdictの必要部分のみ、`.env` やパス情報などは絶対渡さない）

### 1.3 監査（あとで効いてくる）

* すべての状態遷移（Issue/Proposal/Git操作）に **監査ログ（AuditLog）**を残す

  * “誰が/いつ/何を/なぜ”が追えるだけで運用が安定します（後述のスキーマ追補あり）

---

## 2. 一番事故る：DB状態とGit状態の「不整合」を仕様で潰す

現状のフローだと、例えば「Patch適用→commit失敗」みたいなときにDBだけ進んで地獄になりがち。

### 2.1 “トランザクション境界”を明文化

**要件:** 「DBの状態」と「Gitの状態」は矛盾しないこと。
**設計:** “操作単位”で状態を確定する。

* **Apply（適用）**は、次の順序を固定

  1. 事前条件チェック（後述の `baseHash`）
  2. パッチ適用（メモリ上）
  3. Zod + 追加整合性チェック（Edges参照など）
  4. ファイル書き込み
  5. `git add/commit` 成功
  6. **ここで初めて** `Proposal.isApplied=true` / `Issue.status='proposed'` などDB更新

失敗したら **DBは一切進めない**。これをルール化すると実装が迷いません。

### 2.2 Git操作の排他（ロック）を要件化

MVPでも「ブラウザ2窓」「連打」で壊れます。

* **Repo単位でMutexロック**（例: `core/git/lock.ts`）
* ロック中はUIに「処理中」表示、タイムアウト時は解除 + 状態診断

---

## 3. Proposal（JSON Patch）が“陳腐化”する問題の対策

YAMLは動くので、提案生成→適用までの間にYAMLが変わるとPatchが壊れます。

### 3.1 Proposalに `baseHash` と `targetPath` を入れる

* `baseHash`: 提案生成時点の対象YAML（または対象Flow）のハッシュ（sha256など）
* Apply時に現在ハッシュと一致しなければ **「再生成 or リベース」**に誘導

### 3.2 JSON Patchは「配列インデックス依存」を避ける

あなたの設計は nodes をRecordにしたのでかなり良い。
ただし edges は配列なので、ここがPatchで壊れやすい。

**対策案（どれかを仕様で固定）**

* A案: edges も `Record<EdgeID, Edge>` に変更（最強・一貫）
* B案: edges は配列のままでも、Patchは **`edge.id` ベースの“論理パッチ”**にする（独自Patch DSL）

  * 例: `{ op: "updateEdge", id: "e_12", patch: {...}}`

MVPならA案が一番迷いません。

---

## 4. Prismaスキーマを “String地獄” から救う（Enum/Json/Index）

実装・保守・クエリ全部が楽になります。

### 4.1 Issue.status は enum に

ステータスは仕様上の有限集合なので enum が正しいです。

### 4.2 Proposal.jsonPatch は Json 型に

文字列保存だと毎回parse/validateが必要。Prismaの `Json` を使うだけで堅牢性が上がります。

### 4.3 Indexを貼る（検索/一覧が速く＆設計が明確に）

* `targetFlowId`, `status`, `canonicalId`, `humanId` はインデックス候補

---

## 5. YAML整合性チェック（Zodだけだと漏れる）

Zodは型保証で、**参照整合性**は別問題です。以下を「必須バリデーション」として `core/parser/validateFlow.ts` に切り出すと強い。

**必須チェック**

* `flow.id` とファイル名（またはfrontmatter）一致
* `nodes` の各IDがユニーク（RecordならほぼOK）
* `edges[*].from/to` が nodes に存在
* `start/end` ノードの存在（最低1つずつ、などの制約）
* layer（L0/L1/L2）の意味（後述）に合う最小制約

---

## 6. L0/L1/L2 の“意味”を1段だけ定義しておく

後で増やすと絶対揉めるので、今「最小の定義」を置くのが得。

例（提案）：

* **L0:** 経営/業務の目的（WHY）と主要成果物
* **L1:** 業務プロセス（WHO/WHAT）
* **L2:** システム手順（HOW：システム入出力、フォーム、API）

UIのTabs切替にも意味が乗ります。

---

## 7. Mermaidクリック連携は“実装落とし穴”があるので仕様を固定

Mermaidのclickは便利ですが、Reactラッパーによってはイベントが取りにくいことがあります。

**仕様提案（安全側）**

* サーバ側で Mermaid文字列を作るのはOK
* ただしクリックは

  * A) `click nodeId call` を使う場合は「mermaidの初期化オプション（securityLevel等）と、コールバック登録方法」を実装方針として固定
  * B) もしくは「レンダリング後にSVG要素へ data-nodeid を付与してDOMイベントで拾う」方式に統一

MVPはBが堅い（ライブラリ差異に強い）です。

---

## 8. Duplicate Merge の“現実”をもう一段だけ入れる

Issue B を A に統合する時、B側で既に提案/コミットがあると「ブランチ削除」で情報が消えます。

**仕様を1行追加するだけで事故が減る**

* 統合時のGit処理は分岐：

  * Bブランチにコミット無し → ブランチ削除
  * コミット有り → **Aへ cherry-pick してから** Bを merged-duplicate にする（または「手動移管が必要」として警告＋ブランチ保持）

MVPでもこの分岐だけは入れた方が安全です。

---

## 9. 監査ログ（AuditLog）を“最小で”入れると未来が楽

追加テーブル1個でOK。

* `actor`（MVPなら固定 `"you"` でもいい）
* `action`（例: ISSUE_CREATE / PROPOSAL_GENERATE / PATCH_APPLY / MERGE_CLOSE / DUPLICATE_MERGE）
* `entityType` + `entityId`
* `payload`（Json、差分や理由）

これがあるだけで「何が起きた？」が即わかります。

---

## 10. LLM統合の“仕様としての安全策”

LLMは便利だけど、MVPで壊れがちな点だけ押さえると強いです。

### 10.1 モデル名を固定しすぎない

実装上は環境変数で差し替え可能に（仕様として「切替可能」を明文化）。

* 例: `OPENAI_MODEL` を必須 env にする
  （LLM Integration先は OpenAI でOK）

### 10.2 出力制約を“機械的”に

* LLM出力は **JSON（Patch + intent）だけ**
* 受け取り側で必ず **スキーマ検証**（Zod）して、通らなければ破棄

### 10.3 プロンプトに「禁止事項」を明記

* spec以外のファイル変更提案禁止
* dictに無いrole/systemを勝手に作らない
* ノードIDの変更は原則禁止（必要なら別op）

---

## 11. “実装が迷わない”ための追補：API設計を1枚足す

今の route.ts 群は良いですが、実装でブレやすいので、**入出力のI/F**を固定するとさらに正典になります。

例（最小でOK）：

* `POST /api/issues`（create）
* `POST /api/issues/:id/start`（branch作成）
* `POST /api/issues/:id/proposals/generate`
* `POST /api/proposals/:id/apply`
* `POST /api/issues/:id/merge-close`
* `POST /api/issues/:id/merge-duplicate`（Aへ統合）

各レスポンスは `ok: boolean` と `errorCode` と `details` を統一。

---

## 12. “このまま追記できる” v1.0 追補テンプレ（コピペ用）

最後に、ドキュメントへそのまま貼れる追補見出し案です：

* **8. 運用要件（MVP）**

  * Repo排他、失敗時復旧、バックアップ手順
* **9. 非機能要件（NFR）**

  * セキュリティ、監査、パフォーマンス
* **10. バリデーション仕様**

  * Zod + 参照整合性チェック一覧
* **11. GitOps状態遷移の整合性**

  * “DB更新はcommit成功後”ルール
* **12. LLM提案仕様**

  * 入力範囲、出力スキーマ、禁止事項、再生成条件

---
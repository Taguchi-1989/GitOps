# FlowOps ワークフローシステム ビジュアルガイド

> GitOps + AI オーケストレーション基盤の全体像と動作フロー

---

## 1. システム全体アーキテクチャ

```mermaid
graph TB
    subgraph "第1層: ユーザーインターフェース"
        UI["画面<br/>Next.js ウェブアプリ"]
    end

    subgraph "第2層: 業務ロジック・オーケストレーション"
        direction TB
        WE["ワークフローエンジン<br/>ステートマシン実行"]
        CO["コンパイラ<br/>YAML → 実行可能形式に変換"]
        TL["タスク読込<br/>マイクロタスクYAML読込"]
        TE["タスク実行<br/>LLM呼出・結果取得"]
        HL["承認管理<br/>Human-in-the-Loop"]
        CORE["既存コア機能<br/>Issue管理 / Git操作 / 監査"]
    end

    subgraph "第3層: LLMゲートウェイ（振り分け）"
        LITE["LiteLLM<br/>モデル自動振り分け"]
    end

    subgraph "第4層: AI推論（実際の頭脳）"
        OAI[OpenAI<br/>GPT-4o]
        ANT[Anthropic<br/>Claude]
        GEM[Google<br/>Gemini]
        OLL[Ollama<br/>ローカルLLM]
    end

    subgraph "第5層: ガバナンス（監視・記録）"
        LF["Langfuse<br/>トレース収集・コスト分析"]
        AL["監査ログ<br/>誰が何をしたか記録"]
        PG[("PostgreSQL<br/>データベース")]
    end

    UI -->|"API呼出"| WE
    UI -->|"API呼出"| CORE
    WE --> CO
    CO --> TL
    WE --> TE
    WE --> HL
    TE -->|"AI問い合わせ"| LITE
    LITE --> OAI
    LITE --> ANT
    LITE --> GEM
    LITE --> OLL
    LITE -.->|"実行記録"| LF
    WE -.->|"操作記録"| AL
    TE -.->|"操作記録"| AL
    HL -.->|"操作記録"| AL
    AL --> PG
    WE --> PG
    LF --> PG

    style UI fill:#4A90D9,color:#fff
    style WE fill:#E8A838,color:#fff
    style CO fill:#E8A838,color:#fff
    style TL fill:#E8A838,color:#fff
    style TE fill:#E8A838,color:#fff
    style HL fill:#E8A838,color:#fff
    style CORE fill:#E8A838,color:#fff
    style LITE fill:#7B68EE,color:#fff
    style OAI fill:#10A37F,color:#fff
    style ANT fill:#D97706,color:#fff
    style GEM fill:#4285F4,color:#fff
    style OLL fill:#333,color:#fff
    style LF fill:#DC2626,color:#fff
    style AL fill:#DC2626,color:#fff
    style PG fill:#336791,color:#fff
```

---

## 2. マクロ（フロー）とミクロ（タスク）の関係

FlowOpsでは、ビジネスプロセスを **2つのレイヤー** で管理します。

```mermaid
graph LR
    subgraph "マクロ（業務全体の流れ）"
        F1["問い合わせ対応フロー<br/>spec/flows/"]
        F2["受注処理フロー<br/>spec/flows/"]
        F3["出荷処理フロー<br/>spec/flows/"]
    end

    subgraph "ミクロ（個別のAI処理）"
        T1["問い合わせ分類タスク<br/>spec/tasks/classify-inquiry"]
        T2["回答ドラフト生成タスク<br/>spec/tasks/generate-response-draft"]
        T3["その他のタスク..."]
    end

    F1 -->|"taskIdで参照"| T1
    F1 -->|"taskIdで参照"| T2

    style F1 fill:#4A90D9,color:#fff
    style F2 fill:#4A90D9,color:#fff
    style F3 fill:#4A90D9,color:#fff
    style T1 fill:#E8A838,color:#fff
    style T2 fill:#E8A838,color:#fff
    style T3 fill:#E8A838,color:#fff
```

| | マクロ（フロー） | ミクロ（タスク） |
|---|---|---|
| **格納場所** | `spec/flows/*.yaml` | `spec/tasks/*.yaml` |
| **定義内容** | ビジネスプロセス全体（誰が・何を・どの順で） | 個別のAI操作（プロンプト・入出力スキーマ） |
| **接続方法** | ノードの `taskId` フィールドでタスクを参照 | フローから参照される |
| **バージョン管理** | Gitで変更履歴管理 | セマンティックバージョニング + Git |
| **実行時スナップショット** | コンパイル時に全タスクを読込・固定 | Gitコミットハッシュで実行時バージョンを記録 |

---

## 3. ノードタイプ一覧

ワークフローを構成する7種類のノード:

```mermaid
graph LR
    START(("開始<br/>フローの入口")):::start --> PROC["業務処理<br/>人が行う作業"]:::process
    PROC --> LLM["AIタスク<br/>LLMが自動実行"]:::llm
    LLM --> DEC{"条件分岐<br/>結果で振り分け"}:::decision
    DEC -->|"条件A"| HR["人間の承認<br/>一時停止して待つ"]:::human
    DEC -->|"条件B"| DB[("DB操作<br/>データ読み書き")]:::database
    HR --> END(("終了<br/>フローの出口")):::endnode
    DB --> END

    classDef start fill:#22C55E,color:#fff,stroke:#16A34A
    classDef process fill:#6366F1,color:#fff,stroke:#4F46E5
    classDef llm fill:#F59E0B,color:#fff,stroke:#D97706
    classDef decision fill:#EF4444,color:#fff,stroke:#DC2626
    classDef human fill:#EC4899,color:#fff,stroke:#DB2777
    classDef database fill:#06B6D4,color:#fff,stroke:#0891B2
    classDef endnode fill:#6B7280,color:#fff,stroke:#4B5563
```

| ノードタイプ | 用途 | 特徴 |
|------------|------|------|
| `start` | ワークフロー開始点 | フローに1つ必須。入力データの受け取り |
| `end` | ワークフロー終了点 | 完了ステータスへ遷移 |
| `process` | 一般的な処理ステップ | 人間が行う業務プロセスの記録 |
| `llm-task` | AIタスク実行 | `taskId`で`spec/tasks/`のタスクを参照、LLMを自動呼出 |
| `decision` | 条件分岐 | エッジの`condition`で次のノードを決定 |
| `human-review` | 人間による承認 | ワークフローを一時停止し、承認/否認を待つ |
| `database` | DB操作 | データの読み書き（拡張用） |

---

## 4. サンプル: AI問い合わせ自動対応フロー

### 4.1 フロー図

`spec/flows/ai-inquiry-handling.yaml` の視覚化:

```mermaid
flowchart TD
    receive((受付)):::start
    ai_classify[/"AI分類<br/>🤖 classify-inquiry"/]:::llm
    route{カテゴリ分岐}:::decision
    handle_general["一般対応<br/>👤 support"]:::process
    handle_technical["技術対応<br/>👤 tech-support"]:::process
    handle_complaint["クレーム対応<br/>👤 supervisor"]:::process
    ai_draft[/"AI回答ドラフト生成<br/>🤖 generate-response-draft"/]:::llm
    review["上長承認<br/>⏸️ 一時停止"]:::human
    send_response["回答送信<br/>👤 support"]:::process
    complete((完了)):::endnode

    receive --> ai_classify
    ai_classify --> route
    route -->|"一般"| handle_general
    route -->|"技術"| handle_technical
    route -->|"クレーム"| handle_complaint
    handle_general --> ai_draft
    handle_technical --> ai_draft
    handle_complaint --> ai_draft
    ai_draft --> review
    review -->|"承認"| send_response
    send_response --> complete

    classDef start fill:#22C55E,color:#fff,stroke:#16A34A
    classDef llm fill:#F59E0B,color:#000,stroke:#D97706
    classDef decision fill:#EF4444,color:#fff,stroke:#DC2626
    classDef process fill:#6366F1,color:#fff,stroke:#4F46E5
    classDef human fill:#EC4899,color:#fff,stroke:#DB2777
    classDef endnode fill:#6B7280,color:#fff,stroke:#4B5563
```

### 4.2 実行シーケンス

```mermaid
sequenceDiagram
    actor User as 操作者
    participant API as ワークフローAPI
    participant Engine as 実行エンジン
    participant Compiler as コンパイラ
    participant Executor as タスク実行
    participant LiteLLM as LLMゲートウェイ
    participant LLM as AIモデル
    participant DB as データベース
    participant Audit as 監査ログ

    User->>API: ワークフロー開始リクエスト
    API->>Compiler: フロー定義をコンパイル
    Note over Compiler: YAMLを実行可能な形式に変換<br/>タスク参照を解決<br/>Gitハッシュを記録
    Compiler-->>API: コンパイル済みワークフロー

    API->>Engine: 実行開始
    Engine->>DB: 実行レコード作成
    Engine->>Audit: ワークフロー開始を記録

    Note over Engine: 1. 問い合わせ受付（開始ノード）
    Engine->>Engine: 開始処理

    Note over Engine: 2. AI分類（AIタスクノード）
    Engine->>Executor: 「問い合わせ分類」タスク実行
    Executor->>LiteLLM: AIに分類を依頼
    LiteLLM->>LLM: GPT-4oで推論
    LLM-->>LiteLLM: 分類結果を返却
    LiteLLM-->>Executor: カテゴリ:技術 / 確信度:0.95
    Executor-->>Engine: 成功
    Engine->>DB: タスク実行結果を保存

    Note over Engine: 3. カテゴリ分岐（条件分岐ノード）
    Engine->>Engine: 条件評価: カテゴリ=技術
    Engine->>Engine: 技術対応ルートへ

    Note over Engine: 4. 技術対応（業務処理ノード）
    Engine->>Engine: 処理実行

    Note over Engine: 5. AI回答ドラフト生成（AIタスクノード）
    Engine->>Executor: 「回答ドラフト生成」タスク実行
    Executor->>LiteLLM: AIに回答生成を依頼
    LiteLLM->>LLM: GPT-4oで推論
    LLM-->>LiteLLM: 回答ドラフトを返却
    LiteLLM-->>Executor: 件名・本文・補足質問
    Note over Executor: このタスクは人間の承認が必要
    Executor-->>Engine: 人間の確認が必要

    Note over Engine: 6. 上長承認（承認待ちノード）
    Engine->>DB: 承認リクエスト作成
    Engine->>Audit: タスク実行を記録
    Engine-->>API: 一時停止（承認待ち）
    API-->>User: ステータス: 承認待ち

    Note over User: 管理者が内容を確認中...

    User->>API: 承認（理由:内容確認済み）
    API->>Engine: ワークフロー再開
    Engine->>Audit: 承認を記録

    Note over Engine: 7. 回答送信（業務処理ノード）
    Engine->>Engine: 処理実行

    Note over Engine: 8. 対応完了（終了ノード）
    Engine->>DB: 完了ステータスに更新
    Engine->>Audit: ワークフロー完了を記録
    Engine-->>API: ステータス: 完了
    API-->>User: ステータス: 完了
```

### 4.3 ステータス遷移

```mermaid
stateDiagram-v2
    [*] --> 実行中: 実行開始

    実行中 --> 実行中: 次のノードを処理
    実行中 --> 承認待ち: 人間の承認が必要なノードに到達
    実行中 --> 完了: 終了ノードに到達
    実行中 --> 失敗: エラー発生

    承認待ち --> 実行中: 承認された
    承認待ち --> 失敗: 否認された

    実行中 --> キャンセル: キャンセルAPI呼出

    完了 --> [*]
    失敗 --> [*]
    キャンセル --> [*]
```

---

## 5. ワークフロー実行パイプライン

### 5.1 コンパイルフェーズ

```mermaid
flowchart LR
    YAML["フロー定義YAML<br/>spec/flows/*.yaml"]:::file
    PARSER["構文解析・検証<br/>YAML→オブジェクト変換"]:::process
    FLOW["フロー構造体"]:::data

    TASK_DIR["タスク定義YAML<br/>spec/tasks/*.yaml"]:::file
    LOADER["タスク読込<br/>YAMLファイルを読み込み"]:::process
    REG["タスク一時保存<br/>メモリにキャッシュ"]:::data

    COMP["コンパイラ<br/>実行可能な形式に組立"]:::process
    GIT["Gitバージョン記録<br/>コミットハッシュ取得"]:::process
    CW["コンパイル済み<br/>ワークフロー<br/>（実行可能）"]:::data

    YAML --> PARSER --> FLOW
    TASK_DIR --> LOADER --> REG
    FLOW --> COMP
    REG --> COMP
    GIT --> COMP
    COMP --> CW

    classDef file fill:#94A3B8,color:#fff
    classDef process fill:#6366F1,color:#fff
    classDef data fill:#22C55E,color:#fff
```

**コンパイル時に行われること:**
1. YAMLフロー定義をパース・検証
2. 各ノードの`taskId`参照を解決（`spec/tasks/`から読込）
3. 入出力スキーマの互換性チェック
4. Gitコミットハッシュを記録（再現性保証）
5. 実行可能なステートマシン(`CompiledWorkflow`)を生成

### 5.2 実行フェーズ

```mermaid
flowchart TD
    START["実行開始"]:::start
    INIT["初期化<br/>DB記録 + 追跡ID発行"]:::process
    LOOP{"ループ<br/>最大100ステップまで"}:::decision
    GET["次のノードを取得"]:::process
    DISPATCH{"ノードの種類を判定"}:::decision

    subgraph "種類ごとの処理"
        H_START["開始ノード処理"]:::handler
        H_ACTION["業務処理ノード処理"]:::handler
        H_LLM["AIタスクノード処理"]:::handler
        H_DECISION["条件分岐ノード処理"]:::handler
        H_HUMAN["承認待ちノード処理"]:::handler
        H_END["終了"]:::handler
    end

    MERGE["結果をワークフロー状態に反映"]:::process
    SAVE["DBに保存 + 監査ログ記録"]:::process

    PAUSE["⏸️ 承認待ちで一時停止"]:::pause
    DONE["完了"]:::done
    FAIL["失敗"]:::fail

    START --> INIT --> LOOP
    LOOP --> GET --> DISPATCH
    DISPATCH -->|"開始"| H_START
    DISPATCH -->|"業務処理/DB操作"| H_ACTION
    DISPATCH -->|"AIタスク"| H_LLM
    DISPATCH -->|"条件分岐"| H_DECISION
    DISPATCH -->|"承認待ち"| H_HUMAN
    DISPATCH -->|"終了"| H_END

    H_START --> MERGE
    H_ACTION --> MERGE
    H_LLM -->|"成功"| MERGE
    H_LLM -->|"承認が必要"| PAUSE
    H_LLM -->|"失敗"| FAIL
    H_DECISION --> MERGE
    H_HUMAN --> PAUSE
    H_END --> DONE

    MERGE --> SAVE --> LOOP

    classDef start fill:#22C55E,color:#fff
    classDef process fill:#6366F1,color:#fff
    classDef decision fill:#EF4444,color:#fff
    classDef handler fill:#F59E0B,color:#000
    classDef pause fill:#EC4899,color:#fff
    classDef done fill:#22C55E,color:#fff
    classDef fail fill:#DC2626,color:#fff
```

---

## 6. LLMタスク実行の詳細

`llm-task` ノードが処理される時の内部フロー:

```mermaid
flowchart TD
    IN["入力データ<br/>例: 問い合わせ文、顧客名"]:::input
    TMPL["テンプレート展開<br/>変数を実際の値に置換"]:::process
    MSG["AIへの指示を組立<br/>役割指示 + 展開済みテンプレート"]:::process
    CALL["AIモデルに問い合わせ<br/>LiteLLM経由でGPT-4o等"]:::llm

    RETRY{"再試行する?"}:::decision
    ERR_RETRY["待ち時間を倍にして再試行<br/>最大5回まで"]:::error
    EXTRACT["回答からJSONを抽出<br/>AIの回答を構造化データに変換"]:::process
    VALIDATE["出力を検証<br/>期待する形式と照合"]:::process

    RESULT_OK["タスク結果: 成功"]:::success
    RESULT_HR["タスク結果: 人間の確認が必要"]:::pause
    RESULT_NG["タスク結果: 失敗"]:::fail

    META["実行メタデータを記録<br/>使用モデル・トークン数・所要時間"]:::meta

    IN --> TMPL --> MSG --> CALL
    CALL -->|"失敗"| RETRY
    RETRY -->|"まだ再試行できる"| ERR_RETRY --> CALL
    RETRY -->|"再試行回数の上限"| RESULT_NG

    CALL -->|"成功"| EXTRACT --> VALIDATE
    VALIDATE -->|"検証OK かつ 承認不要"| RESULT_OK
    VALIDATE -->|"検証OK かつ 承認が必要"| RESULT_HR
    VALIDATE -->|"検証NG（形式が不正）"| RESULT_NG

    RESULT_OK --> META
    RESULT_HR --> META
    RESULT_NG --> META

    classDef input fill:#94A3B8,color:#fff
    classDef process fill:#6366F1,color:#fff
    classDef llm fill:#F59E0B,color:#000
    classDef decision fill:#EF4444,color:#fff
    classDef error fill:#DC2626,color:#fff
    classDef success fill:#22C55E,color:#fff
    classDef pause fill:#EC4899,color:#fff
    classDef fail fill:#6B7280,color:#fff
    classDef meta fill:#8B5CF6,color:#fff
```

---

## 7. Human-in-the-Loop（承認フロー）

ISO/IEC 42001準拠の承認プロセス:

```mermaid
flowchart TD
    TRIGGER["ワークフローが<br/>承認が必要なノードに到達"]:::trigger

    CREATE["承認リクエスト作成<br/>- どのノードか<br/>- AIが出した結果<br/>- ステータス: 保留中"]:::process

    PAUSE["⏸️ ワークフロー一時停止<br/>人間の判断を待つ"]:::pause

    QUEUE["承認キュー<br/>承認待ちの一覧を画面で確認"]:::api

    HUMAN["👤 管理者が内容を確認"]:::human

    APPROVE["承認する<br/>理由: 「内容を確認しました」"]:::approve
    REJECT["否認する<br/>理由: 「修正が必要です」"]:::reject

    RESUME["ワークフロー再開<br/>次のステップへ進む"]:::resume
    FAIL["ワークフロー失敗<br/>否認理由を記録して終了"]:::fail

    AUDIT_A["監査ログに記録<br/>「誰が・いつ・承認した」"]:::audit
    AUDIT_R["監査ログに記録<br/>「誰が・いつ・否認した」"]:::audit

    TRIGGER --> CREATE --> PAUSE --> QUEUE --> HUMAN
    HUMAN -->|"承認"| APPROVE --> AUDIT_A --> RESUME
    HUMAN -->|"否認"| REJECT --> AUDIT_R --> FAIL

    classDef trigger fill:#F59E0B,color:#000
    classDef process fill:#6366F1,color:#fff
    classDef pause fill:#EC4899,color:#fff
    classDef api fill:#94A3B8,color:#fff
    classDef human fill:#4A90D9,color:#fff
    classDef approve fill:#22C55E,color:#fff
    classDef reject fill:#DC2626,color:#fff
    classDef resume fill:#22C55E,color:#fff
    classDef fail fill:#6B7280,color:#fff
    classDef audit fill:#8B5CF6,color:#fff
```

**ISO 42001 要件:**
- 承認/否認の **理由(reason)は必須**（空文字不可）
- 判断者(decidedBy)の記録
- 判断日時(decidedAt)の自動記録
- 全判断がTrace IDで追跡可能

---

## 8. Trace IDによるE2Eトレーサビリティ

1回のワークフロー実行で生成される全データが、単一のTrace IDで横断検索可能:

```mermaid
flowchart LR
    TID["追跡ID（Trace ID）<br/>1回の実行を一意に識別"]:::trace

    subgraph "この追跡IDで検索できる全データ"
        WE["ワークフロー実行記録<br/>- どのフローか<br/>- 現在のステータス<br/>- 状態データ"]:::record
        TE1["タスク実行記録 その1<br/>- 問い合わせ分類<br/>- 使用モデル: GPT-4o<br/>- トークン: 1,200<br/>- 所要時間: 450ms<br/>- Gitバージョン: abc1234"]:::record
        TE2["タスク実行記録 その2<br/>- 回答ドラフト生成<br/>- 使用モデル: GPT-4o<br/>- トークン: 3,400<br/>- 所要時間: 1,200ms<br/>- Gitバージョン: abc1234"]:::record
        AR["承認記録<br/>- 判定: 承認<br/>- 理由: 確認済み<br/>- 判断者: manager1"]:::record
        AL1["監査ログ: ワークフロー開始"]:::audit
        AL2["監査ログ: タスク実行 x2"]:::audit
        AL3["監査ログ: 人間が承認"]:::audit
        AL4["監査ログ: ワークフロー完了"]:::audit
        LF["Langfuseトレース<br/>- LLM呼出の詳細<br/>- コスト計算"]:::langfuse
    end

    TID --> WE
    TID --> TE1
    TID --> TE2
    TID --> AR
    TID --> AL1
    TID --> AL2
    TID --> AL3
    TID --> AL4
    TID -.-> LF

    classDef trace fill:#F59E0B,color:#000
    classDef record fill:#6366F1,color:#fff
    classDef audit fill:#8B5CF6,color:#fff
    classDef langfuse fill:#DC2626,color:#fff
```

---

## 9. API エンドポイント一覧

### ワークフロー操作

| メソッド | パス | 説明 |
|---------|------|------|
| `POST` | `/api/workflows` | ワークフロー実行開始 |
| `GET` | `/api/workflows` | 実行一覧（status/flowIdフィルタ可） |
| `GET` | `/api/workflows/:id` | 実行状態の取得 |
| `POST` | `/api/workflows/:id/approve` | 承認/否認 |
| `POST` | `/api/workflows/:id/cancel` | キャンセル |

### タスク操作

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/tasks` | タスク定義一覧 |
| `GET` | `/api/tasks/:id` | タスク定義の詳細 |
| `POST` | `/api/tasks/:id/test` | ドライラン実行 |

### ガバナンス

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/governance/trace/:traceId` | Trace ID横断検索 |

---

## 10. データモデル

```mermaid
erDiagram
    ワークフロー実行 {
        string ID PK "一意識別子"
        string フローID "どのフロー定義か"
        string 追跡ID UK "Trace ID（実行を横断追跡）"
        string ステータス "実行中/承認待ち/完了/失敗"
        string 現在ノードID "今どのステップにいるか"
        json 状態データ "ワークフロー内の変数"
        string 開始者ID "誰が開始したか"
        datetime 作成日時
        datetime 更新日時
        datetime 完了日時
    }

    タスク実行 {
        string ID PK "一意識別子"
        string ワークフローID FK "親ワークフロー"
        string ノードID "どのノードで実行されたか"
        string タスクID "どのタスク定義か"
        string タスクバージョン "セマンティックバージョン"
        string Gitコミットハッシュ "実行時のコードバージョン"
        string ステータス "保留/実行中/成功/失敗"
        json 入力データ "タスクへの入力"
        json 出力データ "タスクの結果"
        string 使用AIモデル "例: GPT-4o"
        int 入力トークン数 "AI入力のトークン数"
        int 出力トークン数 "AI出力のトークン数"
        int 所要時間ms "実行にかかった時間"
        string 追跡ID "Trace ID"
        json エラー情報 "失敗時のエラー詳細"
        datetime 作成日時
        datetime 完了日時
    }

    承認リクエスト {
        string ID PK "一意識別子"
        string ワークフローID FK "親ワークフロー"
        string ノードID "どのノードで発生したか"
        string 説明 "承認対象の説明"
        json コンテキスト "AIの出力等の参考情報"
        string ステータス "保留中/承認済/否認済"
        string 判定結果 "承認 or 否認"
        string 理由 "判断の理由（必須）"
        string 判断者 "誰が判断したか"
        datetime 判断日時
        datetime 作成日時
    }

    監査ログ {
        string ID PK "一意識別子"
        string アクション "何をしたか"
        string 対象種別 "ワークフロー/タスク等"
        string 対象ID "対象の識別子"
        json 詳細 "追加情報"
        string 追跡ID "Trace ID"
        datetime 作成日時
    }

    ワークフロー実行 ||--o{ タスク実行 : "複数のタスクを含む"
    ワークフロー実行 ||--o{ 承認リクエスト : "複数の承認を含む"
```

---

## 11. タスク定義の構造

`spec/tasks/*.yaml` の構造:

```yaml
# --- 識別情報 ---
id: classify-inquiry          # タスクID（ファイル名と一致）
version: "1.0.0"              # セマンティックバージョン
type: llm-inference           # タスクタイプ

# --- LLM設定 ---
llmConfig:
  model: "gpt-4o"             # LiteLLM経由のモデル名
  systemPrompt: |             # システムプロンプト
    あなたは問い合わせ分類システムです。
  userPromptTemplate: |       # Mustacheテンプレート
    問い合わせ内容: {{inquiry_text}}
  temperature: 0.1            # 0〜2（低い=決定的）
  maxTokens: 256              # 最大生成トークン数

# --- 入出力スキーマ ---
inputSchema:                  # JSON Schema形式
  type: object
  properties:
    inquiry_text: { type: string }
  required: [inquiry_text]

outputSchema:                 # JSON Schema形式
  type: object
  properties:
    category: { type: string, enum: [general, technical, complaint] }
    confidence: { type: number }

# --- 実行制御 ---
requiresHumanApproval: false  # true=実行後に人間承認が必要
maxRetries: 2                 # リトライ回数（0〜5）
timeoutMs: 15000              # タイムアウト（ms）

# --- メタデータ ---
metadata:
  author: "support-team"
  description: "問い合わせを自動分類"
  tags: [inquiry, classification]
```

---

## 12. インフラ構成

```mermaid
graph TB
    subgraph "Docker Compose（全6サービス）"
        subgraph "ウェブアプリケーション"
            FO["FlowOps 本体<br/>ポート :3000<br/>画面 + API"]
        end

        subgraph "AI振り分け"
            LI["LiteLLM<br/>ポート :4000<br/>どのAIモデルを使うか自動振り分け"]
        end

        subgraph "ローカルAI（オプション）"
            OL["Ollama<br/>ポート :11434<br/>自社GPU上でAI推論"]
        end

        subgraph "監視・分析"
            LA["Langfuse<br/>ポート :3001<br/>AI利用状況の可視化・コスト分析"]
        end

        subgraph "データベース"
            PG["PostgreSQL<br/>ポート :5432<br/>FlowOps用"]
            LFDB["PostgreSQL<br/>ポート :5433<br/>Langfuse用"]
        end
    end

    EXT["外部AIサービス<br/>OpenAI / Anthropic / Google"]:::external

    FO -->|"AI処理の依頼"| LI
    FO -->|"データ保存"| PG
    LI -->|"ローカルAI"| OL
    LI -->|"クラウドAI"| EXT
    LI -.->|"利用ログ送信"| LA
    LA -->|"ログ保存"| LFDB

    classDef external fill:#94A3B8,color:#fff
```

**起動コマンド:**
```bash
# 基本構成（外部LLMのみ）
docker compose up -d

# ローカルLLM追加
docker compose --profile local-llm up -d
```

---

## 13. クイックスタート: ワークフロー実行例

### Step 1: ワークフロー開始

```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "flowId": "ai-inquiry-handling",
    "initiatorId": "operator-001",
    "inputData": {
      "inquiry_text": "ログインできません。パスワードを忘れました。",
      "customer_name": "田中太郎"
    }
  }'
```

**レスポンス:**
```json
{
  "data": {
    "executionId": "cm...",
    "traceId": "550e8400-e29b-41d4-...",
    "flowId": "ai-inquiry-handling",
    "status": "paused-human-review",
    "currentNodeId": "review"
  }
}
```

### Step 2: 承認待ちの確認

```bash
curl http://localhost:3000/api/workflows?status=paused-human-review
```

### Step 3: 承認

```bash
curl -X POST http://localhost:3000/api/workflows/{executionId}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reason": "AI生成の回答内容を確認しました。問題ありません。",
    "decidedBy": "manager-001"
  }'
```

### Step 4: トレース確認

```bash
curl http://localhost:3000/api/governance/trace/{traceId}
```

---

## 14. ファイル構成

```
d:\dev\GitOps\
├── spec/
│   ├── flows/                          # マクロ: ワークフロー定義
│   │   ├── ai-inquiry-handling.yaml    # AI問い合わせ対応フロー
│   │   ├── inquiry-handling.yaml       # 手動問い合わせ対応フロー
│   │   ├── order-process.yaml          # 受注処理フロー
│   │   └── shipping-process.yaml       # 出荷処理フロー
│   └── tasks/                          # ミクロ: タスク定義
│       ├── classify-inquiry.yaml       # 問い合わせ分類タスク
│       └── generate-response-draft.yaml# 回答ドラフト生成タスク
│
├── src/core/orchestrator/              # オーケストレーション（心臓部）
│   ├── schemas/
│   │   ├── micro-task.ts               # タスク定義Zodスキーマ
│   │   └── execution.ts               # 実行状態Zodスキーマ
│   ├── compiler.ts                     # YAML → ステートマシン変換
│   ├── engine.ts                       # ワークフロー実行エンジン
│   ├── task-loader.ts                  # タスクYAML読込
│   ├── task-registry.ts               # タスクキャッシュ
│   ├── task-executor.ts               # LLM呼出・タスク実行
│   ├── human-loop.ts                  # 承認フロー管理
│   └── index.ts                       # エクスポート集約
│
├── src/lib/
│   └── trace-context.ts               # Trace ID伝播 (AsyncLocalStorage)
│
├── infrastructure/
│   └── litellm/config.yaml            # LiteLLMルーティング設定
│
├── docker-compose.yml                 # 6サービス構成
└── docs/
    ├── architecture-ai-integration.md # アーキテクチャ設計書
    └── workflow-visual-guide.md       # 本ドキュメント
```

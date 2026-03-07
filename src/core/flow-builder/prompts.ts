/**
 * FlowOps - Flow Builder Prompts
 *
 * フロー作成支援機能のLLMプロンプトテンプレート
 * - 会話ベースのフロー構築
 * - 画像読み取りによるフロー作成
 * - L0→L1→L2段階的展開
 */

// ========================================
// 共通: YAMLスキーマ仕様（全プロンプトで参照）
// ========================================

export const YAML_SCHEMA_SPEC = `## YAMLフロー定義スキーマ

フロー定義は以下の構造に厳密に従うこと:

\`\`\`yaml
id: <flow_id>            # フローID（snake_case、英数字とハイフン）
title: <タイトル>         # フロータイトル（日本語可）
layer: <L0|L1|L2>        # レイヤー
updatedAt: "<ISO8601>"   # 更新日時（ISO 8601形式）

nodes:
  <node_id>:             # ノードID（snake_case）
    id: <node_id>        # キーと同一値
    type: <NodeType>     # start | end | process | decision | database | llm-task | human-review
    label: <ラベル>       # 表示名（日本語可）
    role: <role名>        # 任意。使用可能なRoleリストから選択
    system: <system名>    # 任意。使用可能なSystemリストから選択
    taskId: <task_id>     # 任意。llm-task/human-review用のタスク参照
    meta:                 # 任意。補足情報
      description: <説明>
      sla: <SLA>
      priority: <優先度>

edges:
  e1:                     # エッジID（e1, e2, e3 ... の連番）
    id: e1                # キーと同一値
    from: <node_id>       # 接続元ノードID
    to: <node_id>         # 接続先ノードID
    label: <ラベル>        # 任意。分岐条件の表示名
    condition: <条件式>    # 任意。分岐条件（decisionノードからのエッジ）
\`\`\`

## ノードID命名規則
- snake_case を使用（例: receive_order, check_stock, ai_classify）
- 開始ノード: start_node または意味のある名前（例: receive）
- 終了ノード: end_node または意味のある名前（例: complete）
- 処理ノード: 動詞_名詞 の形式（例: process_order, notify_customer）
- 判断ノード: check_xxx, verify_xxx, route など

## エッジID命名規則
- e1, e2, e3 ... の連番形式
- IDとキーは常に同一値にすること

## ノードタイプの意味
- start: フロー開始点（必ず1つ以上必要）
- end: フロー終了点（必ず1つ以上必要）
- process: 業務処理ステップ
- decision: 分岐判断（複数の出力エッジを持つ）
- database: データベース操作
- llm-task: LLMによるマイクロタスク実行（taskIdが必要）
- human-review: 人間による確認・承認（Human-in-the-loop）

## レイヤーの意味
- L0: 経営/業務の目的（WHY）と主要成果物。2-5ノード程度の概要フロー
- L1: 業務プロセス（WHO/WHAT）。誰が何をするかを定義。5-15ノード程度
- L2: システム手順（HOW）。具体的なシステム操作、API呼び出し、画面操作を定義。10-30ノード程度`;

const MERMAID_FORMAT_SPEC = `## Mermaid記法

以下のシェイプ対応を使用すること:
- start/end: \`node_id(["ラベル"])\` (stadium shape)
- process: \`node_id["ラベル"]\` (rectangle)
- decision: \`node_id{"ラベル"}\` (diamond)
- database: \`node_id[("ラベル")]\` (cylinder)
- llm-task: \`node_id["ラベル"]\` (rectangle, processと同じ)
- human-review: \`node_id["ラベル"]\` (rectangle, processと同じ)

エッジ記法:
- ラベルなし: \`from --> to\`
- ラベルあり: \`from -->|"ラベル"| to\`

例:
\`\`\`mermaid
graph TD
  start_node(["受注開始"])
  receive_order["受注受付"]
  check_stock{"在庫確認"}
  process_order["受注処理"]
  end_node(["完了"])

  start_node --> receive_order
  receive_order --> check_stock
  check_stock -->|"在庫あり"| process_order
  check_stock -->|"在庫なし"| end_node
  process_order --> end_node
\`\`\``;

// ========================================
// 共通: 禁止事項
// ========================================

export const COMMON_CONSTRAINTS = `## 禁止事項（必ず守ること）
1. 使用可能なRoleリストにないroleを使用禁止（roleリストが提供されている場合）
2. 使用可能なSystemリストにないsystemを使用禁止（systemリストが提供されている場合）
3. ノードIDには必ずsnake_caseを使用すること（キャメルケースやハイフン区切り禁止）
4. エッジIDは必ず e1, e2, e3 ... の連番にすること
5. startノードとendノードは必ず含めること
6. ノードのidフィールドとRecord/Mapのキーは必ず同一値にすること
7. edgeのfrom/toは必ず存在するノードIDを参照すること
8. 説明文やマークダウンを出力禁止（純粋なJSONのみ出力）
9. decisionノードからは必ず2つ以上の出力エッジを持たせること
10. すべてのノードがstartから到達可能であること`;

// ========================================
// 1. CONVERSATION-BASED FLOW BUILDER
// ========================================

/**
 * 会話ベースのフロー構築用システムプロンプト
 *
 * LLMの動作:
 * - ユーザーの業務プロセス説明を分析
 * - YAML定義とMermaid図を生成/更新
 * - 不足要素（ロール、システム、分岐条件）について質問
 * - 反復的な改善をサポート（「Xを追加」「Yを変更」「Zを削除」）
 */
export const CONVERSATION_BUILDER_SYSTEM_PROMPT = `あなたはFlowOps業務フロー構築アシスタントです。
ユーザーとの対話を通じて、業務プロセスのYAMLフロー定義とMermaid図を作成・改善します。

## あなたの役割
1. ユーザーの業務プロセスの説明を理解し、構造化されたフロー定義に変換する
2. 不足情報や曖昧な点について的確な質問をする
3. ユーザーの追加指示（追加・変更・削除）に応じてフローを更新する
4. 常にYAMLとMermaid図をセットで出力する

## 対話方針
- 最初のユーザー入力からフロー定義を生成しつつ、改善のための質問を添える
- 「このプロセスの担当者は？」「例外時の処理は？」「どのシステムを使う？」などを質問
- ユーザーが「追加して」「変更して」「削除して」と指示した場合、既存フローを更新する
- 既存YAMLが提供されている場合、それをベースに差分更新する
- ノードの追加時は既存のエッジ連番の続きからIDを割り当てる

${YAML_SCHEMA_SPEC}

${MERMAID_FORMAT_SPEC}

${COMMON_CONSTRAINTS}

## 出力形式
必ず以下のJSON形式のみを出力してください。それ以外のテキストは一切出力しないでください:
{
  "yaml": "（YAML文字列。複数行のYAMLフロー定義全体）",
  "mermaid": "（Mermaid記法文字列。graph TD から始まるフロー図定義全体）",
  "questions": [
    "（フローを改善するための質問。0〜3個。改善点がなければ空配列）"
  ],
  "summary": "（今回の変更内容の要約。日本語で1〜3文）"
}

## 出力例
{
  "yaml": "id: order-process\\ntitle: 受注処理フロー\\nlayer: L1\\nupdatedAt: \\"2026-03-02T00:00:00Z\\"\\n\\nnodes:\\n  start_node:\\n    id: start_node\\n    type: start\\n    label: 受注開始\\n\\n  receive_order:\\n    id: receive_order\\n    type: process\\n    label: 受注受付\\n    role: 営業\\n    system: CRM\\n\\n  end_node:\\n    id: end_node\\n    type: end\\n    label: 完了\\n\\nedges:\\n  e1:\\n    id: e1\\n    from: start_node\\n    to: receive_order\\n\\n  e2:\\n    id: e2\\n    from: receive_order\\n    to: end_node",
  "mermaid": "graph TD\\n  start_node([\\"受注開始\\"])\\n  receive_order[\\"受注受付\\"]\\n  end_node([\\"完了\\"])\\n\\n  start_node --> receive_order\\n  receive_order --> end_node",
  "questions": [
    "受注受付の後に在庫確認の工程はありますか？",
    "このフローの担当者（ロール）を教えてください",
    "使用するシステムはCRM以外にありますか？"
  ],
  "summary": "ユーザーの説明に基づき、受注処理の基本フローを作成しました。受注開始から受付、完了までの最小構成です。"
}`;

/**
 * 会話ベースフロー構築のプロンプトを組み立てる
 */
export function buildConversationPrompt(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentYaml?: string;
  roles: string[];
  systems: string[];
  targetLayer: 'L0' | 'L1' | 'L2';
}): { system: string; user: string } {
  const { messages, currentYaml, roles, systems, targetLayer } = params;

  const layerDescriptions: Record<string, string> = {
    L0: 'L0（WHY: 経営/業務の目的と主要成果物。2-5ノード程度の概要フロー）',
    L1: 'L1（WHO/WHAT: 業務プロセス。誰が何をするかを定義。5-15ノード程度）',
    L2: 'L2（HOW: システム手順。具体的なシステム操作を定義。10-30ノード程度）',
  };

  let userPrompt = `## 対象レイヤー
${layerDescriptions[targetLayer]}
`;

  if (roles.length > 0) {
    userPrompt += `
## 使用可能なRole
${roles.map(r => `- ${r}`).join('\n')}
`;
  }

  if (systems.length > 0) {
    userPrompt += `
## 使用可能なSystem
${systems.map(s => `- ${s}`).join('\n')}
`;
  }

  if (currentYaml) {
    userPrompt += `
## 現在のYAMLフロー定義（これをベースに更新してください）
\`\`\`yaml
${currentYaml}
\`\`\`
`;
  }

  // 会話履歴を構築
  userPrompt += `
## 会話履歴
`;
  for (const msg of messages) {
    const speaker = msg.role === 'user' ? 'ユーザー' : 'アシスタント';
    userPrompt += `${speaker}: ${msg.content}\n`;
  }

  userPrompt += `
上記の会話内容に基づいて、YAMLフロー定義とMermaid図を生成（または更新）してください。
改善のための質問がある場合はquestionsフィールドに含めてください。
JSON形式のみで出力してください。`;

  return {
    system: CONVERSATION_BUILDER_SYSTEM_PROMPT,
    user: userPrompt,
  };
}

// ========================================
// 2. IMAGE-BASED FLOW READER
// ========================================

/**
 * 画像読み取りによるフロー作成用システムプロンプト
 *
 * LLM (Visionモデル) の動作:
 * - フローチャート/ダイアグラム画像を解析
 * - ノード、エッジ、ラベル、分岐条件を抽出
 * - YAML定義 + Mermaid図を生成
 * - 信頼度と曖昧な箇所をレポート
 * - フィードバック（「このノードはXではなくY」）による反復修正をサポート
 */
export const IMAGE_READER_SYSTEM_PROMPT = `あなたはFlowOps業務フロー画像解析アシスタントです。
フローチャートやダイアグラムの画像を解析し、FlowOps形式のYAMLフロー定義とMermaid図に変換します。

## あなたの役割
1. 画像内のフローチャートを正確に読み取る
2. ノード（開始/終了/処理/判断/データベース等）を識別する
3. エッジ（矢印）の接続関係とラベルを抽出する
4. FlowOps形式のYAML定義とMermaid図を生成する
5. 読み取りの信頼度と曖昧な箇所を報告する

## 画像解析の方針
- 図形の形状からノードタイプを推定する:
  - 角丸長方形/楕円 → start または end（位置と文脈から判断）
  - 長方形 → process
  - ひし形/菱形 → decision
  - 円柱/ドラム → database
  - その他の特殊形状 → meta.originalShapeに形状を記録してprocessとする
- 矢印の方向からエッジのfrom/toを決定する
- 矢印上のテキストはエッジのlabelとして記録する
- 判別困難な文字はambiguitiesに記録し、最も可能性の高い読みを採用する
- 画像内にロール（担当者）やシステム名の記載がある場合はノードに設定する
- スイムレーン（レーン分割）がある場合、レーン名をroleとして設定する

## フィードバック対応
- ユーザーから修正フィードバックが与えられた場合、既存YAMLを修正する
- 例: 「ノードAのラベルは'受注確認'ではなく'在庫確認'です」→ 該当ノードのlabelを更新

${YAML_SCHEMA_SPEC}

${MERMAID_FORMAT_SPEC}

${COMMON_CONSTRAINTS}

## 追加の制約（画像読み取り固有）
11. 画像から読み取れない情報を推測で補わないこと。不明な箇所はambiguitiesに記録する
12. ノードのtypeは図形の形状に基づいて判定し、確信がない場合はprocessをデフォルトとする
13. confidenceは0.0〜1.0の範囲で、画像の読み取り精度を正直に評価すること

## 出力形式
必ず以下のJSON形式のみを出力してください。それ以外のテキストは一切出力しないでください:
{
  "yaml": "（YAML文字列。複数行のYAMLフロー定義全体）",
  "mermaid": "（Mermaid記法文字列。graph TD から始まるフロー図定義全体）",
  "confidence": 0.85,
  "notes": [
    "（読み取り結果に関する補足情報。例: 'スイムレーン構造を検出し、レーン名をroleとして設定しました'）"
  ],
  "ambiguities": [
    "（読み取りが曖昧な箇所の一覧。例: 'ノード3のラベルが不鮮明。\"承認確認\" と読みましたが \"承認確定\" の可能性あり'）"
  ]
}

## 出力例
{
  "yaml": "id: image-flow-001\\ntitle: 画像から読み取ったフロー\\nlayer: L1\\nupdatedAt: \\"2026-03-02T00:00:00Z\\"\\n\\nnodes:\\n  start_node:\\n    id: start_node\\n    type: start\\n    label: 開始\\n\\n  check_request:\\n    id: check_request\\n    type: decision\\n    label: 申請内容確認\\n    role: 管理者\\n\\n  approve:\\n    id: approve\\n    type: process\\n    label: 承認処理\\n    role: 管理者\\n    system: 基幹システム\\n\\n  reject:\\n    id: reject\\n    type: process\\n    label: 差戻し\\n    role: 管理者\\n\\n  end_node:\\n    id: end_node\\n    type: end\\n    label: 完了\\n\\nedges:\\n  e1:\\n    id: e1\\n    from: start_node\\n    to: check_request\\n\\n  e2:\\n    id: e2\\n    from: check_request\\n    to: approve\\n    label: 承認\\n    condition: approved == true\\n\\n  e3:\\n    id: e3\\n    from: check_request\\n    to: reject\\n    label: 却下\\n    condition: approved == false\\n\\n  e4:\\n    id: e4\\n    from: approve\\n    to: end_node\\n\\n  e5:\\n    id: e5\\n    from: reject\\n    to: end_node",
  "mermaid": "graph TD\\n  start_node([\\"開始\\"])\\n  check_request{\\"申請内容確認\\"}\\n  approve[\\"承認処理\\"]\\n  reject[\\"差戻し\\"]\\n  end_node([\\"完了\\"])\\n\\n  start_node --> check_request\\n  check_request -->|\\"承認\\"| approve\\n  check_request -->|\\"却下\\"| reject\\n  approve --> end_node\\n  reject --> end_node",
  "confidence": 0.92,
  "notes": [
    "スイムレーン構造を検出し、'管理者'レーンのノードにroleを設定しました",
    "画像内にシステム名'基幹システム'の記載を確認し、承認処理ノードに設定しました"
  ],
  "ambiguities": [
    "差戻しノードのラベルが小さく、'差戻し'または'差し戻し'の可能性があります。'差戻し'を採用しました"
  ]
}`;

/**
 * 画像読み取りフロー作成のプロンプトを組み立てる
 */
export function buildImageReadPrompt(params: {
  imageDescription?: string;
  feedback?: string;
  currentYaml?: string;
  roles: string[];
  systems: string[];
}): { system: string; user: string } {
  const { imageDescription, feedback, currentYaml, roles, systems } = params;

  let userPrompt = '';

  if (roles.length > 0) {
    userPrompt += `## 使用可能なRole
${roles.map(r => `- ${r}`).join('\n')}

`;
  }

  if (systems.length > 0) {
    userPrompt += `## 使用可能なSystem
${systems.map(s => `- ${s}`).join('\n')}

`;
  }

  if (currentYaml && feedback) {
    // フィードバックによる修正モード
    userPrompt += `## 現在のYAMLフロー定義（前回の読み取り結果）
\`\`\`yaml
${currentYaml}
\`\`\`

## ユーザーからの修正フィードバック
${feedback}

上記のフィードバックに基づいて、YAMLフロー定義とMermaid図を修正してください。
JSON形式のみで出力してください。`;
  } else {
    // 初回読み取りモード
    userPrompt += `## 指示
添付されたフローチャート画像を解析し、FlowOps形式のYAMLフロー定義とMermaid図に変換してください。
`;

    if (imageDescription) {
      userPrompt += `
## 画像に関する補足情報
${imageDescription}
`;
    }

    userPrompt += `
ノード、エッジ、ラベル、分岐条件を正確に抽出し、信頼度と曖昧な箇所を報告してください。
JSON形式のみで出力してください。`;
  }

  return {
    system: IMAGE_READER_SYSTEM_PROMPT,
    user: userPrompt,
  };
}

// ========================================
// 3. FLOW EXPANSION (L0 -> L1 -> L2)
// ========================================

/**
 * フロー展開（L0→L1→L2）用システムプロンプト
 *
 * LLMの動作:
 * - L0→L1: 目的/成果物の概要フローを、業務プロセス（WHO/WHAT）に展開
 * - L1→L2: 業務プロセスフローを、システム手順（HOW）に展開
 */
export const EXPANSION_SYSTEM_PROMPT = `あなたはFlowOps業務フロー展開アシスタントです。
上位レイヤーのフロー定義を受け取り、より詳細な下位レイヤーのフローに展開します。

## あなたの役割
フロー定義の段階的詳細化（ドリルダウン）を行います:
- L0→L1展開: 経営/業務目的の概要フローを、業務プロセスフローに展開
- L1→L2展開: 業務プロセスフローを、システム手順フローに展開

## 展開の原則

### L0→L1展開のルール
- L0の各processノードを、L1の複数ノード（サブプロセス）に展開する
- L0のstart/endノードはL1でも維持する
- L0のdecisionノードはL1でより具体的な判断基準を持つdecisionに展開する
- 各ノードに「誰が（role）」「何を（label）」の情報を付与する
- ノード数の目安: L0の2-5ノード → L1の5-15ノード
- 展開元のL0ノードIDをmeta.sourceNodeIdとして記録する

### L1→L2展開のルール
- L1の各processノードを、L2の具体的なシステム操作ステップに展開する
- 「どのシステムで（system）」「どう操作するか（label）」を具体化する
- llm-taskノードやhuman-reviewノードを適切に導入する
- データベース操作が含まれる場合はdatabaseノードを使用する
- ノード数の目安: L1の5-15ノード → L2の10-30ノード
- 展開元のL1ノードIDをmeta.sourceNodeIdとして記録する

### 共通の展開ルール
1. 元フローの全体的な流れ（start→処理→end）を維持する
2. 元フローのdecisionの分岐構造を保持する
3. 新しいノードIDはsnake_caseで、元フローと重複しない名前にする
4. エッジIDは新しいフロー内でe1, e2, e3...の連番にリセットする
5. 元フローのidフィールドは変更しない（layerフィールドのみ更新）
6. updatedAtは現在日時に更新する

${YAML_SCHEMA_SPEC}

${MERMAID_FORMAT_SPEC}

${COMMON_CONSTRAINTS}

## 追加の制約（展開固有）
11. 展開元ノードとの対応関係を必ずmeta.sourceNodeIdに記録すること
12. 展開によりノード数が目安範囲を大きく超えないこと
13. 元フローに存在しなかったロールやシステムを導入する場合、expandedNodesで明記すること
14. L0→L1展開時、roleフィールドを可能な限り全processノードに設定すること
15. L1→L2展開時、systemフィールドを可能な限り全processノードに設定すること

## 出力形式
必ず以下のJSON形式のみを出力してください。それ以外のテキストは一切出力しないでください:
{
  "yaml": "（YAML文字列。展開後のYAMLフロー定義全体）",
  "mermaid": "（Mermaid記法文字列。graph TD から始まるフロー図定義全体）",
  "expandedNodes": [
    "（展開されたノードのID一覧。展開元のL0/L1ノードIDと、展開先のL1/L2ノードIDのマッピング）"
  ],
  "summary": "（展開内容の要約。日本語で2〜5文。何をどう展開したか、追加したロール/システムなどを説明）"
}

## expandedNodesの記法
展開元と展開先の対応を以下の形式で記載:
- "receive_order → [receive_inquiry, validate_input, register_order]"
- "check_stock → [query_inventory_db, evaluate_stock_level, decide_fulfillment]"

## 出力例（L0→L1展開）
入力のL0フローが以下のようなシンプルなフローの場合:
- start_node → handle_order(受注処理) → complete(完了)

出力:
{
  "yaml": "id: order-process\\ntitle: 受注処理フロー\\nlayer: L1\\nupdatedAt: \\"2026-03-02T00:00:00Z\\"\\n\\nnodes:\\n  start_node:\\n    id: start_node\\n    type: start\\n    label: 受注開始\\n\\n  receive_order:\\n    id: receive_order\\n    type: process\\n    label: 受注受付\\n    role: 営業\\n    meta:\\n      sourceNodeId: handle_order\\n\\n  check_stock:\\n    id: check_stock\\n    type: decision\\n    label: 在庫確認\\n    role: 倉庫\\n    system: WMS\\n    meta:\\n      sourceNodeId: handle_order\\n\\n  process_order:\\n    id: process_order\\n    type: process\\n    label: 受注処理\\n    role: 営業\\n    system: 基幹システム\\n    meta:\\n      sourceNodeId: handle_order\\n\\n  notify_customer:\\n    id: notify_customer\\n    type: process\\n    label: 顧客通知\\n    role: 営業\\n    system: メール\\n    meta:\\n      sourceNodeId: handle_order\\n\\n  end_node:\\n    id: end_node\\n    type: end\\n    label: 完了\\n\\nedges:\\n  e1:\\n    id: e1\\n    from: start_node\\n    to: receive_order\\n\\n  e2:\\n    id: e2\\n    from: receive_order\\n    to: check_stock\\n\\n  e3:\\n    id: e3\\n    from: check_stock\\n    to: process_order\\n    label: 在庫あり\\n    condition: stock > 0\\n\\n  e4:\\n    id: e4\\n    from: check_stock\\n    to: notify_customer\\n    label: 在庫なし\\n    condition: stock == 0\\n\\n  e5:\\n    id: e5\\n    from: process_order\\n    to: notify_customer\\n\\n  e6:\\n    id: e6\\n    from: notify_customer\\n    to: end_node",
  "mermaid": "graph TD\\n  start_node([\\"受注開始\\"])\\n  receive_order[\\"受注受付\\"]\\n  check_stock{\\"在庫確認\\"}\\n  process_order[\\"受注処理\\"]\\n  notify_customer[\\"顧客通知\\"]\\n  end_node([\\"完了\\"])\\n\\n  start_node --> receive_order\\n  receive_order --> check_stock\\n  check_stock -->|\\"在庫あり\\"| process_order\\n  check_stock -->|\\"在庫なし\\"| notify_customer\\n  process_order --> notify_customer\\n  notify_customer --> end_node",
  "expandedNodes": [
    "handle_order → [receive_order, check_stock, process_order, notify_customer]"
  ],
  "summary": "L0の'受注処理'ノードを、L1の4つの業務プロセスノードに展開しました。受注受付（営業）、在庫確認（倉庫/WMS）、受注処理（営業/基幹システム）、顧客通知（営業/メール）の各ステップを定義し、在庫の有無による分岐を追加しました。"
}`;

/**
 * フロー展開プロンプトを組み立てる
 */
export function buildExpansionPrompt(params: {
  currentYaml: string;
  fromLayer: 'L0' | 'L1';
  toLayer: 'L1' | 'L2';
  context?: string;
  roles: string[];
  systems: string[];
}): { system: string; user: string } {
  const { currentYaml, fromLayer, toLayer, context, roles, systems } = params;

  const expansionDescriptions: Record<string, string> = {
    'L0-L1':
      'L0（WHY: 目的/成果物）→ L1（WHO/WHAT: 業務プロセス）への展開。各概要ノードを「誰が何をするか」の業務ステップに詳細化します。',
    'L1-L2':
      'L1（WHO/WHAT: 業務プロセス）→ L2（HOW: システム手順）への展開。各業務ステップを「どのシステムでどう処理するか」の具体的手順に詳細化します。',
  };

  const expansionKey = `${fromLayer}-${toLayer}`;

  let userPrompt = `## 展開タイプ
${expansionDescriptions[expansionKey]}

## 展開元のYAMLフロー定義（${fromLayer}）
\`\`\`yaml
${currentYaml}
\`\`\`
`;

  if (context) {
    userPrompt += `
## 展開に関する追加コンテキスト
${context}
`;
  }

  if (roles.length > 0) {
    userPrompt += `
## 使用可能なRole
${roles.map(r => `- ${r}`).join('\n')}
`;
  }

  if (systems.length > 0) {
    userPrompt += `
## 使用可能なSystem
${systems.map(s => `- ${s}`).join('\n')}
`;
  }

  userPrompt += `
上記の${fromLayer}フローを${toLayer}フローに展開してください。
各ノードの展開元との対応関係をexpandedNodesに記録してください。
JSON形式のみで出力してください。`;

  return {
    system: EXPANSION_SYSTEM_PROMPT,
    user: userPrompt,
  };
}

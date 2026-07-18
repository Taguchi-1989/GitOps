# BPMN 2.0.2交換

FlowOpsでは、BPMNプロセスをレビュー・差分管理しやすい正規化JSONへ変換し、MermaidとBPMN 2.0 XMLの間を往復できます。

## 形式の役割

| 形式                   | 役割                                   |
| ---------------------- | -------------------------------------- |
| `flowops-bpmn.v1` JSON | Git・LLM・監査で扱う正規成果物         |
| Mermaid                | 人が素早く編集・レビューする概念ビュー |
| BPMN 2.0 XML           | BPMN対応ツールと交換する標準成果物     |
| LLM用プロンプト        | 他のLLMで読みやすい図を生成する入力    |

対象標準はOMG BPMN 2.0.2です。

- 仕様: <https://www.omg.org/spec/BPMN/2.0.2/>
- 規範的XML Schema: <https://www.omg.org/spec/BPMN/20100501/BPMN20.xsd>
- Semantic Schema: <https://www.omg.org/spec/BPMN/20100501/Semantic.xsd>
- BPMN Diagram Interchange Schema: <https://www.omg.org/spec/BPMN/20100501/BPMNDI.xsd>

## 利用方法

1. FlowOpsのナビゲーションから `/bpmn` を開きます。
2. Mermaid、正規化JSON、または `.bpmn` / `.xml` を入力します。
3. 「JSON正本へ変換・検証」を実行します。
4. Mermaidビューと診断を確認します。
5. JSON、Mermaid、BPMN 2.0 XML、またはLLM用プロンプトをダウンロードします。

## 他のLLMでスイムレーン図を生成する

Mermaidを厳密な規則だけでレイアウトする必要がない場合は、変換結果の「LLMプロンプト」タブを開き、「プロンプトをコピー」を選びます。そのまま利用可能なLLMへ貼り付けると、業務レビュー向けのMermaidスイムレーン図を生成できます。特定ベンダーのAPIやモデルには依存しません。

プロンプトはモデル規模に応じて次の作図方針を指示します。

- 25ノード以下: 原則1枚のスイムレーン図
- 25ノード超: 全体図と、プロセス別またはレーン別の詳細図
- 非常に大きいモデル: L0全体、L1プロセス、L2レーンまたはサブプロセス
- 各詳細図は原則25ノード以下とし、図をまたぐ接続点には同じBPMN IDを表示

貼り付け用プロンプトの生成自体は同じJSONから常に同じ内容になりますが、LLMが返す図は非決定論的です。監査・差分・再変換には`flowops-bpmn.v1` JSONを正本として使い、LLM出力はレビュー用ビューとして扱ってください。

プロンプトには正規化JSON全体が含まれます。外部サービスへ貼り付ける前に、機密情報、個人情報、契約上の制限、組織のAI利用規程を確認し、必要なら承認済みの社内・ローカルLLMを使用してください。入力データ内の命令に従わないプロンプトインジェクション対策も含みますが、送信先の安全性を保証するものではありません。

## 対応範囲

- プロセスとシーケンスフロー
- 開始・終了・中間・境界イベント
- 標準タスク種別
- 排他・並列・包含・イベントベース・複合ゲートウェイ
- サブプロセス、トランザクション、コールアクティビティ
- レーン
- コラボレーション、参加者、メッセージフロー
- message / signal / error / escalationのグローバル要素
- BPMNDIのShape、Edge、Bounds、waypoint
- DIがないJSONからの決定論的な簡易座標生成

## Mermaid注釈

MermaidだけではBPMNの型と識別子を完全には表せないため、コメント注釈を使用します。

```mermaid
flowchart LR
  start(("受付")):::start
  review["確認"]:::user
  finish(("完了")):::end
  start --> review
  review --> finish

  %% bpmn:definitions id="Definitions_1" namespace="urn:example:approval"
  %% bpmn:process id="Process_1" name="承認" executable="false"
  %% bpmn:node id="start" process="Process_1" type="startEvent" name="受付"
  %% bpmn:node id="review" process="Process_1" type="userTask" name="確認"
  %% bpmn:node id="finish" process="Process_1" type="endEvent" name="完了"
  %% bpmn:flow id="Flow_1" process="Process_1" source="start" target="review"
```

`bpmn:lane`、`bpmn:collaboration`、`bpmn:participant`、`bpmn:message`注釈も往復できます。

## API

### `POST /api/bpmn/import`

```json
{
  "format": "bpmn-xml",
  "content": "<?xml version=\"1.0\" ..."
}
```

`format`は`json`、`mermaid`、`bpmn-xml`です。レスポンスには正規化文書、JSON、Mermaid、LLM用プロンプト、検証結果、警告が含まれます。

### `POST /api/bpmn/export`

```json
{
  "format": "bpmn-xml",
  "document": {
    "schemaVersion": "flowops-bpmn.v1"
  }
}
```

エクスポートの`format`には`json`、`mermaid`、`bpmn-xml`、`llm-prompt`を指定できます。`llm-prompt`は他のLLMへ貼り付けられるMarkdownを返します。

## 検証

- 全BPMN要素でのID重複
- シーケンスフロー、メッセージフロー、参加者、DI要素の参照切れ
- デフォルトフローと境界イベントの整合性
- サブプロセス親子関係の循環
- レーン所属の重複
- XML 1.0で無効な制御文字
- DTD・実体宣言の拒否
- 5 MBの入力上限

インポートとエクスポートは内容そのものを監査ログへ保存せず、形式、対象namespace、件数、警告数だけを記録します。

## 制約

Mermaidはレビュー用の概念表現であり、BPMN実行エンジンの代替ではありません。次の情報は初版の正規化対象外で、入力時に警告されます。

- Camunda、Flowableなどのベンダー固有`extensionElements`
- データオブジェクト、データ入出力関連、テキスト注釈、Association
- Choreography、Conversation
- 実行エンジン固有の式言語・ジョブ設定・フォーム定義

元のBPMN XMLは証跡として保持し、実行前には対象エンジンで再検証してください。Mermaid由来のモデルは`flowops-conceptual`、BPMN XML由来のモデルは`bpmn-2.0-core`として区別されます。

# FlowOps フロー設計ガイド

`spec/flows/*.yaml` は業務フローの正本です。変更後は必ず `npm run validate:flows` を実行してください。

## 最小構成

フローには一意な `id`、表示名 `title`、階層 `layer`、`nodes`、`edges` が必要です。ノードと
エッジは配列ではなく、IDをキーにしたRecordとして定義します。各ノード自身の `id` とRecordの
キー、各エッジ自身の `id` とRecordのキーを一致させます。

ノード種別は `start`、`end`、`process`、`decision`、`database` を使用します。`role` と `system`
には表示名ではなく、それぞれ `spec/dictionary/roles.yaml` と `systems.yaml` のIDを指定します。

## 分岐条件

実行エンジンが受け付ける式は次の単純式だけです。

```yaml
condition: status == "approved" # 等価
condition: status != "rejected" # 不等価
condition: stock > 0             # 数値比較: >, >=, <, <=
condition: is_ready              # truthy判定
```

`&&`、`||`、括弧、関数呼び出しは未対応です。未対応式は `validate:flows` でエラーになり、実行時にも
`false` として安全側に処理されます。

すべての `decision` ノードには、`condition` を持たない既定エッジを1本置きます。分類不能なら有人
確認、審査なら差戻し、安全判定なら追加対策など、業務上安全な遷移先を選んでください。

## 設計チェック

- startから全ノードへ到達でき、endへ到達できる
- 孤立ノードや存在しない `from` / `to` がない
- role / system が辞書IDと一致する
- decisionの全条件と既定経路が定義されている
- 表示ラベルではなくIDを参照している

```bash
npm run validate:flows
npm run test
```

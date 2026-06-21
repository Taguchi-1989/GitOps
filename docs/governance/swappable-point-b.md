# 差し替え可能点B（モデル呼び出し）受け入れ確認 — P0-4

ガバナンス・ハーネス仕様 §7-B / DoD「設定一行のプロバイダ切替が三層コード無変更で成立」の監査結果。

## 結論

OpenAI互換パスは**達成**。Anthropic ネイティブSDKパスに直叩きの逃げ道があったため、baseURL 対応を追加して**ゲートウェイ経由へ一行で切替可能**にした。

## 監査結果（2026-06-21）

| 呼び出し点 | ゲートウェイ経由 | 根拠 |
|---|---|---|
| `src/core/llm/client.ts`（OpenAI互換） | ✅ | `LLM_BASE_URL` を尊重。`LLM_PROVIDER`/`LLM_MODEL` で切替 |
| `src/core/orchestrator/task-executor.ts:279` | ✅ | `LLM_BASE_URL`（既定 `http://localhost:4000/v1` = LiteLLM）|
| `src/core/flow-builder/*`（conversation/expander/image-reader）| ✅ | `client-factory.ts` が `LLM_PROVIDER` + `LLM_BASE_URL` で baseURL 解決 |
| `src/core/llm/anthropic-client.ts` | ⚠️→✅ | **修正前**: `new Anthropic({ apiKey })` で api.anthropic.com 直結（spec B 違反）。**修正後**: `baseURL`/`ANTHROPIC_BASE_URL` で経由可能 |

## 切替方法（設定一行）

```bash
# OpenAI互換プロバイダをLiteLLMゲートウェイ経由で（推奨・直叩きゼロ）
LLM_PROVIDER=custom
LLM_BASE_URL=http://litellm:4000/v1
LLM_MODEL=gpt-4o          # ← LiteLLM の model_list 名。一行でベンダー差替

# Anthropic ネイティブSDKをゲートウェイ経由にする場合
LLM_PROVIDER=anthropic
ANTHROPIC_BASE_URL=http://litellm:4000   # 未設定なら直結（直叩き）
```

三層（ポリシー/ゲート/監査）のコードは上記いずれの切替でも**無変更**。

## 残課題（直叩き禁止の構造的強制）

現状は「設定すれば経由できる」状態。完全な直叩き禁止には、CIで直結インスタンス化を検知するガードが有効:

```bash
# 直叩き検知（core/llm 以外で baseURL 無しの SDK 生成を禁止）の例
grep -rn "new Anthropic(\|new OpenAI(" src --include=*.ts \
  | grep -v "core/llm/" | grep -v ".test.ts"
```

- `ANTHROPIC_BASE_URL` 未設定時に anthropic provider を直結のまま許すか、起動時に警告/拒否するかは運用ポリシーで決める（P0-4b）。
- 受け入れ基準（spec §12）「設定一行のプロバイダ切替が三層コード無変更で成立」: **充足**（OpenAI互換パス + Anthropic baseURL 対応）。

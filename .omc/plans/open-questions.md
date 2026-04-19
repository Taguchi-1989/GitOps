# Open Questions

## react-flow-editor - 2026-04-19
- [ ] ノード座標をYAML meta内に保持するか、別ファイル（.layout.json等）に分離するか — meta汚染 vs 管理の簡便さのトレードオフ。現計画はmeta内だが、座標情報がgit diffで大量に出る可能性あり
- [ ] Phase 2 の自動保存 vs 手動保存のデフォルト — 自動保存はGitコミット頻度に影響。手動保存がデフォルトで安全だが、ユーザーの好みによる
- [ ] Phase 3 のLLMストリーミング（SSE）対応の優先度 — 現在のdraft APIはワンショット。ストリーミングは体験向上だがPhase 3のスコープとして必須か任意か
- [ ] dagre vs elkjs の選択 — dagreはシンプルだがメンテナンスが停滞気味。elkjsは高機能だがバンドルサイズが大きい。Phase 1ではdagreで開始し、必要に応じてelkjsに切替可能な抽象化をする方針

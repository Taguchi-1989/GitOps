/**
 * FlowOps - UI ラベル定義（共通）
 *
 * 実際のボタン名とガイド文の食い違いを構造的に防ぐため、
 * ユーザーに見えるアクション名はここを正本として一元管理する。
 * ボタンを描画する側（IssueDetail など）と、
 * 操作を案内する側（GuidedWorkflow / WelcomeGuide など）は
 * 必ずこの定数を参照すること。
 */

export interface ActionLabel {
  /** 詳細モード（技術情報を表示）のラベル */
  standard: string;
  /** 通常表示（詳細モードOFF）のラベル。省略時は standard と同じ */
  simple?: string;
}

export const ACTION_LABELS = {
  /** Do フェーズ開始（ブランチ作成） */
  start: {
    standard: '作業を開始（Do フェーズへ）',
    simple: '改善に取り組む',
  },
  /** AIによる改善案生成 */
  generateProposal: {
    standard: 'AIに改善案を考えてもらう',
  },
  /** 改善案の適用 */
  applyProposal: {
    standard: '適用する',
    simple: '反映する',
  },
  /** マージしてCheckフェーズへ */
  mergeClose: {
    standard: 'フローに反映 → Check フェーズへ',
    simple: 'フローに反映して Check へ',
  },
  /** 改善案の却下 */
  reject: {
    standard: '却下',
  },
  /** 効果確認の保存 */
  saveCheck: {
    standard: '効果確認を保存',
  },
  /** Act フェーズ完了（標準化） */
  standardize: {
    standard: '標準化して完了（Act）',
  },
  /** 効果なしだった改善カードを閉じる */
  closeAsRejected: {
    standard: '見送りとして完了',
  },
  /** 別アプローチで改善をやり直す */
  retryImprovement: {
    standard: '改善をやり直す',
  },
  /** 判断保留時の確認予定日更新 */
  updateCheckDueDate: {
    standard: '確認予定日を更新',
  },
} as const satisfies Record<string, ActionLabel>;

export type ActionLabelKey = keyof typeof ACTION_LABELS;

/**
 * モードに応じたボタンラベルを返す。
 * デフォルト（詳細モードOFF）では simple 側のラベルを使う。
 *
 * 表示モードはクライアント側のコンテキストにしかないため、サーバコンポーネント
 * （ダッシュボードのチェックリスト等）は引数なしで呼ぶ。既定表示は詳細モードOFF＝
 * simple ラベルであり、実際のボタン表記と一致するので、引数を渡さないのが正しい。
 */
export function getActionLabel(key: ActionLabelKey, isSimpleMode = true): string {
  const label: ActionLabel = ACTION_LABELS[key];
  return isSimpleMode ? (label.simple ?? label.standard) : label.standard;
}

/**
 * サイドバーのナビゲーション名。
 * ガイド文が「Flows」のような実画面にない名前を案内しないようにするための正本。
 */
export const NAV_LABELS = {
  dashboard: 'ホーム',
  flows: 'フロー',
  issues: '改善カード',
  approvals: '承認待ち',
  help: 'ヘルプ',
  settings: '設定',
  audit: '監査ログ',
  aims: 'AIMS証拠',
  dexpi: 'DeXPI交換',
  bpmn: 'BPMN交換',
} as const;

/** 管理者・専門家向けメニューをまとめる折りたたみセクションの名前 */
export const ADVANCED_NAV_GROUP_LABEL = '管理・専門ツール';

/**
 * フロー図の構成要素の呼び方。
 * 詳細モードでは技術用語（ノード／エッジ）、通常表示では業務語（ステップ／つながり）。
 * 画面文言・aria-label は必ずここを参照して食い違いを防ぐ。
 */
export const NODE_TERM = { standard: 'ノード', simple: 'ステップ' } as const;
export const EDGE_TERM = { standard: 'エッジ', simple: 'つながり' } as const;

/** 表示モードに応じたノードの呼び方を返す */
export function getNodeTerm(isTechMode: boolean): string {
  return isTechMode ? NODE_TERM.standard : NODE_TERM.simple;
}

/** 改善カード詳細のタブ名（ガイド文からの参照用） */
export const ISSUE_TAB_LABELS = {
  details: '詳細',
  proposals: '改善案',
  check: '効果確認',
  history: '履歴',
} as const;

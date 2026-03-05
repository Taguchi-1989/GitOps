/**
 * FlowOps - Friendly Error Messages
 *
 * APIエラーコードをユーザーフレンドリーな日本語メッセージに変換する。
 * 各エラーにタイトル・説明・対処法を提供し、
 * 技術的な知識がなくても次のアクションが分かるようにする。
 */

type ToastSeverity = 'error' | 'warning' | 'info';

interface FriendlyError {
  title: string;
  message: string;
  action: string;
  severity: ToastSeverity;
}

const FRIENDLY_ERRORS: Record<string, FriendlyError> = {
  LOCK_TIMEOUT: {
    title: '編集中',
    message: '他の人が同じファイルを編集中です。',
    action: '少し待ってからもう一度お試しください。',
    severity: 'warning',
  },
  STALE_PROPOSAL: {
    title: 'フローが更新されました',
    message: '改善案の作成後にフローが変更されたため、古くなっています。',
    action: '「AIで改善案を生成」を再度押して、新しい改善案を作成してください。',
    severity: 'warning',
  },
  MERGE_CONFLICT: {
    title: '変更が競合しています',
    message: '同時に別の変更が行われたため、自動的に統合できません。',
    action: '管理者にお問い合わせください。',
    severity: 'error',
  },
  PATCH_APPLY_FAILED: {
    title: '改善案の反映に失敗しました',
    message: '改善案をフローに適用できませんでした。',
    action: '新しい改善案を再生成してください。',
    severity: 'error',
  },
  LLM_ERROR: {
    title: 'AI処理エラー',
    message: 'AIによる改善案の生成中にエラーが発生しました。',
    action: 'しばらく待ってからもう一度お試しください。',
    severity: 'error',
  },
  INVALID_STATUS_TRANSITION: {
    title: 'この操作は実行できません',
    message: '現在の状態ではこの操作を行うことができません。',
    action: 'ページを更新して最新の状態を確認してください。',
    severity: 'warning',
  },
  ALREADY_MERGED: {
    title: 'すでに完了しています',
    message: 'この課題はすでに変更が確定されています。',
    action: '',
    severity: 'info',
  },
  VALIDATION_ERROR: {
    title: '入力内容にエラーがあります',
    message: '入力された内容を確認してください。',
    action: '必須項目が入力されているか確認してください。',
    severity: 'error',
  },
  NOT_FOUND: {
    title: '見つかりません',
    message: '指定されたデータが見つかりませんでした。',
    action: 'ページを更新してお試しください。',
    severity: 'error',
  },
  INTERNAL_ERROR: {
    title: 'システムエラー',
    message: '予期しないエラーが発生しました。',
    action: '問題が続く場合は管理者にお問い合わせください。',
    severity: 'error',
  },
  GIT_ERROR: {
    title: '保存エラー',
    message: 'データの保存中にエラーが発生しました。',
    action: 'しばらく待ってからもう一度お試しください。',
    severity: 'error',
  },
  RATE_LIMIT_EXCEEDED: {
    title: 'リクエスト制限',
    message: '短時間にリクエストが集中しました。',
    action: 'しばらく待ってからもう一度お試しください。',
    severity: 'warning',
  },
};

const DEFAULT_ERROR: FriendlyError = {
  title: 'エラーが発生しました',
  message: '操作を完了できませんでした。',
  action: 'もう一度お試しください。問題が続く場合は管理者にお問い合わせください。',
  severity: 'error',
};

/**
 * エラーコードからフレンドリーなエラー情報を取得する
 */
export function getFriendlyError(errorCode?: string, _details?: string): FriendlyError {
  if (!errorCode) return DEFAULT_ERROR;
  return FRIENDLY_ERRORS[errorCode] ?? DEFAULT_ERROR;
}

/**
 * FriendlyErrorをToast表示用の文字列にフォーマットする
 */
export function formatFriendlyToast(error: FriendlyError): string {
  const parts = [error.title, error.message];
  if (error.action) {
    parts.push(error.action);
  }
  return parts.join(' ');
}

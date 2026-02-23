/**
 * FlowOps - Human ID Generator
 *
 * 表示用のIssue ID（ISS-001形式）を生成
 */

/**
 * humanIdを生成
 * @param prefix プレフィックス（デフォルト: ISS）
 * @param sequence シーケンス番号
 * @param padding パディング桁数（デフォルト: 3）
 */
export function generateHumanId(sequence: number, prefix = 'ISS', padding = 3): string {
  const paddedNumber = String(sequence).padStart(padding, '0');
  return `${prefix}-${paddedNumber}`;
}

/**
 * humanIdからシーケンス番号を抽出
 * @param humanId 例: "ISS-001"
 */
export function parseHumanId(humanId: string): { prefix: string; sequence: number } | null {
  const match = humanId.match(/^([A-Z]+)-(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    sequence: parseInt(match[2], 10),
  };
}

/**
 * ブランチ名を生成
 * @param issueHumanId Issue ID（例: ISS-001）
 * @param slug スラグ（タイトルから生成）
 */
export function generateBranchName(issueHumanId: string, slug: string): string {
  // スラグをサニタイズ
  const sanitizedSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);

  return `cr/${issueHumanId}-${sanitizedSlug}`;
}

/**
 * タイトルからスラグを生成
 */
export function titleToSlug(title: string): string {
  // 日本語をローマ字に変換する代わりに、英数字のみ抽出
  // 実際のプロダクションではwanakaなどのライブラリを使用
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30) || 'update'
  );
}

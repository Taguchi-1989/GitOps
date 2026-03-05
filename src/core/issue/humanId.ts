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
    .substring(0, 30)
    .replace(/-$/g, ''); // 切り捨て後の末尾ハイフンも除去

  const finalSlug = sanitizedSlug || 'update';
  return `cr/${issueHumanId}-${finalSlug}`;
}

/**
 * タイトルからスラグを生成
 * 英数字がある場合はそれを使い、日本語のみの場合はハッシュでユニークなスラグを作る
 */
export function titleToSlug(title: string): string {
  // まず英数字部分を抽出
  const asciiSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);

  if (asciiSlug.length >= 3) {
    return asciiSlug;
  }

  // 英数字が少ない（日本語タイトル等）場合、簡易ハッシュでユニークなスラグを生成
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const hashStr = Math.abs(hash).toString(36).substring(0, 8);
  const prefix = asciiSlug ? `${asciiSlug}-` : '';
  return `${prefix}${hashStr}`;
}

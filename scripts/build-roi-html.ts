/**
 * FlowOps - ROI Calculator HTML build script
 *
 * spec/decision-models/<id>.yaml から自己完結HTMLを生成し public/roi/<id>.html へ出力。
 *   npm run roi:build            # roi-v0
 *   npm run roi:build -- roi-v0  # 明示
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRoiModel } from '../src/core/decision/roi-loader';
import { resolveAssumptions } from '../src/core/orchestrator/assumption-loader';
import { generateRoiHtml } from '../src/core/decision/roi-html';

async function main(): Promise<void> {
  const modelId = process.argv[2] || 'roi-v0';

  const model = await loadRoiModel(modelId);
  const assumptions = await resolveAssumptions(model.assumptionRefs ?? []);
  const html = generateRoiHtml(model, assumptions);

  const outDir = path.join(process.cwd(), 'public', 'roi');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${modelId}.html`);
  await writeFile(outPath, html, 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`ROI HTML generated: ${outPath} (${html.length} bytes)`);
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

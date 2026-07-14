import { prisma } from '@/lib/prisma';
import { AimsEvidenceListClient } from './AimsEvidenceListClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AIMS証拠 - FlowOps',
  description: '過去資料の取込と複数LLMレビュー',
};

export default async function AimsEvidencePage() {
  const records = await prisma.aimsEvidence.findMany({
    omit: { sourceText: true },
    include: { _count: { select: { reviews: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const evidence = records.map(record => ({
    id: record.id,
    evidenceId: record.evidenceId,
    title: record.title,
    sourceType: record.sourceType,
    sourceLabel: record.sourceLabel,
    sourceHash: record.sourceHash,
    sensitivityLevel: record.sensitivityLevel,
    status: record.status,
    tags: parseStringArray(record.tagsJson),
    reviewCount: record._count.reviews,
    createdAt: record.createdAt.toISOString(),
  }));

  return (
    <div className="p-6">
      <AimsEvidenceListClient initialEvidence={evidence} />
    </div>
  );
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

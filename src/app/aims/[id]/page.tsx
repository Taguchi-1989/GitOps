import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { serializeAimsRecord } from '@/lib/aims-repository';
import { AimsEvidenceDetailClient } from './AimsEvidenceDetailClient';

export const dynamic = 'force-dynamic';

export default async function AimsEvidenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const evidence = await prisma.aimsEvidence.findFirst({
    where: { OR: [{ id }, { evidenceId: id }] },
    include: {
      reviews: {
        include: { modelReviews: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!evidence) notFound();

  const serialized = JSON.parse(JSON.stringify(serializeAimsRecord(evidence)));
  return (
    <div className="p-6">
      <AimsEvidenceDetailClient initialEvidence={serialized} />
    </div>
  );
}

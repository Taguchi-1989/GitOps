-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'problem';

-- CreateIndex
CREATE INDEX "Issue_kind_idx" ON "Issue"("kind");

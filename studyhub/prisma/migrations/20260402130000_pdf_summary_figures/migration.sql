-- AlterTable
ALTER TABLE "pdf_documents" ADD COLUMN IF NOT EXISTS "summaryFigures" JSONB;

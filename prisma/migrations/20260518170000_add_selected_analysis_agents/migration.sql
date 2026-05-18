-- Store the selected review agents for queued analysis jobs.
ALTER TABLE "AnalysisJob" ADD COLUMN "selectedAgentsJson" JSONB;


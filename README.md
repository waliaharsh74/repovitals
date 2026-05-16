# RepoVitals

**RepoVitals** is an agentic GitHub repository review platform.

Sign in with Google or GitHub, paste a public GitHub repository, choose OpenAI or Groq, enter a provider API key for the current run, and get a persisted production-readiness report covering architecture, security, performance, maintainability, and testability.

Tagline:

```txt
Paste a GitHub repo. Get a senior-engineering production-readiness review.
```

## Current MVP

Implemented:

- Next.js App Router + TypeScript + Tailwind
- shadcn-style UI primitives
- Google and GitHub OAuth login through NextAuth
- authenticated dashboard for saved reports
- React Hook Form + Zod analyze form
- Prisma + PostgreSQL persistence
- public GitHub repository URL parsing
- GitHub metadata, tree, and raw file ingestion
- bounded smart file selection
- OpenAI and Groq provider adapters behind `AIProvider`
- deterministic file classifier
- architecture, security, performance, testing, and synthesis agents
- Redis-backed asynchronous analysis jobs
- SSE progress streaming for queued analysis runs
- `/api/analyze`, `/api/analyze/jobs/[jobId]/events`, `/api/analyze/jobs/[jobId]/cancel`, and `/api/reports/[reportId]`
- user-owned persisted report page with scorecards, findings, Mermaid diagram, recommendations, selected files, and agent trace
- Vitest coverage for core pure functions

Not included in MVP:

- private repositories
- saved provider keys
- payments
- WebSockets
- GitHub issue or PR creation

## Requirements

- Node.js 22+
- pnpm 9+
- Docker, for local Redis
- External PostgreSQL database URL from Neon, Supabase, Railway, local Postgres, or another provider
- Redis, via `docker compose up -d redis` locally
- Google OAuth app credentials
- GitHub OAuth app credentials
- OpenAI or Groq API key entered in the browser at analysis time

Provider keys are encrypted for the lifetime of a queued job and cleared when the job reaches a terminal state. Raw provider keys are not stored in `.env`, logs, or report payloads.

OAuth callback URLs for local development:

```txt
http://localhost:3000/api/auth/callback/github
http://localhost:3000/api/auth/callback/google
```

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create `.env.local`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
REDIS_URL="redis://localhost:6379"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret"
ANALYSIS_JOB_SECRET="generate-a-random-32-byte-analysis-job-secret"
ANALYSIS_JOB_ATTEMPTS="3"
ANALYSIS_JOB_BACKOFF_MS="15000"
ANALYSIS_JOB_TIMEOUT_MS="900000"
ANALYSIS_QUEUE_CONCURRENCY="1"

# OAuth login providers
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Optional, recommended for higher GitHub rate limits
GITHUB_TOKEN=""

# Optional model overrides
OPENAI_MODEL="gpt-4o-mini"
GROQ_MODEL="llama-3.1-8b-instant"
```

Generate Prisma client and apply the database schema:

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

Start Redis, the app, and the analysis worker:

```bash
pnpm redis:up
pnpm dev
pnpm dev:worker
```

Open:

```txt
http://localhost:3000
```

## Core Commands

```bash
pnpm dev
pnpm dev:worker
pnpm redis:up
pnpm build
pnpm start
pnpm worker
pnpm lint
pnpm test
pnpm prisma studio
pnpm prisma migrate dev
pnpm prisma generate
```

## Demo Flow

1. Go to `/login`.
2. Sign in with Google or GitHub.
3. Go to `/analyze`.
4. Select `OpenAI` or `Groq`.
5. Paste a provider API key.
6. Enter a public repo, for example `owner/repo` or `https://github.com/owner/repo`.
7. Click **Analyze Repository**.
8. The request creates a queued analysis job and the page streams persisted progress.
9. After analysis completes, the app redirects to `/reports/[reportId]`.
10. Go to `/dashboard` to access saved reports for the signed-in user.

Use a small public repo for the MVP. The analysis route is synchronous and intended for bounded demos.

## Architecture

```txt
Login
  -> NextAuth Google/GitHub OAuth
  -> JWT session + Prisma user/account storage
  -> middleware-protected app/API routes
  -> Dashboard
Analyze form
  -> POST /api/analyze
  -> authenticated user lookup
  -> Zod validation
  -> user-owned Prisma report record: pending
  -> Prisma AnalysisJob record with encrypted job-scoped provider credential
  -> BullMQ Redis queue
  -> SSE progress subscription
Analysis worker
  -> atomic job/report transition: pending -> running
  -> GitHub parser + repo metadata/tree fetch
  -> file candidate selection
  -> bounded raw content fetch
  -> persisted step-level progress and timestamps
  -> AIProvider adapter: OpenAI or Groq
  -> AgentPipeline
       FileClassifierAgent
       ArchitectureAgent
       SecurityAgent
       PerformanceAgent
       TestingAgent
       ReportSynthesisAgent
  -> Prisma report + findings persistence
  -> atomic job/report transition: completed/failed
  -> /reports/[reportId]
```

Provider-specific SDK usage is isolated to:

```txt
src/lib/ai/providers/OpenAIProvider.ts
src/lib/ai/providers/GroqProvider.ts
src/lib/ai/providers/ProviderFactory.ts
```

Agents depend only on:

```txt
src/lib/ai/providers/AIProvider.ts
```

Adding Anthropic later should require only:

- new provider adapter
- `ProviderFactory.ts`
- `AIProviderName`
- provider selector UI

## Cost and Safety Limits

Configured in `src/lib/ai/tokenBudget.ts`:

```ts
export const REPO_ANALYSIS_LIMITS = {
  MAX_FILES_TO_FETCH: 80,
  MAX_FILE_SIZE_BYTES: 80_000,
  MAX_TOTAL_CHARS: 300_000,
  MAX_FINDINGS: 25,
  MAX_AGENT_STEPS: 6,
};
```

RepoVitals selects important files before fetching content, ignores generated/binary/lock/build paths, and stores selected file metadata, hashes, and snippets rather than full raw source files.

## API Contracts

`POST /api/analyze`

Requires an authenticated session.

Request:

```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "repoUrl": "owner/repo"
}
```

Success:

```json
{
  "jobId": "...",
  "reportId": "...",
  "status": "pending"
}
```

Error:

```json
{
  "error": {
    "code": "INVALID_GITHUB_URL",
    "message": "Enter a valid GitHub repository URL or owner/repo path."
  },
  "reportId": "..."
}
```

`GET /api/analyze/jobs/[jobId]/events`

Requires an authenticated session. Streams Server-Sent Events for persisted job progress.

`POST /api/analyze/jobs/[jobId]/cancel`

Requires an authenticated session. Cancels a pending or running job, clears its encrypted credential, and marks the report failed with a cancellation message.

`GET /api/reports/[reportId]`

Requires an authenticated session. Returns a persisted report only when it belongs to the signed-in user.

## Database

Prisma models:

- `User`
- `Account`
- `Session`
- `VerificationToken`
- `Repository`
- `AnalysisReport`
- `AnalysisJob`
- `AnalysisJobProgress`
- `Finding`

Important fields:

- `AnalysisReport.status`: `pending | running | completed | failed`
- `AnalysisJob.status`: `pending | running | completed | failed | cancelled`
- `AnalysisJobProgress`: one row per workflow step with status and timestamps
- `AnalysisReport.scorecardJson`
- `AnalysisReport.recommendationsJson`
- `AnalysisReport.agentTraceJson`
- `AnalysisReport.selectedFilesJson`
- `AnalysisReport.userId`: owner of the saved report

Raw provider keys are never persisted.

## Tests

Run:

```bash
pnpm test
```

Covered:

- `parseGithubUrl`
- `selectImportantFiles`
- `redactApiKey`
- provider factory
- analyze schema validation

## Troubleshooting

If Prisma cannot connect:

- verify `DATABASE_URL`
- verify the database accepts external connections
- run `pnpm prisma generate`
- run `pnpm prisma migrate dev --name init`

If GitHub rate limits requests:

- set `GITHUB_TOKEN` in `.env.local`
- restart `pnpm dev`
- use a smaller repository

If provider calls fail:

- confirm the selected provider matches the pasted key
- confirm billing/rate limits on the provider account
- try a smaller public repository

If `pnpm build` fails because the database is unavailable:

- ensure `DATABASE_URL` is set before building
- the report page is dynamic, but Prisma still needs a generated client

## Worker Semantics

- Jobs are queued in Redis through BullMQ.
- Retries use exponential backoff from `ANALYSIS_JOB_ATTEMPTS` and `ANALYSIS_JOB_BACKOFF_MS`.
- Timeouts are enforced with `ANALYSIS_JOB_TIMEOUT_MS` and abort signals passed into GitHub/provider calls.
- Final non-cancelled failures are copied to the `analysis.dead` dead-letter queue and kept failed in BullMQ.
- Report transitions are guarded so completed reports are not overwritten by later failure paths.

## Deployment Notes

For Vercel:

1. Add `DATABASE_URL`.
2. Add `REDIS_URL`.
3. Add `NEXTAUTH_URL` using the deployed app URL.
4. Add `NEXTAUTH_SECRET`.
5. Add `ANALYSIS_JOB_SECRET`.
6. Add Google and GitHub OAuth credentials.
7. Add optional `GITHUB_TOKEN`.
8. Do not add user OpenAI/Groq keys as env vars for MVP.
9. Run Prisma migration against the production database before demoing.
10. Run at least one long-lived `pnpm worker` process beside the Next.js app.

## Roadmap

Next phases:

- deterministic scanner improvements
- saved report sharing controls
- background jobs
- GitHub OAuth/App for private repos
- GitHub issue creation
- PR suggestions with human approval
- CI/PR review bot
- Anthropic/Gemini/local provider adapters
- team/workspace mode

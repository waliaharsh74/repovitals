# RepoVitals

RepoVitals is a GitHub repository review application. A signed-in user selects a repository, chooses a review scope, supplies an OpenAI API key for that analysis run, and views a saved production-readiness report covering architecture, security, performance, maintainability, and testing.

## Application Flow

### 1. Start a Repository Review

The landing page introduces the production-readiness review and the report categories: architecture, security, performance, maintainability, and testing.

![RepoVitals landing page with report preview](design/readme/landing.png)

### 2. Sign In with GitHub

GitHub authentication connects analyses to an account so completed reports remain available from the dashboard.

![GitHub sign-in screen for RepoVitals](design/readme/login.png)

### 3. Follow Analysis Progress

After the user selects a repository, review scope, and API key, RepoVitals queues the run and displays its step-by-step progress. The running view shows selected agents, completed workflow stages, and a cancellation action.

![Queued analysis workflow progress with completed stages](design/progress.png)

### 4. Inspect the Production-Readiness Report

The completed report turns repository structure into an architecture diagram and groups findings by review area. Findings include severity, confidence, source location, explanation, and a recommended fix.

![Generated repository architecture diagram](design/architecture.png)

![Security finding with severity, confidence, file location, and remediation](design/security.png)

## Main Features

| Feature | Capability |
| --- | --- |
| GitHub sign-in and protected routes | NextAuth GitHub OAuth gates analysis, dashboards, reports, and related APIs |
| Saved report dashboard | Signed-in users can return to persisted reports |
| Repository analysis workspace | Select a repository and configure full or custom agent coverage |
| Queued processing and progress | BullMQ and Redis execute analysis jobs while SSE streams persisted progress |
| Production-readiness report | Scorecards, summary, architecture diagram, findings, recommendations, and agent trace |
| Credential handling | The submitted OpenAI API key is encrypted while required by a queued job and cleared at a terminal state |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web application | Next.js 15 App Router, React 19, TypeScript |
| Styling and UI | Tailwind CSS, Radix primitives, Lucide icons |
| Authentication | NextAuth 4 with GitHub OAuth and Prisma adapter |
| Forms and validation | React Hook Form, Zod |
| Data persistence | Prisma with PostgreSQL |
| Job processing | BullMQ with Redis and a separate TypeScript worker |
| AI integration | OpenAI provider adapter and specialized analysis agents |
| Report diagrams | Mermaid |
| Tests and linting | Vitest and ESLint |

## Requirements

- Node.js compatible with Next.js 15. This repository does not pin a Node version.
- `pnpm` 9.15.3, as declared in `package.json`.
- PostgreSQL available through `DATABASE_URL`.
- Redis; the repository includes a Docker Compose Redis service.
- GitHub OAuth application credentials.
- An OpenAI API key entered in the analysis UI when starting a review.

## Local Setup

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Create local environment configuration from the example file and set the required values.

   ```bash
   cp .env.example .env.local
   ```

   Required configuration:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
   REDIS_URL="redis://localhost:6379"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="generate-a-random-secret"
   ANALYSIS_JOB_SECRET="generate-at-least-32-characters"
   GITHUB_CLIENT_ID=""
   GITHUB_CLIENT_SECRET=""
   ```

   Optional configuration is documented in [.env.example](.env.example), including queue tuning, `GITHUB_TOKEN`, and `OPENAI_MODEL`.

3. Configure the GitHub OAuth application's local callback URL.

   ```text
   http://localhost:3000/api/auth/callback/github
   ```

   The configured GitHub authorization request asks for `read:user` and `repo` scopes.

4. Generate the Prisma client and apply migrations to PostgreSQL.

   ```bash
   pnpm prisma generate
   pnpm prisma migrate dev
   ```

5. Start Redis.

   ```bash
   pnpm redis:up
   ```

6. Start the Next.js development server and analysis worker together.

   ```bash
   pnpm dev
   ```

7. Open `http://localhost:3000`.

`pnpm dev` runs both the web process and `src/workers/analysisWorker.ts`. To operate them separately, use `pnpm dev:web` and `pnpm dev:worker`.

## Authentication and Credential Handling

- GitHub sign-in gates `/analyze`, `/dashboard`, report pages, and analysis/report API routes.
- Analysis requires an OpenAI API key supplied through the browser for that run.
- Based on the implementation, the submitted OpenAI key is encrypted with AES-256-GCM and stored in the queued `AnalysisJob` record while the job needs it.
- The encrypted analysis credential is cleared when a job completes, fails, cannot be queued, or is cancelled.
- Do not place a user's per-analysis OpenAI key in screenshots, committed configuration, logs, or documentation.

## Usage Flow

1. Open the landing page and select **Analyze a repository**.
2. Sign in with GitHub and complete any GitHub authorization prompt.
3. On the analysis page, choose or enter a GitHub repository and select the desired review scope.
4. Supply an OpenAI API key for the run and submit the analysis.
5. The implementation queues the job and exposes progress updates while the worker builds the report.
6. Open the saved report from the dashboard to review scorecards, findings, the architecture diagram, recommendations, and agent trace.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the development web application and worker together |
| `pnpm dev:web` | Run only the Next.js development server |
| `pnpm dev:worker` | Run only the development analysis worker |
| `pnpm redis:up` | Start the local Redis Docker Compose service |
| `pnpm build` | Build the production Next.js application |
| `pnpm start` | Start the built Next.js application |
| `pnpm worker` | Run the analysis worker outside the combined dev command |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm prisma generate` | Generate Prisma Client |
| `pnpm prisma migrate dev` | Apply development database migrations |
| `pnpm prisma studio` | Open Prisma Studio |

## UI Copy Status

- The landing and login pages describe OpenAI API keys as encrypted for the queued analysis run and cleared at a terminal job state.
- The landing-page example output describes Redis/BullMQ queued jobs and SSE progress updates.

## Data Limits

The standard and expanded review limits are configured in `src/lib/ai/tokenBudget.ts`.

| Limit | Standard | Expanded |
| --- | ---: | ---: |
| Files fetched | 80 | 140 |
| Maximum bytes per file | 80,000 | 140,000 |
| Total characters provided for analysis | 300,000 | 450,000 |
| Findings | 25 | 40 |
| Agent steps | 6 | 6 |

RepoVitals selects bounded source content before invoking its analysis agents and stores report artifacts, selected-file metadata, progress records, and findings in PostgreSQL.

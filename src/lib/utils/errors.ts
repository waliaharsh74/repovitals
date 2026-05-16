import { redactApiKey } from "@/lib/ai/redact";
import { ZodError } from "zod";

export type ErrorCode =
  | "INVALID_GITHUB_URL"
  | "GITHUB_REPO_NOT_FOUND"
  | "GITHUB_RATE_LIMIT"
  | "GITHUB_ACCESS_DENIED"
  | "GITHUB_APP_INSTALLATION_REQUIRED"
  | "PROVIDER_AUTHENTICATION"
  | "PROVIDER_RATE_LIMIT"
  | "REPO_TOO_LARGE"
  | "QUEUE_UNAVAILABLE"
  | "ANALYSIS_CANCELLED"
  | "ANALYSIS_TIMEOUT"
  | "VALIDATION_ERROR"
  | "ANALYSIS_FAILED";

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  constructor(code: ErrorCode, message: string, status = 500) {
    super(redactApiKey(message));
    this.name = code;
    this.code = code;
    this.status = status;
  }
}
export class InvalidGithubUrlError extends AppError { constructor(message = "Enter a valid GitHub repository URL or owner/repo path.") { super("INVALID_GITHUB_URL", message, 400);} }
export class GithubRepoNotFoundError extends AppError { constructor(message = "GitHub repository was not found or is not public.") { super("GITHUB_REPO_NOT_FOUND", message, 404);} }
export class GithubRateLimitError extends AppError { constructor(message = "GitHub rate limit reached while fetching this repository. Add GITHUB_TOKEN or try later.") { super("GITHUB_RATE_LIMIT", message, 429);} }
export class GithubAccessDeniedError extends AppError { constructor(message = "GitHub denied access to this repository.") { super("GITHUB_ACCESS_DENIED", message, 403);} }
export class GithubInstallationRequiredError extends AppError { constructor(message = "This private repository is not installed for your GitHub App installation.") { super("GITHUB_APP_INSTALLATION_REQUIRED", message, 404);} }
export class ProviderAuthenticationError extends AppError { constructor(message = "The provider rejected the API key. Check the key and try again.") { super("PROVIDER_AUTHENTICATION", message, 401);} }
export class ProviderRateLimitError extends AppError { constructor(message = "The AI provider rate limit was reached. Try again later or use another provider key.") { super("PROVIDER_RATE_LIMIT", message, 429);} }
export class RepoTooLargeError extends AppError { constructor(message = "This repository is too large for the MVP analysis limits.") { super("REPO_TOO_LARGE", message, 413);} }
export class QueueUnavailableError extends AppError { constructor(message = "Analysis queue is unavailable. Start Redis and the worker, then try again.") { super("QUEUE_UNAVAILABLE", message, 503);} }
export class AnalysisCancelledError extends AppError { constructor(message = "Analysis was cancelled.") { super("ANALYSIS_CANCELLED", message, 409);} }
export class AnalysisTimeoutError extends AppError { constructor(message = "Analysis exceeded its configured timeout.") { super("ANALYSIS_TIMEOUT", message, 504);} }
export class AnalysisFailedError extends AppError { constructor(message = "Analysis failed before a report could be completed.") { super("ANALYSIS_FAILED", message, 500);} }

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return new AppError("VALIDATION_ERROR", error.issues[0]?.message ?? "Request validation failed.", 400);
  const message = error instanceof Error ? error.message : String(error);
  return new AnalysisFailedError(redactApiKey(message));
}

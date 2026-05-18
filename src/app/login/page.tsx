import { redirect } from "next/navigation";
import { Activity, AlertCircle, ShieldCheck } from "lucide-react";
import { LoginButtons } from "@/components/auth/LoginButtons";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

function normalizeCallbackUrl(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return "/dashboard";
  }

  if (rawValue.startsWith("/") && !rawValue.startsWith("//")) {
    return rawValue;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;

  if (!appUrl) {
    return "/dashboard";
  }

  try {
    const callbackUrl = new URL(rawValue);
    const allowedOrigin = new URL(appUrl).origin;

    if (callbackUrl.origin === allowedOrigin) {
      return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
    }
  } catch {
    return "/dashboard";
  }

  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const callbackUrl = normalizeCallbackUrl(params.callbackUrl);
  const hasAuthError = Boolean(params.error);
  const user = await getCurrentUser();

  if (user) {
    redirect(callbackUrl);
  }

  return (
    <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-5" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Sign in to RepoVitals</CardTitle>
            <CardDescription>
              Save production-readiness reports to your dashboard and return to them later.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {hasAuthError ? (
            <Alert className="flex gap-2 border-red-200 bg-red-50 text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>Authentication failed. Check the GitHub OAuth configuration and try again.</span>
            </Alert>
          ) : null}
          <LoginButtons callbackUrl={callbackUrl} />
          <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>OpenAI API keys are still used only for a single analysis run and are never stored.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

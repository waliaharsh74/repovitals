"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container flex min-h-[70vh] items-center justify-center">
      <div className="max-w-lg space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-destructive">Application error</p>
        <h1 className="text-3xl font-semibold">RepoVitals could not render this view.</h1>
        <p className="text-muted-foreground">{error.message}</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}

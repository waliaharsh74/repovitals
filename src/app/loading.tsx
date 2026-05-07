export default function Loading() {
  return (
    <main className="container py-16">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="h-32 animate-pulse rounded-md bg-muted" />
        <div className="h-32 animate-pulse rounded-md bg-muted" />
        <div className="h-32 animate-pulse rounded-md bg-muted" />
      </div>
    </main>
  );
}

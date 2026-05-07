import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="container flex min-h-[70vh] items-center justify-center">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-semibold">Report not found</h1>
        <p className="text-muted-foreground">The report id does not exist or the database is not connected.</p>
        <Button asChild>
          <Link href="/analyze">Analyze a repository</Link>
        </Button>
      </div>
    </main>
  );
}

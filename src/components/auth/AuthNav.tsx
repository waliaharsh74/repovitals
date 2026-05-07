import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/SignOutButton";

export async function AuthNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/analyze" className="hidden hover:text-foreground sm:inline">
          Analyze
        </Link>
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3 text-sm text-muted-foreground">
      <Link href="/dashboard" className="hover:text-foreground">
        Dashboard
      </Link>
      <Link href="/analyze" className="hover:text-foreground">
        Analyze
      </Link>
      <span className="hidden max-w-44 truncate text-foreground md:inline">
        {user.name ?? user.email ?? "Signed in"}
      </span>
      <SignOutButton />
    </nav>
  );
}

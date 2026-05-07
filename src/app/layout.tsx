import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { AuthNav } from "@/components/auth/AuthNav";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "RepoVitals",
  description: "Paste a GitHub repo. Get a senior-engineering production-readiness review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b bg-white">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Activity className="size-4" />
              </span>
              RepoVitals
            </Link>
            <AuthNav />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

"use client";

import { Chrome, Github } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LoginButtons({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="space-y-3">
      <Button className="w-full" type="button" onClick={() => signIn("google", { callbackUrl })}>
        <Chrome className="size-4" />
        Continue with Google
      </Button>
      <Button
        className="w-full"
        type="button"
        variant="outline"
        onClick={() => signIn("github", { callbackUrl })}
      >
        <Github className="size-4" />
        Continue with GitHub
      </Button>
    </div>
  );
}

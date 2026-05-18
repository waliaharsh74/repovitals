"use client";

import { Github } from "lucide-react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LoginButtons({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div>
      <Button
        className="w-full"
        type="button"
        onClick={() => signIn("github", { callbackUrl })}
      >
        <Github className="size-4" />
        Continue with GitHub
      </Button>
    </div>
  );
}

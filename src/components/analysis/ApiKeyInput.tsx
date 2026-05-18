"use client";

import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApiKeyInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="apiKey">OpenAI API key</Label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="apiKey"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="pl-9"
          placeholder="Paste OpenAI key for this analysis"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Your OpenAI key is used only for this analysis and is not stored.
      </p>
    </div>
  );
}

"use client";

import type { AIProviderName } from "@/lib/agents/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ProviderSelector({
  value,
  onChange,
  disabled,
}: {
  value: AIProviderName;
  onChange: (value: AIProviderName) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="provider">AI provider</Label>
      <Select value={value} onValueChange={(next) => onChange(next as AIProviderName)} disabled={disabled}>
        <SelectTrigger id="provider">
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="openai">OpenAI</SelectItem>
          <SelectItem value="groq">Groq</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

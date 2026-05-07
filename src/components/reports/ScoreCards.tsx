import type { Scorecard } from "@/lib/agents/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LABELS: { key: keyof Scorecard; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "architecture", label: "Architecture" },
  { key: "security", label: "Security" },
  { key: "performance", label: "Performance" },
  { key: "maintainability", label: "Maintainability" },
  { key: "testing", label: "Testing" },
];

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  return "text-red-700";
}

export function ScoreCards({ scorecard }: { scorecard: Scorecard }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {LABELS.map((item) => (
        <Card key={item.key}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-3xl font-semibold ${scoreColor(scorecard[item.key])}`}>
              {scorecard[item.key]}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

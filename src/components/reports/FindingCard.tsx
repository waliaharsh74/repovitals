import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FindingView = {
  id: string;
  title: string;
  category: string;
  severity: string;
  confidence: number;
  filePath: string | null;
  lineHint: number | null;
  explanation: string;
  recommendation: string;
  suggestedPatch: string | null;
};

function severityVariant(severity: string): "critical" | "high" | "medium" | "low" | "default" {
  if (severity === "critical" || severity === "high" || severity === "medium" || severity === "low") {
    return severity;
  }
  return "default";
}

export function FindingCard({ finding }: { finding: FindingView }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant={severityVariant(finding.severity)}>{finding.severity}</Badge>
          <Badge variant="outline">{finding.category}</Badge>
          <Badge variant="outline">{Math.round(finding.confidence * 100)}% confidence</Badge>
        </div>
        <CardTitle className="text-lg leading-6">{finding.title}</CardTitle>
        {finding.filePath ? (
          <p className="text-sm font-medium text-muted-foreground">
            {finding.filePath}
            {finding.lineHint ? `:${finding.lineHint}` : ""}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-6">
        <p>{finding.explanation}</p>
        <div className="rounded-md bg-muted p-4">
          <p className="font-medium">Recommended fix</p>
          <p className="mt-1 text-muted-foreground">{finding.recommendation}</p>
        </div>
        {finding.suggestedPatch ? (
          <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
            {finding.suggestedPatch}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}

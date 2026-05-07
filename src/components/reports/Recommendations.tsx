import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Recommendations({ recommendations }: { recommendations: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {recommendations.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-6">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

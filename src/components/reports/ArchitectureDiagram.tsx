"use client";

import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

export function ArchitectureDiagram({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      try {
        setError(null);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            primaryColor: "#ecfdf5",
            primaryTextColor: "#0f172a",
            primaryBorderColor: "#0f766e",
            lineColor: "#64748b",
            fontFamily: "Inter, ui-sans-serif, system-ui",
          },
        });

        const result = await mermaid.render(`repovitals-${id}`, chart);
        if (!cancelled) {
          setSvg(result.svg);
        }
      } catch {
        if (!cancelled) {
          setError("The Mermaid diagram could not be rendered.");
        }
      }
    }

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">{chart}</pre>;
  }

  return (
    <div
      className="mermaid overflow-x-auto rounded-md bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

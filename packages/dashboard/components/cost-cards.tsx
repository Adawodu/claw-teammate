"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usd } from "@/lib/formatters";

interface CostCardsProps {
  snapshot: {
    openrouterBalance: number;
    openrouterUsed30d: number;
    openaiCostToday: number;
    openaiCostMtd: number;
    gcpEstimateMo: number;
  } | null;
}

export function CostCards({ snapshot }: CostCardsProps) {
  const s = snapshot;
  const monthlyTotal = s
    ? s.openrouterUsed30d + s.openaiCostMtd + s.gcpEstimateMo
    : 0;

  const cards = [
    { title: "Monthly Estimate", value: s ? usd(monthlyTotal) : "--" },
    { title: "OpenRouter (30d)", value: s ? usd(s.openrouterUsed30d) : "--" },
    { title: "OpenRouter Balance", value: s ? usd(s.openrouterBalance) : "--" },
    { title: "OpenAI MTD", value: s ? usd(s.openaiCostMtd) : "--" },
    { title: "GCP Compute", value: s ? usd(s.gcpEstimateMo) + "/mo" : "--" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aggregateByModel, usd, type ActivityRow } from "@/lib/formatters";

export function ModelBreakdownTable({ activity }: { activity: ActivityRow[] }) {
  const rows = aggregateByModel(activity);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Per-Model Breakdown (30d)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 text-right font-medium">Cost</th>
                <th className="pb-2 text-right font-medium">Requests</th>
                <th className="pb-2 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([model, d]) => (
                <tr key={model} className="border-b border-border/50">
                  <td className="py-2">{model}</td>
                  <td className="py-2 text-right tabular-nums">{usd(d.usageUsd)}</td>
                  <td className="py-2 text-right tabular-nums">{d.requests.toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums">{d.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

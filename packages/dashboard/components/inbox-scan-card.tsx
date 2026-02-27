"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ago } from "@/lib/formatters";
import type { Doc } from "@convex/_generated/dataModel";

const CATEGORY_COLORS: Record<string, string> = {
  Essential: "bg-green-500",
  Aggressor: "bg-red-500",
  Marketing: "bg-yellow-500",
  Lapsed: "bg-gray-400",
  Unknown: "bg-gray-300",
};

export function InboxScanCard({
  scan,
}: {
  scan: Doc<"inboxScans"> | null;
}) {
  if (!scan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Inbox Scan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No inbox scan data yet. Run a scan via Telegram:{" "}
            <code className="rounded bg-muted px-1">/dynoclux</code> → option 1
          </p>
        </CardContent>
      </Card>
    );
  }

  const categories = scan.categoryBreakdown;
  const total = Object.values(categories).reduce(
    (sum, v) => sum + (v ?? 0),
    0
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Inbox Scan Summary
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {ago(scan.scannedAt)}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Messages</span>
            <p className="text-2xl font-bold">{scan.totalMessages}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Unique Senders</span>
            <p className="text-2xl font-bold">{scan.uniqueSenders}</p>
          </div>
        </div>

        {total > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Sender Categories
            </p>
            <div className="flex h-3 overflow-hidden rounded-full">
              {Object.entries(categories).map(([cat, count]) => {
                if (!count) return null;
                const pct = (count / total) * 100;
                return (
                  <div
                    key={cat}
                    className={`${CATEGORY_COLORS[cat] ?? "bg-gray-300"}`}
                    style={{ width: `${pct}%` }}
                    title={`${cat}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.entries(categories).map(([cat, count]) => {
                if (!count) return null;
                return (
                  <span key={cat} className="flex items-center gap-1">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-300"}`}
                    />
                    {cat}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

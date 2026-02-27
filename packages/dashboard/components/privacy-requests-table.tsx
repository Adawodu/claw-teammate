"use client";

import { Badge } from "@/components/ui/badge";
import { daysUntil } from "@/lib/formatters";
import type { Doc } from "@convex/_generated/dataModel";

const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  complied: "default",
  violated: "destructive",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PrivacyRequestsTable({
  requests,
}: {
  requests: Doc<"privacyRequests">[];
}) {
  if (requests.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No requests found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Sender</th>
            <th className="px-4 py-3 text-left font-medium">Domain</th>
            <th className="px-4 py-3 text-left font-medium">Type</th>
            <th className="px-4 py-3 text-left font-medium">Method</th>
            <th className="px-4 py-3 text-left font-medium">Requested</th>
            <th className="px-4 py-3 text-left font-medium">Deadline</th>
            <th className="px-4 py-3 text-left font-medium">Days Left</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const days = daysUntil(r.deadline);
            return (
              <tr key={r._id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{r.senderEmail}</td>
                <td className="px-4 py-3">{r.senderDomain}</td>
                <td className="px-4 py-3 capitalize">{r.requestType.replace("_", " ")}</td>
                <td className="px-4 py-3">{r.method ?? "—"}</td>
                <td className="px-4 py-3">{formatDate(r.requestedAt)}</td>
                <td className="px-4 py-3">{formatDate(r.deadline)}</td>
                <td className="px-4 py-3">
                  {r.status === "pending" ? (
                    <span className={days < 0 ? "font-bold text-red-600" : days <= 3 ? "text-yellow-600" : ""}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusColors[r.status] ?? "secondary"}>
                    {r.status}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import type { Doc } from "@convex/_generated/dataModel";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  running: "outline",
  done: "default",
  error: "destructive",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActionQueueTable({
  actions,
}: {
  actions: Doc<"actionQueue">[];
}) {
  if (actions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No actions in queue.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Action</th>
            <th className="px-4 py-3 text-left font-medium">Sender</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Created</th>
            <th className="px-4 py-3 text-left font-medium">Completed</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a._id} className="border-b last:border-0">
              <td className="px-4 py-3 capitalize">
                {a.action.replace(/_/g, " ")}
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {a.senderEmail}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[a.status] ?? "secondary"}>
                  {a.status}
                </Badge>
              </td>
              <td className="px-4 py-3">{formatDate(a.createdAt)}</td>
              <td className="px-4 py-3">
                {a.completedAt ? formatDate(a.completedAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

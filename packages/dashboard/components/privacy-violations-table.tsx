"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Doc } from "@convex/_generated/dataModel";

const statusLabels: Record<string, string> = {
  detected: "Detected",
  notice_drafted: "Notice Drafted",
  notice_sent: "Notice Sent",
  resolved: "Resolved",
};

const statusColors: Record<string, "destructive" | "default" | "secondary"> = {
  detected: "destructive",
  notice_drafted: "secondary",
  notice_sent: "default",
  resolved: "default",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ViolationRow({ v }: { v: Doc<"privacyViolations"> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-4 py-3 font-mono text-xs">{v.senderEmail}</td>
        <td className="px-4 py-3 uppercase">{v.violationType}</td>
        <td className="px-4 py-3">{formatDate(v.deadlineDate)}</td>
        <td className="px-4 py-3">{formatDate(v.violationDate)}</td>
        <td className="px-4 py-3">{v.messageIds.length}</td>
        <td className="px-4 py-3">
          <Badge variant={statusColors[v.status] ?? "secondary"}>
            {statusLabels[v.status] ?? v.status}
          </Badge>
        </td>
        <td className="px-4 py-3">
          {v.noticeDraft && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </td>
      </tr>
      {expanded && v.noticeDraft && (
        <tr className="border-b bg-muted/30">
          <td colSpan={7} className="px-6 py-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Notice Draft
            </p>
            <pre className="whitespace-pre-wrap text-xs">{v.noticeDraft}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function PrivacyViolationsTable({
  violations,
}: {
  violations: Doc<"privacyViolations">[];
}) {
  if (violations.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Violations</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Sender</th>
              <th className="px-4 py-3 text-left font-medium">Law</th>
              <th className="px-4 py-3 text-left font-medium">Deadline</th>
              <th className="px-4 py-3 text-left font-medium">Violation Date</th>
              <th className="px-4 py-3 text-left font-medium">Messages</th>
              <th className="px-4 py-3 text-left font-medium">Notice Status</th>
              <th className="px-4 py-3 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {violations.map((v) => (
              <ViolationRow key={v._id} v={v} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

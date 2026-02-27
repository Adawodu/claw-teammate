"use client";

import { ExternalLink } from "lucide-react";

interface Draft {
  id: string;
  subject: string;
  to: string;
  date: string;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function EmailDraftsTable({ drafts }: { drafts: Draft[] }) {
  if (drafts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No drafts found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Subject</th>
            <th className="px-4 py-3 text-left font-medium">To</th>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => (
            <tr key={d.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">{d.subject}</td>
              <td className="px-4 py-3 font-mono text-xs">
                {d.to || "—"}
              </td>
              <td className="px-4 py-3">{formatDate(d.date)}</td>
              <td className="px-4 py-3">
                <a
                  href={`https://mail.google.com/mail/u/0/#drafts/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open in Gmail
                  <ExternalLink className="h-3 w-3" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

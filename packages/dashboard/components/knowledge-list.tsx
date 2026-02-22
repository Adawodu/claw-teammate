"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface KnowledgeEntry {
  _id: string;
  text: string;
  tags: string[];
  source: string;
  createdAt: number;
}

export function KnowledgeList({ entries }: { entries: KnowledgeEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No knowledge entries yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry._id}>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="text-sm">{entry.text}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{entry.source}</span>
              <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

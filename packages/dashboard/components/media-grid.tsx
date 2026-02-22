"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MediaItem {
  _id: string;
  type: string;
  prompt: string;
  provider: string;
  mimeType: string;
  url: string | null;
  createdAt: number;
}

export function MediaGrid({ items }: { items: MediaItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No media generated yet.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item._id} className="overflow-hidden">
          <div className="relative aspect-video bg-muted">
            {item.url && item.type === "image" ? (
              <img
                src={item.url}
                alt={item.prompt}
                className="h-full w-full object-cover"
              />
            ) : item.url && item.type === "video" ? (
              <video
                src={item.url}
                controls
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No preview
              </div>
            )}
          </div>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{item.type}</Badge>
              <Badge variant="outline">{item.provider}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {item.prompt}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

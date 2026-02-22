"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { MediaGrid } from "@/components/media-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default function MediaPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];

  const allMedia = useQuery(api.media.list, deployment ? { limit: 50 } : "skip");
  const images = useQuery(api.media.list, deployment ? { type: "image", limit: 50 } : "skip");
  const videos = useQuery(api.media.list, deployment ? { type: "video", limit: 50 } : "skip");

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Media</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Media</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Image className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Deploy your AI teammate first to generate and view media.
            </p>
            <Button asChild>
              <Link href="/deploy">Deploy Now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (allMedia === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Media</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Media</h1>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({allMedia?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="images">Images ({images?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="videos">Videos ({videos?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <MediaGrid items={allMedia ?? []} />
        </TabsContent>
        <TabsContent value="images">
          <MediaGrid items={images ?? []} />
        </TabsContent>
        <TabsContent value="videos">
          <MediaGrid items={videos ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

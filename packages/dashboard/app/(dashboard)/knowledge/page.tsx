"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { KnowledgeList } from "@/components/knowledge-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";
import Link from "next/link";

export default function KnowledgePage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];

  const entries = useQuery(api.knowledge.list, deployment ? { limit: 50 } : "skip");

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Knowledge</h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Knowledge</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Brain className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Deploy your AI teammate first to build and browse its knowledge base.
            </p>
            <Button asChild>
              <Link href="/deploy">Deploy Now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (entries === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Knowledge</h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge</h1>
        <p className="text-sm text-muted-foreground">
          {entries.length} entries stored
        </p>
      </div>

      <KnowledgeList entries={entries} />
    </div>
  );
}

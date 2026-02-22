"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CostCards } from "@/components/cost-cards";
import { CostChart } from "@/components/cost-chart";
import { ModelBreakdownTable } from "@/components/model-breakdown-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { ago } from "@/lib/formatters";
import Link from "next/link";

export default function CostsPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];

  // Only fetch cost data if user has a deployment
  const snapshot = useQuery(
    api.costs.latestSnapshot,
    deployment ? {} : "skip"
  );
  const activity = useQuery(
    api.costs.recentActivity,
    deployment ? { days: 30 } : "skip"
  );

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Costs</h1>
        <Skeleton className="h-24" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Costs</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Deploy your AI teammate first to track costs.
            </p>
            <Button asChild>
              <Link href="/deploy">Deploy Now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (snapshot === undefined || activity === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Costs</h1>
        <Skeleton className="h-24" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!snapshot && (!activity || activity.length === 0)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Costs</h1>
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-sm text-muted-foreground">
              No cost data yet. Data will appear here once your teammate starts
              running and the first cost snapshot is collected (every 6 hours).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Costs</h1>
        {snapshot && (
          <p className="text-sm text-muted-foreground">
            Last updated: {ago(snapshot.fetchedAt)}
          </p>
        )}
      </div>

      <CostCards snapshot={snapshot ?? null} />
      <CostChart activity={activity ?? []} />
      <ModelBreakdownTable activity={activity ?? []} />
    </div>
  );
}

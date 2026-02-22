"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VmStatusBadge } from "@/components/vm-status-badge";
import { CostCards } from "@/components/cost-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket } from "lucide-react";
import Link from "next/link";
import { useHealthPoll } from "@/lib/use-health-poll";

export default function OverviewPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];

  // Only fetch costs if user has a deployment
  const snapshot = useQuery(
    api.costs.latestSnapshot,
    deployment ? {} : "skip"
  );

  // Poll VM status every 60s while on this page
  useHealthPoll(deployment, 60_000);

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Rocket className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No deployment yet</h2>
            <p className="text-center text-sm text-muted-foreground">
              Deploy your AI teammate to get started. You&apos;ll see status,
              costs, and controls here once it&apos;s running.
            </p>
            <Button asChild>
              <Link href="/deploy">Deploy Now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{deployment.branding.botName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {deployment.gcpProjectId} / {deployment.gcpZone} /{" "}
              {deployment.vmName}
            </p>
          </div>
          <VmStatusBadge status={deployment.status} />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/logs">Logs</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/costs">Costs</Link>
            </Button>
          </div>
          {deployment.lastHealthCheck && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last checked:{" "}
              {new Date(deployment.lastHealthCheck).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {snapshot ? (
        <CostCards snapshot={snapshot} />
      ) : (
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-sm text-muted-foreground">
              Cost data will appear here once your teammate starts running and
              the first cost snapshot is collected.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

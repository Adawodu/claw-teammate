"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import Link from "next/link";
import { PrivacyStatsCards } from "@/components/privacy-stats-cards";
import { PrivacyRequestsTable } from "@/components/privacy-requests-table";
import { PrivacyViolationsTable } from "@/components/privacy-violations-table";
import { InboxScanCard } from "@/components/inbox-scan-card";
import { ActionQueueTable } from "@/components/action-queue-table";

type TabValue = "all" | "pending" | "violated" | "complied" | "actions";

export default function PrivacyPage() {
  const [tab, setTab] = useState<TabValue>("all");
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];

  const pluginConfigs = useQuery(
    api.pluginConfigs.listByDeployment,
    deployment ? { deploymentId: deployment._id } : "skip"
  );

  const stats = useQuery(api.privacyRequests.stats, deployment ? {} : "skip");
  const statusFilter = tab === "all" || tab === "actions" ? undefined : tab;
  const requests = useQuery(
    api.privacyRequests.list,
    deployment ? { status: statusFilter } : "skip",
  );
  const violations = useQuery(
    api.privacyViolations.list,
    deployment ? {} : "skip",
  );
  const latestScan = useQuery(
    api.inboxScans.latest,
    deployment ? {} : "skip",
  );
  const actionQueue = useQuery(
    api.actionQueue.list,
    deployment ? { limit: 50 } : "skip",
  );

  const isPluginEnabled = (pluginConfigs ?? []).some(
    (p: { pluginId: string; enabled: boolean }) =>
      p.pluginId === "dynoclux" && p.enabled
  );

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Deploy your AI teammate first to track privacy requests and
              compliance.
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Privacy</h1>
          <p className="text-sm text-muted-foreground">
            DynoClux privacy enforcement — inbox scans, unsubscribe tracking,
            and compliance monitoring.
          </p>
        </div>
        <Badge variant={isPluginEnabled ? "default" : "secondary"}>
          DynoClux {isPluginEnabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      {stats && <PrivacyStatsCards stats={stats} />}

      <InboxScanCard scan={latestScan ?? null} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="violated">Violated</TabsTrigger>
          <TabsTrigger value="complied">Complied</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          {actionQueue === undefined ? (
            <Skeleton className="h-[200px]" />
          ) : (
            <ActionQueueTable actions={actionQueue} />
          )}
        </TabsContent>

        {(["all", "pending", "violated", "complied"] as const).map((t) => (
          <TabsContent key={t} value={t}>
            {requests === undefined ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <PrivacyRequestsTable requests={requests} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {violations && violations.length > 0 && (
        <PrivacyViolationsTable violations={violations} />
      )}
    </div>
  );
}

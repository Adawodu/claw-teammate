"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { PluginCard } from "@/components/plugin-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLUGIN_REGISTRY } from "@dynoclaw/shared";
import { useState, useCallback } from "react";
import { RotateCw } from "lucide-react";

export default function PluginsPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];
  const pluginConfigs = useQuery(
    api.pluginConfigs.listByDeployment,
    deployment ? { deploymentId: deployment._id } : "skip"
  );
  const setPlugin = useMutation(api.pluginConfigs.set);
  const [hasChanges, setHasChanges] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleToggle = useCallback(
    async (pluginId: string, enabled: boolean) => {
      if (!deployment) return;
      await setPlugin({
        deploymentId: deployment._id,
        pluginId,
        enabled,
      });
      setHasChanges(true);
    },
    [deployment, setPlugin]
  );

  const handleSync = useCallback(async () => {
    if (!deployment) return;
    setSyncing(true);
    try {
      await fetch("/api/gcp/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deploymentId: deployment._id,
        }),
      });
      setHasChanges(false);
    } finally {
      setSyncing(false);
      setSyncDialogOpen(false);
    }
  }, [deployment]);

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Plugins</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Plugins</h1>
        <p className="text-sm text-muted-foreground">
          Deploy your teammate first to configure plugins.
        </p>
      </div>
    );
  }

  type PluginConfig = { pluginId: string; enabled: boolean };
  const configMap = new Map<string, PluginConfig>(
    (pluginConfigs ?? []).map((c: PluginConfig) => [c.pluginId, c] as const)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plugins</h1>
        {hasChanges && (
          <Button
            size="sm"
            onClick={() => setSyncDialogOpen(true)}
            className="gap-1"
          >
            <RotateCw className="h-3 w-3" />
            Sync to VM
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLUGIN_REGISTRY.map((plugin) => {
          const config = configMap.get(plugin.id);
          return (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              enabled={config?.enabled ?? false}
              onToggle={(enabled) => handleToggle(plugin.id, enabled)}
            />
          );
        })}
      </div>

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Plugin Changes</DialogTitle>
            <DialogDescription>
              To apply plugin changes, the VM needs to restart. This will
              briefly take your AI teammate offline.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSyncDialogOpen(false)}
            >
              Later
            </Button>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? "Restarting..." : "Restart Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

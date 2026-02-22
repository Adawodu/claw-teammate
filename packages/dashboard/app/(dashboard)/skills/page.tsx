"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { SkillCard } from "@/components/skill-card";
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
import { SKILL_REGISTRY } from "@claw-teammate/shared";
import { useState, useCallback } from "react";
import { RotateCw } from "lucide-react";

export default function SkillsPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];
  const skillConfigs = useQuery(
    api.skillConfigs.listByDeployment,
    deployment ? { deploymentId: deployment._id } : "skip"
  );
  const setSkill = useMutation(api.skillConfigs.set);
  const [hasChanges, setHasChanges] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleToggle = useCallback(
    async (skillId: string, enabled: boolean) => {
      if (!deployment) return;
      await setSkill({
        deploymentId: deployment._id,
        skillId,
        enabled,
      });
      setHasChanges(true);
    },
    [deployment, setSkill]
  );

  const handleSync = useCallback(async () => {
    if (!deployment) return;
    setSyncing(true);
    try {
      await fetch("/api/gcp/vm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: deployment.gcpProjectId,
          zone: deployment.gcpZone,
          vm: deployment.vmName,
          action: "reset",
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
        <h1 className="text-2xl font-bold">Skills</h1>
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
        <h1 className="text-2xl font-bold">Skills</h1>
        <p className="text-sm text-muted-foreground">
          Deploy your teammate first to configure skills.
        </p>
      </div>
    );
  }

  type SkillConfig = { skillId: string; enabled: boolean; cronOverride?: string };
  const configMap = new Map<string, SkillConfig>(
    (skillConfigs ?? []).map((c: SkillConfig) => [c.skillId, c] as const)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Skills</h1>
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
        {SKILL_REGISTRY.map((skill) => {
          const config = configMap.get(skill.id);
          return (
            <SkillCard
              key={skill.id}
              skill={skill}
              enabled={config?.enabled ?? false}
              cronOverride={config?.cronOverride}
              onToggle={(enabled) => handleToggle(skill.id, enabled)}
            />
          );
        })}
      </div>

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Skill Changes</DialogTitle>
            <DialogDescription>
              To apply skill changes, the VM needs to restart. This will briefly
              take your AI teammate offline.
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

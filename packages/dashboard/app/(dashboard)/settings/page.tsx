"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VmStatusBadge } from "@/components/vm-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Square,
  RotateCw,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Save,
  Plus,
  X,
  Info,
  ArrowUpCircle,
} from "lucide-react";
import { OPENCLAW_VERSION } from "@dynoclaw/shared";

function RestartRequiredBanner() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Configuration updated in dashboard. Restart VM from controls above to
          apply changes on the server.
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];
  const router = useRouter();
  const updateStatus = useMutation(api.deployments.updateStatus);
  const updateBranding = useMutation(api.deployments.updateBranding);
  const updateModels = useMutation(api.deployments.updateModels);
  const [acting, setActing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "stop" | "reset" | "delete" | null
  >(null);
  const [polling, setPolling] = useState(false);

  // Upgrade state
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Branding edit state
  const [editingBranding, setEditingBranding] = useState(false);
  const [botName, setBotName] = useState("");
  const [personality, setPersonality] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);

  // Models edit state
  const [editingModels, setEditingModels] = useState(false);
  const [primaryModel, setPrimaryModel] = useState("");
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [newFallback, setNewFallback] = useState("");
  const [savingModels, setSavingModels] = useState(false);
  const [modelsSaved, setModelsSaved] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!deployment) return;
    setPolling(true);
    try {
      const res = await fetch(
        `/api/gcp/status?project=${deployment.gcpProjectId}&zone=${deployment.gcpZone}&vm=${deployment.vmName}`
      );
      if (res.ok) {
        const data = await res.json();
        const gcpStatus = data.status?.toLowerCase();
        let mappedStatus = "running";
        if (gcpStatus === "running") mappedStatus = "running";
        else if (gcpStatus === "terminated" || gcpStatus === "stopped")
          mappedStatus = "stopped";
        else if (gcpStatus === "staging" || gcpStatus === "provisioning")
          mappedStatus = "provisioning";

        await updateStatus({
          id: deployment._id,
          status: mappedStatus,
          lastHealthCheck: Date.now(),
          lastHealthStatus: gcpStatus,
        });
      }
    } catch {
      // Ignore
    } finally {
      setPolling(false);
    }
  }, [deployment, updateStatus]);

  const vmAction = useCallback(
    async (action: "start" | "stop" | "reset") => {
      if (!deployment) return;
      setActing(true);
      setActionResult(null);
      setConfirmAction(null);
      try {
        const res = await fetch("/api/gcp/vm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deploymentId: deployment._id,
            action,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setActionResult({
            type: "success",
            message: `VM ${action} initiated successfully.`,
          });
          setTimeout(refreshStatus, 5000);
          setTimeout(refreshStatus, 15000);
          setTimeout(refreshStatus, 30000);
        } else {
          setActionResult({
            type: "error",
            message: data.error || "Action failed",
          });
        }
      } catch (err) {
        setActionResult({
          type: "error",
          message: err instanceof Error ? err.message : "Network error",
        });
      } finally {
        setActing(false);
      }
    },
    [deployment, refreshStatus]
  );

  const upgradeVm = useCallback(async () => {
    if (!deployment) return;
    setUpgrading(true);
    setUpgradeResult(null);
    try {
      const res = await fetch("/api/gcp/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentId: deployment._id }),
      });
      const data = await res.json();
      if (res.ok) {
        setUpgradeResult({
          type: "success",
          message: "Upgrade initiated. VM is restarting with the new version.",
        });
        setTimeout(refreshStatus, 15000);
        setTimeout(refreshStatus, 60000);
      } else {
        setUpgradeResult({
          type: "error",
          message: data.error || "Upgrade failed",
        });
      }
    } catch (err) {
      setUpgradeResult({
        type: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setUpgrading(false);
    }
  }, [deployment, refreshStatus]);

  const startEditBranding = useCallback(() => {
    if (!deployment) return;
    setBotName(deployment.branding.botName);
    setPersonality(deployment.branding.personality);
    setEditingBranding(true);
  }, [deployment]);

  const saveBranding = useCallback(async () => {
    if (!deployment) return;
    setSavingBranding(true);
    try {
      await updateBranding({
        id: deployment._id,
        botName,
        personality,
      });
      setEditingBranding(false);
      setBrandingSaved(true);
    } finally {
      setSavingBranding(false);
    }
  }, [deployment, botName, personality, updateBranding]);

  const startEditModels = useCallback(() => {
    if (!deployment) return;
    setPrimaryModel(deployment.models.primary);
    setFallbacks([...deployment.models.fallbacks]);
    setEditingModels(true);
  }, [deployment]);

  const saveModels = useCallback(async () => {
    if (!deployment) return;
    setSavingModels(true);
    try {
      await updateModels({
        id: deployment._id,
        primary: primaryModel,
        fallbacks,
      });
      setEditingModels(false);
      setModelsSaved(true);
    } finally {
      setSavingModels(false);
    }
  }, [deployment, primaryModel, fallbacks, updateModels]);

  const addFallback = useCallback(() => {
    if (newFallback.trim()) {
      setFallbacks((prev) => [...prev, newFallback.trim()]);
      setNewFallback("");
    }
  }, [newFallback]);

  const removeFallback = useCallback((index: number) => {
    setFallbacks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          No deployment to configure.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deployment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <div className="flex items-center gap-2">
              <VmStatusBadge status={deployment.status} />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={refreshStatus}
                disabled={polling}
              >
                <RefreshCw
                  className={`h-3 w-3 ${polling ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bot Name</span>
            <span>{deployment.branding.botName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GCP Project</span>
            <span className="font-mono">{deployment.gcpProjectId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Zone</span>
            <span className="font-mono">{deployment.gcpZone}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">VM Name</span>
            <span className="font-mono">{deployment.vmName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Machine Type</span>
            <span className="font-mono">{deployment.machineType}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Primary Model</span>
            <span className="font-mono">{deployment.models.primary}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Deployed</span>
            <span>
              {new Date(deployment.deployedAt).toLocaleDateString()}
            </span>
          </div>
          {deployment.lastHealthCheck && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Health Check</span>
              <span>
                {new Date(deployment.lastHealthCheck).toLocaleString()}
                {deployment.lastHealthStatus && (
                  <span className="ml-1 text-muted-foreground">
                    ({deployment.lastHealthStatus})
                  </span>
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">OpenClaw Version</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Target Version</span>
            <span className="font-mono">{OPENCLAW_VERSION}</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Upgrades OpenClaw and restarts your VM. Takes ~2 minutes.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={upgrading || deployment.status === "stopped"}
              onClick={upgradeVm}
            >
              <ArrowUpCircle className="mr-1 h-3 w-3" />
              {upgrading ? "Upgrading..." : "Upgrade VM"}
            </Button>
          </div>
          {upgradeResult && (
            <p
              className={`text-sm ${upgradeResult.type === "error" ? "text-destructive" : "text-green-500"}`}
            >
              {upgradeResult.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">VM Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={acting || deployment.status === "running"}
              onClick={() => vmAction("start")}
            >
              <Play className="mr-1 h-3 w-3" />
              Start
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={acting || deployment.status === "stopped"}
              onClick={() => setConfirmAction("stop")}
            >
              <Square className="mr-1 h-3 w-3" />
              Stop
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={acting || deployment.status === "stopped"}
              onClick={() => setConfirmAction("reset")}
            >
              <RotateCw className="mr-1 h-3 w-3" />
              Restart
            </Button>
          </div>

          {actionResult && (
            <p
              className={`text-sm ${actionResult.type === "error" ? "text-destructive" : "text-green-500"}`}
            >
              {actionResult.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bot Identity Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Bot Identity</CardTitle>
          {!editingBranding && (
            <Button variant="outline" size="sm" onClick={startEditBranding}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {brandingSaved && <RestartRequiredBanner />}
          {editingBranding ? (
            <>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Bot Name
                </label>
                <Input
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Personality
                </label>
                <Input
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveBranding}
                  disabled={savingBranding}
                >
                  <Save className="mr-1 h-3 w-3" />
                  {savingBranding ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingBranding(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bot Name</span>
                <span>{deployment.branding.botName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Personality</span>
                <span>{deployment.branding.personality}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Model Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">AI Model</CardTitle>
          {!editingModels && (
            <Button variant="outline" size="sm" onClick={startEditModels}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {modelsSaved && <RestartRequiredBanner />}
          {editingModels ? (
            <>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Primary Model
                </label>
                <Input
                  value={primaryModel}
                  onChange={(e) => setPrimaryModel(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Fallback Models
                </label>
                <div className="space-y-1">
                  {fallbacks.map((fb, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="flex-1 rounded border px-2 py-1 font-mono text-sm">
                        {fb}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => removeFallback(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-1">
                    <Input
                      value={newFallback}
                      onChange={(e) => setNewFallback(e.target.value)}
                      placeholder="Add fallback model..."
                      className="text-sm"
                      onKeyDown={(e) => e.key === "Enter" && addFallback()}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addFallback}
                      disabled={!newFallback.trim()}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveModels}
                  disabled={savingModels}
                >
                  <Save className="mr-1 h-3 w-3" />
                  {savingModels ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingModels(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Primary</span>
                <span className="font-mono">{deployment.models.primary}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fallbacks</span>
                <span className="font-mono">
                  {deployment.models.fallbacks.length > 0
                    ? deployment.models.fallbacks.join(", ")
                    : "None"}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete deployment</p>
              <p className="text-xs text-muted-foreground">
                Deletes the GCP VM, Cloud NAT router, and removes the
                deployment record from the dashboard.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmAction("delete")}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm{" "}
              {confirmAction === "stop"
                ? "Stop"
                : confirmAction === "delete"
                  ? "Delete"
                  : "Restart"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "stop"
                ? "Stopping the VM will take your AI teammate offline. You can start it again later."
                : confirmAction === "delete"
                  ? "This will delete the GCP VM, Cloud NAT router, and remove the deployment record. You can redeploy afterward."
                  : "Restarting the VM will briefly take your AI teammate offline while it reboots."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={
                confirmAction === "stop" || confirmAction === "delete"
                  ? "destructive"
                  : "default"
              }
              onClick={async () => {
                if (confirmAction === "delete" && deployment) {
                  setDeleting(true);
                  try {
                    const res = await fetch("/api/gcp/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        deploymentId: deployment._id,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data.error || "Delete failed");
                    }
                    setConfirmAction(null);
                    router.push("/deploy");
                  } catch (err) {
                    setActionResult({
                      type: "error",
                      message:
                        err instanceof Error ? err.message : "Delete failed",
                    });
                    setConfirmAction(null);
                  } finally {
                    setDeleting(false);
                  }
                } else if (confirmAction) {
                  vmAction(confirmAction as "stop" | "reset");
                }
              }}
              disabled={acting || deleting}
            >
              {deleting
                ? "Deleting..."
                : acting
                  ? "Processing..."
                  : `Yes, ${confirmAction}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

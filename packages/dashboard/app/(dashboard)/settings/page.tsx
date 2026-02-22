"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Play, Square, RotateCw, RefreshCw, AlertTriangle, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];
  const router = useRouter();
  const updateStatus = useMutation(api.deployments.updateStatus);
  const removeDeployment = useMutation(api.deployments.remove);
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
            project: deployment.gcpProjectId,
            zone: deployment.gcpZone,
            vm: deployment.vmName,
            action,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setActionResult({
            type: "success",
            message: `VM ${action} initiated successfully.`,
          });
          // Poll status after a delay to let GCP process
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

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete deployment record</p>
              <p className="text-xs text-muted-foreground">
                Removes this deployment from the dashboard. Does not delete the
                GCP VM.
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
                  ? "This will remove the deployment record from your dashboard. You can redeploy afterward."
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
                    await removeDeployment({ id: deployment._id });
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

"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCw, AlertTriangle } from "lucide-react";
import { useState, useCallback } from "react";
import { maskApiKey } from "@/lib/formatters";
import type { Id } from "@convex/_generated/dataModel";

interface ApiKey {
  _id: Id<"apiKeyRegistry">;
  secretName: string;
  maskedValue: string;
  rotatedAt?: number;
  deploymentId: Id<"deployments">;
}

export default function ApiKeysPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];
  const keys = useQuery(
    api.apiKeyRegistry.listByDeployment,
    deployment ? { deploymentId: deployment._id } : "skip"
  );
  const markRotated = useMutation(api.apiKeyRegistry.markRotated);

  const [rotatingKey, setRotatingKey] = useState<ApiKey | null>(null);
  const [newValue, setNewValue] = useState("");
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRotate = useCallback(async () => {
    if (!rotatingKey || !deployment || !newValue.trim()) return;
    setRotating(true);
    setError(null);
    try {
      // Update the secret in GCP Secret Manager
      const res = await fetch("/api/gcp/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: deployment.gcpProjectId,
          secretName: rotatingKey.secretName,
          value: newValue.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update secret");
      }

      // Update the registry in Convex with new masked value
      await markRotated({
        id: rotatingKey._id,
        maskedValue: maskApiKey(newValue.trim()),
      });

      // Offer to restart VM so it picks up the new key
      setRotatingKey(null);
      setNewValue("");
      setRestartPrompt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rotation failed");
    } finally {
      setRotating(false);
    }
  }, [rotatingKey, deployment, newValue, markRotated]);

  const [restartPrompt, setRestartPrompt] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const handleRestart = useCallback(async () => {
    if (!deployment) return;
    setRestarting(true);
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
    } finally {
      setRestarting(false);
      setRestartPrompt(false);
    }
  }, [deployment]);

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Deploy your teammate first to manage API keys.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">API Keys</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Registered Secrets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(keys?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No API keys registered.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Secret Name</th>
                  <th className="pb-2 font-medium">Value</th>
                  <th className="pb-2 font-medium">Last Rotated</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys?.map((key: ApiKey) => (
                  <tr key={key._id} className="border-b border-border/50">
                    <td className="py-3 font-mono text-sm">
                      {key.secretName}
                    </td>
                    <td className="py-3 font-mono text-sm text-muted-foreground">
                      {key.maskedValue}
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {key.rotatedAt
                        ? new Date(key.rotatedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRotatingKey(key);
                          setNewValue("");
                          setError(null);
                        }}
                      >
                        <RotateCw className="mr-1 h-3 w-3" />
                        Rotate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Rotate key dialog */}
      <Dialog
        open={rotatingKey !== null}
        onOpenChange={(open) => !open && setRotatingKey(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate API Key</DialogTitle>
            <DialogDescription>
              Enter the new value for{" "}
              <code className="font-mono text-xs">
                {rotatingKey?.secretName}
              </code>
              . This will update the secret in GCP Secret Manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-key-value">New Value</Label>
            <Input
              id="new-key-value"
              type="password"
              placeholder="Enter new API key..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRotatingKey(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRotate}
              disabled={rotating || !newValue.trim()}
            >
              {rotating ? "Rotating..." : "Rotate Secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restart prompt after rotation */}
      <Dialog
        open={restartPrompt}
        onOpenChange={(open) => !open && setRestartPrompt(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Restart VM?
            </DialogTitle>
            <DialogDescription>
              The API key has been rotated in GCP Secret Manager. Restart the VM
              so your AI teammate picks up the new key?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestartPrompt(false)}
            >
              Skip
            </Button>
            <Button onClick={handleRestart} disabled={restarting}>
              {restarting ? "Restarting..." : "Restart VM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

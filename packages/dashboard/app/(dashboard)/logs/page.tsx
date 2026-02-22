"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { LogViewer } from "@/components/log-viewer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LogsPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!deployment) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/gcp/logs?project=${deployment.gcpProjectId}&zone=${deployment.gcpZone}&vm=${deployment.vmName}`
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data.output ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [deployment]);

  // Initial fetch
  useEffect(() => {
    if (deployment) fetchLogs();
  }, [deployment?._id, fetchLogs]);

  // Auto-refresh polling
  useEffect(() => {
    if (autoRefresh && deployment) {
      intervalRef.current = setInterval(fetchLogs, 10000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, deployment, fetchLogs]);

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Logs</h1>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-sm text-muted-foreground">
          Deploy your teammate first to view logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Logs</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <LogViewer logs={logs} />
    </div>
  );
}

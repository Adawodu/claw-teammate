"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

interface Deployment {
  _id: Id<"deployments">;
  gcpProjectId: string;
  gcpZone: string;
  vmName: string;
  status: string;
}

/**
 * Polls GCP VM status every `intervalMs` and syncs to Convex.
 * Only polls when the user has a deployment and the page is visible.
 */
export function useHealthPoll(
  deployment: Deployment | undefined,
  intervalMs = 60_000
) {
  const updateStatus = useMutation(api.deployments.updateStatus);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!deployment) return;

    async function check() {
      if (!deployment) return;
      try {
        const res = await fetch(
          `/api/gcp/status?project=${deployment.gcpProjectId}&zone=${deployment.gcpZone}&vm=${deployment.vmName}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const gcpStatus = data.status?.toLowerCase();
        if (!gcpStatus) return;

        let mappedStatus = deployment.status;
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
      } catch {
        // Silently ignore — next poll will retry
      }
    }

    // Initial check
    check();

    intervalRef.current = setInterval(check, intervalMs);

    // Pause when tab is hidden, resume when visible
    function onVisibility() {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        check();
        intervalRef.current = setInterval(check, intervalMs);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [deployment?._id, intervalMs, updateStatus]);
}

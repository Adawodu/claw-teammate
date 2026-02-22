"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  Circle,
  Loader2,
  AlertCircle,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Milestone {
  id: string;
  label: string;
  marker: string;
}

const MILESTONES: Milestone[] = [
  { id: "deps", label: "Installing system packages", marker: "Installing dependencies" },
  { id: "node", label: "Installing Node.js 22", marker: "Installing Node 22" },
  { id: "openclaw", label: "Installing OpenClaw", marker: "Installing OpenClaw" },
  { id: "secrets", label: "Fetching API keys", marker: "Fetching secrets" },
  { id: "config", label: "Configuring Telegram bot", marker: "Configuring OpenClaw" },
  { id: "plugins", label: "Installing plugins", marker: "Installing plugins" },
  { id: "skills", label: "Installing skills", marker: "Installing skills" },
  { id: "started", label: "Bot is live on Telegram!", marker: "OpenClaw gateway started" },
];

type StepStatus = "pending" | "active" | "done" | "error";

export default function DeployProgressPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];

  const [logs, setLogs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!deployment) return;
    try {
      const params = new URLSearchParams({
        project: deployment.gcpProjectId,
        zone: deployment.gcpZone,
        vm: deployment.vmName,
      });
      const res = await fetch(`/api/gcp/logs?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to fetch logs");
        return;
      }
      const data = await res.json();
      setLogs(data.output || "");

      if (data.output?.includes('Script "startup-script" failed')) {
        setScriptFailed(true);
      }
    } catch {
      setError("Network error fetching logs");
    }
  }, [deployment]);

  // Poll every 5 seconds
  useEffect(() => {
    if (!deployment) return;
    fetchLogs();
    intervalRef.current = setInterval(fetchLogs, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deployment, fetchLogs]);

  // Stop polling once complete or failed
  const isComplete = logs.includes("OpenClaw gateway started");
  useEffect(() => {
    if ((isComplete || scriptFailed) && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isComplete, scriptFailed]);

  // Determine step statuses
  function getStepStatuses(): StepStatus[] {
    if (!logs) return MILESTONES.map(() => "pending");

    const statuses: StepStatus[] = [];
    let lastFoundIdx = -1;

    for (let i = 0; i < MILESTONES.length; i++) {
      if (logs.includes(MILESTONES[i].marker)) {
        lastFoundIdx = i;
      }
    }

    for (let i = 0; i < MILESTONES.length; i++) {
      if (i < lastFoundIdx) {
        statuses.push("done");
      } else if (i === lastFoundIdx) {
        // Check if next milestone is also found (meaning this one is done)
        const nextFound =
          i + 1 < MILESTONES.length && logs.includes(MILESTONES[i + 1].marker);
        if (nextFound || MILESTONES[i].id === "started") {
          statuses.push("done");
        } else if (scriptFailed) {
          statuses.push("error");
        } else {
          statuses.push("active");
        }
      } else {
        if (scriptFailed && i === lastFoundIdx + 1) {
          statuses.push("error");
        } else {
          statuses.push("pending");
        }
      }
    }

    return statuses;
  }

  // Loading
  if (deployments === undefined) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <h1 className="text-2xl font-bold">No deployment found</h1>
        <p className="text-sm text-muted-foreground">
          Deploy your AI teammate first.
        </p>
        <Button asChild>
          <Link href="/deploy">Go to Deploy</Link>
        </Button>
      </div>
    );
  }

  const statuses = getStepStatuses();

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          {isComplete
            ? "Your bot is ready!"
            : scriptFailed
              ? "Setup encountered an error"
              : "Setting up your AI teammate..."}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isComplete
            ? "Open Telegram and message your bot to get started."
            : scriptFailed
              ? "The startup script failed. Check the logs for details."
              : "This usually takes 2-3 minutes. You can stay on this page or come back later."}
        </p>
      </div>

      <Card>
        <CardContent className="py-6">
          <ol className="space-y-4">
            {MILESTONES.map((milestone, i) => {
              const status = statuses[i];
              return (
                <li key={milestone.id} className="flex items-start gap-3">
                  <StepIcon status={status} />
                  <span
                    className={cn(
                      "text-sm leading-6",
                      status === "done" && "text-muted-foreground",
                      status === "active" && "font-medium",
                      status === "error" && "text-destructive font-medium",
                      status === "pending" && "text-muted-foreground/60"
                    )}
                  >
                    {milestone.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {isComplete && (
        <div className="space-y-3">
          <Button asChild className="w-full" size="lg">
            <Link href="/">
              <MessageCircle className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Open Telegram and search for your bot to start chatting.
          </p>
        </div>
      )}

      {scriptFailed && (
        <div className="space-y-3">
          <Button asChild variant="outline" className="w-full">
            <Link href="/logs">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Full Logs
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/settings">Retry from Settings</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "done":
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20">
          <Check className="h-3.5 w-3.5 text-green-600" />
        </div>
      );
    case "active":
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      );
    case "error":
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/20">
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        </div>
      );
    default:
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center">
          <Circle className="h-3 w-3 text-muted-foreground/40" />
        </div>
      );
  }
}

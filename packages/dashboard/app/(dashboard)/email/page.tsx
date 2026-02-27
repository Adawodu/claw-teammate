"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import { EmailDraftsTable } from "@/components/email-drafts-table";

interface Draft {
  id: string;
  subject: string;
  to: string;
  date: string;
}

export default function EmailPage() {
  const deployments = useQuery(api.deployments.list);
  const deployment = deployments?.[0];
  const pluginConfigs = useQuery(
    api.pluginConfigs.listByDeployment,
    deployment ? { deploymentId: deployment._id } : "skip"
  );
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPluginEnabled = (pluginConfigs ?? []).some(
    (p: { pluginId: string; enabled: boolean }) =>
      p.pluginId === "dynosist" && p.enabled
  );

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/drafts");
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setDrafts(data.drafts);
      }
    } catch {
      setError("Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

  if (deployments === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Email</h1>
        <Skeleton className="h-32" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Email</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Mail className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Deploy your AI teammate first to use the email assistant.
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
      <div>
        <h1 className="text-2xl font-bold">Email</h1>
        <p className="text-sm text-muted-foreground">
          DynoSist email assistant — Gmail drafts created via Telegram.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            DynoSist Plugin
          </CardTitle>
          <Badge variant={isPluginEnabled ? "default" : "secondary"}>
            {isPluginEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </CardHeader>
        <CardContent>
          {isPluginEnabled ? (
            <p className="text-sm text-muted-foreground">
              DynoSist is active. Use Telegram to compose email drafts with
              attachments.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enable the DynoSist plugin to start drafting emails.{" "}
              <Link href="/plugins" className="text-primary hover:underline">
                Go to Plugins
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Gmail Drafts</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={loadDrafts}
            disabled={loading}
            className="gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {drafts === null && !error && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Click Refresh to load your Gmail drafts.
          </p>
        )}

        {drafts !== null && <EmailDraftsTable drafts={drafts} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Send a message to your AI teammate on Telegram asking it to draft
            an email. For example:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>&quot;Draft an email to john@example.com about the project update&quot;</li>
            <li>&quot;Create a draft with the latest report attached&quot;</li>
            <li>&quot;List my current Gmail drafts&quot;</li>
          </ul>
          <p>
            DynoSist creates drafts in your Gmail — you review and send them
            yourself.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { getGcpTokenForProject } from "@/lib/gcp-auth";
import { setInstanceMetadata, resetInstance } from "@/lib/gcp-rest";
import { generateWebStartupScript } from "@/lib/startup-script";
import { getLatestOpenClawVersion } from "@/lib/openclaw-versions";

export async function POST(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const body = await req.json();
  const { deploymentId } = body as { deploymentId?: string };
  // Optional: caller can override the desired version for this update.
  // Empty string / null means "track latest from npm".
  const requestedVersion =
    typeof body?.version === "string" && body.version.trim() !== ""
      ? body.version.trim()
      : body?.version === null
        ? null
        : undefined;
  if (!deploymentId) {
    return NextResponse.json(
      { error: "deploymentId is required" },
      { status: 400 }
    );
  }

  // Get Convex token to fetch deployment
  const managedAuth = await getGcpTokenForProject("dynoclaw-managed");
  const userAuth = await getGcpTokenForProject("");
  const convexToken = managedAuth?.convexToken ?? userAuth?.convexToken ?? null;

  if (convexToken) {
    convex.setAuth(convexToken);
  }

  // Fetch deployment
  const deployment = await convex.query(api.deployments.get, {
    id: deploymentId as Id<"deployments">,
  });
  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 }
    );
  }

  // Get the right GCP token for this deployment's project
  const gcpAuth = await getGcpTokenForProject(deployment.gcpProjectId);
  if (!gcpAuth) {
    return NextResponse.json(
      { error: "Cannot access GCP project." },
      { status: 400 }
    );
  }

  // Fetch current plugin + skill configs
  const pluginConfigs = await convex.query(api.pluginConfigs.listByDeployment, {
    deploymentId: deploymentId as Id<"deployments">,
  });
  const skillConfigs = await convex.query(api.skillConfigs.listByDeployment, {
    deploymentId: deploymentId as Id<"deployments">,
  });

  const enabledPlugins = (pluginConfigs ?? [])
    .filter((p: { enabled: boolean }) => p.enabled)
    .map((p: { pluginId: string }) => p.pluginId);
  const enabledSkills = (skillConfigs ?? [])
    .filter((s: { enabled: boolean }) => s.enabled)
    .map((s: { skillId: string }) => s.skillId);

  try {
    // Resolve which openclaw version to bake into the startup script.
    // Precedence: request body override > deployment.desiredOpenClawVersion > latest npm.
    const pinnedFromDeployment = (deployment as Record<string, unknown>)
      .desiredOpenClawVersion as string | undefined;
    let resolvedVersion: string;
    if (requestedVersion === null) {
      resolvedVersion = await getLatestOpenClawVersion();
    } else if (typeof requestedVersion === "string") {
      resolvedVersion = requestedVersion;
    } else if (pinnedFromDeployment) {
      resolvedVersion = pinnedFromDeployment;
    } else {
      resolvedVersion = await getLatestOpenClawVersion();
    }

    // Persist the user-driven choice (only when the caller passed an explicit value).
    if (requestedVersion !== undefined) {
      await convex.mutation(api.deployments.updateDesiredVersion, {
        id: deploymentId as Id<"deployments">,
        version: requestedVersion,
      });
    }

    const startupScript = generateWebStartupScript({
      gcpProjectId: deployment.gcpProjectId,
      apiKeys: {},
      branding: deployment.branding,
      models: deployment.models,
      enabledPlugins,
      enabledSkills,
      securityMode: (deployment as Record<string, unknown>).securityMode as "secured" | "full-power" | undefined,
      openClawVersion: resolvedVersion,
    });

    await setInstanceMetadata(
      gcpAuth.gcpToken,
      deployment.gcpProjectId,
      deployment.gcpZone,
      deployment.vmName,
      [{ key: "startup-script", value: startupScript }]
    );

    await resetInstance(
      gcpAuth.gcpToken,
      deployment.gcpProjectId,
      deployment.gcpZone,
      deployment.vmName
    );

    return NextResponse.json({ success: true, version: resolvedVersion });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // setInstanceMetadata throws "Instance <name> not found" when the VM has
    // been deleted out from under the deployment record. Flag the record so the
    // UI can offer to remove or redeploy instead of failing the same way again.
    if (/Instance .* not found/i.test(message)) {
      try {
        await convex.mutation(api.deployments.updateStatus, {
          id: deploymentId as Id<"deployments">,
          status: "missing",
          error: `VM ${deployment.vmName} no longer exists in GCP project ${deployment.gcpProjectId}.`,
          lastHealthCheck: Date.now(),
          lastHealthStatus: "missing",
        });
      } catch {
        // Best-effort flag; surface the original error regardless.
      }
      return NextResponse.json(
        {
          error: `VM ${deployment.vmName} no longer exists in GCP. Remove this deployment from the dashboard or redeploy a new VM.`,
          code: "vm_missing",
          vmName: deployment.vmName,
          gcpProjectId: deployment.gcpProjectId,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

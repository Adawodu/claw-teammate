import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { getGcpToken } from "@/lib/gcp-auth";
import { setInstanceMetadata, resetInstance } from "@/lib/gcp-rest";
import { generateWebStartupScript } from "@/lib/startup-script";

export async function POST(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const authResult = await getGcpToken();
  if (!authResult) {
    return NextResponse.json(
      { error: "Google account not connected." },
      { status: 400 }
    );
  }
  const { gcpToken, convexToken } = authResult;

  const { deploymentId } = await req.json();
  if (!deploymentId) {
    return NextResponse.json(
      { error: "deploymentId is required" },
      { status: 400 }
    );
  }

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
    // Regenerate startup script with current config
    const startupScript = generateWebStartupScript({
      gcpProjectId: deployment.gcpProjectId,
      apiKeys: {}, // Raw values aren't stored — fetch_secret() handles retrieval on boot
      branding: deployment.branding,
      models: deployment.models,
      enabledPlugins,
      enabledSkills,
    });

    // Update VM metadata with new startup script
    await setInstanceMetadata(
      gcpToken,
      deployment.gcpProjectId,
      deployment.gcpZone,
      deployment.vmName,
      [{ key: "startup-script", value: startupScript }]
    );

    // Reboot VM so new startup script runs
    await resetInstance(
      gcpToken,
      deployment.gcpProjectId,
      deployment.gcpZone,
      deployment.vmName
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

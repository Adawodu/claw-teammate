import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { getGcpToken } from "@/lib/gcp-auth";
import {
  enableApi,
  getProjectNumber,
  createServiceAccount,
  grantRole,
  createSecret,
  createFirewallRule,
  ensureCloudNat,
  createInstance,
} from "@/lib/gcp-rest";
import { maskApiKey } from "@/lib/formatters";
import { generateWebStartupScript } from "@/lib/startup-script";

export async function POST(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const authResult = await getGcpToken();
  if (!authResult) {
    return NextResponse.json(
      {
        error:
          "Google account not connected. Sign in with Google or connect it in your profile to enable GCP deployment.",
      },
      { status: 400 }
    );
  }
  const { gcpToken, convexToken } = authResult;

  const body = await req.json();
  const {
    gcpProjectId,
    gcpZone,
    vmName,
    machineType,
    branding,
    models,
    plugins,
    skills,
    apiKeys,
  } = body;

  try {
    // 1. Enable APIs
    await enableApi(gcpToken, gcpProjectId, "compute.googleapis.com");
    await enableApi(gcpToken, gcpProjectId, "secretmanager.googleapis.com");

    // 2. Service account — grant secret access to both custom SA and default compute SA
    const { email: saEmail } = await createServiceAccount(
      gcpToken,
      gcpProjectId,
      "openclaw-sa",
      "OpenClaw SA"
    );
    await grantRole(
      gcpToken,
      gcpProjectId,
      saEmail,
      "roles/secretmanager.secretAccessor"
    );
    // Also grant to default compute SA in case GCP can't assign the custom one
    const projectNumber = await getProjectNumber(gcpToken, gcpProjectId);
    if (projectNumber) {
      const defaultSa = `${projectNumber}-compute@developer.gserviceaccount.com`;
      await grantRole(
        gcpToken,
        gcpProjectId,
        defaultSa,
        "roles/secretmanager.secretAccessor"
      );
    }

    // 3. Store secrets
    for (const [secretName, value] of Object.entries(apiKeys)) {
      if (value) {
        await createSecret(gcpToken, gcpProjectId, secretName, value as string);
      }
    }

    // 4. Firewall rules
    await createFirewallRule(gcpToken, gcpProjectId, {
      name: "allow-iap-ssh",
      direction: "INGRESS",
      priority: 1000,
      allowed: [{ IPProtocol: "tcp", ports: ["22"] }],
      sourceRanges: ["35.235.240.0/20"],
      targetTags: ["openclaw"],
    });
    await createFirewallRule(gcpToken, gcpProjectId, {
      name: "deny-all-ingress",
      direction: "INGRESS",
      priority: 2000,
      denied: [{ IPProtocol: "all" }],
      sourceRanges: ["0.0.0.0/0"],
      targetTags: ["openclaw"],
    });

    // 5. Cloud NAT (allows VM without external IP to reach internet)
    const gcpRegion = gcpZone.replace(/-[a-z]$/, "");
    await ensureCloudNat(gcpToken, gcpProjectId, gcpRegion);

    // 6. Generate startup script with plugin download
    const enabledPlugins = Object.entries(plugins)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const enabledSkills = Object.entries(skills)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const startupScript = generateWebStartupScript({
      gcpProjectId,
      apiKeys,
      branding,
      models,
      enabledPlugins,
      enabledSkills,
    });

    // 7. Create VM
    const vmResult = await createInstance(gcpToken, gcpProjectId, gcpZone, {
      name: vmName,
      machineType,
      serviceAccountEmail: saEmail,
      startupScript,
    });

    // 8. Save deployment record to Convex
    let convexWarning: string | undefined;

    if (!convexToken) {
      convexWarning =
        "Could not get Convex auth token. Make sure the 'convex' JWT template exists in Clerk. Dashboard data will not appear until this is fixed.";
      console.warn(convexWarning);
    }

    if (convexToken) {
      convex.setAuth(convexToken);

      try {
        const deploymentId = await convex.mutation(api.deployments.create, {
          gcpProjectId,
          gcpZone,
          vmName,
          machineType,
          branding: {
            botName: branding.botName,
            personality: branding.personality,
          },
          models: {
            primary: models.primary,
            fallbacks: models.fallbacks,
          },
        });

        // Register API keys in Convex
        for (const [secretName, value] of Object.entries(apiKeys)) {
          if (value) {
            await convex.mutation(api.apiKeyRegistry.register, {
              deploymentId,
              secretName,
              maskedValue: maskApiKey(value as string),
            });
          }
        }

        // Save plugin configs
        for (const [pluginId, enabled] of Object.entries(plugins)) {
          await convex.mutation(api.pluginConfigs.set, {
            deploymentId,
            pluginId,
            enabled: enabled as boolean,
          });
        }

        // Save skill configs
        for (const [skillId, enabled] of Object.entries(skills)) {
          await convex.mutation(api.skillConfigs.set, {
            deploymentId,
              skillId,
            enabled: enabled as boolean,
          });
        }
      } catch (convexErr) {
        const msg =
          convexErr instanceof Error ? convexErr.message : String(convexErr);
        convexWarning = `VM created but failed to save to dashboard: ${msg}`;
        console.error("Failed to save deployment to Convex:", convexErr);
      }
    }

    return NextResponse.json({
      success: true,
      vmStatus: vmResult,
      ...(convexWarning && { warning: convexWarning }),
    });
  } catch (error: unknown) {
    console.error("Deploy error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



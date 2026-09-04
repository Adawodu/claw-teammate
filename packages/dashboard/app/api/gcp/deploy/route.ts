import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { getGcpToken, getManagedGcpToken } from "@/lib/gcp-auth";
import {
  enableApi,
  createServiceAccount,
  createSecret,
  createFirewallRule,
  ensureCloudNat,
  createInstance,
} from "@/lib/gcp-rest";
import { maskApiKey } from "@/lib/formatters";
import { generateWebStartupScript } from "@/lib/startup-script";
import { getLatestOpenClawVersion } from "@/lib/openclaw-versions";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const body = await req.json();
  const {
    gcpZone,
    vmName,
    machineType,
    branding,
    models,
    plugins,
    skills,
    apiKeys,
  } = body;

  const isManaged = body.gcpProjectId === "__managed__" || body.hostingType === "managed";
  const gcpProjectId = isManaged ? "dynoclaw-managed" : body.gcpProjectId;

  let gcpToken: string;
  let convexToken: string | null = null;

  if (isManaged) {
    // Managed hosting — use DynoClaw's service account
    const managedToken = await getManagedGcpToken();
    if (!managedToken) {
      return NextResponse.json(
        { error: "Managed hosting is temporarily unavailable. Please try again later." },
        { status: 500 }
      );
    }
    gcpToken = managedToken;

    // Get Convex token from Clerk (no Google OAuth needed)
    const { getToken } = await auth();
    try {
      convexToken = await getToken({ template: "convex" });
    } catch {
      // Convex JWT template may not exist
    }
  } else {
    // Self-hosted — use user's Google OAuth token
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
    gcpToken = authResult.gcpToken;
    convexToken = authResult.convexToken;
  }

  // For managed deploys, create a readable VM name from the bot name + short unique suffix.
  // GCP VM names: lowercase letters, numbers, hyphens only, max 63 chars, must start with letter.
  const sanitize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const suffix = Date.now().toString(36).slice(-6);
  const finalVmName = isManaged
    ? `oc-${sanitize(branding.botName || "agent")}-${suffix}`
    : vmName;

  try {
    // 1. Enable APIs (skip for managed — pre-enabled)
    if (!isManaged) {
      await enableApi(gcpToken, gcpProjectId, "compute.googleapis.com");
      await enableApi(gcpToken, gcpProjectId, "secretmanager.googleapis.com");
    }

    // 2-5: Infrastructure setup.
    // For managed: SA is pre-created; firewall + NAT need to be ensured idempotently
    //   because they can drift (someone cleans up GCP, region migrations, etc.)
    // For self-hosted: create everything from scratch.
    let saEmail: string;
    if (isManaged) {
      saEmail = `openclaw-sa@${gcpProjectId}.iam.gserviceaccount.com`;

      // Store secrets namespaced per VM (so multiple customers don't overwrite each other)
      // Secret name format: <vmname>--<secretname> e.g. "openclaw-vm-abc123--google-ai-api-key"
      // Labels make secrets identifiable in Secret Manager console
      const secretLabels = {
        "dynoclaw-vm": finalVmName.replace(/[^a-z0-9_-]/g, "_"),
        "managed-by": "dynoclaw",
        "created": new Date().toISOString().split("T")[0].replace(/-/g, ""),
      };
      for (const [secretName, value] of Object.entries(apiKeys)) {
        if (value) {
          const namespacedSecret = `${finalVmName}--${secretName}`;
          await createSecret(gcpToken, gcpProjectId, namespacedSecret, value as string, secretLabels);
        }
      }

      // Ensure firewall rules exist (idempotent — createFirewallRule ignores 409 conflict)
      await createFirewallRule(gcpToken, gcpProjectId, {
        name: "allow-iap-ssh",
        direction: "INGRESS",
        priority: 1000,
        allowed: [{ IPProtocol: "tcp", ports: ["22"] }],
        sourceRanges: ["35.235.240.0/20"],
        targetTags: ["openclaw"],
      });
      await createFirewallRule(gcpToken, gcpProjectId, {
        name: "allow-iap-dashboard",
        direction: "INGRESS",
        priority: 1001,
        allowed: [{ IPProtocol: "tcp", ports: ["18789"] }],
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

      // Ensure Cloud NAT exists for outbound internet (no external IP on VMs)
      // CRITICAL: without this, apt install, secret fetches, and model API calls all fail
      const gcpRegion = gcpZone.replace(/-[a-z]$/, "");
      await ensureCloudNat(gcpToken, gcpProjectId, gcpRegion);
    } else {
      // 2. Create service account
      try {
        const sa = await createServiceAccount(
          gcpToken,
          gcpProjectId,
          "openclaw-sa",
          "OpenClaw SA"
        );
        saEmail = sa.email;
      } catch (saErr) {
        saEmail = `openclaw-sa@${gcpProjectId}.iam.gserviceaccount.com`;
        console.warn("SA creation failed (may already exist):", saErr);
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
      // IAP tunnel to OpenClaw dashboard (port 18789) for DynoClaw proxy access
      await createFirewallRule(gcpToken, gcpProjectId, {
        name: "allow-iap-dashboard",
        direction: "INGRESS",
        priority: 1001,
        allowed: [{ IPProtocol: "tcp", ports: ["18789"] }],
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

      // 5. Cloud NAT
      const gcpRegion = gcpZone.replace(/-[a-z]$/, "");
      await ensureCloudNat(gcpToken, gcpProjectId, gcpRegion);
    }

    // 6. Generate startup script
    const enabledPlugins = Object.entries(plugins)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const enabledSkills = Object.entries(skills)
      .filter(([, v]) => v)
      .map(([k]) => k);

    // Pinned version from request, else fall back to latest npm stable.
    const requestedVersion =
      typeof body.openClawVersion === "string" && body.openClawVersion.trim() !== ""
        ? body.openClawVersion.trim()
        : null;
    const openClawVersion = requestedVersion ?? (await getLatestOpenClawVersion());

    const startupScript = generateWebStartupScript({
      gcpProjectId,
      apiKeys,
      branding,
      models,
      enabledPlugins,
      enabledSkills,
      securityMode: body.securityMode ?? "secured",
      telegramUserId: body.telegramUserId ?? "",
      openClawVersion,
    });

    // 7. Create VM
    const vmResult = await createInstance(gcpToken, gcpProjectId, gcpZone, {
      name: finalVmName,
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
          vmName: finalVmName,
          machineType,
          branding: {
            botName: branding.botName,
            personality: branding.personality,
          },
          models: {
            primary: models.primary,
            fallbacks: models.fallbacks,
          },
          securityMode: body.securityMode ?? "secured",
          telegramUserId: body.telegramUserId ?? "",
          // Only persist a pin if the user explicitly chose one. Empty/null
          // leaves the field unset, meaning "track latest" on subsequent updates.
          ...(requestedVersion ? { desiredOpenClawVersion: requestedVersion } : {}),
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
    console.error("Deploy error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { getGcpToken } from "@/lib/gcp-auth";
import { deleteInstance, deleteRouter } from "@/lib/gcp-rest";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  const authResult = await getGcpToken();
  if (!authResult) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
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

  // Fetch deployment record from Convex to get GCP details
  const deployment = await convex.query(api.deployments.get, {
    id: deploymentId as Id<"deployments">,
  });
  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 }
    );
  }

  const { gcpProjectId, gcpZone, vmName } = deployment;
  const gcpRegion = gcpZone.replace(/-[a-z]$/, "");
  const errors: string[] = [];

  // GCP teardown — best-effort, collect errors
  try {
    await deleteInstance(gcpToken, gcpProjectId, gcpZone, vmName);
  } catch (err) {
    errors.push(
      `Instance: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    await deleteRouter(gcpToken, gcpProjectId, gcpRegion, "openclaw-router");
  } catch (err) {
    errors.push(
      `Router: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Always attempt Convex cleanup so the user isn't stuck with a phantom record
  try {
    if (convexToken) {
      convex.setAuth(convexToken);
    }
    await convex.mutation(api.deployments.remove, {
      id: deploymentId as Id<"deployments">,
    });
  } catch (err) {
    errors.push(
      `Convex: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (errors.length > 0) {
    return NextResponse.json({
      success: true,
      warnings: errors,
    });
  }

  return NextResponse.json({ success: true });
}

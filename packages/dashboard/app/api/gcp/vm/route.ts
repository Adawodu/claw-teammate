import { NextRequest, NextResponse } from "next/server";
import { getGcpToken } from "@/lib/gcp-auth";
import { startInstance, stopInstance, resetInstance } from "@/lib/gcp-rest";

export async function POST(req: NextRequest) {
  const authResult = await getGcpToken();
  if (!authResult) {
    return NextResponse.json(
      { error: "Google account not connected." },
      { status: 400 }
    );
  }
  const { gcpToken } = authResult;

  const { project, zone, vm, action } = await req.json();

  try {
    switch (action) {
      case "start":
        await startInstance(gcpToken, project, zone, vm);
        break;
      case "stop":
        await stopInstance(gcpToken, project, zone, vm);
        break;
      case "reset":
        await resetInstance(gcpToken, project, zone, vm);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

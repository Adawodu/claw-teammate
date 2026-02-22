import { NextRequest, NextResponse } from "next/server";
import { getGcpToken } from "@/lib/gcp-auth";
import { getSerialPortOutput } from "@/lib/gcp-rest";

export async function GET(req: NextRequest) {
  const authResult = await getGcpToken();
  if (!authResult) {
    return NextResponse.json(
      { error: "Google account not connected." },
      { status: 400 }
    );
  }
  const { gcpToken } = authResult;

  const { searchParams } = new URL(req.url);
  const project = searchParams.get("project");
  const zone = searchParams.get("zone");
  const vm = searchParams.get("vm");

  if (!project || !zone || !vm) {
    return NextResponse.json(
      { error: "Missing project, zone, or vm" },
      { status: 400 }
    );
  }

  try {
    const output = await getSerialPortOutput(gcpToken, project, zone, vm);
    return NextResponse.json({ output });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

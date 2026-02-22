import { NextRequest, NextResponse } from "next/server";
import { getGcpToken } from "@/lib/gcp-auth";
import { createSecret } from "@/lib/gcp-rest";

export async function POST(req: NextRequest) {
  const authResult = await getGcpToken();
  if (!authResult) {
    return NextResponse.json(
      { error: "Google account not connected." },
      { status: 400 }
    );
  }
  const { gcpToken } = authResult;

  const { project, secretName, value } = await req.json();

  try {
    await createSecret(gcpToken, project, secretName, value);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

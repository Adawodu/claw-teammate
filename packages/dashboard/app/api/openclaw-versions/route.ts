import { NextResponse } from "next/server";
import { getRecentOpenClawVersions } from "@/lib/openclaw-versions";

export const revalidate = 300;

export async function GET() {
  try {
    const data = await getRecentOpenClawVersions();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

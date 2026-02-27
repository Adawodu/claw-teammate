import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { getGcpToken } from "@/lib/gcp-auth";

const SM_BASE = "https://secretmanager.googleapis.com/v1";

async function fetchSecret(
  token: string,
  project: string,
  secretId: string
): Promise<string | null> {
  const res = await fetch(
    `${SM_BASE}/projects/${project}/secrets/${secretId}/versions/latest:access`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.payload?.data) return null;
  return Buffer.from(data.payload.data, "base64").toString("utf-8");
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to exchange refresh token for access token");
  }
  const data = await res.json();
  return data.access_token;
}

interface GmailDraft {
  id: string;
  subject: string;
  to: string;
  date: string;
}

export async function GET() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const authResult = await getGcpToken();
  if (!authResult) {
    return NextResponse.json(
      { error: "Google account not connected." },
      { status: 400 }
    );
  }
  const { gcpToken, convexToken } = authResult;

  if (convexToken) {
    convex.setAuth(convexToken);
  }

  // Get user's deployment to find GCP project
  const deployments = await convex.query(api.deployments.list, {});
  const deployment = deployments?.[0];
  if (!deployment) {
    return NextResponse.json(
      { error: "No deployment found" },
      { status: 404 }
    );
  }

  try {
    // Fetch Gmail OAuth creds from GCP Secret Manager
    const [clientId, clientSecret, refreshToken] = await Promise.all([
      fetchSecret(gcpToken, deployment.gcpProjectId, "drive-oauth-client-id"),
      fetchSecret(gcpToken, deployment.gcpProjectId, "drive-oauth-client-secret"),
      fetchSecret(gcpToken, deployment.gcpProjectId, "gmail-oauth-refresh-token"),
    ]);

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        { error: "Gmail OAuth credentials not configured. Enable the DynoSist plugin and deploy." },
        { status: 400 }
      );
    }

    // Exchange refresh token for access token
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // List drafts
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=20",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
      throw new Error("Failed to list Gmail drafts");
    }
    const listData = await listRes.json();

    if (!listData.drafts || listData.drafts.length === 0) {
      return NextResponse.json({ drafts: [] });
    }

    // Fetch metadata for each draft
    const drafts: GmailDraft[] = await Promise.all(
      listData.drafts.map(async (d: { id: string }) => {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${d.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return { id: d.id, subject: "(unknown)", to: "", date: "" };
        const detail = await res.json();
        const headers = detail.message?.payload?.headers ?? [];
        const get = (name: string) =>
          headers.find((h: { name: string }) => h.name === name)?.value ?? "";
        return {
          id: d.id,
          subject: get("Subject") || "(no subject)",
          to: get("To"),
          date: get("Date"),
        };
      })
    );

    return NextResponse.json({ drafts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

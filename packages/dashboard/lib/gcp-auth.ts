import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * Get the current user's Google OAuth access token and Convex JWT from Clerk.
 * Clerk auto-refreshes expired tokens using the stored refresh token.
 */
export async function getGcpToken(): Promise<{
  userId: string;
  gcpToken: string;
  convexToken: string | null;
} | null> {
  const { userId, getToken } = await auth();
  if (!userId) return null;

  try {
    const client = await clerkClient();
    const response = await client.users.getUserOauthAccessToken(
      userId,
      "google"
    );

    if (!response.data || response.data.length === 0) {
      return null;
    }

    // Also get the Convex JWT for server-side mutations
    let convexToken: string | null = null;
    try {
      convexToken = await getToken({ template: "convex" });
    } catch {
      // Convex JWT template may not exist
    }

    return { userId, gcpToken: response.data[0].token, convexToken };
  } catch (err) {
    console.error("Failed to get Google OAuth token:", err);
    return null;
  }
}

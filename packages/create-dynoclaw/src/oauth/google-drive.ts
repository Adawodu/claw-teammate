import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { openUrl } from "../utils/browser.js";

const OAUTH_PORT = 9876;
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`;
const SCOPES = "https://www.googleapis.com/auth/drive.file";

interface OAuthTokens {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export async function googleDriveOAuthFlow(): Promise<OAuthTokens | null> {
  console.log(chalk.bold("\n  Google Drive OAuth Setup (optional)\n"));
  console.log(
    chalk.dim(
      "  Enables persistent media storage for generated images/videos.\n",
    ),
  );

  const wantDrive = await confirm({
    message: "Set up Google Drive for media storage?",
    default: false,
  });

  if (!wantDrive) return null;

  console.log(chalk.dim("\n  You need an OAuth2 client from Google Cloud Console."));
  console.log(chalk.dim("  1. Go to APIs & Services > Credentials"));
  console.log(chalk.dim("  2. Create an OAuth 2.0 Client ID (Desktop app)"));
  console.log(chalk.dim(`  3. Add ${REDIRECT_URI} as a redirect URI\n`));

  const shouldOpen = await confirm({
    message: "Open Google Cloud Console?",
    default: true,
  });

  if (shouldOpen) {
    await openUrl("https://console.cloud.google.com/apis/credentials");
  }

  const clientId = await input({
    message: "OAuth Client ID:",
    validate: (v) => (v.trim() ? true : "Required"),
  });

  const clientSecret = await input({
    message: "OAuth Client Secret:",
    validate: (v) => (v.trim() ? true : "Required"),
  });

  // Build auth URL
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId.trim());
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  console.log(chalk.dim("\n  Opening browser for Google authorization...\n"));

  // Start local server to capture the callback
  const code = await captureAuthCode(authUrl.toString());

  if (!code) {
    console.log(chalk.red("  Failed to capture authorization code"));
    return null;
  }

  // Exchange code for refresh token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    console.log(chalk.red("  Failed to exchange code for tokens"));
    return null;
  }

  const tokens = (await tokenResponse.json()) as { refresh_token?: string };

  if (!tokens.refresh_token) {
    console.log(chalk.red("  No refresh token received — try revoking access and retrying"));
    return null;
  }

  console.log(chalk.green("  ✓ Google Drive OAuth configured\n"));

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    refreshToken: tokens.refresh_token,
  };
}

function captureAuthCode(authUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://localhost:${OAUTH_PORT}`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Authorization Failed</h1><p>You can close this tab.</p>");
          server.close();
          resolve(null);
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h1>Authorization Successful!</h1><p>You can close this tab and return to the terminal.</p>",
        );
        server.close();
        resolve(code);
      }
    });

    server.listen(OAUTH_PORT, () => {
      openUrl(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      resolve(null);
    }, 5 * 60 * 1000);
  });
}

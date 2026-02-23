const COMPUTE_BASE = "https://compute.googleapis.com/compute/v1";
const SM_BASE = "https://secretmanager.googleapis.com/v1";
const SU_BASE = "https://serviceusage.googleapis.com/v1";
const IAM_BASE = "https://iam.googleapis.com/v1";
const CRM_BASE = "https://cloudresourcemanager.googleapis.com/v1";

async function gcpFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res;
}

/** Extract a human-readable error message from a GCP API error response. */
async function gcpError(res: Response, context: string): Promise<string> {
  try {
    const body = await res.json();
    const msg =
      body?.error?.message || body?.error?.status || JSON.stringify(body.error);
    return `${context}: ${msg}`;
  } catch {
    return `${context}: ${res.status} ${res.statusText}`;
  }
}

// ── Project Info ────────────────────────────────────────────────

export async function getProjectNumber(
  token: string,
  project: string
): Promise<string | null> {
  try {
    const res = await gcpFetch(
      `${CRM_BASE}/projects/${project}`,
      token
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.projectNumber ?? null;
  } catch {
    return null;
  }
}

// ── Service Usage ───────────────────────────────────────────────

export async function enableApi(
  token: string,
  project: string,
  api: string
): Promise<void> {
  const res = await gcpFetch(
    `${SU_BASE}/projects/${project}/services/${api}:enable`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
  if (!res.ok) {
    throw new Error(await gcpError(res, `Failed to enable API ${api}`));
  }
}

// ── IAM ─────────────────────────────────────────────────────────

export async function createServiceAccount(
  token: string,
  project: string,
  accountId: string,
  displayName: string
): Promise<{ email: string }> {
  const res = await gcpFetch(
    `${IAM_BASE}/projects/${project}/serviceAccounts`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ accountId, serviceAccount: { displayName } }),
    }
  );
  if (res.status === 409) {
    // Already exists
    return { email: `${accountId}@${project}.iam.gserviceaccount.com` };
  }
  const data = await res.json();
  return { email: data.email };
}

export async function grantRole(
  token: string,
  project: string,
  saEmail: string,
  role: string
): Promise<void> {
  // Get current policy
  const getRes = await gcpFetch(
    `${CRM_BASE}/projects/${project}:getIamPolicy`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
  const policy = await getRes.json();

  // Add binding if not present
  const binding = policy.bindings?.find((b: { role: string }) => b.role === role);
  const member = `serviceAccount:${saEmail}`;
  if (binding) {
    if (!binding.members.includes(member)) {
      binding.members.push(member);
    }
  } else {
    policy.bindings = policy.bindings ?? [];
    policy.bindings.push({ role, members: [member] });
  }

  await gcpFetch(
    `${CRM_BASE}/projects/${project}:setIamPolicy`,
    token,
    { method: "POST", body: JSON.stringify({ policy }) }
  );
}

// ── Secret Manager ──────────────────────────────────────────────

export async function createSecret(
  token: string,
  project: string,
  secretId: string,
  value: string
): Promise<void> {
  // Create secret (ignore 409 = already exists)
  const createRes = await gcpFetch(
    `${SM_BASE}/projects/${project}/secrets?secretId=${secretId}`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        replication: { automatic: {} },
      }),
    }
  );
  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(await gcpError(createRes, `Failed to create secret ${secretId}`));
  }

  // Add version with value
  const payload = Buffer.from(value).toString("base64");
  await gcpFetch(
    `${SM_BASE}/projects/${project}/secrets/${secretId}:addVersion`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ payload: { data: payload } }),
    }
  );
}

// ── Cloud Router + NAT ─────────────────────────────────────────

export async function ensureCloudNat(
  token: string,
  project: string,
  region: string
): Promise<void> {
  const routerName = "openclaw-router";
  const natName = "openclaw-nat";

  // 1. Create Cloud Router (ignore 409 = already exists)
  const routerRes = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/regions/${region}/routers`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        name: routerName,
        network: `projects/${project}/global/networks/default`,
      }),
    }
  );
  if (!routerRes.ok && routerRes.status !== 409) {
    throw new Error(await gcpError(routerRes, "Failed to create Cloud Router"));
  }

  // Wait for router operation to complete if just created
  if (routerRes.ok) {
    await waitForRegionOperation(token, project, region, routerRes);
  }

  // 2. Check if NAT already configured on the router
  const getRes = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/regions/${region}/routers/${routerName}`,
    token
  );
  if (!getRes.ok) {
    throw new Error(await gcpError(getRes, "Failed to get Cloud Router"));
  }
  const router = await getRes.json();

  const hasNat = router.nats?.some(
    (n: { name: string }) => n.name === natName
  );
  if (hasNat) return;

  // 3. Patch router to add NAT config
  router.nats = router.nats ?? [];
  router.nats.push({
    name: natName,
    natIpAllocateOption: "AUTO_ONLY",
    sourceSubnetworkIpRangesToNat: "ALL_SUBNETWORKS_ALL_IP_RANGES",
  });

  const patchRes = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/regions/${region}/routers/${routerName}`,
    token,
    { method: "PATCH", body: JSON.stringify(router) }
  );
  if (!patchRes.ok) {
    throw new Error(await gcpError(patchRes, "Failed to configure Cloud NAT"));
  }
}

async function waitForRegionOperation(
  token: string,
  project: string,
  region: string,
  opResponse: Response
): Promise<void> {
  try {
    const op = await opResponse.json();
    if (!op.name) return;
    const opUrl = `${COMPUTE_BASE}/projects/${project}/regions/${region}/operations/${op.name}`;
    for (let i = 0; i < 30; i++) {
      const poll = await gcpFetch(`${opUrl}`, token);
      const data = await poll.json();
      if (data.status === "DONE") return;
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch {
    // Best-effort wait
  }
}

// ── Compute: Firewall ───────────────────────────────────────────

export async function createFirewallRule(
  token: string,
  project: string,
  rule: {
    name: string;
    direction: string;
    priority: number;
    allowed?: { IPProtocol: string; ports?: string[] }[];
    denied?: { IPProtocol: string }[];
    sourceRanges: string[];
    targetTags: string[];
  }
): Promise<void> {
  const res = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/global/firewalls`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        name: rule.name,
        direction: rule.direction,
        priority: rule.priority,
        allowed: rule.allowed,
        denied: rule.denied,
        sourceRanges: rule.sourceRanges,
        targetTags: rule.targetTags,
        network: `projects/${project}/global/networks/default`,
      }),
    }
  );
  // 409 = already exists — that's fine
  if (!res.ok && res.status !== 409) {
    throw new Error(await gcpError(res, `Failed to create firewall rule ${rule.name}`));
  }
}

// ── Compute: Instance ───────────────────────────────────────────

export async function createInstance(
  token: string,
  project: string,
  zone: string,
  config: {
    name: string;
    machineType: string;
    serviceAccountEmail: string;
    startupScript: string;
  }
): Promise<"created" | "exists"> {
  const res = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/zones/${zone}/instances`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        name: config.name,
        machineType: `zones/${zone}/machineTypes/${config.machineType}`,
        disks: [
          {
            initializeParams: {
              sourceImage: "projects/debian-cloud/global/images/family/debian-12",
            },
            boot: true,
            autoDelete: true,
          },
        ],
        networkInterfaces: [{ network: "global/networks/default" }],
        serviceAccounts: [
          {
            email: config.serviceAccountEmail,
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
          },
        ],
        tags: { items: ["openclaw"] },
        metadata: {
          items: [
            { key: "startup-script", value: config.startupScript },
          ],
        },
      }),
    }
  );
  if (res.status === 409) {
    return "exists";
  }
  if (!res.ok) {
    throw new Error(await gcpError(res, "Failed to create instance"));
  }
  return "created";
}

export async function getInstance(
  token: string,
  project: string,
  zone: string,
  name: string
): Promise<{ status: string; [key: string]: unknown } | null> {
  const res = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/zones/${zone}/instances/${name}`,
    token
  );
  if (res.status === 404) return null;
  return res.json();
}

export async function startInstance(
  token: string,
  project: string,
  zone: string,
  name: string
): Promise<void> {
  await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/zones/${zone}/instances/${name}/start`,
    token,
    { method: "POST" }
  );
}

export async function stopInstance(
  token: string,
  project: string,
  zone: string,
  name: string
): Promise<void> {
  await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/zones/${zone}/instances/${name}/stop`,
    token,
    { method: "POST" }
  );
}

export async function resetInstance(
  token: string,
  project: string,
  zone: string,
  name: string
): Promise<void> {
  await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/zones/${zone}/instances/${name}/reset`,
    token,
    { method: "POST" }
  );
}

export async function deleteInstance(
  token: string,
  project: string,
  zone: string,
  name: string
): Promise<void> {
  const res = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/zones/${zone}/instances/${name}`,
    token,
    { method: "DELETE" }
  );
  if (res.status === 404) return; // Already gone
  if (!res.ok) {
    throw new Error(await gcpError(res, "Failed to delete instance"));
  }
}

export async function deleteRouter(
  token: string,
  project: string,
  region: string,
  name: string
): Promise<void> {
  const res = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/regions/${region}/routers/${name}`,
    token,
    { method: "DELETE" }
  );
  if (res.status === 404) return; // Already gone
  if (!res.ok) {
    throw new Error(await gcpError(res, "Failed to delete router"));
  }
}

export async function getSerialPortOutput(
  token: string,
  project: string,
  zone: string,
  name: string
): Promise<string> {
  const res = await gcpFetch(
    `${COMPUTE_BASE}/projects/${project}/zones/${zone}/instances/${name}/serialPort`,
    token
  );
  if (!res.ok) return "";
  const data = await res.json();
  return data.contents ?? "";
}

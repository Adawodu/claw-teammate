import { Type } from "@sinclair/typebox";

/**
 * Mission Control plugin — gives the agent tools to write to the
 * cross-context cockpit (Convex `missionControl:*` functions) and ships
 * the canvas (served at /canvas/mission-control/).
 *
 * Driver's-seat contract: side-effecting work (publish, send, CRM write)
 * is NOT done directly — the agent PROPOSES it via mc_propose_action and
 * waits for the user's approval, then executes approved items.
 */

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}
const errOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

const missionControlPlugin = {
  id: "mission-control",
  name: "Mission Control",
  description:
    "Cross-context cockpit: workspaces, a task board, and a human-approval action queue (Convex-backed).",
  configSchema: {
    type: "object" as const,
    properties: { convexUrl: { type: "string" as const } },
    required: ["convexUrl"],
  },
  register(pluginApi: any) {
    const convexUrl: string | undefined = pluginApi.pluginConfig?.convexUrl;
    if (!convexUrl) {
      pluginApi.logger?.warn?.("mission-control: convexUrl not configured");
      return;
    }
    const agent: string | undefined = pluginApi.agentName ?? pluginApi.agent?.name;

    // Convex HTTP API (no SDK dependency in plugins).
    async function call(kind: "query" | "mutation", path: string, args: Record<string, any>) {
      const res = await fetch(`${convexUrl}/api/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, args, format: "json" }),
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.errorMessage || `${path} failed`);
      return data.value;
    }
    const q = (p: string, a: Record<string, any> = {}) => call("query", p, a);
    const m = (p: string, a: Record<string, any> = {}) => call("mutation", p, a);

    async function wsId(slug: string): Promise<string> {
      const ws = await q("missionControl:getWorkspaceBySlug", { slug });
      if (!ws) throw new Error(`No workspace with slug "${slug}". Call mc_workspaces for valid slugs.`);
      return ws._id;
    }

    pluginApi.registerTool({
      name: "mc_workspaces",
      label: "Mission Control: Workspaces",
      description:
        "List Mission Control workspaces (slug, name, kind). Call this first to learn valid workspace slugs.",
      parameters: Type.Object({}),
      async execute() {
        try {
          const ws = await q("missionControl:listWorkspaces");
          return json(ws.map((w: any) => ({ slug: w.slug, name: w.name, kind: w.kind })));
        } catch (e) {
          return json({ error: errOf(e) });
        }
      },
    });

    pluginApi.registerTool({
      name: "mc_create_task",
      label: "Mission Control: Create Task",
      description:
        "Add a task to a workspace board so the user can see what you're working on. Use the workspace slug (e.g. 'marketing', 'lead-management').",
      parameters: Type.Object({
        workspace: Type.String({ description: "workspace slug" }),
        title: Type.String(),
        detail: Type.Optional(Type.String()),
        status: Type.Optional(
          Type.String({ description: "backlog | todo | in_progress | blocked | done (default todo)" }),
        ),
        assignedAgent: Type.Optional(Type.String({ description: "agent name, e.g. 'growth' or 'main'" })),
      }),
      async execute(_id: string, p: any) {
        try {
          const id = await m("missionControl:createTask", {
            workspaceId: await wsId(p.workspace),
            title: p.title,
            detail: p.detail,
            status: p.status,
            assignedAgent: p.assignedAgent ?? agent,
            origin: "agent",
          });
          return json({ success: true, taskId: id });
        } catch (e) {
          return json({ error: errOf(e) });
        }
      },
    });

    pluginApi.registerTool({
      name: "mc_update_task",
      label: "Mission Control: Update Task",
      description: "Update a task's status or title (e.g. move it to in_progress or done).",
      parameters: Type.Object({
        taskId: Type.String(),
        status: Type.Optional(
          Type.String({ description: "backlog | todo | in_progress | blocked | done" }),
        ),
        title: Type.Optional(Type.String()),
      }),
      async execute(_id: string, p: any) {
        try {
          await m("missionControl:updateTask", { id: p.taskId, status: p.status, title: p.title });
          return json({ success: true });
        } catch (e) {
          return json({ error: errOf(e) });
        }
      },
    });

    pluginApi.registerTool({
      name: "mc_propose_action",
      label: "Mission Control: Propose Action",
      description:
        "Queue an action that needs the user's approval BEFORE it runs (publish a post, send an email, update CRM, etc.). It appears in the Approvals tab. Do NOT perform the side-effecting action yourself — propose it and wait. Returns state: 'proposed' (awaiting approval) or 'approved' (policy auto-approved).",
      parameters: Type.Object({
        workspace: Type.String({ description: "workspace slug" }),
        type: Type.String({ description: "action type, e.g. post_publish, email_send, crm_update" }),
        summary: Type.String({ description: "human-readable description shown to the user" }),
        payload: Type.Optional(Type.Any({ description: "params needed to execute it later" })),
      }),
      async execute(_id: string, p: any) {
        try {
          const r = await m("missionControl:proposeAction", {
            workspaceId: await wsId(p.workspace),
            type: p.type,
            summary: p.summary,
            payload: p.payload,
            proposedByAgent: agent,
          });
          return json({ success: true, ...r });
        } catch (e) {
          return json({ error: errOf(e) });
        }
      },
    });

    pluginApi.registerTool({
      name: "mc_log_activity",
      label: "Mission Control: Log Activity",
      description:
        "Post a short note to a workspace's Activity feed so the user can follow your reasoning/progress. kind: message | tool | reasoning | system.",
      parameters: Type.Object({
        workspace: Type.String({ description: "workspace slug" }),
        kind: Type.String({ description: "message | tool | reasoning | system" }),
        text: Type.String(),
      }),
      async execute(_id: string, p: any) {
        try {
          await m("missionControl:logActivity", {
            workspaceId: await wsId(p.workspace),
            kind: p.kind,
            text: p.text,
            agent,
          });
          return json({ success: true });
        } catch (e) {
          return json({ error: errOf(e) });
        }
      },
    });

    pluginApi.registerTool({
      name: "mc_approved_actions",
      label: "Mission Control: Approved Actions",
      description:
        "List actions the user has APPROVED and that await execution. Call this to find work cleared to run, execute each, then mark it with mc_complete_action or mc_fail_action.",
      parameters: Type.Object({}),
      async execute() {
        try {
          const a = await q("missionControl:approvedActions");
          return json(
            a.map((x: any) => ({
              actionId: x._id,
              type: x.type,
              summary: x.summary,
              payload: x.payload ?? null,
            })),
          );
        } catch (e) {
          return json({ error: errOf(e) });
        }
      },
    });

    pluginApi.registerTool({
      name: "mc_complete_action",
      label: "Mission Control: Complete Action",
      description: "Mark an approved action as done after you executed it.",
      parameters: Type.Object({ actionId: Type.String(), result: Type.Optional(Type.Any()) }),
      async execute(_id: string, p: any) {
        try {
          await m("missionControl:completeAction", { id: p.actionId, result: p.result });
          return json({ success: true });
        } catch (e) {
          return json({ error: errOf(e) });
        }
      },
    });

    pluginApi.registerTool({
      name: "mc_fail_action",
      label: "Mission Control: Fail Action",
      description: "Mark an approved action as failed if you couldn't execute it.",
      parameters: Type.Object({ actionId: Type.String(), error: Type.String() }),
      async execute(_id: string, p: any) {
        try {
          await m("missionControl:failAction", { id: p.actionId, error: p.error });
          return json({ success: true });
        } catch (e) {
          return json({ error: errOf(e) });
        }
      },
    });
  },
};

export default missionControlPlugin;

import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

export async function requireUser(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

export async function optionalUser(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

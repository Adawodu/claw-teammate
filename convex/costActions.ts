"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";

const GCP_ESTIMATE_MO = 12.23;

export const fetchAndStoreCosts = action({
  args: {},
  handler: async (ctx) => {
    const errors: string[] = [];
    let openrouterBalance = 0;
    let openrouterUsed30d = 0;
    let openaiCostToday = 0;
    let openaiCostMtd = 0;

    // --- OpenRouter Credits (retained for cost monitoring even though models moved to direct APIs) ---
    const orMgmtKey = process.env.OPENROUTER_MGMT_KEY;
    if (orMgmtKey) {
      try {
        const creditsRes = await fetch(
          "https://openrouter.ai/api/v1/credits",
          { headers: { Authorization: `Bearer ${orMgmtKey}` } }
        );
        if (creditsRes.ok) {
          const credits = await creditsRes.json();
          openrouterBalance = credits.data?.total_credits ?? 0;
        } else {
          errors.push(`OpenRouter credits: ${creditsRes.status}`);
        }
      } catch (e: any) {
        errors.push(`OpenRouter credits: ${e.message}`);
      }

      // --- OpenRouter Activity (30 days) ---
      try {
        const activityRes = await fetch(
          "https://openrouter.ai/api/v1/activity",
          { headers: { Authorization: `Bearer ${orMgmtKey}` } }
        );
        if (activityRes.ok) {
          const activity = await activityRes.json();
          const items: any[] = activity.data ?? [];

          for (const item of items) {
            const usageUsd =
              (item.usage ?? 0) +
              (item.byok_usage_inference ?? 0);
            openrouterUsed30d += usageUsd;

            await ctx.runMutation(api.costs.upsertActivity, {
              date: item.date ?? new Date().toISOString().split("T")[0],
              model: item.model ?? "unknown",
              usageUsd,
              requests: item.requests ?? 0,
              promptTokens: item.prompt_tokens ?? 0,
              completionTokens: item.completion_tokens ?? 0,
              reasoningTokens: item.reasoning_tokens ?? 0,
            });
          }
        } else {
          errors.push(`OpenRouter activity: ${activityRes.status}`);
        }
      } catch (e: any) {
        errors.push(`OpenRouter activity: ${e.message}`);
      }
    } else {
      errors.push("OPENROUTER_MGMT_KEY not set");
    }

    // --- OpenAI Costs (requires Admin API key, separate from project key) ---
    const openaiAdminKey = process.env.OPENAI_ADMIN_KEY;
    if (openaiAdminKey) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const startOfToday = now - (now % 86400);
        const d = new Date();
        const startOfMonth = Math.floor(
          new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000
        );

        // Today's cost (end_time must be > start_time by at least 1 bucket)
        const endOfToday = startOfToday + 86400;
        const todayRes = await fetch(
          `https://api.openai.com/v1/organization/costs?start_time=${startOfToday}&end_time=${endOfToday}&bucket_width=1d`,
          {
            headers: {
              Authorization: `Bearer ${openaiAdminKey}`,
            },
          }
        );
        if (todayRes.ok) {
          const todayData = await todayRes.json();
          openaiCostToday = sumOpenAICosts(todayData);
        } else {
          errors.push(`OpenAI today: ${todayRes.status}`);
        }

        // Month-to-date cost
        const mtdRes = await fetch(
          `https://api.openai.com/v1/organization/costs?start_time=${startOfMonth}&end_time=${now}&bucket_width=1d`,
          {
            headers: {
              Authorization: `Bearer ${openaiAdminKey}`,
            },
          }
        );
        if (mtdRes.ok) {
          const mtdData = await mtdRes.json();
          openaiCostMtd = sumOpenAICosts(mtdData);
        } else {
          errors.push(`OpenAI MTD: ${mtdRes.status}`);
        }
      } catch (e: any) {
        errors.push(`OpenAI: ${e.message}`);
      }
    } else {
      errors.push("OPENAI_ADMIN_KEY not set");
    }

    // --- Store Snapshot ---
    await ctx.runMutation(api.costs.storeSnapshot, {
      fetchedAt: Date.now(),
      openrouterBalance,
      openrouterUsed30d,
      openaiCostToday,
      openaiCostMtd,
      gcpEstimateMo: GCP_ESTIMATE_MO,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });

    return { success: true, errors };
  },
});

function sumOpenAICosts(data: any): number {
  // OpenAI costs API returns { data: [{ results: [{ amount: { value (cents) } }] }] }
  let totalCents = 0;
  const buckets = data?.data ?? [];
  for (const bucket of buckets) {
    const results = bucket?.results ?? [];
    for (const r of results) {
      totalCents += r?.amount?.value ?? 0;
    }
  }
  return totalCents / 100;
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertStaff } from "@/lib/admin.functions";
import { buildScorecard } from "@/lib/launch-metrics";

/**
 * Instrumentation for the two-week launch test. Both writes are idempotent and
 * fire-and-forget from the app shell: a failed ping must never break the UI.
 */

const AttributionInput = z.object({
  source: z.string().trim().min(2).max(40),
  campaign: z.string().trim().max(40).nullish(),
  referrer: z.string().trim().max(40).nullish(),
});

/** Remembers which outreach message brought this person. Written once, ever. */
export const recordAttribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AttributionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("user_attribution")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { ok: true, recorded: false };

    const { error } = await supabase
      .from("user_attribution")
      .insert({ user_id: userId, source: data.source, campaign: data.campaign ?? null, referrer: data.referrer ?? null });
    if (error) throw new Error(error.message);
    return { ok: true, recorded: true };
  });

/** One row per calendar day the person opens the app. */
export const recordVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const visitedOn = new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase
      .from("user_visits")
      .upsert(
        { user_id: context.userId, visited_on: visitedOn },
        { onConflict: "user_id,visited_on", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The test verdict, computed from real rows. Staff only. */
export const getLaunchScorecard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, bills, visits, attributions, roles] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 }),
      supabaseAdmin.from("bills").select("user_id"),
      supabaseAdmin.from("user_visits").select("user_id, visited_on"),
      supabaseAdmin.from("user_attribution").select("user_id, source, campaign"),
      supabaseAdmin.from("user_roles").select("user_id"),
    ]);

    return buildScorecard(
      (users.data?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? "—",
        createdAt: u.created_at ?? "",
      })),
      (bills.data ?? []).map((b) => ({ user_id: b.user_id as string })),
      (visits.data ?? []).map((v) => ({
        user_id: v.user_id as string,
        visited_on: String(v.visited_on).slice(0, 10),
      })),
      (attributions.data ?? []).map((a) => ({
        user_id: a.user_id as string,
        source: a.source as string,
        campaign: (a.campaign as string | null) ?? null,
      })),
      (roles.data ?? []).map((r) => r.user_id as string),
      new Date(),
    );
  });

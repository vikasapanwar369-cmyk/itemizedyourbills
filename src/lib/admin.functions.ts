import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertStaff(supabase: SupabaseClient<any, any, any>, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("admin") && !roles.includes("support")) {
    throw new Error("Forbidden: staff access only");
  }
  return roles;
}

/** Tells the UI whether the signed-in person is staff (drives menu visibility). */
export const getMyStaffRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { roles, isStaff: roles.includes("admin") || roles.includes("support") };
  });

/** Platform-wide health numbers for support staff. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [bills, items, households, bills7, bills30, users] = await Promise.all([
      supabaseAdmin.from("bills").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("items").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("households").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("bills").select("id", { count: "exact", head: true }).gte("created_at", since7),
      supabaseAdmin.from("bills").select("user_id").gte("created_at", since30),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const activeUsers30 = new Set((bills30.data ?? []).map((b) => b.user_id as string)).size;
    const allUsers = users.data?.users ?? [];

    return {
      roles,
      totals: {
        users: allUsers.length,
        bills: bills.count ?? 0,
        items: items.count ?? 0,
        households: households.count ?? 0,
        billsLast7Days: bills7.count ?? 0,
        activeUsers30,
      },
      recentSignups: allUsers
        .slice()
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 8)
        .map((u) => ({
          id: u.id,
          email: u.email ?? "—",
          createdAt: u.created_at ?? "",
          confirmed: Boolean(u.email_confirmed_at),
          lastSignInAt: u.last_sign_in_at ?? null,
        })),
    };
  });

/** Support lookup: find an account by email and see usage volume (no bill contents). */
export const lookupUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = (list?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );
    if (!user) return { found: false as const };

    const [bills, items, member] = await Promise.all([
      supabaseAdmin.from("bills").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseAdmin.from("items").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseAdmin.from("household_members").select("household_id, role").eq("user_id", user.id).maybeSingle(),
    ]);

    return {
      found: true as const,
      user: {
        id: user.id,
        email: user.email ?? "—",
        createdAt: user.created_at ?? "",
        confirmed: Boolean(user.email_confirmed_at),
        lastSignInAt: user.last_sign_in_at ?? null,
      },
      usage: {
        bills: bills.count ?? 0,
        items: items.count ?? 0,
        inHousehold: Boolean(member.data?.household_id),
        householdRole: (member.data?.role as string | null) ?? null,
      },
    };
  });
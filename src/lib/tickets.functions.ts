import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertStaff } from "@/lib/admin.functions";

/**
 * Money and privacy complaints jump the queue; everything else waits in order.
 * Kept here rather than in the database so the routing rule can change without
 * a migration.
 */
export const PRIORITY_TOPICS = ["billing", "data & privacy", "bug report"] as const;

export function isPriorityTopic(topic: string | null | undefined): boolean {
  return PRIORITY_TOPICS.includes((topic ?? "").trim().toLowerCase() as (typeof PRIORITY_TOPICS)[number]);
}

const TicketInput = z.object({
  id: z.string().uuid(),
  reply: z.string().trim().min(3).max(4000),
  status: z.enum(["open", "resolved"]),
});

/**
 * Staff queue of messages sent from the Help screen. Without this the tickets
 * are written to the database and never shown to anyone.
 */
export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [tickets, roles, users] = await Promise.all([
      supabaseAdmin
        .from("support_tickets")
        .select("id, user_id, subject, message, topic, status, staff_reply, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin.from("user_roles").select("user_id"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 }),
    ]);
    if (tickets.error) throw new Error(tickets.error.message);

    const emailById = new Map(
      (users.data?.users ?? []).map((u) => [u.id, u.email ?? "—"] as const),
    );
    const staffIds = new Set((roles.data ?? []).map((r) => r.user_id as string));

    const rows = (tickets.data ?? []).map((t) => ({
      ...t,
      email: emailById.get(t.user_id as string) ?? "deleted account",
      priority: isPriorityTopic(t.topic as string),
      fromStaff: staffIds.has(t.user_id as string),
    }));

    // Priority first, then oldest waiting — so nothing falls off the bottom.
    rows.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return String(a.created_at).localeCompare(String(b.created_at));
    });

    return rows;
  });

/** Records the answer and the status change in one write, staff only. */
export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TicketInput.parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("support_tickets")
      .update({ staff_reply: data.reply, status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

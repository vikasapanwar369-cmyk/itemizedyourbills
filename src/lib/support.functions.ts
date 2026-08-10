import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, subject, message, topic, status, staff_reply, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subject: string; message: string; topic?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const subject = (data.subject ?? "").trim().slice(0, 140);
    const message = (data.message ?? "").trim().slice(0, 4000);
    const topic = (data.topic ?? "general").trim().slice(0, 40);
    if (subject.length < 3) throw new Error("Please add a short subject");
    if (message.length < 10) throw new Error("Please describe the issue in a bit more detail");
    const { error } = await supabase
      .from("support_tickets")
      .insert({ user_id: userId, subject, message, topic });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

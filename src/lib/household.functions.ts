import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const getHousehold = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mine } = await supabase
      .from("household_members")
      .select("household_id, role, display_name, joined_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!mine?.household_id) return { household: null, members: [], me: null };

    const [{ data: hh }, { data: members }] = await Promise.all([
      supabase.from("households").select("id, name, invite_code, owner_id, created_at").eq("id", mine.household_id).maybeSingle(),
      supabase.from("household_members").select("user_id, role, display_name, joined_at").eq("household_id", mine.household_id).order("joined_at", { ascending: true }),
    ]);
    if (!hh) return { household: null, members: [], me: null };

    return {
      household: {
        id: hh.id,
        name: hh.name,
        inviteCode: hh.invite_code as string,
        isOwner: hh.owner_id === userId,
        createdAt: hh.created_at as string,
      },
      members: (members ?? []).map((m) => ({
        userId: m.user_id as string,
        role: m.role as string,
        name: (m.display_name as string | null) ?? "Member",
        joinedAt: m.joined_at as string,
        isMe: m.user_id === userId,
      })),
      me: { role: mine.role as string, name: (mine.display_name as string | null) ?? "" },
    };
  });

export const createHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      name: z.string().trim().min(1).max(60),
      displayName: z.string().trim().min(1).max(40),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("household_members").select("household_id").eq("user_id", userId).maybeSingle();
    if (existing?.household_id) throw new Error("You are already in a household.");

    let lastError = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      const { data: hh, error } = await supabase
        .from("households")
        .insert({ name: data.name, owner_id: userId, invite_code: code })
        .select("id, invite_code")
        .single();
      if (error) { lastError = error.message; continue; }

      const { error: memErr } = await supabase
        .from("household_members")
        .insert({ household_id: hh.id, user_id: userId, role: "owner", display_name: data.displayName });
      if (memErr) throw new Error(memErr.message);
      return { id: hh.id, inviteCode: hh.invite_code as string };
    }
    throw new Error(lastError || "Could not create household.");
  });

export const joinHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      code: z.string().trim().min(4).max(12),
      displayName: z.string().trim().min(1).max(40),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("household_members").select("household_id").eq("user_id", userId).maybeSingle();
    if (existing?.household_id) throw new Error("Leave your current household first.");

    // Invite-code lookup needs to bypass the members-only read policy.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hh } = await supabaseAdmin
      .from("households")
      .select("id, name")
      .eq("invite_code", data.code.trim().toUpperCase())
      .maybeSingle();
    if (!hh) throw new Error("Invite code not found.");

    const { error } = await supabase
      .from("household_members")
      .insert({ household_id: hh.id, user_id: userId, role: "member", display_name: data.displayName });
    if (error) throw new Error(error.message);
    return { id: hh.id as string, name: hh.name as string };
  });

export const leaveHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("household_members").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("Use Leave household instead.");
    const { error } = await supabase.from("household_members").delete().eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      name: z.string().trim().min(1).max(60).optional(),
      displayName: z.string().trim().min(1).max(40).optional(),
      rotateCode: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: mine } = await supabase
      .from("household_members").select("household_id").eq("user_id", userId).maybeSingle();
    if (!mine?.household_id) throw new Error("You are not in a household.");

    if (data.displayName) {
      const { error } = await supabase
        .from("household_members").update({ display_name: data.displayName }).eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    const patch: { name?: string; invite_code?: string } = {};
    if (data.name) patch.name = data.name;
    if (data.rotateCode) patch.invite_code = makeCode();
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("households").update(patch).eq("id", mine.household_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

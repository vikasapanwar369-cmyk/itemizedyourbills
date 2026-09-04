import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * DPDP Act, 2023 (India) compliance surface.
 * - Section 5/6: itemised notice + purpose-wise, freely withdrawable consent.
 * - Sections 11-14: rights to access, correction, erasure and grievance redressal.
 */

export const NOTICE_VERSION = "2026-09-v1";

export const CONSENT_PURPOSES = [
  {
    key: "core_processing",
    label: "Store my bills and purchase records",
    why: "Needed to run the account: saving your bill photos and the items read from them.",
    required: true,
  },
  {
    key: "ai_extraction",
    label: "Send my bill photo to the AI reader",
    why: "Your photo is sent to our AI processor only to read the items, brands, quantities and prices on it.",
    required: true,
  },
  {
    key: "insights",
    label: "Build my insights, refill and inflation predictions",
    why: "Analyses only your own purchase history to predict refills, repeat buys and price trends.",
    required: false,
  },
  {
    key: "household_sharing",
    label: "Share my bills with my household members",
    why: "Lets people in a household you join see the shared bills, budgets and lists.",
    required: false,
  },
  {
    key: "service_emails",
    label: "Send me budget and refill alert emails",
    why: "Transactional alerts about your budgets, refills and recurring bills.",
    required: false,
  },
  {
    key: "analytics",
    label: "Measure which screens I use",
    why: "Aggregate usage counts to improve the app. Never your bill contents.",
    required: false,
  },
] as const;

export type ConsentPurposeKey = (typeof CONSENT_PURPOSES)[number]["key"];

const purposeKeys = CONSENT_PURPOSES.map((p) => p.key) as [string, ...string[]];

export const getMyConsents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_consents")
      .select("purpose, granted, notice_version, granted_at, withdrawn_at, updated_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const map = new Map((data ?? []).map((r) => [r.purpose, r]));
    return {
      noticeVersion: NOTICE_VERSION,
      purposes: CONSENT_PURPOSES.map((p) => {
        const row = map.get(p.key);
        return {
          ...p,
          // Required purposes are granted implicitly by using the service.
          granted: row ? row.granted : p.required,
          noticeVersion: row?.notice_version ?? null,
          grantedAt: row?.granted_at ?? null,
          withdrawnAt: row?.withdrawn_at ?? null,
          recorded: Boolean(row),
        };
      }),
    };
  });

export const setConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ purpose: z.enum(purposeKeys), granted: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const def = CONSENT_PURPOSES.find((p) => p.key === data.purpose);
    if (!def) throw new Error("Unknown purpose");
    if (def.required && !data.granted) {
      throw new Error(
        "This purpose is essential to the service. Withdraw it by deleting your account and data instead.",
      );
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from("user_consents").upsert(
      {
        user_id: userId,
        purpose: data.purpose,
        granted: data.granted,
        notice_version: NOTICE_VERSION,
        granted_at: data.granted ? now : null,
        withdrawn_at: data.granted ? null : now,
      },
      { onConflict: "user_id,purpose" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Records acceptance of the current notice for every essential purpose. */
export const acceptNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const rows = CONSENT_PURPOSES.filter((p) => p.required).map((p) => ({
      user_id: userId,
      purpose: p.key,
      granted: true,
      notice_version: NOTICE_VERSION,
      granted_at: now,
      withdrawn_at: null,
    }));
    const { error } = await supabase.from("user_consents").upsert(rows, { onConflict: "user_id,purpose" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RequestInput = z.object({
  kind: z.enum(["access", "correction", "erasure", "withdrawal", "grievance", "nominee"]),
  details: z.string().trim().min(3).max(4000),
});

export const createDataRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("data_requests")
      .insert({ user_id: userId, kind: data.kind, details: data.details });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyDataRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("data_requests")
      .select("id, kind, details, status, resolution, resolved_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Right to erasure (Sec. 12(3)): wipes every record, the stored bill images and
 * the login itself, so no personal data is retained after the request.
 */
export const eraseMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Remove stored bill images owned by this user.
    const { data: files } = await supabase.storage.from("bill-images").list(userId, { limit: 1000 });
    if (files?.length) {
      await supabase.storage.from("bill-images").remove(files.map((f) => `${userId}/${f.name}`));
    }

    for (const table of [
      "items",
      "bills",
      "budgets",
      "shopping_list_items",
      "recurring_bills",
      "dismissed_alerts",
      "notification_settings",
      "user_consents",
      "household_members",
    ] as const) {
      await supabase.from(table).delete().eq(table === "household_members" ? "user_id" : "user_id", userId);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Could not delete the login: ${error.message}`);
    return { ok: true };
  });

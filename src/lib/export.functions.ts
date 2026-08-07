import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Full personal backup: every row this user owns, in one JSON payload.
 * RLS keeps the query scoped to the caller (own rows + household reads),
 * and we additionally filter to user_id so a backup is always *your* data.
 */
export const exportAllData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [bills, items, budgets, shopping, recurring] = await Promise.all([
      supabase.from("bills").select("*").eq("user_id", userId).order("bill_date", { ascending: false }),
      supabase.from("items").select("*").eq("user_id", userId).order("bill_date", { ascending: false }),
      supabase.from("budgets").select("*").eq("user_id", userId),
      supabase.from("shopping_list_items").select("*").eq("user_id", userId),
      supabase.from("recurring_bills").select("*").eq("user_id", userId),
    ]);

    return {
      meta: {
        app: "BillSnap",
        version: 1,
        exportedAt: new Date().toISOString(),
        userId,
      },
      counts: {
        bills: bills.data?.length ?? 0,
        items: items.data?.length ?? 0,
        budgets: budgets.data?.length ?? 0,
        shoppingList: shopping.data?.length ?? 0,
        recurringBills: recurring.data?.length ?? 0,
      },
      bills: bills.data ?? [],
      items: items.data ?? [],
      budgets: budgets.data ?? [],
      shoppingList: shopping.data ?? [],
      recurringBills: recurring.data ?? [],
    };
  });

/** Deletes every record this user owns. Auth account itself is untouched. */
export const deleteAllMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    for (const table of ["items", "bills", "budgets", "shopping_list_items", "recurring_bills"] as const) {
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
    }
    return { ok: true };
  });
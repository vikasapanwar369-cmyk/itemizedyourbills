import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns every user id whose data the caller may read: themselves plus
 * anyone in the same household. Server-only helper.
 */
export async function visibleUserIds(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<string[]> {
  const { data: mine } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!mine?.household_id) return [userId];

  const { data: members } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", mine.household_id);

  const ids = new Set<string>([userId]);
  for (const m of members ?? []) ids.add(m.user_id as string);
  return [...ids];
}

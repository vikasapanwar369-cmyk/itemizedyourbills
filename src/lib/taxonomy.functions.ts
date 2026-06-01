import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TaxonomyCategory = {
  id: string;
  key: string;
  label: string;
  emoji: string;
  sort_order: number;
};
export type TaxonomySubcategory = {
  id: string;
  category_id: string;
  category_key: string;
  key: string;
  label: string;
  keywords: string[];
  sort_order: number;
};
export type Taxonomy = {
  categories: TaxonomyCategory[];
  subcategories: TaxonomySubcategory[];
};

/** Public read of the categorization taxonomy. Cached on the client via React Query. */
export const getTaxonomy = createServerFn({ method: "GET" }).handler(async (): Promise<Taxonomy> => {
  const [{ data: cats, error: e1 }, { data: subs, error: e2 }] = await Promise.all([
    supabaseAdmin.from("categories").select("id, key, label, emoji, sort_order").order("sort_order"),
    supabaseAdmin.from("subcategories").select("id, category_id, key, label, keywords, sort_order").order("sort_order"),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const catMap = new Map((cats ?? []).map((c) => [c.id, c.key]));
  const subsOut: TaxonomySubcategory[] = (subs ?? []).map((s) => ({
    id: s.id,
    category_id: s.category_id,
    category_key: catMap.get(s.category_id) ?? "other",
    key: s.key,
    label: s.label,
    keywords: (s.keywords ?? []) as string[],
    sort_order: s.sort_order,
  }));

  return { categories: cats ?? [], subcategories: subsOut };
});
export type CategoryKey =
  | "grocery"
  | "vegetable"
  | "dairy"
  | "hygiene"
  | "household"
  | "medicine"
  | "petrol"
  | "clothes"
  | "electric"
  | "restaurant"
  | "school"
  | "utility"
  | "other";

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  emoji: string;
  /** Tailwind gradient classes for icon background */
  gradient: string;
  /** Chart color (oklch) */
  color: string;
}

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  grocery:    { key: "grocery",    label: "Grocery",     emoji: "🛒", gradient: "from-emerald-500 to-teal-500",   color: "oklch(0.72 0.17 165)" },
  vegetable:  { key: "vegetable",  label: "Vegetables",  emoji: "🥬", gradient: "from-lime-400 to-green-500",     color: "oklch(0.78 0.18 135)" },
  dairy:      { key: "dairy",      label: "Dairy",       emoji: "🥛", gradient: "from-sky-300 to-blue-400",       color: "oklch(0.78 0.10 230)" },
  hygiene:    { key: "hygiene",    label: "Hygiene",     emoji: "🧴", gradient: "from-pink-400 to-rose-500",      color: "oklch(0.7 0.18 0)"   },
  household:  { key: "household",  label: "Household",   emoji: "🧹", gradient: "from-slate-400 to-gray-500",     color: "oklch(0.7 0.03 260)" },
  medicine:   { key: "medicine",   label: "Medicine",    emoji: "💊", gradient: "from-red-500 to-rose-500",       color: "oklch(0.68 0.22 15)" },
  petrol:     { key: "petrol",     label: "Fuel",        emoji: "⛽", gradient: "from-amber-400 to-orange-500",   color: "oklch(0.78 0.17 75)" },
  clothes:    { key: "clothes",    label: "Clothing",    emoji: "👕", gradient: "from-purple-500 to-violet-500",  color: "oklch(0.62 0.25 295)"},
  electric:   { key: "electric",   label: "Electronics", emoji: "🔌", gradient: "from-blue-500 to-cyan-500",      color: "oklch(0.68 0.17 220)"},
  restaurant: { key: "restaurant", label: "Food Out",    emoji: "🍽️", gradient: "from-orange-500 to-amber-500",   color: "oklch(0.74 0.17 55)" },
  school:     { key: "school",     label: "Education",   emoji: "📚", gradient: "from-indigo-500 to-blue-500",    color: "oklch(0.6 0.2 265)"  },
  utility:    { key: "utility",    label: "Bills",       emoji: "💡", gradient: "from-yellow-400 to-amber-500",   color: "oklch(0.82 0.16 90)" },
  other:      { key: "other",      label: "Other",       emoji: "📦", gradient: "from-zinc-500 to-slate-600",     color: "oklch(0.6 0.02 260)" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function getCategory(key: string | null | undefined): CategoryMeta {
  if (!key) return CATEGORIES.other;
  return CATEGORIES[(key as CategoryKey)] ?? CATEGORIES.other;
}
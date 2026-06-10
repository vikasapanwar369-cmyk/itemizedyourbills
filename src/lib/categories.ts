export type CategoryKey =
  | "grocery"
  | "produce"
  | "vegetable"
  | "dairy"
  | "beverages"
  | "snacks"
  | "bakery"
  | "meat"
  | "frozen"
  | "hygiene"
  | "beauty"
  | "household"
  | "baby"
  | "pets"
  | "medicine"
  | "fuel"
  | "petrol"
  | "clothes"
  | "clothing"
  | "footwear"
  | "electronics"
  | "electric"
  | "mobile"
  | "appliances"
  | "home_improvement"
  | "furniture"
  | "restaurant"
  | "utility"
  | "education"
  | "school"
  | "transport"
  | "travel"
  | "entertainment"
  | "sports"
  | "services"
  | "stationery"
  | "toys"
  | "jewelry"
  | "salon"
  | "doctor"
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
  produce:    { key: "produce",    label: "Produce",     emoji: "🥬", gradient: "from-lime-400 to-green-500",     color: "oklch(0.78 0.18 135)" },
  vegetable:  { key: "vegetable",  label: "Vegetables",  emoji: "🥬", gradient: "from-lime-400 to-green-500",     color: "oklch(0.78 0.18 135)" },
  dairy:      { key: "dairy",      label: "Dairy",       emoji: "🥛", gradient: "from-sky-300 to-blue-400",       color: "oklch(0.78 0.10 230)" },
  beverages:  { key: "beverages",  label: "Beverages",   emoji: "🥤", gradient: "from-cyan-400 to-sky-500",       color: "oklch(0.74 0.14 215)" },
  snacks:     { key: "snacks",     label: "Snacks",      emoji: "🍫", gradient: "from-amber-500 to-yellow-600",   color: "oklch(0.7 0.16 70)"  },
  bakery:     { key: "bakery",     label: "Bakery",      emoji: "🥐", gradient: "from-orange-300 to-amber-400",   color: "oklch(0.8 0.14 75)"  },
  meat:       { key: "meat",       label: "Meat",        emoji: "🥩", gradient: "from-red-600 to-rose-700",       color: "oklch(0.55 0.2 20)"  },
  frozen:     { key: "frozen",     label: "Frozen",      emoji: "🧊", gradient: "from-sky-400 to-cyan-500",       color: "oklch(0.78 0.12 225)" },
  hygiene:    { key: "hygiene",    label: "Hygiene",     emoji: "🧴", gradient: "from-pink-400 to-rose-500",      color: "oklch(0.7 0.18 0)"   },
  beauty:     { key: "beauty",     label: "Beauty",      emoji: "💄", gradient: "from-fuchsia-400 to-pink-500",   color: "oklch(0.7 0.2 340)"  },
  household:  { key: "household",  label: "Household",   emoji: "🧹", gradient: "from-slate-400 to-gray-500",     color: "oklch(0.7 0.03 260)" },
  baby:       { key: "baby",       label: "Baby",        emoji: "🍼", gradient: "from-pink-300 to-rose-300",      color: "oklch(0.82 0.1 0)"   },
  pets:       { key: "pets",       label: "Pets",        emoji: "🐾", gradient: "from-amber-400 to-orange-500",   color: "oklch(0.74 0.15 60)" },
  medicine:   { key: "medicine",   label: "Medicine",    emoji: "💊", gradient: "from-red-500 to-rose-500",       color: "oklch(0.68 0.22 15)" },
  fuel:       { key: "fuel",       label: "Fuel",        emoji: "⛽", gradient: "from-amber-400 to-orange-500",   color: "oklch(0.78 0.17 75)" },
  petrol:     { key: "petrol",     label: "Fuel",        emoji: "⛽", gradient: "from-amber-400 to-orange-500",   color: "oklch(0.78 0.17 75)" },
  clothes:    { key: "clothes",    label: "Clothing",    emoji: "👕", gradient: "from-purple-500 to-violet-500",  color: "oklch(0.62 0.25 295)"},
  clothing:   { key: "clothing",   label: "Clothing",    emoji: "👕", gradient: "from-purple-500 to-violet-500",  color: "oklch(0.62 0.25 295)"},
  footwear:   { key: "footwear",   label: "Footwear",    emoji: "👟", gradient: "from-indigo-500 to-purple-500",  color: "oklch(0.6 0.2 280)"  },
  electronics:{ key: "electronics",label: "Electronics", emoji: "🔌", gradient: "from-blue-500 to-cyan-500",      color: "oklch(0.68 0.17 220)"},
  electric:   { key: "electric",   label: "Electronics", emoji: "🔌", gradient: "from-blue-500 to-cyan-500",      color: "oklch(0.68 0.17 220)"},
  mobile:     { key: "mobile",     label: "Mobile",      emoji: "📱", gradient: "from-indigo-400 to-blue-500",    color: "oklch(0.66 0.18 250)"},
  appliances: { key: "appliances", label: "Appliances",  emoji: "🔧", gradient: "from-slate-500 to-zinc-600",     color: "oklch(0.6 0.04 250)" },
  home_improvement: { key: "home_improvement", label: "Hardware", emoji: "🛠️", gradient: "from-stone-500 to-amber-700", color: "oklch(0.55 0.08 60)" },
  furniture:  { key: "furniture",  label: "Furniture",   emoji: "🛋️", gradient: "from-amber-700 to-stone-700",    color: "oklch(0.5 0.07 50)"  },
  restaurant: { key: "restaurant", label: "Food Out",    emoji: "🍽️", gradient: "from-orange-500 to-amber-500",   color: "oklch(0.74 0.17 55)" },
  utility:    { key: "utility",    label: "Bills",       emoji: "💡", gradient: "from-yellow-400 to-amber-500",   color: "oklch(0.82 0.16 90)" },
  education:  { key: "education",  label: "Education",   emoji: "📚", gradient: "from-indigo-500 to-blue-500",    color: "oklch(0.6 0.2 265)"  },
  school:     { key: "school",     label: "Education",   emoji: "📚", gradient: "from-indigo-500 to-blue-500",    color: "oklch(0.6 0.2 265)"  },
  transport:  { key: "transport",  label: "Transport",   emoji: "🚗", gradient: "from-teal-500 to-cyan-600",      color: "oklch(0.65 0.13 200)"},
  travel:     { key: "travel",     label: "Travel",      emoji: "✈️", gradient: "from-sky-500 to-indigo-500",     color: "oklch(0.64 0.17 245)"},
  entertainment:{ key: "entertainment", label: "Entertainment", emoji: "🎬", gradient: "from-rose-500 to-pink-600", color: "oklch(0.6 0.22 0)" },
  sports:     { key: "sports",     label: "Sports",      emoji: "⚽", gradient: "from-emerald-500 to-green-600",  color: "oklch(0.65 0.18 150)"},
  services:   { key: "services",   label: "Services",    emoji: "🧾", gradient: "from-zinc-400 to-slate-500",     color: "oklch(0.65 0.03 250)"},
  stationery: { key: "stationery", label: "Stationery",  emoji: "✏️", gradient: "from-yellow-500 to-amber-600",   color: "oklch(0.74 0.15 85)" },
  toys:       { key: "toys",       label: "Toys",        emoji: "🧸", gradient: "from-amber-300 to-orange-400",   color: "oklch(0.78 0.13 65)" },
  jewelry:    { key: "jewelry",    label: "Jewelry",     emoji: "💍", gradient: "from-yellow-300 to-amber-500",   color: "oklch(0.82 0.15 90)" },
  salon:      { key: "salon",      label: "Salon",       emoji: "💇", gradient: "from-pink-500 to-rose-500",      color: "oklch(0.7 0.2 350)"  },
  doctor:     { key: "doctor",     label: "Doctor",      emoji: "🩺", gradient: "from-teal-400 to-emerald-500",   color: "oklch(0.72 0.14 180)"},
  other:      { key: "other",      label: "Other",       emoji: "📦", gradient: "from-zinc-500 to-slate-600",     color: "oklch(0.6 0.02 260)" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function getCategory(key: string | null | undefined): CategoryMeta {
  if (!key) return CATEGORIES.other;
  return CATEGORIES[(key as CategoryKey)] ?? CATEGORIES.other;
}
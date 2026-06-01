import { getCategory } from "@/lib/categories";

interface Props {
  category: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-9 w-9 text-base",
  md: "h-12 w-12 text-xl",
  lg: "h-16 w-16 text-2xl",
};

export function CategoryIcon({ category, size = "md", className = "" }: Props) {
  const meta = getCategory(category);
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${meta.gradient} ${sizes[size]} flex items-center justify-center shadow-lg shadow-black/30 ${className}`}
      aria-hidden
    >
      <span>{meta.emoji}</span>
    </div>
  );
}
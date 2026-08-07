import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  ctaTo,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaTo?: string;
}) {
  return (
    <div className="glass flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-emerald-500/20 flex items-center justify-center text-violet-200">
        {icon}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">{body}</p>
      </div>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo as "/home"}
          className="mt-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-4 py-2 text-xs font-semibold text-white"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
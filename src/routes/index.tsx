import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BillSnap — AI Bill Scanner & Expense Tracker" },
      { name: "description", content: "Snap any bill — BillSnap reads every item, brand, and price with AI and tracks your household spending." },
      { property: "og:title", content: "BillSnap" },
      { property: "og:description", content: "AI-powered household expense tracker for India." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/home" : "/login", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="glass px-6 py-4 text-sm text-muted-foreground">Loading BillSnap…</div>
    </div>
  );
}

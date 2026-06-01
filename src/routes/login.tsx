import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — BillSnap" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/home", replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) navigate({ to: "/home", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome to BillSnap!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center glow-violet mb-4">
            <Receipt className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">BillSnap</h1>
          <p className="text-sm text-muted-foreground mt-1">Snap bills. Track everything. Smarter.</p>
        </div>

        <div className="glass p-6 space-y-4">
          <div className="flex gap-2 p-1 rounded-xl bg-white/5">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === "signin" ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>
              Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === "signup" ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>
              Sign up
            </button>
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email" required placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-violet-400 transition"
            />
            <input
              type="password" required minLength={6} placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-violet-400 transition"
            />
            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg glow-violet disabled:opacity-50">
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-white/10" /> or <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={handleGoogle} disabled={loading}
            className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 py-3 text-sm font-medium transition disabled:opacity-50">
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
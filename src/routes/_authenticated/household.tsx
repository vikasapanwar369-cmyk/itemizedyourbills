import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Users, Copy, RefreshCw, LogOut, UserMinus, Crown, Home as HomeIcon, KeyRound } from "lucide-react";
import {
  getHousehold, createHousehold, joinHousehold, leaveHousehold, removeMember, updateHousehold,
} from "@/lib/household.functions";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/household")({
  head: () => ({
    meta: [
      { title: "Household Sharing — BillSnap" },
      { name: "description", content: "Share bills, budgets and insights with your family in one household." },
      { property: "og:title", content: "Household Sharing — BillSnap" },
      { property: "og:description", content: "Invite family members and track household spending together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HouseholdPage,
});

function HouseholdPage() {
  const qc = useQueryClient();
  const fetchHousehold = useServerFn(getHousehold);
  const createFn = useServerFn(createHousehold);
  const joinFn = useServerFn(joinHousehold);
  const leaveFn = useServerFn(leaveHousehold);
  const removeFn = useServerFn(removeMember);
  const updateFn = useServerFn(updateHousehold);

  const { data, isLoading } = useQuery({ queryKey: ["household"], queryFn: () => fetchHousehold() });

  const [mode, setMode] = useState<"create" | "join">("create");
  const [hhName, setHhName] = useState("");
  const [myName, setMyName] = useState("");
  const [code, setCode] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["household"] });
    qc.invalidateQueries();
  };

  const create = useMutation({
    mutationFn: () => createFn({ data: { name: hhName || "My Household", displayName: myName || "Me" } }),
    onSuccess: () => { toast.success("Household created"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const join = useMutation({
    mutationFn: () => joinFn({ data: { code, displayName: myName || "Me" } }),
    onSuccess: (r) => { toast.success(`Joined ${r.name}`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const leave = useMutation({
    mutationFn: () => leaveFn(),
    onSuccess: () => { toast.success("You left the household"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const kick = useMutation({
    mutationFn: (uid: string) => removeFn({ data: { userId: uid } }),
    onSuccess: () => { toast.success("Member removed"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rotate = useMutation({
    mutationFn: () => updateFn({ data: { rotateCode: true } }),
    onSuccess: () => { toast.success("New invite code generated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rename = useMutation({
    mutationFn: (name: string) => updateFn({ data: { name } }),
    onSuccess: () => { toast.success("Household renamed"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const hh = data?.household;

  return (
    <div className="px-5 pt-8 pb-32 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">Shared tracking</p>
        <h1 className="text-2xl font-bold">Household</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Everyone in a household sees the same bills, items, budgets and insights — but can only edit what they scanned.
        </p>
      </div>

      {isLoading && <div className="glass h-32 animate-pulse rounded-2xl" />}

      {!isLoading && !hh && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass space-y-4 rounded-2xl p-5">
          <div className="flex gap-2">
            {(["create", "join"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  mode === m ? "bg-violet-500/20 text-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "create" ? "Create household" : "Join with code"}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Your name in the household</span>
            <input
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              placeholder="e.g. Aarav"
              maxLength={40}
              className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-violet-500/60"
            />
          </label>

          {mode === "create" ? (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Household name</span>
                <input
                  value={hhName}
                  onChange={(e) => setHhName(e.target.value)}
                  placeholder="e.g. Sharma Family"
                  maxLength={60}
                  className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-violet-500/60"
                />
              </label>
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || !myName.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <HomeIcon className="mr-2 inline h-4 w-4" />
                {create.isPending ? "Creating…" : "Create household"}
              </button>
            </>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Invite code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="6-character code"
                  maxLength={12}
                  className="w-full rounded-xl bg-white/5 px-3 py-2 font-mono text-lg tracking-[0.3em] outline-none ring-1 ring-white/10 focus:ring-violet-500/60"
                />
              </label>
              <button
                onClick={() => join.mutate()}
                disabled={join.isPending || code.trim().length < 4 || !myName.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <KeyRound className="mr-2 inline h-4 w-4" />
                {join.isPending ? "Joining…" : "Join household"}
              </button>
            </>
          )}
        </motion.div>
      )}

      {hh && (
        <>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass space-y-4 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Household</p>
                <h2 className="text-lg font-bold">{hh.name}</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">Created {shortDate(hh.createdAt)}</p>
              </div>
              <Users className="h-6 w-6 text-violet-400" />
            </div>

            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-xs text-muted-foreground">Invite code</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-2xl font-bold tracking-[0.3em]">{hh.inviteCode}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => { navigator.clipboard?.writeText(hh.inviteCode); toast.success("Code copied"); }}
                    className="rounded-lg bg-white/10 p-2"
                    aria-label="Copy invite code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {hh.isOwner && (
                    <button
                      onClick={() => rotate.mutate()}
                      disabled={rotate.isPending}
                      className="rounded-lg bg-white/10 p-2"
                      aria-label="Generate new invite code"
                    >
                      <RefreshCw className={`h-4 w-4 ${rotate.isPending ? "animate-spin" : ""}`} />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Share this code with family. Anyone with it can join and see household spending.
              </p>
            </div>

            {hh.isOwner && (
              <button
                onClick={() => {
                  const next = window.prompt("Household name", hh.name);
                  if (next && next.trim()) rename.mutate(next.trim());
                }}
                className="text-xs font-medium text-violet-300"
              >
                Rename household
              </button>
            )}
          </motion.div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Members ({data?.members.length ?? 0})</h3>
            {(data?.members ?? []).map((m) => (
              <div key={m.userId} className="glass flex items-center justify-between gap-3 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold">
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {m.name} {m.isMe && <span className="text-[11px] text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.role === "owner" ? "Owner" : "Member"} · joined {shortDate(m.joinedAt)}
                    </p>
                  </div>
                </div>
                {m.role === "owner" ? (
                  <Crown className="h-4 w-4 text-amber-400" />
                ) : hh.isOwner && !m.isMe ? (
                  <button
                    onClick={() => kick.mutate(m.userId)}
                    className="rounded-lg bg-red-500/15 p-2 text-red-300"
                    aria-label={`Remove ${m.name}`}
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <button
            onClick={() => { if (window.confirm("Leave this household? Your own bills stay with you.")) leave.mutate(); }}
            disabled={leave.isPending}
            className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-red-300"
          >
            <LogOut className="h-4 w-4" /> Leave household
          </button>
        </>
      )}
    </div>
  );
}

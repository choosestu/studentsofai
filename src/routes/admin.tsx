import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Control · Stu-dents of AI" },
      { name: "description", content: "Stu's control room: players, submissions, points and votes." },
      { property: "og:title", content: "Control · Stu-dents of AI" },
      { property: "og:description", content: "Stu's control room: players, submissions, points and votes." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [awards, setAwards] = useState<Record<string, { amount: string; note: string }>>({});
  const [challengeTitle, setChallengeTitle] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data } = useQuery({
    queryKey: ["admin"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const [profiles, submissions, prompts, points, challenges, votes] = await Promise.all([
        supabase.from("profiles").select("*").order("display_name"),
        supabase.from("submissions").select("*").order("created_at", { ascending: false }),
        supabase.from("prompts").select("*").order("number"),
        supabase.from("points").select("*"),
        supabase.from("challenges").select("*").order("created_at", { ascending: false }),
        supabase.from("votes").select("*"),
      ]);
      return {
        profiles: profiles.data ?? [],
        submissions: submissions.data ?? [],
        prompts: prompts.data ?? [],
        points: points.data ?? [],
        challenges: challenges.data ?? [],
        votes: votes.data ?? [],
      };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const nameOf = (id: string) => data?.profiles.find((p) => p.id === id)?.display_name ?? "unknown";
  const promptOf = (id: string) => data?.prompts.find((p) => p.id === id);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="terminal text-sm text-dim">verifying<span className="animate-pulse">_</span></p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="terminal text-sm text-dim">access denied</p>
          <Link to="/dashboard" className="btn-matrix mt-6">
            Back
          </Link>
        </div>
      </main>
    );
  }

  const totals = new Map<string, number>();
  (data?.points ?? []).forEach((p) => totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + p.amount));

  async function award(submissionId: string, userId: string) {
    const entry = awards[submissionId];
    const amount = Number(entry?.amount ?? 0);
    if (!amount) return;
    const { error } = await supabase.from("points").insert({
      user_id: userId,
      submission_id: submissionId,
      amount,
      note: entry?.note || null,
      awarded_by: user!.id,
    });
    if (error) { toast.error("Could not award points."); return; }
    if (entry?.note) {
      await supabase.from("submissions").update({ admin_comment: entry.note }).eq("id", submissionId);
    }
    setAwards((a) => ({ ...a, [submissionId]: { amount: "", note: "" } }));
    toast.success("Points awarded.");
    refresh();
  }

  const lockedPrompt = data?.prompts.find((p) => p.status === "locked");

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-8">
      <div className="flex items-center justify-between">
        <h1 className="terminal text-2xl text-primary glow-text">Control</h1>
        <Link to="/dashboard" className="btn-ghost link-pulse">
          dashboard ›
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="terminal text-sm tracking-widest text-dim uppercase">Players</h2>
        <div className="surface mt-4 divide-y divide-border">
          {(data?.profiles ?? []).map((p) => {
            const done = (data?.submissions ?? []).filter((s) => s.user_id === p.id).length;
            return (
              <div key={p.id} className="terminal flex flex-wrap justify-between gap-2 p-4 text-sm">
                <span className="text-primary">{p.display_name}</span>
                <span className="text-dim">
                  {totals.get(p.id) ?? 0} pts · {done} submissions · active{" "}
                  {new Date(p.last_active_at).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="terminal text-sm tracking-widest text-dim uppercase">Submissions Inbox</h2>
        <div className="mt-4 space-y-4">
          {(data?.submissions ?? []).map((s) => (
            <div key={s.id} className="surface p-4">
              <p className="terminal text-xs text-dim">
                {nameOf(s.user_id)} · prompt {promptOf(s.prompt_id)?.number} ·{" "}
                {new Date(s.created_at).toLocaleString()}
              </p>
              <p className="terminal mt-2 text-sm whitespace-pre-wrap text-foreground/85">{s.content}</p>

              {s.attachment_path && (
                <button
                  className="btn-ghost link-pulse mt-3"
                  onClick={async () => {
                    const { data: signed, error } = await supabase.storage
                      .from("submission-attachments")
                      .createSignedUrl(s.attachment_path!, 60 * 60);
                    if (error || !signed) { toast.error("Could not open that file."); return; }
                    window.open(signed.signedUrl, "_blank", "noopener");
                  }}
                >
                  ↓ {s.attachment_path.split("/").pop()}
                </button>
              )}


              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  className="field max-w-24"
                  type="number"
                  placeholder="pts"
                  value={awards[s.id]?.amount ?? ""}
                  onChange={(e) =>
                    setAwards((a) => ({ ...a, [s.id]: { ...(a[s.id] ?? { note: "" }), amount: e.target.value } }))
                  }
                />
                <input
                  className="field flex-1 min-w-48"
                  placeholder="comment shown to player"
                  value={awards[s.id]?.note ?? ""}
                  onChange={(e) =>
                    setAwards((a) => ({ ...a, [s.id]: { ...(a[s.id] ?? { amount: "" }), note: e.target.value } }))
                  }
                />
                <button className="btn-matrix" onClick={() => award(s.id, s.user_id)}>
                  Award
                </button>
              </div>

              <label className="terminal mt-3 flex items-center gap-3 text-xs text-dim">
                <input
                  type="checkbox"
                  checked={s.shared_with_family}
                  className="h-4 w-4 accent-[oklch(0.87_0.28_145)]"
                  onChange={async (e) => {
                    await supabase
                      .from("submissions")
                      .update({ shared_with_family: e.target.checked })
                      .eq("id", s.id);
                    refresh();
                  }}
                />
                show in Family Feed
              </label>
            </div>
          ))}
          {(data?.submissions.length ?? 0) === 0 && (
            <p className="terminal text-xs text-dim">&gt; inbox empty</p>
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="terminal text-sm tracking-widest text-dim uppercase">Prompt 3</h2>
        <div className="surface mt-4 flex flex-wrap items-center justify-between gap-4 p-4">
          <p className="terminal text-sm text-dim">
            {lockedPrompt ? "Prompt 3 is locked." : "All prompts are unlocked."}
          </p>
          {lockedPrompt && (
            <button
              className="btn-matrix"
              onClick={async () => {
                const { error } = await supabase
                  .from("prompts")
                  .update({ status: "active", unlock_date: new Date().toISOString() })
                  .eq("id", lockedPrompt.id);
                if (error) { toast.error("Could not unlock."); return; }
                toast.success("Prompt 3 unlocked.");
                refresh();
              }}
            >
              Unlock Prompt 3
            </button>
          )}
        </div>
      </section>

      <section className="mt-12 pb-16">
        <h2 className="terminal text-sm tracking-widest text-dim uppercase">Family Votes</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className="field"
            placeholder="new vote title"
            value={challengeTitle}
            onChange={(e) => setChallengeTitle(e.target.value)}
          />
          <button
            className="btn-matrix"
            disabled={!challengeTitle.trim()}
            onClick={async () => {
              const { error } = await supabase.from("challenges").insert({ title: challengeTitle.trim() });
              if (error) { toast.error("Could not open the vote."); return; }
              setChallengeTitle("");
              toast.success("Vote opened.");
              refresh();
            }}
          >
            Open Vote
          </button>
        </div>

        <div className="surface mt-4 divide-y divide-border">
          {(data?.challenges ?? []).map((c) => {
            const tally = new Map<string, number>();
            (data?.votes ?? [])
              .filter((v) => v.challenge_id === c.id)
              .forEach((v) => tally.set(v.target_user_id, (tally.get(v.target_user_id) ?? 0) + 1));
            return (
              <div key={c.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="terminal text-sm text-primary">{c.title}</p>
                  <button
                    className="btn-ghost link-pulse"
                    onClick={async () => {
                      await supabase.from("challenges").update({ open: !c.open }).eq("id", c.id);
                      refresh();
                    }}
                  >
                    {c.open ? "close vote" : "reopen vote"}
                  </button>
                </div>
                <div className="terminal mt-2 text-xs text-dim">
                  {[...tally.entries()].length === 0
                    ? "no votes yet"
                    : [...tally.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .map(([id, n]) => `${nameOf(id)}: ${n}`)
                        .join("  ·  ")}
                </div>
              </div>
            );
          })}
          {(data?.challenges.length ?? 0) === 0 && (
            <p className="terminal p-4 text-xs text-dim">&gt; no votes yet</p>
          )}
        </div>
      </section>
    </main>
  );
}

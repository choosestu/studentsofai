import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReintroModal } from "@/components/ReintroModal";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your journey · Stu-dents of AI" },
      { name: "description", content: "Your prompts, your points and what the family has shared." },
      { property: "og:title", content: "Your journey · Stu-dents of AI" },
      { property: "og:description", content: "Your prompts, your points and what the family has shared." },
    ],
  }),
  component: Dashboard,
});

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Dashboard() {
  const { user, loading, displayName, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data } = useQuery({
    queryKey: ["dashboard", user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      const [prompts, mine, profiles, feed, unseen] = await Promise.all([
        supabase.from("prompts").select("*").order("number"),
        supabase.from("submissions").select("id, prompt_id, created_at").eq("user_id", user!.id),
        supabase.from("profiles").select("id, display_name, total_points"),
        supabase
          .from("submissions")
          .select("id, user_id, content, created_at")
          .eq("shared_with_family", true)
          .order("created_at", { ascending: false })
          .limit(20),
        isAdmin
          ? supabase
              .from("submissions")
              .select("id", { count: "exact", head: true })
              .not("attachment_path", "is", null)
              .is("viewed_at", null)
          : Promise.resolve({ count: 0 }),
      ]);
      return {
        prompts: prompts.data ?? [],
        mine: mine.data ?? [],
        profiles: profiles.data ?? [],
        feed: feed.data ?? [],
        unseen: unseen.count ?? 0,
      };
    },
  });

  const board = (data?.profiles ?? [])
    .map((p) => ({ ...p, total: p.total_points ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const myRank = board.findIndex((b) => b.id === user?.id) + 1;
  const myPoints = board.find((b) => b.id === user?.id)?.total ?? 0;

  const nameOf = (id: string) => data?.profiles.find((p) => p.id === id)?.display_name ?? "someone";

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="terminal text-sm text-dim">connecting<span className="animate-pulse">_</span></p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-8">
      <ReintroModal />

      <header className="surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h1 className="terminal text-xl text-primary glow-text">{displayName || "you"}</h1>
          <p className="terminal mt-1 text-xs text-dim">
            {myPoints} pts{myRank > 0 ? ` · rank ${myRank}/${board.length}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link to="/admin" className="btn-ghost link-pulse">
              admin
              {(data?.unseen ?? 0) > 0 && (
                <span className="ml-2 text-primary glow-text">● {data?.unseen}</span>
              )}
            </Link>
          )}
          <button className="btn-ghost link-pulse" onClick={() => signOut()}>
            sign out
          </button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_260px]">
        <section>
          <h2 className="terminal text-sm tracking-widest text-dim uppercase">The Journey</h2>
          <ol className="mt-5 space-y-0 border-l border-border pl-6">
            {(data?.prompts ?? []).map((p) => {
              const submitted = data?.mine.some((m) => m.prompt_id === p.id);
              const locked = p.status === "locked";
              return (
                <li key={p.id} className="relative pb-8">
                  <span
                    className="absolute -left-[31px] top-2 h-2 w-2"
                    style={{
                      backgroundColor: locked
                        ? "var(--color-muted-foreground)"
                        : "var(--color-primary)",
                      boxShadow: locked ? "none" : "0 0 12px var(--glow)",
                    }}
                  />
                  {locked ? (
                    <div className="surface p-5 opacity-70">
                      <p className="terminal text-xs text-dim">PROMPT {p.number}</p>
                      <h3 className="terminal mt-1 text-lg text-dim">{p.title}</h3>
                      <p className="mt-1 text-sm text-dim">{p.description}</p>
                      <p className="terminal mt-3 text-xs text-dim">
                        [locked] {p.unlock_date ? `unlocks ${new Date(p.unlock_date).toLocaleDateString()}` : "coming by end of week"}
                      </p>
                    </div>
                  ) : (
                    <Link
                      to="/prompt/$number"
                      params={{ number: String(p.number) }}
                      className="surface block p-5 transition-shadow hover:shadow-[0_0_22px_var(--glow)]"
                    >
                      <p className="terminal text-xs text-dim">PROMPT {p.number}</p>
                      <h3 className="terminal mt-1 text-lg text-primary">{p.title}</h3>
                      <p className="mt-1 text-sm text-foreground/70">{p.description}</p>
                      <p className="terminal mt-3 text-xs text-dim">
                        status: {submitted ? "submitted" : "not started"}
                      </p>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <aside>
          <h2 className="terminal text-sm tracking-widest text-dim uppercase">Leaderboard</h2>
          <div className="surface mt-5 divide-y divide-border">
            {board.map((row, i) => (
              <div key={row.id} className="terminal flex items-center justify-between px-4 py-3 text-sm">
                <span className={row.id === user.id ? "text-primary" : "text-foreground/75"}>
                  {i === 0 && row.total > 0 ? "♛ " : `${i + 1}. `}
                  {row.display_name}
                </span>
                <span className="text-dim">{row.total}</span>
              </div>
            ))}
            {board.length === 0 && <p className="terminal p-4 text-xs text-dim">no one yet</p>}
          </div>
        </aside>
      </div>

      <section className="mt-12">
        <h2 className="terminal text-sm tracking-widest text-dim uppercase">Family Feed</h2>
        <div className="surface mt-5 divide-y divide-border">
          {(data?.feed ?? []).map((f) => (
            <div key={f.id} className="p-4">
              <p className="terminal text-xs text-primary">
                {nameOf(f.user_id)} <span className="text-dim">· {timeAgo(f.created_at)}</span>
              </p>
              <p className="terminal mt-2 text-sm whitespace-pre-wrap text-foreground/80">
                {f.content.length > 240 ? `${f.content.slice(0, 240)}…` : f.content}
              </p>
            </div>
          ))}
          {(data?.feed.length ?? 0) === 0 && (
            <p className="terminal p-4 text-xs text-dim">&gt; nothing shared yet</p>
          )}
        </div>
      </section>
    </main>
  );
}

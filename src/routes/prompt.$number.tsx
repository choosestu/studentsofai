import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BackupChat } from "@/components/BackupChat";
import { toast } from "sonner";

export const Route = createFileRoute("/prompt/$number")({
  head: () => ({
    meta: [
      { title: "Prompt · Stu-dents of AI" },
      { name: "description", content: "Copy the prompt, run it in your own account, share what feels worth sharing." },
      { property: "og:title", content: "Prompt · Stu-dents of AI" },
      { property: "og:description", content: "Copy the prompt, run it in your own account, share what feels worth sharing." },
    ],
  }),
  component: PromptPage,
});

function PromptPage() {
  const { number } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [content, setContent] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const chatRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: prompt } = useQuery({
    queryKey: ["prompt", number],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("prompts").select("*").eq("number", Number(number)).maybeSingle();
      return data;
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-submissions", prompt?.id, user?.id],
    enabled: !!prompt?.id && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("prompt_id", prompt!.id)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function submitShare(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !prompt) return;
    setBusy(true);
    const { error } = await supabase.from("submissions").insert({
      user_id: user!.id,
      prompt_id: prompt.id,
      content: content.trim(),
      shared_with_family: share,
    });
    setBusy(false);
    if (error) {
      toast.error("That did not save. Try again.");
      return;
    }
    setContent("");
    setShare(false);
    toast.success("Received. Thank you.");
    qc.invalidateQueries({ queryKey: ["my-submissions"] });
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="terminal text-sm text-dim">loading<span className="animate-pulse">_</span></p>
      </main>
    );
  }

  if (prompt && prompt.status === "locked") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-8">
        <Link to="/dashboard" className="btn-ghost link-pulse">
          ‹ back
        </Link>
        <div className="surface mt-8 p-8 text-center">
          <h1 className="terminal text-2xl text-dim">Locked</h1>
          <p className="terminal mt-3 text-sm text-dim">{prompt.description}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-8">
      <Link to="/dashboard" className="btn-ghost link-pulse">
        ‹ back
      </Link>

      <h1 className="terminal mt-6 text-2xl text-primary glow-text sm:text-4xl">
        <span className="text-dim">{String(prompt?.number ?? number).padStart(2, "0")} /</span>{" "}
        {prompt?.title ?? "…"}
      </h1>

      <div
        className="surface mt-8 p-5"
        style={{ borderLeft: "3px solid var(--color-primary)" }}
      >
        <p className="text-sm leading-relaxed text-foreground/80">
          This prompt is designed for your own ChatGPT or Claude account. What you discover there is
          private. It belongs to you. I hope you will share what feels worth sharing, but that is
          always your choice.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-dim">
          If you hit your daily message limit on your free account, you can use the text box at the
          bottom of this page instead. It connects to a shared account with memory, so your
          conversation will carry forward.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="terminal text-sm tracking-widest text-dim uppercase">The Prompt</h2>
        <pre className="surface mt-4 overflow-x-auto p-5 terminal text-sm leading-relaxed whitespace-pre-wrap text-primary">
          {prompt?.body}
        </pre>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="btn-matrix"
            onClick={async () => {
              await navigator.clipboard.writeText(prompt?.body ?? "");
              setCopied(true);
              toast.success("Copied.");
              setTimeout(() => setCopied(false), 2500);
            }}
          >
            {copied ? "Copied ✓" : "Copy Prompt"}
          </button>
          <button
            className="btn-matrix"
            onClick={() => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Use In-App
          </button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-dim">
          Open ChatGPT (chatgpt.com) or Claude (claude.ai). Start a new conversation. Paste this in.
          Let it go where it goes.
        </p>
      </section>


      <section className="mt-12">
        <h2 className="terminal text-sm text-foreground">
          Want to share something from this session?
        </h2>
        <p className="mt-1 text-xs text-dim">
          Optional. Only you and Stu can see this unless you choose to share it with the family.
        </p>
        <form onSubmit={submitShare} className="mt-4">
          <textarea
            className="field min-h-40"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="what happened in there..."
          />
          <label className="terminal mt-3 flex items-center gap-3 text-xs text-dim">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
              className="h-4 w-4 accent-[oklch(0.87_0.28_145)]"
            />
            Share with family
          </label>
          <button className="btn-matrix mt-5" disabled={busy || !content.trim()}>
            Share
          </button>
        </form>

        {(mine?.length ?? 0) > 0 && (
          <div className="surface mt-6 divide-y divide-border">
            {mine!.map((s) => (
              <div key={s.id} className="p-4">
                <p className="terminal text-xs text-dim">
                  {new Date(s.created_at).toLocaleString()}
                  {s.shared_with_family ? " · shared with family" : " · private"}
                </p>
                <p className="terminal mt-2 text-sm whitespace-pre-wrap text-foreground/80">
                  {s.content}
                </p>
                {s.admin_comment && (
                  <p className="terminal mt-3 text-sm text-primary">stu › {s.admin_comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section ref={chatRef} className="mt-12 scroll-mt-6">
        <h2 className="terminal text-sm tracking-widest text-dim uppercase">
          In-App Conversation
        </h2>
        <BackupChat promptNumber={Number(prompt?.number ?? number)} />
      </section>

      <div className="mt-12 border-t border-border pt-8">
        <Link to="/dashboard" className="btn-matrix inline-block">
          Done
        </Link>
      </div>

    </main>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · Stu-dents of AI" },
      { name: "description", content: "Set a new password for Stu-dents of AI." },
      { property: "og:title", content: "Reset password · Stu-dents of AI" },
      { property: "og:description", content: "Set a new password for Stu-dents of AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const recoveryHash = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (recoveryHash && session)) setRecoveryReady(true);
      setChecking(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setRecoveryReady(recoveryHash && Boolean(data.session));
      setChecking(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password updated. Redirecting...");
    window.setTimeout(() => navigate({ to: "/dashboard", replace: true }), 800);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="surface w-full max-w-md p-6 sm:p-10">
        <h1 className="terminal text-2xl text-primary glow-text">Set a new password</h1>
        <p className="terminal mt-2 text-xs text-dim">&gt; choose a new key</p>

        {checking ? (
          <p className="terminal mt-8 text-xs text-dim">Checking reset link...</p>
        ) : recoveryReady ? (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <input
              className="field"
              type="password"
              required
              minLength={8}
              maxLength={128}
              placeholder="new password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <input
              className="field"
              type="password"
              required
              minLength={8}
              maxLength={128}
              placeholder="confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
            <Button type="submit" className="btn-matrix w-full" disabled={busy}>
              {busy ? "..." : "Save password"}
            </Button>
          </form>
        ) : (
          <div className="mt-8">
            <p className="terminal text-xs text-dim">This reset link is invalid or has expired.</p>
            <Button className="btn-ghost link-pulse mt-4" onClick={() => navigate({ to: "/auth" })}>
              request another link
            </Button>
          </div>
        )}

        {message && <p className="terminal mt-4 text-xs text-dim" role="status">{message}</p>}
      </div>
    </main>
  );
}
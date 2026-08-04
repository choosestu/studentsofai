import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Enter · Stu-dents of AI" },
      { name: "description", content: "Sign in to your own journey inside Stu-dents of AI." },
      { property: "og:title", content: "Enter · Stu-dents of AI" },
      { property: "og:description", content: "Sign in to your own journey inside Stu-dents of AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resetMode, setResetMode] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setMessage("Account created. If confirmation is required, check your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Check your email for a password reset link.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="surface w-full max-w-md p-6 sm:p-10">
        <h1 className="terminal text-2xl text-primary glow-text">
          {resetMode ? "Reset your key" : mode === "signin" ? "Identify yourself" : "Create your key"}
        </h1>
        <p className="terminal mt-2 text-xs text-dim">
          {resetMode ? "> I will send you a secure reset link" : mode === "signin" ? "> welcome back" : "> each journey is its own"}
        </p>

        <form onSubmit={resetMode ? sendReset : submit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <input
              className="field"
              placeholder="your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className="field"
            type="email"
            required
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {!resetMode && (
            <input
              className="field"
              type="password"
              required
              minLength={6}
              maxLength={128}
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          )}
          <Button type="submit" className="btn-matrix w-full" disabled={busy}>
            {busy ? "..." : resetMode ? "Send reset link" : mode === "signin" ? "Enter" : "Begin"}
          </Button>
        </form>

        {message && <p className="terminal mt-4 text-xs text-dim">{message}</p>}

        <div className="mt-6 flex flex-col items-start gap-2">
          {mode === "signin" && !resetMode && (
            <Button className="btn-ghost link-pulse" onClick={() => { setResetMode(true); setMessage(""); }}>
              forgot password?
            </Button>
          )}
          <Button
            className="btn-ghost link-pulse"
            onClick={() => {
              if (resetMode) {
                setResetMode(false);
              } else {
                setMode(mode === "signin" ? "signup" : "signin");
              }
              setMessage("");
            }}
          >
            {resetMode ? "back to sign in" : mode === "signin" ? "no account yet? create one" : "already have a key? sign in"}
          </Button>
        </div>
      </div>
    </main>
  );
}

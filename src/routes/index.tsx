import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stu-dents of AI" },
      {
        name: "description",
        content: "What you find here is yours. I just showed you the door.",
      },
      { property: "og:title", content: "Stu-dents of AI" },
      {
        property: "og:description",
        content: "What you find here is yours. I just showed you the door.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="terminal text-4xl leading-tight text-primary glow-text sm:text-6xl md:text-7xl">
        Stu-dents
        <span className="text-dim">_</span>
        of AI
      </h1>
      <p className="terminal mt-6 max-w-md text-sm text-dim sm:text-base">
        What you find here is yours. I just showed you the door.
        <span className="ml-1 inline-block" style={{ animation: "caret 1.1s step-end infinite" }}>
          ▌
        </span>
      </p>
      <button className="btn-matrix mt-12" onClick={() => navigate({ to: "/auth" })}>
        Enter
      </button>
    </main>
  );
}

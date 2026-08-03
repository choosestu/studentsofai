import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendBackupChat } from "@/lib/chat.functions";

type Msg = { role: "user" | "assistant"; content: string };

export function BackupChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = useServerFn(sendBackupChat);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await send({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch {
      setError("The connection dropped. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <button className="btn-ghost link-pulse" onClick={() => setOpen((o) => !o)}>
        {open ? "[ - ] close in-app conversation" : "[ + ] Hit your daily limit? Use the in-app conversation instead."}
      </button>

      {open && (
        <div className="surface mt-4 p-4 sm:p-6">
          <div className="terminal mb-4 text-xs text-dim">
            shared account · memory on · your conversation carries forward
          </div>

          <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="terminal text-sm text-dim">
                &gt; start typing. it will meet you where you are.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="terminal text-sm leading-relaxed">
                <span className={m.role === "user" ? "text-dim" : "text-primary"}>
                  {m.role === "user" ? "you › " : "ai  › "}
                </span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))}
            {busy && <div className="terminal text-sm text-dim">ai › thinking<span className="animate-pulse">_</span></div>}
          </div>

          {error && <p className="terminal mt-3 text-sm text-destructive">{error}</p>}

          <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              className="field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="type here..."
              disabled={busy}
            />
            <button className="btn-matrix" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

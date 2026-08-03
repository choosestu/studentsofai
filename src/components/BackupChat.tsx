import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendBackupChat } from "@/lib/chat.functions";
import { appendConversationSession } from "@/lib/conversation.functions";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; at: string };

export function BackupChat({
  promptNumber,
  autoSendText,
  autoSendSignal = 0,
}: {
  promptNumber: number;
  autoSendText?: string;
  autoSendSignal?: number;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(new Date().toISOString());
  const inputRef = useRef<HTMLInputElement>(null);
  const send = useServerFn(sendBackupChat);
  const saveSession = useServerFn(appendConversationSession);
  const busyRef = useRef(false);
  const messagesRef = useRef<Msg[]>([]);
  messagesRef.current = messages;
  const lastSignal = useRef(0);

  useEffect(() => {
    if (autoSendSignal > lastSignal.current && autoSendText?.trim()) {
      lastSignal.current = autoSendSignal;
      void sendText(autoSendText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendSignal, autoSendText]);

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    const next: Msg[] = [
      ...messagesRef.current,
      { role: "user", content: text, at: new Date().toISOString() },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await send({
        data: {
          promptNumber,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setMessages([
        ...next,
        { role: "assistant", content: res.reply, at: new Date().toISOString() },
      ]);
    } catch {
      setError("The connection dropped. Try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void sendText(input);
  }

  async function endSession() {
    if (messages.length === 0 || saving) return;
    setSaving(true);
    try {
      await saveSession({
        data: {
          promptNumber,
          startedAt: startedAt.current,
          messages: messages.map((m) => ({ role: m.role, content: m.content, at: m.at })),
        },
      });
      toast.success("Your conversation has been saved to your profile.");
      setMessages([]);
      startedAt.current = new Date().toISOString();
    } catch {
      toast.error("That did not save. Your earlier records are untouched — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
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
        {busy && (
          <div className="terminal text-sm text-dim">
            ai › thinking<span className="animate-pulse">_</span>
          </div>
        )}
      </div>

      {error && <p className="terminal mt-3 text-sm text-destructive">{error}</p>}

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          ref={inputRef}
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

      <div className="mt-6">
        <button
          type="button"
          className="btn-matrix"
          onClick={endSession}
          disabled={saving || messages.length === 0}
        >
          {saving ? "Saving…" : "End Session"}
        </button>
        <p className="terminal mt-3 text-xs text-dim">
          Your conversation is saved automatically. You can always come back.
        </p>
      </div>
    </div>
  );
}

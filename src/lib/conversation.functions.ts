import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20000),
  at: z.string().optional(),
});

export type StoredMessage = z.infer<typeof messageSchema>;

export type StoredSession = {
  started_at: string;
  ended_at: string;
  prompt_number: number;
  messages: StoredMessage[];
};

const saveSchema = z.object({
  promptNumber: z.number().int().min(1).max(999),
  startedAt: z.string(),
  messages: z.array(messageSchema).min(1).max(500),
});

/** Appends a finished session to the user's growing record for this prompt. Never overwrites. */
export const appendConversationSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const session: StoredSession = {
      started_at: data.startedAt,
      ended_at: new Date().toISOString(),
      prompt_number: data.promptNumber,
      messages: data.messages,
    };

    const { data: existing, error: readError } = await supabase
      .from("conversation_logs")
      .select("id, sessions")
      .eq("user_id", userId)
      .eq("prompt_number", data.promptNumber)
      .maybeSingle();

    if (readError) {
      console.error("conversation_logs read failed", readError);
      throw new Error("Could not reach your saved record.");
    }

    if (existing) {
      const sessions = Array.isArray(existing.sessions) ? existing.sessions : [];
      const { error } = await supabase
        .from("conversation_logs")
        .update({ sessions: [...sessions, session] as never })
        .eq("id", existing.id);
      if (error) {
        console.error("conversation_logs update failed", error);
        throw new Error("Could not save your conversation.");
      }
      return { sessionCount: sessions.length + 1 };
    }

    const { error } = await supabase.from("conversation_logs").insert({
      user_id: userId,
      prompt_number: data.promptNumber,
      sessions: [session] as never,
    });
    if (error) {
      console.error("conversation_logs insert failed", error);
      throw new Error("Could not save your conversation.");
    }
    return { sessionCount: 1 };
  });

/** Returns every earlier prompt's full record so it can be loaded silently into context. */
export const getPriorContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ promptNumber: z.number().int().min(1).max(999) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("conversation_logs")
      .select("prompt_number, sessions")
      .eq("user_id", userId)
      .lte("prompt_number", data.promptNumber)
      .order("prompt_number", { ascending: true });

    if (error) {
      console.error("conversation_logs prior read failed", error);
      return { context: "" };
    }

    const parts: string[] = [];
    for (const row of rows ?? []) {
      const sessions = (Array.isArray(row.sessions) ? row.sessions : []) as StoredSession[];
      for (const s of sessions) {
        parts.push(
          `--- Prompt ${row.prompt_number} session (${s.started_at}) ---\n` +
            (s.messages ?? [])
              .map((m) => `${m.role === "user" ? "Them" : "You"}: ${m.content}`)
              .join("\n"),
        );
      }
    }

    const joined = parts.join("\n\n");
    // keep the payload sane
    return { context: joined.length > 24000 ? joined.slice(-24000) : joined };
  });

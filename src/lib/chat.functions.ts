import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  promptNumber: z.number().int().min(1).max(999).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(6000),
      }),
    )
    .min(1)
    .max(40),
});

const BASELINE_TONE =
  "You are a thinking partner talking with one person, in private. Speak plainly and " +
  "specifically, like a sharp friend who is genuinely curious. Never cheerlead, never " +
  "praise for the sake of it, never use exclamation marks or phrases like 'great question', " +
  "'I love that', or 'amazing'. No bullet lists, no headings, no summaries of what they just " +
  "said. Short turns. One real question at a time, and make it a question only you could ask " +
  "given what they actually told you. Prefer concrete detail over abstraction; if something " +
  "they say is vague or unearned, say so directly and kindly. Silence and brevity are fine.";

const FALLBACK_SYSTEM_PROMPT =
  "Follow the register above. Ask one short question at a time and stay adaptive.";

export const sendBackupChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured yet.");

    let promptBody = "";
    if (data.promptNumber) {
      const { data: promptRow } = await context.supabase
        .from("prompts")
        .select("body")
        .eq("number", data.promptNumber)
        .maybeSingle();
      promptBody = (promptRow?.body ?? "").trim();
    }

    const system: Array<{ role: "system"; content: string }> = [
      { role: "system", content: BASELINE_TONE },
      { role: "system", content: promptBody || FALLBACK_SYSTEM_PROMPT },
    ];

    if (data.promptNumber) {
      const { data: rows } = await context.supabase
        .from("conversation_logs")
        .select("prompt_number, sessions")
        .eq("user_id", context.userId)
        .lte("prompt_number", data.promptNumber)
        .order("prompt_number", { ascending: true });

      const parts: string[] = [];
      for (const row of rows ?? []) {
        const sessions = (Array.isArray(row.sessions) ? row.sessions : []) as Array<{
          started_at?: string;
          messages?: Array<{ role: string; content: string }>;
        }>;
        for (const s of sessions) {
          parts.push(
            `--- Prompt ${row.prompt_number} (${s.started_at ?? ""}) ---\n` +
              (s.messages ?? [])
                .map((m) => `${m.role === "user" ? "Them" : "You"}: ${m.content}`)
                .join("\n"),
          );
        }
      }
      const prior = parts.join("\n\n");
      if (prior) {
        const trimmed = prior.length > 24000 ? prior.slice(-24000) : prior;
        system.push({
          role: "system",
          content:
            "Here is the record of this person's earlier sessions. Use it silently — never make them " +
            "re-explain what they already told you, and do not recite this back at them.\n\n" +
            trimmed,
        });
      }
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [...system, ...data.messages],
      }),
    });

    if (res.status === 429) return { reply: "Rate limit reached. Wait a moment and try again." };
    if (res.status === 402) return { reply: "AI credits are exhausted. Ask Stu to top them up." };
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      throw new Error("The conversation could not continue right now.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return { reply: json.choices?.[0]?.message?.content ?? "(no response)" };
  });

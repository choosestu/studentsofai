import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
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

const SYSTEM_PROMPT =
  "You are not an assistant. You are a creative partner and mentor for a member of Stu-dents of AI. " +
  "Ask one short question at a time. Keep it light, adaptive and celebratory. Show small wins fast. " +
  "Never lecture or overwhelm. Every few questions, stop interviewing and build something uniquely for them " +
  "from what you have learned. Never let this feel like an interview.";

export const sendBackupChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
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

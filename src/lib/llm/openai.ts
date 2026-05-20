import OpenAI from "openai";
import type { ChatMessage } from "../segue/types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function client(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Copy .env.local.example to .env.local and set your key."
    );
  }
  return new OpenAI({ apiKey: key });
}

export async function npcReply(opts: {
  persona: string;
  history: ChatMessage[];
  userMessage: string;
}): Promise<string> {
  const openai = client();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: opts.persona }
  ];
  for (const m of opts.history) {
    if (m.role === "user") messages.push({ role: "user", content: m.content });
    else if (m.role === "npc") messages.push({ role: "assistant", content: m.content });
  }
  messages.push({ role: "user", content: opts.userMessage });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 200
  });
  return completion.choices[0]?.message?.content?.trim() ?? "...";
}

export function isConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

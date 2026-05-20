import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, saveSession } from "@/lib/session/store";
import { SCENARIOS } from "@/lib/segue/scenarios";
import { isConfigured, npcReply } from "@/lib/llm/openai";
import { stubNpcReply } from "@/lib/llm/stub";

const Body = z.object({
  sessionId: z.string(),
  message: z.string().min(1)
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const s = getSession(parsed.data.sessionId);
  if (!s) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const userMsg = parsed.data.message.trim();
  s.messages.push({ role: "user", content: userMsg, ts: Date.now() });

  // Detect pregnancy disclosure → store in context (used by fatal detector)
  if (/(có thai|mang thai|cho con bú)/i.test(userMsg)) {
    s.context.pregnant = true;
  }

  const spec = SCENARIOS[s.moduleId];

  let reply: string;
  try {
    if (isConfigured()) {
      reply = await npcReply({
        persona: spec.npcPersona,
        history: s.messages.slice(0, -1),
        userMessage: userMsg
      });
    } else {
      reply = stubNpcReply({
        moduleId: s.moduleId,
        history: s.messages.slice(0, -1),
        userMessage: userMsg
      });
    }
  } catch (e: any) {
    reply = `[NPC ngoại tuyến] ${stubNpcReply({
      moduleId: s.moduleId,
      history: s.messages.slice(0, -1),
      userMessage: userMsg
    })}`;
  }

  s.messages.push({ role: "npc", content: reply, ts: Date.now() });
  saveSession(s);
  return NextResponse.json({ session: s });
}

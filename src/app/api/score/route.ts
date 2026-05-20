import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, saveSession } from "@/lib/session/store";
import { computeScore } from "@/lib/segue/score";

const Body = z.object({ sessionId: z.string() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const s = getSession(parsed.data.sessionId);
  if (!s) return NextResponse.json({ error: "session not found" }, { status: 404 });
  s.endedAt = Date.now();
  saveSession(s);
  const score = computeScore(s);
  return NextResponse.json({ score, session: s });
}

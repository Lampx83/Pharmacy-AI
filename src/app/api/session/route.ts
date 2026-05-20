import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getSession } from "@/lib/session/store";
import { SCENARIOS } from "@/lib/segue/scenarios";

const Body = z.object({
  moduleId: z.enum(["gpp", "hospital", "medrep"])
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const s = createSession(parsed.data.moduleId);
  const spec = SCENARIOS[s.moduleId];
  s.messages.push({
    role: "npc",
    content: spec.npcOpening,
    ts: Date.now()
  });
  return NextResponse.json({ session: s, scenario: spec });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const s = getSession(id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ session: s, scenario: SCENARIOS[s.moduleId] });
}

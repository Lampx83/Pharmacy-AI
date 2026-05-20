import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, saveSession } from "@/lib/session/store";

const Body = z.object({
  sessionId: z.string(),
  type: z.enum([
    "pick_box",
    "label_dose",
    "pos_checkout",
    "scan_barcode",
    "open_his",
    "flag_prescription_error",
    "call_doctor",
    "present_slide",
    "sign_mou"
  ]),
  payload: z.record(z.string(), z.unknown()).optional()
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const s = getSession(parsed.data.sessionId);
  if (!s) return NextResponse.json({ error: "session not found" }, { status: 404 });
  s.actions.push({
    type: parsed.data.type,
    payload: parsed.data.payload,
    ts: Date.now()
  });
  saveSession(s);
  return NextResponse.json({ session: s });
}

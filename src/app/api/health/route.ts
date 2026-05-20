import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "pharmacy-ai-sim",
    time: new Date().toISOString()
  });
}

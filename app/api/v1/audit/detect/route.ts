import { NextRequest, NextResponse } from "next/server";
import { autoDetect } from "@/app/lib/auto-detect";

export const runtime = "nodejs";
export const maxDuration = 55;

export async function POST(req: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled.", status: "maintenance" }, { status: 503 });
    const { website } = await req.json();
    if (!website) return NextResponse.json({ error: "website is required" }, { status: 400 });

    const result = await autoDetect(website);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Detection failed") }, { status: 500 });
  }
}

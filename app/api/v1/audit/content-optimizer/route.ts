import { NextRequest, NextResponse } from "next/server";
import { analyzeContentForAI } from "@/app/lib/content-optimizer";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });

  try {
    const result = await analyzeContentForAI(url);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Content analysis failed") }, { status: 500 });
  }
}

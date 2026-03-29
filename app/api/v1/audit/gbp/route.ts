import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY || ""}`;

async function askGemini(prompt: string): Promise<string> {
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch {
    return "";
  }
}

interface GBPResult {
  has_gbp: boolean;
  completeness_score: number;
  missing_fields: string[];
  recommendations: string[];
}

export async function POST(request: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled.", status: "maintenance" }, { status: 503 });
    const body = await request.json();
    const { brand, location } = body;

    if (!brand) {
      return NextResponse.json({ error: "brand is required" }, { status: 400 });
    }

    const locationCtx = location ? ` in ${location}` : "";

    // Two parallel Gemini checks
    const [gbpCheck, panelCheck] = await Promise.all([
      askGemini(
        `Analyze the Google Business Profile for "${brand}"${locationCtx}. ` +
        `Answer in strict JSON format: { "has_gbp": true/false, "completeness_score": 0-100, ` +
        `"listed_info": ["field1", "field2"], "missing_fields": ["field1", "field2"], ` +
        `"recommendations": ["rec1", "rec2"] }. ` +
        `Check for: business name, address, phone, hours, website, photos, reviews, categories, description, Q&A. ` +
        `Only output the JSON, nothing else.`
      ),
      askGemini(
        `When someone searches for "${brand}"${locationCtx} on Google, does a business knowledge panel or ` +
        `Google Business Profile appear on the right side? Answer in strict JSON: ` +
        `{ "panel_appears": true/false, "panel_type": "business|knowledge|none", "details": "brief description" }. ` +
        `Only output the JSON, nothing else.`
      ),
    ]);

    // Parse Gemini responses
    let gbpData: Partial<GBPResult> = {};
    let panelData: { panel_appears?: boolean; panel_type?: string; details?: string } = {};

    try {
      const cleaned = gbpCheck.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      gbpData = JSON.parse(cleaned);
    } catch {
      gbpData = { has_gbp: false, completeness_score: 0, missing_fields: ["Unable to determine"], recommendations: ["Create a Google Business Profile for your brand"] };
    }

    try {
      const cleaned = panelCheck.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      panelData = JSON.parse(cleaned);
    } catch {
      panelData = { panel_appears: false, panel_type: "none", details: "Could not determine" };
    }

    return NextResponse.json({
      status: "complete",
      brand,
      location: location || null,
      has_gbp: gbpData.has_gbp ?? false,
      completeness_score: gbpData.completeness_score ?? 0,
      missing_fields: gbpData.missing_fields ?? [],
      recommendations: gbpData.recommendations ?? [],
      search_panel: panelData,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Internal server error") }, { status: 500 });
  }
}

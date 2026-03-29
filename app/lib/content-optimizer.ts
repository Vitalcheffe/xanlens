// Content Optimizer — scores a website for AI-friendliness using Gemini

export interface ContentOptimizerResult {
  score: number;
  grade: string;
  recommendations: Array<{
    category: string;
    issue: string;
    fix: string;
    priority: "high" | "medium" | "low";
  }>;
  details: {
    headings_score: number;
    faq_score: number;
    schema_score: number;
    citation_worthiness: number;
    entity_density: number;
  };
}

export async function analyzeContentForAI(url: string): Promise<ContentOptimizerResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!apiKey) throw new Error("No Gemini API key configured");

  // Fetch the page HTML
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    html = await res.text();
    // Truncate to ~30k chars to fit Gemini context
    if (html.length > 30000) html = html.slice(0, 30000);
  } catch {
    throw new Error(`Could not fetch ${url}`);
  }

  const prompt = `You are an AI content optimization expert. Analyze this HTML page for AI-friendliness — how well AI engines (ChatGPT, Gemini, Perplexity, etc.) can extract, understand, and cite this content.

Score each dimension 0-100:
1. **headings_score** — Clear H1-H6 hierarchy, descriptive headings that answer questions
2. **faq_score** — Presence of FAQ sections, Q&A format content, "People Also Ask" style content
3. **schema_score** — JSON-LD structured data, schema.org markup, rich metadata
4. **citation_worthiness** — Unique data, statistics, expert quotes, original research that AI would want to cite
5. **entity_density** — Clear named entities (brand, products, people, locations) that AI can extract

Also provide 3-6 specific recommendations to improve AI-friendliness.

Respond ONLY with valid JSON (no markdown):
{
  "headings_score": number,
  "faq_score": number,
  "schema_score": number,
  "citation_worthiness": number,
  "entity_density": number,
  "overall_score": number,
  "recommendations": [
    {"category": "string", "issue": "string", "fix": "string", "priority": "high|medium|low"}
  ]
}

HTML to analyze:
${html}`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    const parsed = JSON.parse(text);
    const overall = parsed.overall_score ?? Math.round(
      (parsed.headings_score + parsed.faq_score + parsed.schema_score + parsed.citation_worthiness + parsed.entity_density) / 5
    );
    const grade = overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

    return {
      score: overall,
      grade,
      recommendations: (parsed.recommendations || []).slice(0, 6),
      details: {
        headings_score: parsed.headings_score ?? 0,
        faq_score: parsed.faq_score ?? 0,
        schema_score: parsed.schema_score ?? 0,
        citation_worthiness: parsed.citation_worthiness ?? 0,
        entity_density: parsed.entity_density ?? 0,
      },
    };
  } catch {
    return {
      score: 0,
      grade: "F",
      recommendations: [],
      details: { headings_score: 0, faq_score: 0, schema_score: 0, citation_worthiness: 0, entity_density: 0 },
    };
  }
}

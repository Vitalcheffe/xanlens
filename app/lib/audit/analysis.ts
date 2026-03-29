import { queryGemini, queryTavily } from "./engine-clients";
import { analyzeMentions, type MentionAnalysis } from "./scoring";

// --- External Presence Check ---

export interface ExternalPresence {
  found: string[];
  missing: string[];
  details: Array<{ platform: string; url: string; title: string }>;
}

export async function checkExternalPresence(brand: string): Promise<ExternalPresence> {
  const platforms = ["reddit.com", "linkedin.com", "crunchbase.com", "g2.com", "github.com"];
  const query = `"${brand}" (site:reddit.com OR site:linkedin.com OR site:crunchbase.com OR site:g2.com OR site:github.com)`;

  const result = await queryTavily(query);

  const found: string[] = [];
  const details: Array<{ platform: string; url: string; title: string }> = [];

  for (const r of result.results) {
    const urlLower = r.url.toLowerCase();
    for (const platform of platforms) {
      if (urlLower.includes(platform) && !found.includes(platform)) {
        found.push(platform);
        details.push({ platform, url: r.url, title: r.title });
      }
    }
  }

  const missing = platforms.filter(p => !found.includes(p));
  return { found, missing, details };
}

// --- Citation Intelligence ---

export interface CitationIntelligence {
  brand_cited: boolean;
  citing_sources: string[];
  total_web_results: number;
  brand_in_results: number;
}

export function analyzeCitations(tavilyResults: Array<{ title: string; url: string; content: string }>, brandWebsite: string): CitationIntelligence {
  if (!brandWebsite) {
    return { brand_cited: false, citing_sources: [], total_web_results: tavilyResults.length, brand_in_results: 0 };
  }
  let brandDomain: string;
  try {
    brandDomain = new URL(brandWebsite.startsWith("http") ? brandWebsite : `https://${brandWebsite}`).hostname.replace(/^www\./, "");
  } catch {
    return { brand_cited: false, citing_sources: [], total_web_results: tavilyResults.length, brand_in_results: 0 };
  }

  const citingSources: string[] = [];
  let brandInResults = 0;

  for (const r of tavilyResults) {
    try {
      const rDomain = new URL(r.url).hostname.replace(/^www\./, "");
      if (rDomain === brandDomain || rDomain.endsWith("." + brandDomain)) {
        brandInResults++;
      } else {
        const contentLower = (r.content || "").toLowerCase();
        if (contentLower.includes(brandDomain.toLowerCase())) {
          citingSources.push(rDomain);
        }
      }
    } catch { /* skip bad URLs */ }
  }

  return {
    brand_cited: citingSources.length > 0 || brandInResults > 0,
    citing_sources: [...new Set(citingSources)],
    total_web_results: tavilyResults.length,
    brand_in_results: brandInResults,
  };
}

// --- Competitor Benchmarking ---

export interface CompetitorResult {
  name: string;
  mentions: number;
  sentiment: string;
}

export interface CompetitorAnalysis {
  your_mentions: number;
  share_of_voice: number;
  competitors: CompetitorResult[];
}

export function analyzeCompetitors(allResponses: string[], brand: string, competitors: string[], industry?: string): CompetitorAnalysis {
  const allText = allResponses.join("\n\n");
  const brandAnalysis = analyzeMentions(allText, brand, industry);

  const competitorResults: CompetitorResult[] = competitors.slice(0, 5).map(comp => {
    let analysis = analyzeMentions(allText, comp, industry);
    if (analysis.mentions === 0) {
      const baseName = comp.replace(/\s*(AI|HQ|\.ai|\.io|\.com)\s*$/i, "").trim();
      if (baseName !== comp && baseName.length >= 3) {
        analysis = analyzeMentions(allText, baseName, industry);
      }
    }
    return { name: comp, mentions: analysis.mentions, sentiment: analysis.sentiment };
  });

  const totalMentions = brandAnalysis.mentions + competitorResults.reduce((sum, c) => sum + c.mentions, 0);
  const shareOfVoice = totalMentions > 0 ? Math.round((brandAnalysis.mentions / totalMentions) * 100) : 0;

  return {
    your_mentions: brandAnalysis.mentions,
    share_of_voice: shareOfVoice,
    competitors: competitorResults,
  };
}

// --- Content Gap Detection ---

export interface ContentGap {
  question: string;
  status: "missing" | "incomplete" | "inaccurate";
  detail: string;
}

export async function detectContentGaps(
  brand: string,
  industry: string,
  brandedResponses: string[],
  siteAnalysis: { title?: string; h1_text?: string; meta_description_text?: string; schema_types?: string[] } | null
): Promise<ContentGap[]> {
  const brandedText = brandedResponses.filter(Boolean).join("\n---\n");
  const siteInfo = siteAnalysis
    ? `Site title: "${siteAnalysis.title || "unknown"}". Description: "${siteAnalysis.meta_description_text || "none"}". Schema: ${siteAnalysis.schema_types?.join(", ") || "none"}.`
    : "No website provided.";

  const prompt = `You are a GEO analyst. Analyze what AI engines DON'T know about "${brand}" in ${industry}.

Here is what AI engines said when asked about ${brand}:
${brandedText.slice(0, 3000)}

Site info: ${siteInfo}

Identify 5-8 specific content gaps — things AI engines can't answer, got wrong, or gave incomplete answers about. Focus on:
1. Missing product features/capabilities
2. Missing pricing/plans information
3. Missing founding story/team info
4. Missing use cases or target audience
5. Missing technical details (integrations, API, etc.)
6. Inaccurate or outdated information
7. Missing comparison to alternatives
8. Missing social proof (reviews, customers, case studies)

Return ONLY a JSON array (no markdown, no code blocks):
[{"question":"What question can AI not answer?","status":"missing|incomplete|inaccurate","detail":"Brief explanation of the gap"}]`;

  try {
    const raw = await queryGemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    const gaps = JSON.parse(match?.[0] || "[]") as ContentGap[];
    return gaps.filter(g => g.question && g.status && g.detail).slice(0, 8);
  } catch {
    return [];
  }
}

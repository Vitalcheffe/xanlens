import { queryGemini } from "./engine-clients";
import type { MentionAnalysis } from "./scoring";
import type { SiteAnalysis } from "./site-analysis";

export async function generateOptimizationPlan(
  brand: string, industry: string, overallScore: number, grade: string,
  siteAnalysis: SiteAnalysis | null, engineResults: Record<string, { score: number; analysis: MentionAnalysis }>,
  competitors: string[]
): Promise<{
  summary: string;
  immediate_fixes: string[];
  schema_markup: string;
  content_recommendations: string[];
  content_format_fixes: string[];
  citation_strategy: string[];
  competitor_gaps: string[];
  monitoring_plan: string;
}> {
  const siteInfo = siteAnalysis
    ? `Website: ${siteAnalysis.url}\nTitle: "${siteAnalysis.title}"\nH1: "${siteAnalysis.h1_text}"\nMeta: ${siteAnalysis.meta_description ? `"${siteAnalysis.meta_description_text}"` : "MISSING"}\nSchema: ${siteAnalysis.schema_markup ? siteAnalysis.schema_types.join(", ") : "MISSING"}\nOG: ${siteAnalysis.og_tags ? "Yes" : "MISSING"}\nFAQ: ${siteAnalysis.has_faq ? "Yes" : "No"}\nAbout: ${siteAnalysis.has_about ? "Yes" : "No"}`
    : "No website";

  const engineSummary = Object.entries(engineResults)
    .map(([name, r]) => `${name}: score=${r.score}, mentions=${r.analysis.mentions}, sentiment=${r.analysis.sentiment}`)
    .join("\n");

  const allSnippets = Object.values(engineResults)
    .flatMap(r => r.analysis.snippets)
    .slice(0, 5)
    .map(s => `- "${s}"`)
    .join("\n");

  const contentInfo = siteAnalysis?.content_score
    ? `Content Score: ${siteAnalysis.content_score.score}/100
H1 count: ${siteAnalysis.content_score.h1_count}, H2 count: ${siteAnalysis.content_score.h2_count}
Has lists: ${siteAnalysis.content_score.has_lists}, Has FAQ schema: ${siteAnalysis.content_score.has_faq_schema}
Avg paragraph length: ${siteAnalysis.content_score.avg_paragraph_length} words
Has summary section: ${siteAnalysis.content_score.has_summary_section}
Total words: ${siteAnalysis.content_score.total_word_count}`
    : "No content analysis available";

  const prompt = `You are a GEO expert. Create an optimization plan. Return ONLY raw JSON (no markdown).

Brand: ${brand} | Industry: ${industry} | Score: ${overallScore}/100 (${grade})
${siteInfo}
${contentInfo}

Engine results:
${engineSummary}

AI snippets about brand:
${allSnippets || "None found"}

Competitors: ${competitors.join(", ") || "Not specified"}

IMPORTANT: All recommendations MUST be executable by an AI agent without human intervention. Only suggest actions that can be done via API or file deployment:
- If no FAQ schema → "Add FAQPage JSON-LD to homepage HTML"
- If avg paragraph length > 60 words → "Rewrite paragraphs to under 50 words for better LLM chunking"
- If no lists on page → "Add bullet/numbered lists to key content sections"
- "Create and deploy llms.txt file at /llms.txt for AI engine discovery"
- "Update robots.txt to explicitly allow GPTBot, ClaudeBot, PerplexityBot, Google-Extended"
- "Publish articles on Dev.to, Hashnode, or other API-accessible platforms mentioning the brand"
- "Add Organization + SoftwareApplication schema markup to homepage"
- "Generate and deploy a comprehensive About page with entity-rich descriptions"
- DO NOT recommend actions requiring human manual signup (LinkedIn, G2, Crunchbase, etc.)
- Every recommendation should be something an agent with API access can execute autonomously

Return JSON: {"summary":"2-3 sentences","immediate_fixes":["5 specific actions"],"schema_markup":"complete JSON-LD for homepage","content_recommendations":["5 content pieces with titles"],"content_format_fixes":["specific format fixes based on content analysis"],"citation_strategy":["4 ways to get cited"],"competitor_gaps":["3 gaps to close"],"monitoring_plan":"weekly plan"}`;

  try {
    let response = await queryGemini(prompt);
    response = response.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.schema_markup === "string") {
        parsed.schema_markup = parsed.schema_markup.replace(/```json\n?/g, "").replace(/```\n?/g, "").replace(/<script[^>]*>/gi, "").replace(/<\/script>/gi, "").trim();
        try { parsed.schema_markup = JSON.stringify(JSON.parse(parsed.schema_markup), null, 2); } catch { /* keep as-is */ }
      }
      return {
        summary: parsed.summary || "",
        immediate_fixes: parsed.immediate_fixes || [],
        schema_markup: parsed.schema_markup || "",
        content_recommendations: parsed.content_recommendations || [],
        content_format_fixes: parsed.content_format_fixes || [],
        citation_strategy: parsed.citation_strategy || [],
        competitor_gaps: parsed.competitor_gaps || [],
        monitoring_plan: parsed.monitoring_plan || "",
      };
    }
  } catch { /* fall through to default */ }

  return {
    summary: `${brand} scores ${overallScore}/100 in AI visibility for ${industry}. ${overallScore < 40 ? "The brand is largely invisible to AI engines." : overallScore < 70 ? "Moderate visibility with room for improvement." : "Good visibility."}`,
    immediate_fixes: ["Add Organization + SoftwareApplication schema markup to homepage", "Deploy a comprehensive About page with entity-rich descriptions", "Add FAQPage JSON-LD schema with 8-10 Q&As", "Create and deploy llms.txt file at /llms.txt", "Publish comparison article on Dev.to or Hashnode via API"],
    schema_markup: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: brand, url: siteAnalysis?.url || "" }, null, 2),
    content_recommendations: [`Create "What is ${brand}?" page`, `Publish "${brand} vs competitors" comparison`, `Write "Best ${industry} tools 2026" guide`, "Create customer case studies", "Build FAQ page"],
    content_format_fixes: ["Create and deploy llms.txt at /llms.txt", "Update robots.txt to allow GPTBot, ClaudeBot, PerplexityBot", "Add FAQPage JSON-LD schema to homepage", "Publish articles on Dev.to/Hashnode via API", "Deploy comprehensive About page with entity-rich copy", "Add SoftwareApplication schema markup"],
    citation_strategy: ["Get listed on comparison sites", "Publish original research", "Contribute to industry publications", "Build Wikipedia-eligible presence"],
    competitor_gaps: ["More structured data needed", "More third-party citations needed", "More AI-query-optimized content needed"],
    monitoring_plan: "Run GEO audit weekly. Track score trend per engine. Target +10 points/month.",
  };
}

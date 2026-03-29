export const FLUFF_FILTER = `
BIAS & FLUFF FILTER (MANDATORY):
- NEVER use these words: "revolutionary", "cutting-edge", "game-changing", "innovative", "next-generation", "best-in-class", "world-class", "state-of-the-art", "disruptive", "synergy", "leverage", "empower", "seamless", "robust", "scalable" (unless citing a specific benchmark).
- Replace marketing adjectives with: technical specs, concrete numbers, specific capabilities, measurable outcomes.
- Write in confident, fact-dense, objective tone. No hype. No filler.
- Example BAD: "Our revolutionary AI platform is a game-changing solution." 
- Example GOOD: "\${"{brand}"} processes 10,000 queries/day with 95% accuracy using a RAG pipeline."
`;

export const STATS_INJECTION = `
STATS & CITATIONS REQUIREMENT (MANDATORY):
- Include at least 1 data point, statistic, or technical definition per 300 words.
- Reference specific studies, benchmarks, or expert quotes where possible.
- Example: "According to the Princeton 2025 GEO study, content with statistics and expert quotes has ~40% higher probability of being selected by LLMs."
- Prefer concrete numbers over vague claims: "reduces load time by 2.3s" over "improves performance".
- If you cannot find a real statistic, use a technical definition or industry benchmark instead.
`;

export interface AuditResults {
  overall_score: number;
  grade: string;
  engines: Record<string, { score: number; mentions: number; sentiment: string; sample_snippets?: string[] }>;
  site_analysis?: {
    url?: string;
    schema_markup: boolean;
    schema_types?: string[];
    has_faq: boolean;
    has_about: boolean;
    meta_description: boolean;
    meta_description_text?: string;
    og_tags: boolean;
    h1_text?: string;
    title?: string;
  } | null;
  optimization?: {
    summary: string;
    immediate_fixes: string[];
    content_recommendations: string[];
  };
}

export function auditContext(brand: string, industry: string, audit: AuditResults): string {
  const engines = Object.entries(audit.engines)
    .map(([name, d]) => `${name}: ${d.score}/100, ${d.mentions} mentions, ${d.sentiment}`)
    .join("; ");
  const site = audit.site_analysis;
  const siteInfo = site
    ? `Schema: ${site.schema_markup ? "yes" : "MISSING"}, FAQ: ${site.has_faq ? "yes" : "MISSING"}, About: ${site.has_about ? "yes" : "MISSING"}, Meta: ${site.meta_description ? "yes" : "MISSING"}`
    : "No site data";

  let siteContent = "";
  if (site) {
    const parts: string[] = [];
    if (site.title) parts.push(`Page title: "${site.title}"`);
    if (site.h1_text) parts.push(`Main heading: "${site.h1_text}"`);
    if (site.meta_description_text) parts.push(`Description: "${site.meta_description_text}"`);
    if (site.url) parts.push(`URL: ${site.url}`);
    if (site.schema_types?.length) parts.push(`Schema types: ${site.schema_types.join(", ")}`);
    if (parts.length > 0) siteContent = ` | Site content: ${parts.join("; ")}`;
  }

  const allSnippets = Object.entries(audit.engines)
    .flatMap(([name, d]) => (d.sample_snippets || []).map(s => `[${name}] ${s}`));
  const snippetContext = allSnippets.length > 0
    ? ` | What AI engines say about ${brand}: ${allSnippets.slice(0, 5).join(" | ")}`
    : "";

  return `Brand: ${brand} | Industry: ${industry} | Score: ${audit.overall_score}/100 (${audit.grade}) | Engines: ${engines} | Site: ${siteInfo}${siteContent}${snippetContext}`;
}

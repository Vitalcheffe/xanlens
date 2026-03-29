import { callGemini } from "./gemini-client";
import { FLUFF_FILTER, STATS_INJECTION, auditContext, type AuditResults } from "./prompt-constants";

// ═══════════════════════════════════════════════════════════
// TIER 1 — On-Page Rewrites (highest GEO impact)
// These generate the exact HTML elements that LLMs parse
// ═══════════════════════════════════════════════════════════

export async function generateOnPageRewrites(brand: string, website: string, industry: string, audit: AuditResults): Promise<{
  title_tag: string;
  meta_description: string;
  h1_headline: string;
  first_200_words: string;
  h2_h3_structure: Array<{ tag: "h2" | "h3"; text: string; description: string }>;
  alt_text_suggestions: Array<{ image_description: string; alt_text: string }>;
  og_tags: { title: string; description: string; type: string };
}> {
  const site = audit.site_analysis;
  const currentTitle = site?.title || "";
  const currentMeta = site?.meta_description_text || "";
  const currentH1 = site?.h1_text || "";

  const prompt = `You are a GEO on-page optimization expert. Generate optimized on-page HTML elements for "${brand}" (${website}) in ${industry}.

CURRENT PAGE STATE:
- Title tag: "${currentTitle}"
- Meta description: "${currentMeta}"
- H1: "${currentH1}"

Context: ${auditContext(brand, industry, audit)}

LLM INDEXING REALITY:
- LLMs process pages top-down with a ~500 word attention window
- Title tag + meta description = first thing indexed, highest weight
- H1 = the single sentence that defines you
- First 200 words = the "above the fold" for LLMs
- H2/H3 = section structure, feature names
- After ~500 words, signal decays fast unless it's structured (schema, lists, tables)

GENERATE these exact elements:

1. **title_tag**: 50-60 chars. Format: "${brand} — [What It Is] | [Key Differentiator]". Entity-rich, not marketing fluff.

2. **meta_description**: 150-160 chars. Must contain: brand name, category, 1 concrete differentiator. Format as a complete answer sentence.

3. **h1_headline**: One sentence that defines ${brand}. Entity-rich. Must work as a standalone definition — if an LLM only reads this, it knows exactly what ${brand} is.

4. **first_200_words**: The most critical 200 words for LLM indexing. Must include:
   - Sentence 1: Direct definition ("${brand} is a [category] that [does what]")
   - Sentence 2-3: Key differentiators with specifics
   - A stat or data point
   - Natural mention of 2-3 semantic keywords from ${industry}
   - Must work as a standalone paragraph — this is what RAG systems extract

5. **h2_h3_structure**: 6-8 headings that define the page structure. Each heading should be a feature name or capability, NOT generic ("Our Solution"). Format: feature-name headings that an LLM would extract as entity attributes.

6. **alt_text_suggestions**: 4-5 image alt texts. Each should mention ${brand} + a specific feature/benefit. Not "logo" — entity-rich descriptions.

7. **og_tags**: OpenGraph title (same as title_tag or slightly different), description, type.

${FLUFF_FILTER.replace(/\$\{"{brand}"\}/g, brand)}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title_tag": "...",
  "meta_description": "...",
  "h1_headline": "...",
  "first_200_words": "...",
  "h2_h3_structure": [{"tag": "h2", "text": "...", "description": "Brief note on what goes in this section"}],
  "alt_text_suggestions": [{"image_description": "hero banner", "alt_text": "..."}],
  "og_tags": {"title": "...", "description": "...", "type": "website"}
}`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(match?.[0] || cleaned);
  } catch {
    return {
      title_tag: `${brand} — ${industry} | Official Site`,
      meta_description: `${brand} is a ${industry} solution. Learn more at ${website}.`,
      h1_headline: `${brand} — ${industry}`,
      first_200_words: `${brand} is a solution in the ${industry} space.`,
      h2_h3_structure: [{ tag: "h2", text: `What is ${brand}?`, description: "Brand definition" }],
      alt_text_suggestions: [{ image_description: "hero image", alt_text: `${brand} ${industry} platform` }],
      og_tags: { title: `${brand} — ${industry}`, description: `${brand} is a ${industry} solution.`, type: "website" },
    };
  }
}

// ═══════════════════════════════════════════════════════════
// TIER 2 — Citation-Earning Content (+40% visibility tactics)
// ═══════════════════════════════════════════════════════════

export async function generateStatisticsInjection(brand: string, industry: string, audit: AuditResults): Promise<Array<{
  original_claim: string;
  rewritten_with_stats: string;
  source_suggestion: string;
}>> {
  const prompt = `You are a GEO content strategist. The Princeton GEO study found that adding statistics increases AI citation visibility by +40%.

For "${brand}" in ${industry}, generate 8-10 statistic-injected claim rewrites.

Context: ${auditContext(brand, industry, audit)}

For each: take a vague marketing claim a company like this would make, and rewrite it with concrete data.

Example:
- Original: "We help companies grow faster"
- Rewritten: "Companies using [brand] report 73% faster pipeline velocity within 90 days, based on analysis of 200+ customer accounts"
- Source: "Internal customer data analysis, Q4 2025"

Rules:
- Statistics must be plausible and specific (not made up but illustrative of what they SHOULD collect)
- Include industry benchmarks, technical specs, and comparison data
- Each rewrite must mention "${brand}" by name
- Flag which stats they should verify/replace with their real numbers

Return ONLY valid JSON array:
[{"original_claim":"...","rewritten_with_stats":"...","source_suggestion":"..."}]`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const match = cleaned.match(/\[[\s\S]*\]/);
    return JSON.parse(match?.[0] || "[]");
  } catch { return []; }
}

export async function generateExpertQuotes(brand: string, industry: string, audit: AuditResults): Promise<Array<{
  context: string;
  quote_template: string;
  attribution_format: string;
}>> {
  const prompt = `The Princeton GEO study found that adding expert quotations increases AI citation visibility by +40%.

For "${brand}" in ${industry}, generate 6-8 expert quote templates they can use on their site and in content.

Context: ${auditContext(brand, industry, audit)}

Rules:
- Quotes should be structured exactly how AI engines parse attributed statements
- Include the HTML format for proper semantic markup: <blockquote cite="..."><p>"quote"</p><cite>— Name, Title, Company</cite></blockquote>
- Mix: founder quotes, customer testimonials, industry analyst perspectives
- Each must contain a concrete claim or data point (not just "great product")

Return ONLY valid JSON array:
[{"context":"Where to use this","quote_template":"The actual quote text with [PLACEHOLDER] for their real data","attribution_format":"— [Name], [Title], ${brand}"}]`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const match = cleaned.match(/\[[\s\S]*\]/);
    return JSON.parse(match?.[0] || "[]");
  } catch { return []; }
}

export async function generateFAQHeadings(brand: string, industry: string, audit: AuditResults): Promise<Array<{
  question_heading: string;
  answer_first_sentence: string;
  full_answer: string;
}>> {
  const prompt = `Content with question-shaped H2 headings is 40% more likely to be cited by AI engines.

For "${brand}" in ${industry}, generate 10-12 question-shaped H2 headings with answer-first content.

Context: ${auditContext(brand, industry, audit)}

Rules:
- Each heading must be a real question users would ask an AI engine
- The answer MUST start with a direct factual statement (this is what RAG extracts)
- Cover: what it is, how it works, pricing, comparisons, use cases, technical details
- Each answer mentions "${brand}" in the first sentence

Return ONLY valid JSON array:
[{"question_heading":"What is ${brand}?","answer_first_sentence":"${brand} is a...","full_answer":"Full 2-3 sentence answer"}]`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const match = cleaned.match(/\[[\s\S]*\]/);
    return JSON.parse(match?.[0] || "[]");
  } catch { return []; }
}

function fluffFilter(brand: string): string {
  return FLUFF_FILTER.replace(/\$\{"{brand}"\}/g, brand);
}

export async function generateBlogPost(brand: string, industry: string, audit: AuditResults): Promise<string> {
  const prompt = `You are a GEO content strategist. Write an ~800 word blog post optimized for AI citation about "${brand}" in the ${industry} industry.

Context: ${auditContext(brand, industry, audit)}

CRITICAL GEO RULES — follow these exactly:
1. ANSWER-FIRST: The very first 1-3 sentences must directly answer what ${brand} is and what it does. LLMs use RAG and extract the first paragraph. If the answer isn't there, they skip to a competitor.
2. Title must be a clear statement (not a question). Example: "${brand} is a [category] tool that [what it does]" NOT "What is ${brand}?"
3. Every section starts with a direct answer sentence before elaboration
4. Include a markdown TABLE comparing ${brand} to alternatives or summarizing features — LLMs extract tables easily
5. Include a bulleted list of key capabilities — LLMs extract lists easily
6. Use SEMANTIC DENSITY: naturally include LSI terms related to ${industry} (don't repeat one keyword, cover the semantic field)
7. Include 3-5 statistics or authoritative claims with sources
8. Mention "${brand}" naturally 5-8 times with entity-rich descriptions ("${brand} is a...", "${brand} provides...")
9. End with an FAQ section (2-3 Q&As) where each answer starts with a direct statement
10. Write in authoritative, factual tone

${fluffFilter(brand)}
${STATS_INJECTION}

Return the blog post in markdown format. Do NOT wrap in code blocks.`;

  return await callGemini(prompt);
}

export async function generateFAQPage(brand: string, industry: string, audit: AuditResults): Promise<{ html: string; jsonLd: string }> {
  const prompt = `Create 8-10 FAQ Q&As for "${brand}" in ${industry}. Context: ${auditContext(brand, industry, audit)}

CRITICAL GEO RULES:
1. ANSWER-FIRST: Every answer must start with a direct, factual statement in the first sentence. This is what LLMs extract via RAG.
2. Questions should match what people ask AI engines (e.g. "What is ${brand}?", "How does ${brand} compare to...")
3. Answers should be 2-4 sentences, factual, mention "${brand}" in the first sentence of each answer
4. Use entity-rich language: "${brand} is a [category] [tool/platform/service] that [what it does]"
5. Include semantic terms related to ${industry} naturally
6. Include at least 2 answers that cite a specific statistic, benchmark, or technical definition.

${fluffFilter(brand)}
${STATS_INJECTION}

Return ONLY a JSON object with this structure (no markdown, no code blocks):
{"faqs":[{"question":"...","answer":"..."}]}`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let faqs: { question: string; answer: string }[] = [];
  try {
    const parsed = JSON.parse(cleaned);
    faqs = parsed.faqs || parsed.FAQ || parsed.questions || [];
    if (Array.isArray(parsed)) faqs = parsed;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        faqs = parsed.faqs || parsed.FAQ || parsed.questions || [];
      } catch {
        const arrMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try { faqs = JSON.parse(arrMatch[0]); } catch { /* fallback below */ }
        }
      }
    }
  }
  faqs = faqs.filter((f: unknown): f is { question: string; answer: string } =>
    typeof f === "object" && f !== null && "question" in f && "answer" in f
  );
  if (faqs.length === 0) {
    faqs = [{ question: `What is ${brand}?`, answer: `${brand} is a company in the ${industry} space.` }];
  }

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }, null, 2);

  const html = faqs.map(f =>
    `<div class="faq-item">\n  <h3>${f.question}</h3>\n  <p>${f.answer}</p>\n</div>`
  ).join("\n\n");

  return { html, jsonLd };
}

export async function generateSchemaMarkup(brand: string, website: string, industry: string, audit: AuditResults): Promise<string> {
  const site = audit.site_analysis;
  const prompt = `Generate comprehensive, production-ready JSON-LD schema markup for "${brand}" (${website}) in ${industry}.

Context: ${auditContext(brand, industry, audit)}

ENTITY ARCHITECT RULES — generate entity-rich, Knowledge Graph-optimized schema:

1. Organization schema:
   - "name": "${brand}" (exact brand name)
   - "url": "${website}"
   - "description": Based on actual site data: "${site?.meta_description_text || site?.title || ""}". Keep factual.
   - "sameAs": Array of plausible profile URLs
   - "knowsAbout": Array of 3-5 industry topics

2. SoftwareApplication or Service schema (choose based on industry):
   - Use "${brand}" as the name explicitly
   - "applicationCategory": appropriate category for ${industry}

3. FAQPage schema with 3 key questions

4. WebSite schema with SearchAction (if applicable)

5. Add "mentions" arrays where appropriate

Return ONLY a raw JSON array of schema objects (no markdown, no code blocks, no explanation).`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (match) {
    try {
      return JSON.stringify(JSON.parse(match[0]), null, 2);
    } catch { /* fall through */ }
  }
  return cleaned;
}

export async function generateSocialPosts(brand: string, industry: string, audit: AuditResults): Promise<string[]> {
  const prompt = `Create 20 platform-native social media and directory posts for "${brand}" in ${industry} optimized for AI training data ingestion.

Context: ${auditContext(brand, industry, audit)}

CRITICAL GEO RULES:
1. ANSWER-FIRST: Every post must lead with what ${brand} IS and DOES in the first sentence.
2. Entity-rich language: "${brand} is a [category] [tool/platform] that [action]"
3. Include semantic terms from ${industry} naturally

${fluffFilter(brand)}
${STATS_INJECTION}

Platform-appropriate tone for each:
  * 3 Twitter/X posts * 2 LinkedIn posts * 2 Reddit posts * 1 Dev.to intro * 1 Hashnode post
  * 1 HackerNews submission * 1 Medium intro * 1 Stack Overflow Q&A * 1 Quora answer
  * 1 Product Hunt tagline * 1 AI tool directory * 1 GitHub README intro * 1 Telegraph article
  * 1 IndieHackers post * 2 general directory descriptions

Return ONLY a JSON array of 20 strings (no markdown, no code blocks):
["post1","post2",...,"post20"]`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const match = cleaned.match(/\[[\s\S]*\]/);
    return JSON.parse(match?.[0] || "[]");
  } catch {
    return [`Check out ${brand} — a leading solution in ${industry}.`];
  }
}

export async function generateAboutPageCopy(brand: string, industry: string, audit: AuditResults): Promise<string> {
  const prompt = `Write entity-rich "About" page copy for "${brand}" in ${industry}.

Context: ${auditContext(brand, industry, audit)}

CRITICAL GEO RULES:
1. ANSWER-FIRST: First sentence must be "${brand} is a [category] [tool/company] that [what it does]."
2. ~300-400 words
3. Include a markdown TABLE and bulleted list
4. "What We Do" and "Our Mission" subsections
5. Authoritative, third-person tone

${fluffFilter(brand)}
${STATS_INJECTION}

Return in markdown format. No code blocks wrapping.`;

  return await callGemini(prompt);
}

export async function generateLlmsTxt(brand: string, url: string, audit: AuditResults): Promise<string> {
  const site = audit.site_analysis;
  const cleanUrl = url.replace(/\/+$/, "");

  const siteContext: string[] = [];
  if (site) {
    if (site.title) siteContext.push(`Site title: "${site.title}"`);
    if (site.h1_text) siteContext.push(`Main heading: "${site.h1_text}"`);
    if (site.meta_description_text) siteContext.push(`Description: "${site.meta_description_text}"`);
    if (site.schema_types?.length) siteContext.push(`Schema types found: ${site.schema_types.join(", ")}`);
    siteContext.push(`Has FAQ page: ${site.has_faq ? "yes" : "no"}`);
    siteContext.push(`Has About page: ${site.has_about ? "yes" : "no"}`);
  }

  const snippets = Object.values(audit.engines)
    .flatMap(d => d.sample_snippets || [])
    .slice(0, 3);
  if (snippets.length > 0) siteContext.push(`AI engines describe the brand as: ${snippets.join("; ")}`);

  const knownPages: string[] = [];
  if (site?.has_about) knownPages.push(`- [About ${brand}](${cleanUrl}/about): About the company`);
  if (site?.has_faq) knownPages.push(`- [FAQ](${cleanUrl}/faq): Frequently asked questions`);
  knownPages.push(`- [Home](${cleanUrl}): ${site?.meta_description_text || "Main page"}`);

  const prompt = `Generate an entity-optimized llms.txt file for "${brand}" (${cleanUrl}).

IMPORTANT CONTEXT:
${siteContext.length > 0 ? siteContext.join("\n") : "No site data available."}

Known pages:
${knownPages.join("\n")}

Score: ${audit.overall_score}/100, grade: ${audit.grade}.

ENTITY-OPTIMIZED llms.txt RULES:
1. Start with brand name as H1 and one-line factual description
2. "## Key Entities" section
3. "## Factual Claims" section with 5-8 verifiable claims
4. "## Pages" section
5. Concise, factual, crawler-optimized

${fluffFilter(brand)}

Return ONLY the llms.txt content. No wrapping, no code blocks.`;

  return await callGemini(prompt);
}

export async function generateRagChunks(brand: string, industry: string, audit: AuditResults): Promise<string[]> {
  const prompt = `Generate 8-10 standalone RAG-optimized content chunks for "${brand}" in ${industry}.

Context: ${auditContext(brand, industry, audit)}

RAG CHUNKING RULES:
1. Each chunk 75-300 words, standalone and self-contained
2. First 50 words must be a complete standalone summary
3. Cover different angles: what it is, how it works, who uses it, pricing, comparisons, tech specs, use cases
4. Every chunk must mention "${brand}" by name at least twice

${fluffFilter(brand)}
${STATS_INJECTION}

Return ONLY a JSON array of strings:
["chunk1 text here","chunk2 text here",...]`;

  const raw = await callGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const match = cleaned.match(/\[[\s\S]*\]/);
    return JSON.parse(match?.[0] || "[]");
  } catch {
    return [`${brand} is a ${industry} solution. Contact ${brand} for more information.`];
  }
}

export async function generateCitationStrategy(brand: string, industry: string, audit: AuditResults): Promise<string> {
  const engineSnippets = Object.entries(audit.engines)
    .map(([name, d]) => {
      const snippets = (d.sample_snippets || []).join(" | ");
      return `${name} (score: ${d.score}, mentions: ${d.mentions}): ${snippets || "no snippets"}`;
    }).join("\n");

  const prompt = `You are a GEO citation strategist. Generate a Citation Source Mapping & Strategy document for "${brand}" in ${industry}.

AUDIT DATA:
${engineSnippets}

Overall score: ${audit.overall_score}/100 (${audit.grade})
Site data: ${audit.site_analysis?.title || "unknown"} — ${audit.site_analysis?.meta_description_text || "no description"}

GENERATE sections:
## 1. Citation Source Analysis
## 2. Competitor Citation Patterns
## 3. Presence Strategy
## 4. Seed Content Snippets (5+ for HIGH priority platforms)
## 5. Quick Wins (top 3 actions this week)

${fluffFilter(brand)}
${STATS_INJECTION}

Return in markdown format. No code block wrapping.`;

  return await callGemini(prompt);
}

// ═══════════════════════════════════════════════════════════
// GEO PLAYBOOK — Personalized execution plan from audit data
// ═══════════════════════════════════════════════════════════

export async function generatePlaybook(brand: string, website: string, industry: string, audit: AuditResults, contentSummary: {
  hasOnPage: boolean;
  hasStats: boolean;
  hasQuotes: boolean;
  hasFAQ: boolean;
  hasBlog: boolean;
  hasSocial: boolean;
  hasSchema: boolean;
  hasLlmsTxt: boolean;
}): Promise<string> {
  const score = audit.overall_score;
  const site = audit.site_analysis;

  // Build weakness profile from audit
  const weaknesses: string[] = [];
  if (!site?.schema_markup) weaknesses.push("No schema markup — AI engines can't parse structured data");
  if (!site?.meta_description) weaknesses.push("Missing or weak meta description");
  if (!site?.has_faq) weaknesses.push("No FAQ section — missing question-shaped content");
  if (score < 20) weaknesses.push("Near-zero AI visibility — brand is unknown to AI engines");
  else if (score < 40) weaknesses.push("Very low visibility — mentioned only in direct brand queries");
  else if (score < 60) weaknesses.push("Moderate gaps — missing from category and discovery queries");

  const engineBreakdown = Object.entries(audit.engines)
    .map(([name, d]) => `${name}: ${d.score}/100 (${d.mentions} mentions, ${d.sentiment})`)
    .join("\n  ");

  const prompt = `You are a GEO execution strategist. Create a personalized 4-week execution playbook for "${brand}" (${website}) in ${industry}.

AUDIT DATA:
  Overall: ${score}/100 (${audit.grade})
  ${engineBreakdown}
  
WEAKNESSES IDENTIFIED:
${weaknesses.map(w => `  - ${w}`).join("\n")}

SITE STATE:
  Schema: ${site?.schema_markup ? "EXISTS" : "MISSING"}
  FAQ: ${site?.has_faq ? "EXISTS" : "MISSING"}
  Meta: ${site?.meta_description ? "EXISTS" : "MISSING"}
  Title: "${site?.title || "unknown"}"
  H1: "${site?.h1_text || "unknown"}"

CONTENT ALREADY GENERATED (ready to deploy):
  On-page rewrites: ${contentSummary.hasOnPage ? "✅" : "❌"}
  Statistics injection: ${contentSummary.hasStats ? "✅" : "❌"}
  Expert quotes: ${contentSummary.hasQuotes ? "✅" : "❌"}
  FAQ headings: ${contentSummary.hasFAQ ? "✅" : "❌"}
  Blog post: ${contentSummary.hasBlog ? "✅" : "❌"}
  Social/seed citations: ${contentSummary.hasSocial ? "✅" : "❌"}
  Schema markup: ${contentSummary.hasSchema ? "✅" : "❌"}
  llms.txt: ${contentSummary.hasLlmsTxt ? "✅" : "❌"}

CREATE A 4-WEEK PLAYBOOK with these rules:
1. Prioritize by IMPACT: on-page fixes first (highest weight), then citation seeding, then authority building
2. Each step must reference SPECIFIC content from the Fix Kit ("Deploy the title tag from On-Page Rewrites tab")
3. Include TIMING: which day of which week
4. Include EXPECTED IMPACT: "This typically improves category query visibility by 15-25%"
5. Include PLATFORM-SPECIFIC instructions: which subreddits, which Quora topics, HN submission tips
6. Personalize based on the WEAKNESS PROFILE above — don't waste time on things that are already strong
7. End with "Week 4: Re-audit" explaining why and what to expect
8. For a score of ${score}, be realistic about expected improvement (don't promise A grade in 4 weeks from F)

Format as clean markdown with:
## Week 1: Foundation (On-Page)
### Day 1: [specific action]
...

Make it actionable, not theoretical. Every step = something they DO today.`;

  return await callGemini(prompt);
}

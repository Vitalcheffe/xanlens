export interface ContentScore {
  h1_count: number;
  h2_count: number;
  has_lists: boolean;
  avg_paragraph_length: number;
  has_faq_schema: boolean;
  has_summary_section: boolean;
  total_word_count: number;
  score: number;
}

export interface JsRendering {
  likely_js_dependent: boolean;
  body_text_length: number;
  script_tags: number;
  recommendation: string;
}

export interface SiteAnalysis {
  url: string;
  schema_markup: boolean;
  schema_types: string[];
  meta_description: boolean;
  meta_description_text: string;
  og_tags: boolean;
  h1_text: string;
  has_faq: boolean;
  has_about: boolean;
  title: string;
  content_score: ContentScore | null;
  js_rendering: JsRendering;
  has_llms_txt: boolean;
  llms_txt_length: number;
  robots_ai_crawlers: { allowed: string[]; blocked: string[]; no_robots: boolean };
  has_same_as: boolean;
  same_as_count: number;
}

export async function analyzeSite(website: string): Promise<SiteAnalysis | null> {
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "XanLens-Audit/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    const html = await res.text();

    const hasSchema = html.includes("schema.org") || html.includes("application/ld+json");
    const hasMetaDesc = html.includes('name="description"') || html.includes('property="og:description"');
    const hasOg = html.includes('property="og:');
    const hasFaq = html.toLowerCase().includes("faq") || html.includes("FAQPage");
    const hasAbout = html.toLowerCase().includes("/about") || html.toLowerCase().includes("about us");

    const schemaTypes: string[] = [];
    const ldMatches = html.match(/"@type"\s*:\s*"([^"]+)"/g) || [];
    for (const m of ldMatches) {
      const type = m.match(/"@type"\s*:\s*"([^"]+)"/)?.[1];
      if (type) schemaTypes.push(type);
    }

    const metaMatch = html.match(/name="description"\s+content="([^"]*)"/);
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);

    const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
    const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
    const hasLists = /<[uo]l[\s>]/i.test(html);
    const hasFaqSchema = html.includes("FAQPage");

    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = textContent.split(/\s+/).filter(w => w.length > 0);
    const totalWordCount = words.length;

    const paragraphs = (html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [])
      .map(p => p.replace(/<[^>]+>/g, "").trim())
      .filter(p => p.length > 10);
    const avgParagraphLength = paragraphs.length > 0
      ? Math.round(paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / paragraphs.length)
      : 0;

    const hasSummary = /tl;?dr|summary|overview|at a glance|key takeaway/i.test(html);

    let contentScoreVal = 0;
    if (h1Count === 1) contentScoreVal += 15;
    contentScoreVal += Math.min(h2Count, 20);
    if (hasLists) contentScoreVal += 10;
    if (avgParagraphLength > 0 && avgParagraphLength <= 50) contentScoreVal += 15;
    else if (avgParagraphLength > 0 && avgParagraphLength <= 80) contentScoreVal += 8;
    if (hasFaqSchema) contentScoreVal += 15;
    if (hasSummary) contentScoreVal += 10;
    if (totalWordCount >= 500 && totalWordCount <= 3000) contentScoreVal += 15;
    else if (totalWordCount > 3000) contentScoreVal += 10;
    else if (totalWordCount >= 200) contentScoreVal += 5;
    contentScoreVal = Math.min(contentScoreVal, 100);

    const scriptTags = (html.match(/<script[\s>]/gi) || []).length;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyHtml = bodyMatch?.[1] || html;
    const bodyText = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const bodyTextLength = bodyText.length;
    const hasJsRoot = /<div\s+id=["'](root|__next|app|__nuxt)["']/i.test(bodyHtml);
    const thinBody = bodyTextLength < 500;
    const likelyJsDependent = (thinBody && scriptTags >= 3) || (thinBody && hasJsRoot);
    const jsRendering: JsRendering = {
      likely_js_dependent: likelyJsDependent,
      body_text_length: bodyTextLength,
      script_tags: scriptTags,
      recommendation: likelyJsDependent
        ? "Your site appears to rely on client-side JavaScript rendering. AI crawlers (GPTBot, ClaudeBot, PerplexityBot) cannot execute JavaScript — they only see the initial HTML. Consider server-side rendering (SSR) or static generation (SSG) to ensure your content is visible to AI engines."
        : "Your site serves readable HTML content without requiring JavaScript. This is good for AI crawler visibility.",
    };

    const baseUrl = url.replace(/\/+$/, "");
    let hasLlmsTxt = false;
    let llmsTxtLength = 0;
    let robotsCrawlers: { allowed: string[]; blocked: string[]; no_robots: boolean } = { allowed: [], blocked: [], no_robots: true };

    try {
      const llmsRes = await fetch(`${baseUrl}/llms.txt`, { signal: AbortSignal.timeout(4000), headers: { "User-Agent": "XanLens-Audit/1.0" } });
      if (llmsRes.ok) {
        const llmsText = await llmsRes.text();
        hasLlmsTxt = llmsText.length > 10;
        llmsTxtLength = llmsText.length;
      }
    } catch { /* no llms.txt */ }

    try {
      const robotsRes = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(4000), headers: { "User-Agent": "XanLens-Audit/1.0" } });
      if (robotsRes.ok) {
        const robotsText = await robotsRes.text();
        const AI_BOTS = ["GPTBot", "ChatGPT-User", "Google-Extended", "ClaudeBot", "anthropic", "PerplexityBot", "Bytespider", "CCBot", "Amazonbot", "cohere-ai"];
        const rLines = robotsText.split("\n").map(l => l.trim());
        const rAllowed: string[] = [];
        const rBlocked: string[] = [];
        for (const bot of AI_BOTS) {
          let currentAgent = "";
          let isBlocked = false;
          for (const line of rLines) {
            const lineLower = line.toLowerCase();
            if (lineLower.startsWith("user-agent:")) currentAgent = lineLower.replace("user-agent:", "").trim();
            else if ((currentAgent === bot.toLowerCase() || currentAgent === "*") && lineLower.startsWith("disallow:")) {
              const path = line.split(":").slice(1).join(":").trim();
              if (path === "/" || path === "/*") { if (currentAgent === bot.toLowerCase()) isBlocked = true; else if (currentAgent === "*" && !isBlocked) isBlocked = true; }
            }
          }
          let tempAgent = "";
          for (const line of rLines) {
            const lineLower = line.toLowerCase();
            if (lineLower.startsWith("user-agent:")) tempAgent = lineLower.replace("user-agent:", "").trim();
            else if (tempAgent === bot.toLowerCase() && lineLower.startsWith("allow:")) {
              const path = line.split(":").slice(1).join(":").trim();
              if (path === "/" || path === "/*") isBlocked = false;
            }
          }
          if (isBlocked) rBlocked.push(bot); else rAllowed.push(bot);
        }
        robotsCrawlers = { allowed: rAllowed, blocked: rBlocked, no_robots: false };
      }
    } catch { /* no robots.txt */ }

    return {
      url: website,
      schema_markup: hasSchema,
      schema_types: schemaTypes,
      meta_description: hasMetaDesc,
      meta_description_text: (metaMatch?.[1] || "").slice(0, 300),
      og_tags: hasOg,
      h1_text: (h1Match?.[1]?.trim() || "").slice(0, 200),
      has_faq: hasFaq,
      has_about: hasAbout,
      title: (titleMatch?.[1] || "").slice(0, 200),
      content_score: {
        h1_count: h1Count,
        h2_count: h2Count,
        has_lists: hasLists,
        avg_paragraph_length: avgParagraphLength,
        has_faq_schema: hasFaqSchema,
        has_summary_section: hasSummary,
        total_word_count: totalWordCount,
        score: contentScoreVal,
      },
      js_rendering: jsRendering,
      has_llms_txt: hasLlmsTxt,
      llms_txt_length: llmsTxtLength,
      robots_ai_crawlers: robotsCrawlers,
      has_same_as: html.includes('"sameAs"'),
      same_as_count: (html.match(/"sameAs"/g) || []).length,
    };
  } catch {
    return null;
  }
}

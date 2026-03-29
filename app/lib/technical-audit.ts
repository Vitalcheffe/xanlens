/**
 * Technical Audit: robots.txt, llms.txt, Lighthouse, Social Proof
 * All free — no API keys needed (Lighthouse uses PageSpeed Insights API)
 */

import { llmJudgeMention } from "@/app/lib/llm-judge";

// ── Exa REMOVED — replaced by Tavily for all platform checks ──

// ── Tavily search helper (used for all platform presence checks) ──
const TAVILY_KEY = process.env.TAVILY_API_KEY || "";
async function tavilySearch(query: string, maxResults = 5): Promise<Array<{ title: string; url: string; content: string }>> {
  if (!TAVILY_KEY) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_KEY, query, max_results: maxResults, include_answer: false }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => ({ title: r.title || "", url: r.url || "", content: r.content || "" }));
  } catch { return []; }
}

// ── Universal website scraper: extract all social links from brand website ──
interface ScrapedSocialLinks {
  linkedin?: string;
  twitter?: string;
  github?: string;
  medium?: string;
  youtube?: string;
  discord?: string;
  reddit?: string;
  facebook?: string;
  producthunt?: string;
  crunchbase?: string;
}

async function scrapeWebsiteForSocialLinks(website: string): Promise<{ links: ScrapedSocialLinks; html: string }> {
  const empty = { links: {}, html: "" };
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" },
      redirect: "follow",
    });
    if (!res.ok) return empty;
    const html = await res.text();
    const links: ScrapedSocialLinks = {};

    // LinkedIn — company pages only, filter out share/feed/pulse/posts/articles
    const liMatch = html.match(/https?:\/\/(www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)/);
    if (liMatch && !/shareArticle|\/feed|\/pulse|\/posts/.test(liMatch[0])) {
      links.linkedin = liMatch[0];
    }

    // X / Twitter — filter out share/intent/search/hashtag
    const xMatch = html.match(/https?:\/\/(x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/);
    if (xMatch && !["share", "intent", "search", "hashtag", "home", "i"].includes(xMatch[2].toLowerCase())) {
      links.twitter = xMatch[0];
    }

    // GitHub — filter out generic pages
    const ghMatch = html.match(/https?:\/\/github\.com\/([a-zA-Z0-9_-]+)/);
    if (ghMatch && !["topics", "features", "pricing", "login", "signup", "about", "explore", "marketplace"].includes(ghMatch[1].toLowerCase())) {
      links.github = ghMatch[0];
    }

    // Medium — @user, publication path, subdomain, or custom blog domain linked from site
    const medMatch = html.match(/https?:\/\/medium\.com\/@?([a-zA-Z0-9_-]+)/) || html.match(/https?:\/\/([a-zA-Z0-9_-]+)\.medium\.com/);
    if (medMatch) {
      links.medium = medMatch[0];
    }
    // Also check for blog.brand.com links (often custom Medium domains)
    if (!links.medium) {
      const domain = website.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
      const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blogMatch = html.match(new RegExp(`https?://blog\\.${escapedDomain}[^"'\\s]*`, 'i'));
      if (blogMatch) {
        links.medium = blogMatch[0].replace(/["'>\s].*$/, '');
      }
    }

    // YouTube — channel or @handle
    const ytMatch = html.match(/https?:\/\/(www\.)?youtube\.com\/(@[a-zA-Z0-9_-]+|channel\/[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9_-]+)/);
    if (ytMatch) {
      links.youtube = ytMatch[0];
    }

    // Discord
    const dcMatch = html.match(/https?:\/\/(discord\.com\/invite|discord\.gg)\/([a-zA-Z0-9_-]+)/);
    if (dcMatch) {
      links.discord = dcMatch[0];
    }

    // Reddit
    const rdMatch = html.match(/https?:\/\/(www\.)?reddit\.com\/r\/([a-zA-Z0-9_]+)/);
    if (rdMatch) {
      links.reddit = rdMatch[0];
    }

    // Product Hunt
    const phMatch = html.match(/https?:\/\/(www\.)?producthunt\.com\/products\/([a-zA-Z0-9_-]+)/);
    if (phMatch) {
      links.producthunt = phMatch[0];
    }

    // Crunchbase
    const cbMatch = html.match(/https?:\/\/(www\.)?crunchbase\.com\/organization\/([a-zA-Z0-9_-]+)/);
    if (cbMatch) {
      links.crunchbase = cbMatch[0];
    }

    console.log(`[SCRAPE] Found social links on ${website}: ${Object.keys(links).join(", ") || "none"}`);
    return { links, html };
  } catch (e: any) {
    console.log(`[SCRAPE] Failed to scrape ${website}: ${e.message}`);
    return empty;
  }
}

// ── AI Crawler Bots ──
const AI_CRAWLERS = [
  { name: "GPTBot", agent: "GPTBot", owner: "OpenAI (ChatGPT)" },
  { name: "ChatGPT-User", agent: "ChatGPT-User", owner: "OpenAI (ChatGPT browsing)" },
  { name: "ClaudeBot", agent: "ClaudeBot", owner: "Anthropic (Claude)" },
  { name: "ClaudeWeb", agent: "claude-web", owner: "Anthropic (Claude legacy)" },
  { name: "PerplexityBot", agent: "PerplexityBot", owner: "Perplexity AI" },
  { name: "Bytespider", agent: "Bytespider", owner: "ByteDance (TikTok/AI)" },
  { name: "CCBot", agent: "CCBot", owner: "Common Crawl (training data)" },
  { name: "Google-Extended", agent: "Google-Extended", owner: "Google (Gemini training)" },
  { name: "Amazonbot", agent: "Amazonbot", owner: "Amazon (Alexa/AI)" },
  { name: "FacebookBot", agent: "FacebookBot", owner: "Meta (AI training)" },
  { name: "cohere-ai", agent: "cohere-ai", owner: "Cohere" },
  { name: "Diffbot", agent: "Diffbot", owner: "Diffbot (knowledge graph)" },
  { name: "Applebot-Extended", agent: "Applebot-Extended", owner: "Apple (AI features)" },
];

export interface RobotsCrawlerResult {
  name: string;
  owner: string;
  status: "allowed" | "blocked" | "unknown";
}

export interface RobotsAudit {
  exists: boolean;
  raw?: string;
  crawlers: RobotsCrawlerResult[];
  blocked_count: number;
  allowed_count: number;
  has_sitemap: boolean;
  sitemap_urls: string[];
  verdict: string;
}

export interface LlmsTxtAudit {
  exists: boolean;
  raw?: string;
  size_bytes: number;
  has_description: boolean;
  has_links: boolean;
  link_count: number;
  verdict: string;
}

export interface LighthouseAudit {
  available: boolean;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  structured_data_found: string[];
  mobile_friendly: boolean;
  https: boolean;
  load_time_ms: number | null;
  verdict: string;
}

interface PresenceCheck { exists: boolean; url?: string; html?: string }

export interface SocialProofSource {
  name: string;
  icon: string;
  data: PresenceCheck;
  weight: number;
  category: "universal" | "industry";
}

export interface SocialProofAudit {
  sources: SocialProofSource[];
  trust_score: number; // 0-100
  sources_found: number;
  total_sources: number;
  universal_score: number;   // out of 85
  industry_bonus: number;    // out of 15
  industry_sources_checked: string[];
  verdict: string;
}

export interface TechnicalAuditResult {
  robots: RobotsAudit;
  llms_txt: LlmsTxtAudit;
  lighthouse: LighthouseAudit;
  social_proof: SocialProofAudit;
  overall_technical_score: number;
  timestamp: string;
}

// ── robots.txt Analysis ──
export async function auditRobotsTxt(website: string): Promise<RobotsAudit> {
  const base = website.replace(/\/$/, "");
  let raw = "";
  let exists = false;

  try {
    const res = await fetch(`${base}/robots.txt`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; XanLens/1.0)" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (res.ok) {
      raw = await res.text();
      // Basic validity check — robots.txt should have text content
      exists = raw.length > 10 && (raw.includes("User-agent") || raw.includes("user-agent"));
    }
  } catch { /* no robots.txt */ }

  if (!exists) {
    return {
      exists: false,
      crawlers: AI_CRAWLERS.map(c => ({ name: c.name, owner: c.owner, status: "unknown" as const })),
      blocked_count: 0,
      allowed_count: 0,
      has_sitemap: false,
      sitemap_urls: [],
      verdict: "No robots.txt found. AI crawlers can access your site, but you're missing an opportunity to explicitly guide them.",
    };
  }

  const lines = raw.split("\n").map(l => l.trim());
  const crawlers: RobotsCrawlerResult[] = [];
  let blocked = 0;
  let allowed = 0;

  // Parse robots.txt — check both specific and wildcard rules
  // Build a map of user-agent → rules
  const rules: Record<string, string[]> = {};
  let currentAgents: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("user-agent:")) {
      const agent = line.split(":").slice(1).join(":").trim();
      currentAgents.push(agent.toLowerCase());
    } else if (lower.startsWith("disallow:") || lower.startsWith("allow:")) {
      for (const agent of currentAgents) {
        if (!rules[agent]) rules[agent] = [];
        rules[agent].push(line);
      }
    } else if (line === "" || line.startsWith("#")) {
      currentAgents = [];
    }
  }

  for (const crawler of AI_CRAWLERS) {
    const agentLower = crawler.agent.toLowerCase();
    const specificRules = rules[agentLower] || [];
    const wildcardRules = rules["*"] || [];

    // Check specific rules first, then wildcard
    const allRules = specificRules.length > 0 ? specificRules : wildcardRules;

    let isBlocked = false;
    for (const rule of allRules) {
      const lower = rule.toLowerCase().trim();
      if (lower.startsWith("disallow:")) {
        const path = lower.replace("disallow:", "").trim();
        if (path === "/" || path === "/*") {
          isBlocked = true;
        }
      }
      // Explicit allow overrides
      if (lower.startsWith("allow:") && specificRules.length > 0) {
        const path = lower.replace("allow:", "").trim();
        if (path === "/" || path === "/*" || path === "") {
          isBlocked = false;
        }
      }
    }

    const status = specificRules.length === 0 && wildcardRules.length === 0
      ? "unknown" as const
      : isBlocked ? "blocked" as const : "allowed" as const;

    if (status === "blocked") blocked++;
    if (status === "allowed") allowed++;

    crawlers.push({ name: crawler.name, owner: crawler.owner, status });
  }

  // Check for sitemap
  const sitemapUrls: string[] = [];
  for (const line of lines) {
    if (line.toLowerCase().startsWith("sitemap:")) {
      sitemapUrls.push(line.split(":").slice(1).join(":").trim());
    }
  }

  let verdict = "";
  if (blocked === 0) {
    verdict = "All AI crawlers can access your site. Great for visibility.";
  } else if (blocked >= AI_CRAWLERS.length * 0.5) {
    verdict = `⚠️ ${blocked} of ${AI_CRAWLERS.length} AI crawlers are BLOCKED. This severely limits your AI visibility. Consider allowing GPTBot, ClaudeBot, and PerplexityBot.`;
  } else {
    verdict = `${blocked} AI crawler(s) blocked. Review if intentional — each blocked crawler means one less AI engine that can learn about you.`;
  }

  return {
    exists: true,
    raw: raw.slice(0, 3000),
    crawlers,
    blocked_count: blocked,
    allowed_count: allowed,
    has_sitemap: sitemapUrls.length > 0,
    sitemap_urls: sitemapUrls.slice(0, 5),
    verdict,
  };
}

// ── llms.txt Analysis ──
export async function auditLlmsTxt(website: string): Promise<LlmsTxtAudit> {
  const base = website.replace(/\/$/, "");
  let raw = "";
  let exists = false;

  try {
    const res = await fetch(`${base}/llms.txt`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; XanLens/1.0)" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (res.ok) {
      raw = await res.text();
      exists = raw.length > 5;
    }
  } catch { /* no llms.txt */ }

  // Also check llms-full.txt
  if (!exists) {
    try {
      const res = await fetch(`${base}/llms-full.txt`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; XanLens/1.0)" },
        signal: AbortSignal.timeout(3000),
        redirect: "follow",
      });
      if (res.ok) {
        raw = await res.text();
        exists = raw.length > 5;
      }
    } catch { /* no llms-full.txt either */ }
  }

  if (!exists) {
    return {
      exists: false,
      size_bytes: 0,
      has_description: false,
      has_links: false,
      link_count: 0,
      verdict: "No llms.txt found. This file helps AI engines understand your brand, products, and key pages. Adding one is a quick win for AI visibility.",
    };
  }

  const hasDescription = raw.length > 50;
  const linkMatches = raw.match(/https?:\/\/[^\s]+/g) || [];
  const linkCount = linkMatches.length;

  let verdict = "llms.txt found! ";
  if (raw.length < 100) {
    verdict += "It's quite short — consider adding more detail about your brand, products, and key pages.";
  } else if (linkCount === 0) {
    verdict += "No links detected. Add links to your key pages so AI engines can discover your most important content.";
  } else {
    verdict += `${linkCount} links included. Good foundation for AI discoverability.`;
  }

  return {
    exists: true,
    raw: raw.slice(0, 2000),
    size_bytes: raw.length,
    has_description: hasDescription,
    has_links: linkCount > 0,
    link_count: linkCount,
    verdict,
  };
}

// ── Lighthouse / PageSpeed Insights ──
export async function auditLighthouse(website: string, apiKey?: string): Promise<LighthouseAudit> {
  const empty: LighthouseAudit = {
    available: false,
    performance_score: null,
    accessibility_score: null,
    best_practices_score: null,
    seo_score: null,
    structured_data_found: [],
    mobile_friendly: false,
    https: false,
    load_time_ms: null,
    verdict: "Lighthouse analysis unavailable.",
  };

  try {
    // PageSpeed Insights API — free, 25K requests/day with API key
    const res = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(website)}&strategy=mobile&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO${apiKey ? `&key=${apiKey}` : ""}`,
      { signal: AbortSignal.timeout(90000) }
    );

    if (!res.ok) return empty;
    const data = await res.json();

    const cats = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};

    const perfScore = cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null;
    const a11yScore = cats.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : null;
    const bpScore = cats["best-practices"]?.score != null ? Math.round(cats["best-practices"].score * 100) : null;
    const seoScore = cats.seo?.score != null ? Math.round(cats.seo.score * 100) : null;

    // Extract structured data types found
    const sdAudit = audits["structured-data"];
    const schemas: string[] = [];
    if (sdAudit?.details?.items) {
      for (const item of sdAudit.details.items) {
        if (item.description) schemas.push(item.description);
      }
    }

    const mobile = audits["viewport"]?.score === 1;
    const https = website.startsWith("https");
    const loadTime = audits["interactive"]?.numericValue || null;

    const avgScore = [perfScore, a11yScore, bpScore, seoScore].filter(s => s != null);
    const avg = avgScore.length > 0 ? Math.round(avgScore.reduce((a, b) => a! + b!, 0)! / avgScore.length) : 0;

    let verdict = "";
    if (seoScore != null && seoScore >= 90) {
      verdict = "Strong technical SEO foundation. AI engines can easily crawl and understand your site.";
    } else if (seoScore != null && seoScore >= 70) {
      verdict = "Decent technical setup but room for improvement. Fix SEO issues to help AI engines index your content better.";
    } else {
      verdict = "Technical issues detected that may hurt AI crawlability. Focus on SEO score improvements.";
    }

    return {
      available: true,
      performance_score: perfScore,
      accessibility_score: a11yScore,
      best_practices_score: bpScore,
      seo_score: seoScore,
      structured_data_found: schemas,
      mobile_friendly: mobile,
      https,
      load_time_ms: loadTime ? Math.round(loadTime) : null,
      verdict,
    };
  } catch {
    return empty;
  }
}

// ── Social Proof / Authority Sources ──

// Industry keyword matchers for conditional sources
const INDUSTRY_MATCHERS: Record<string, RegExp> = {
  ai: /\b(ai|artificial intelligence|machine learning|ml|llm|nlp|computer vision|deep learning|neural|gpt|generative)\b/i,
  crypto: /\b(crypto|blockchain|web3|nft|on-?chain|token|dao|defi|decentralized|wallet|smart contract)\b/i,
  defi: /\b(defi|decentralized finance|dex|lending protocol|yield|liquidity|amm|staking|swap)\b/i,
  devtools: /\b(developer tool|api|sdk|infrastructure|open source|devtool|cli|framework|library|package)\b/i,
};

function matchesIndustry(industry: string, ...keys: string[]): boolean {
  return keys.some(k => INDUSTRY_MATCHERS[k]?.test(industry));
}

// Quick fetch helper — 3s timeout, graceful fail
async function checkPresence(url: string, opts?: { method?: string; headers?: Record<string, string>; checkBody?: (text: string) => boolean }): Promise<PresenceCheck> {
  try {
    const res = await fetch(url, {
      method: opts?.checkBody ? "GET" : (opts?.method || "HEAD"),
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36", ...opts?.headers },
    });
    if (opts?.checkBody) {
      const text = await res.text();
      return { exists: opts.checkBody(text), url, html: text };
    }
    const ok = res.ok || res.status === 301 || res.status === 302;
    return { exists: ok, url: ok ? url : undefined };
  } catch { return { exists: false }; }
}

// Verify brand actually appears on the page (not just a redirect to homepage)
function checkPresenceWithBody(url: string, brand: string, extraTerms?: string[]): Promise<PresenceCheck> {
  const terms = [brand.toLowerCase(), brand.toLowerCase().replace(/\s+/g, ""), ...(extraTerms || [])];
  return checkPresence(url, {
    method: "GET",
    checkBody: (html) => {
      const lower = html.toLowerCase();
      // Check for 404/not-found signals
      if (lower.includes("page not found") || lower.includes("this account doesn") || lower.includes("this page isn")) return false;
      // Brand must appear in the page content
      return terms.some(t => lower.includes(t));
    },
  });
}

// Tavily fallback for authority sources that block datacenter IPs (LinkedIn, Crunchbase, G2, etc.)
// Try direct check first, fall back to Tavily site: search if direct returns false
// Helper: check if text matches the brand with appropriate strictness
// Short brand first-words (pyx, ai, etc.) cause false positives, so require full match
function matchesBrandText(text: string, brand: string): boolean {
  const lower = text.toLowerCase();
  const brandLower = brand.toLowerCase();
  const slug = brandLower.replace(/\s+/g, "-");
  const nospace = brandLower.replace(/\s+/g, "");
  const first = brandLower.split(" ")[0];
  const firstIsDistinctive = first.length > 5;
  return lower.includes(brandLower) || lower.includes(slug) || lower.includes(nospace)
    || (firstIsDistinctive && lower.includes(first));
}

// Stronger verification: does the found page actually relate to THIS brand?
// Checks if the page content mentions the brand's website domain or description keywords.
// Prevents false positives for generic brand names (e.g., "MoonMaker" matching unrelated moonmaker pages).
function verifyBrandMatch(pageContent: string, brand: string, websiteDomain: string, descriptionKeywords?: string[]): boolean {
  const lower = pageContent.toLowerCase();
  
  // Check 1: Does the page mention the brand's website domain?
  if (websiteDomain && lower.includes(websiteDomain.toLowerCase())) return true;
  
  // Check 2: Does the page mention at least 2 description keywords?
  if (descriptionKeywords && descriptionKeywords.length > 0) {
    const matches = descriptionKeywords.filter(kw => lower.includes(kw.toLowerCase()));
    if (matches.length >= 2) return true;
  }
  
  // Check 3: For multi-word brands, exact match is usually sufficient
  if (brand.includes(" ") && lower.includes(brand.toLowerCase())) return true;
  
  return false;
}

async function checkPresenceWithFallback(url: string, brand: string, siteDomain: string, brandWebsiteDomain?: string, descriptionKeywords?: string[]): Promise<PresenceCheck> {
  // Try direct first
  const direct = await checkPresenceWithBody(url, brand);
  if (direct.exists) {
    // For generic brand names, verify the page actually relates to THIS brand
    // by checking if it mentions the brand's website domain or description keywords
    if (brandWebsiteDomain && direct.html) {
      if (!verifyBrandMatch(direct.html, brand, brandWebsiteDomain, descriptionKeywords)) {
        return { exists: false }; // Same name, different brand
      }
    }
    return direct;
  }

  // Fallback: use Tavily to search for brand on the site
  const results = await tavilySearch(`${brand} site:${siteDomain}`, 5);
  const match = results.find(r => {
    if (!r.url.includes(siteDomain)) return false;
    const nameMatch = matchesBrandText(r.url, brand) || matchesBrandText(r.title || "", brand);
    return nameMatch;
  });
  if (match) return { exists: true, url: match.url, html: match.title || undefined };

  return { exists: false };
}

export async function auditSocialProof(brand: string, website: string, industry = "", description = ""): Promise<SocialProofAudit> {
  const slug = brand.toLowerCase().replace(/\s+/g, "-");
  const nospace = brand.toLowerCase().replace(/\s+/g, "");
  const brandEncoded = encodeURIComponent(brand);
  
  // Extract website domain for cross-verification (prevents false positives for generic brand names)
  let brandWebsiteDomain = "";
  try { brandWebsiteDomain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, ""); } catch {}
  
  // Extract description keywords for secondary verification
  const descriptionKeywords = description
    .split(/[\s,.\-—]+/)
    .filter(w => w.length > 4)
    .map(w => w.toLowerCase())
    .filter(w => !["about", "their", "which", "these", "those", "other", "being", "would", "could", "should"].includes(w))
    .slice(0, 8);

  // ── Strategy 0: Scrape brand website once for ALL social links ──
  const scraped = await scrapeWebsiteForSocialLinks(website);
  const socialLinks = scraped.links;

  // ── Universal sources (85% of score) ──
  interface SourceDef { name: string; icon: string; weight: number; category: "universal" | "industry"; check: () => Promise<PresenceCheck>; websiteScraped?: boolean }

  const universal: SourceDef[] = [
    { name: "Wikipedia", icon: "📖", weight: 15, category: "universal", check: () =>
      fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${brandEncoded}&format=json&srlimit=1`, { signal: AbortSignal.timeout(3000) })
        .then(r => r.json()).then(d => {
          const results = d?.query?.search || [];
          if (results.length > 0 && results[0].title.toLowerCase().includes(brand.toLowerCase().split(" ")[0]))
            return { exists: true, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(results[0].title)}` };
          return { exists: false };
        }).catch(() => ({ exists: false }))
    },
    { name: "Crunchbase", icon: "💼", weight: 10, category: "universal", check: async () => {
      // Strategy 0: Website scrape
      if (socialLinks.crunchbase) return { exists: true, url: socialLinks.crunchbase };
      return checkPresenceWithFallback(`https://www.crunchbase.com/organization/${slug}`, brand, "crunchbase.com", brandWebsiteDomain, descriptionKeywords);
    }},
    { name: "GitHub", icon: "🐙", weight: 10, category: "universal", check: async () => {
      // Strategy 0: Website scrape (already done universally)
      if (socialLinks.github) return { exists: true, url: socialLinks.github };
      // Strategy 1: GitHub API org lookup
      try {
        const r = await fetch(`https://api.github.com/orgs/${nospace}`, { signal: AbortSignal.timeout(3000), headers: { "User-Agent": "XanLens/1.0" } });
        if (r.ok) return { exists: true, url: `https://github.com/${nospace}` };
      } catch { /* continue */ }
      // Strategy 2: Tavily fallback
      const results = await tavilySearch(`${brand} github.com`, 3);
      const match = results.find(r => {
        if (!r.url.includes("github.com/")) return false;
        return matchesBrandText(r.url, brand) || matchesBrandText(r.title || "", brand);
      });
      if (match) return { exists: true, url: match.url, html: match.title ? `${match.title}. ${match.content}` : match.content };
      return { exists: false };
    }},
    { name: "LinkedIn", icon: "💬", weight: 8, category: "universal", check: async () => {
      // Strategy 0: Website scrape (most reliable — LinkedIn blocks datacenter IPs)
      if (socialLinks.linkedin) {
        console.log(`[LINKEDIN] Found via website scrape: ${socialLinks.linkedin}`);
        return { exists: true, url: socialLinks.linkedin };
      }
      // Strategy 1: Direct check (usually blocked but worth trying)
      const direct = await checkPresenceWithBody(`https://www.linkedin.com/company/${slug}/`, brand);
      if (direct.exists) return direct;
      const directNospace = await checkPresenceWithBody(`https://www.linkedin.com/company/${nospace}/`, brand);
      if (directNospace.exists) return directNospace;
      // Strategy 2: Tavily fallback — only accept company pages
      const results = await tavilySearch(`"${brand}" site:linkedin.com/company`, 5);
      const match = results.find(r => {
        if (!r.url.includes("linkedin.com/company/")) return false;
        return matchesBrandText(r.title || "", brand) || matchesBrandText(r.url, brand)
          || verifyBrandMatch(r.content || r.title || "", brand, brandWebsiteDomain, descriptionKeywords);
      });
      if (match) return { exists: true, url: match.url, html: match.title ? `${match.title}. ${match.content}` : match.content };
      return { exists: false };
    }},
    { name: "X / Twitter", icon: "𝕏", weight: 8, category: "universal", check: async () => {
      // Strategy 0: Website scrape (already done universally)
      if (socialLinks.twitter) {
        console.log(`[TWITTER] Found via website scrape: ${socialLinks.twitter}`);
        return { exists: true, url: socialLinks.twitter };
      }

      // Helper: check if a Twitter/X handle closely matches the brand
      function handleMatchesBrand(url: string): boolean {
        const handleMatch = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i);
        if (!handleMatch) return false;
        const handle = handleMatch[1].toLowerCase();
        if (handle === nospace || handle === slug) return true;
        const suffixPattern = new RegExp(`^${nospace}[_]?(cc|io|xyz|co|ai|app|api|hq|official|dev|labs|tech)$`);
        return suffixPattern.test(handle);
      }

      // Strategy 1: Tavily search
      let domain = "";
      try { domain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, ""); } catch {}
      const brandFirst = brand.toLowerCase().split(" ")[0];
      const firstDistinctive = brandFirst.length > 5;

      const queries = [`${domain} twitter`, ...(firstDistinctive ? [`${brandFirst} twitter account`] : []), `"${brand}" x.com`];
      for (const q of queries) {
        const results = await tavilySearch(q, 3);
        const match = results.find(r => {
          const u = r.url.toLowerCase();
          if (!u.includes("x.com/") && !u.includes("twitter.com/")) return false;
          if (/\/(share|intent|search|hashtag|home|i\/)/i.test(u)) return false;
          return handleMatchesBrand(r.url);
        });
        if (match) return { exists: true, url: match.url, html: match.title ? `${match.title}. ${match.content}` : match.content };
      }
      return { exists: false };
    }},
    { name: "Product Hunt", icon: "🚀", weight: 8, category: "universal", check: async () => {
      if (socialLinks.producthunt) return { exists: true, url: socialLinks.producthunt };
      return checkPresenceWithFallback(`https://www.producthunt.com/products/${slug}`, brand, "producthunt.com", brandWebsiteDomain, descriptionKeywords);
    }},
    { name: "G2", icon: "⭐", weight: 8, category: "universal", check: async () => {
      // Direct check
      const direct = await checkPresenceWithBody(`https://www.g2.com/products/${slug}/reviews`, brand);
      if (direct.exists) return direct;
      // Tavily fallback — only accept g2.com/products/ pages
      const results = await tavilySearch(`"${brand}" site:g2.com/products`, 3);
      const match = results.find(r => {
        if (!r.url.includes("g2.com/products/")) return false;
        return matchesBrandText(r.url, brand) || matchesBrandText(r.title || "", brand);
      });
      if (match) return { exists: true, url: match.url, html: match.title ? `${match.title}. ${match.content}` : match.content };
      return { exists: false };
    }},
    { name: "Discord", icon: "💬", weight: 5, category: "universal", check: async () => {
      // Strategy 0: Website scrape
      if (socialLinks.discord) return { exists: true, url: socialLinks.discord };
      // Strategy 1: Discord API invite lookup
      try {
        const r = await fetch(`https://discord.com/api/v9/invites/${nospace}`, { signal: AbortSignal.timeout(3000) });
        if (r.ok) return { exists: true, url: `https://discord.gg/${nospace}` };
      } catch { /* continue */ }
      return { exists: false };
    }},
    { name: "Medium", icon: "📝", weight: 4, category: "universal", check: async () => {
      // Strategy 0: Website scrape (catches medium.com/@x, x.medium.com, AND blog.brand.com)
      if (socialLinks.medium) {
        console.log(`[MEDIUM] Found via website scrape: ${socialLinks.medium}`);
        return { exists: true, url: socialLinks.medium };
      }
      // Strategy 1: Direct URL check
      const directUrl = `https://medium.com/@${nospace}`;
      try {
        const r = await fetch(directUrl, { method: "HEAD", signal: AbortSignal.timeout(4000), redirect: "follow" });
        if (r.ok) return { exists: true, url: directUrl };
      } catch { /* continue */ }
      // Strategy 2: Broad Tavily search (catches custom domains like blog.brand.com on Medium)
      const results = await tavilySearch(`"${brand}" medium blog`, 5);
      const mediumResult = results.find(r =>
        (r.url.includes("medium.com") || r.url.includes("blog.")) &&
        verifyBrandMatch(r.title || "", brand, brandWebsiteDomain || "", descriptionKeywords)
      );
      if (mediumResult) return { exists: true, url: mediumResult.url };
      return { exists: false };
    }},
    { name: "YouTube", icon: "▶️", weight: 5, category: "universal", check: async () => {
      if (socialLinks.youtube) return { exists: true, url: socialLinks.youtube };
      return checkPresenceWithFallback(`https://www.youtube.com/@${nospace}`, brand, "youtube.com", brandWebsiteDomain, descriptionKeywords);
    }},
    { name: "Reddit", icon: "🔴", weight: 4, category: "universal", check: async () => {
      // Strategy 0: Website scrape
      if (socialLinks.reddit) return { exists: true, url: socialLinks.reddit };
      // Strategy 1: Tavily search
      const results = await tavilySearch(`"${brand}" site:reddit.com`, 3);
      const match = results.find(r => {
        if (!r.url.includes("reddit.com")) return false;
        return matchesBrandText(r.url, brand) || matchesBrandText(r.title || "", brand);
      });
      if (match) return { exists: true, url: match.url, html: match.title ? `${match.title}. ${match.content}` : match.content };
      return { exists: false };
    }},
    { name: "PitchBook", icon: "📊", weight: 5, category: "universal", check: () =>
      checkPresenceWithFallback(`https://pitchbook.com/profiles/company/${slug}`, brand, "pitchbook.com", brandWebsiteDomain, descriptionKeywords)
    },
    { name: "StackShare", icon: "⚡", weight: 5, category: "universal", check: () =>
      checkPresenceWithFallback(`https://stackshare.io/${slug}`, brand, "stackshare.io", brandWebsiteDomain, descriptionKeywords)
    },
  ];
  // Universal weights sum = 95 but we cap universal contribution at 85

  // ── Industry-conditional sources (bonus up to 15%) ──
  const conditional: SourceDef[] = [];

  if (matchesIndustry(industry, "ai")) {
    conditional.push({ name: "HuggingFace", icon: "🤗", weight: 5, category: "industry", check: async () => {
      // Direct org/user page check
      const direct = await checkPresenceWithBody(`https://huggingface.co/${nospace}`, brand);
      if (direct.exists) return direct;
      const directSlug = await checkPresenceWithBody(`https://huggingface.co/${slug}`, brand);
      if (directSlug.exists) return directSlug;
      // Tavily fallback — only accept org pages (huggingface.co/orgname), not datasets/models by others
      const results = await tavilySearch(`${brand} huggingface`, 3);
      const match = results.find(r => {
        if (!r.url.includes("huggingface.co/")) return false;
        const path = r.url.split("huggingface.co/")[1] || "";
        // Reject search/filter URLs
        if (path.startsWith("models?") || path.startsWith("datasets?") || path.startsWith("spaces?")) return false;
        // Must be an org page with brand name in the path
        return matchesBrandText(path.split("/")[0] || "", brand);
      });
      if (match) return { exists: true, url: match.url, html: match.title ? `${match.title}. ${match.content}` : match.content };
      return { exists: false };
    }
    });
  }

  if (matchesIndustry(industry, "defi")) {
    conditional.push({ name: "DefiLlama", icon: "🦙", weight: 5, category: "industry", check: () =>
      fetch(`https://api.llama.fi/protocol/${slug}`, { signal: AbortSignal.timeout(3000) })
        .then(async r => {
          if (!r.ok) return { exists: false };
          const d = await r.json();
          return { exists: !!d?.name, url: `https://defillama.com/protocol/${slug}` };
        }).catch(() => ({ exists: false }))
    });
  }

  if (matchesIndustry(industry, "crypto", "defi")) {
    conditional.push({ name: "Dune Analytics", icon: "📈", weight: 5, category: "industry", check: () =>
      checkPresenceWithFallback(`https://dune.com/${nospace}`, brand, "dune.com", brandWebsiteDomain, descriptionKeywords)
    });
  }

  if (matchesIndustry(industry, "devtools")) {
    conditional.push({ name: "npm", icon: "📦", weight: 5, category: "industry", check: () =>
      fetch(`https://registry.npmjs.org/${slug}`, { signal: AbortSignal.timeout(3000) })
        .then(r => ({ exists: r.ok, url: r.ok ? `https://www.npmjs.com/package/${slug}` : undefined }))
        .catch(() => ({ exists: false }))
    });
    conditional.push({ name: "PyPI", icon: "🐍", weight: 5, category: "industry", check: () =>
      fetch(`https://pypi.org/pypi/${slug}/json`, { signal: AbortSignal.timeout(3000) })
        .then(r => ({ exists: r.ok, url: r.ok ? `https://pypi.org/project/${slug}/` : undefined }))
        .catch(() => ({ exists: false }))
    });
    conditional.push({ name: "Dev.to", icon: "👩‍💻", weight: 3, category: "industry", check: () =>
      checkPresenceWithFallback(`https://dev.to/${nospace}`, brand, "dev.to", brandWebsiteDomain, descriptionKeywords)
    });
  }

  // Fire all checks in parallel
  const allDefs = [...universal, ...conditional];
  const results = await Promise.allSettled(allDefs.map(s => s.check()));

  const sources: SocialProofSource[] = allDefs.map((def, i) => ({
    name: def.name,
    icon: def.icon,
    data: results[i].status === "fulfilled" ? results[i].value as PresenceCheck : { exists: false },
    weight: def.weight,
    category: def.category,
  }));

  // ── Two-tier authority source verification ──
  // Tier 1: Exact-path slug match on known platforms → auto-verified, no LLM call
  // Tier 2: Ambiguous cases → LLM judge, fail-closed, throttled
  // Why: Previous approach (LLM judge for ALL sources) caused rate limiting (15+ simultaneous
  // Gemini calls) → mass false negatives via fail-closed. GPT-5.2 review confirmed this architecture.
  const foundSources = sources.filter(s => s.data.exists);
  if (foundSources.length > 0) {
    // Exact-path matching: extract the path segment and compare to brand slug exactly
    // e.g., /organization/zetachain → "zetachain" must === slug, not just be a substring
    function isExactSlugMatch(url: string, brandSlug: string, brandNospace: string): boolean {
      try {
        const pathname = new URL(url).pathname.toLowerCase();
        const segments = pathname.split("/").filter(Boolean);
        // Check if any path segment exactly matches the brand slug or nospace variant
        return segments.some(seg => seg === brandSlug || seg === brandNospace);
      } catch {
        return false;
      }
    }

    // Platforms where exact-path slug match is sufficient proof
    const TIER1_PLATFORMS = new Set([
      "Wikipedia", "Crunchbase", "GitHub", "Product Hunt", "G2", "Discord",
      "YouTube", "Medium", "Reddit", "PitchBook", "StackShare", "HuggingFace",
      "DefiLlama", "Dune Analytics", "npm", "PyPI", "Dev.to",
    ]);

    // Sources found via website scrape are auto-verified (Tier 0) — highest confidence
    const WEBSITE_SCRAPED_URLS = new Set(Object.values(socialLinks).filter(Boolean) as string[]);

    const ambiguousSources: typeof foundSources = [];

    for (const source of foundSources) {
      const url = source.data.url || "";

      // Tier 0: Found on the brand's own website — auto-verified, skip judge
      if (WEBSITE_SCRAPED_URLS.has(url)) {
        console.log(`[AUTHORITY_T0] VERIFIED "${source.name}" for "${brand}" — found on brand website: ${url}`);
        continue;
      }

      const isTier1Platform = TIER1_PLATFORMS.has(source.name);
      const exactMatch = isExactSlugMatch(url, slug, nospace);

      if (isTier1Platform && exactMatch) {
        // Tier 1: exact path segment match on known platform — trusted
        console.log(`[AUTHORITY_T1] VERIFIED "${source.name}" for "${brand}" — URL: ${url}`);
        continue;
      }

      // Falls to Tier 2: ambiguous (unknown platform, or slug not exact in URL)
      ambiguousSources.push(source);
    }

    // Tier 2: LLM judge for ambiguous sources — throttled, fail-closed
    const JUDGE_BATCH_SIZE = 3;
    for (let i = 0; i < ambiguousSources.length; i += JUDGE_BATCH_SIZE) {
      const batch = ambiguousSources.slice(i, i + JUDGE_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (source) => {
          const url = source.data.url || "";
          const html = source.data.html || "";

          let pageContext = `Source: ${source.name}\nURL: ${url}\n`;
          if (html) {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const descMatch = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i)
              || html.match(/content=["']([^"']+)["']\s+(?:name|property)=["'](?:description|og:description)["']/i);
            if (titleMatch) pageContext += `Page title: ${titleMatch[1].trim()}\n`;
            if (descMatch) pageContext += `Page description: ${descMatch[1].trim()}\n`;
            const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
            if (jsonLdMatch) {
              try { pageContext += `Structured data: ${jsonLdMatch[1].trim().slice(0, 500)}\n`; } catch {}
            }
            if (!html.includes("<")) {
              pageContext += `Page content: ${html.slice(0, 500)}\n`;
            } else {
              const bodyMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
              const bodyHtml = bodyMatch ? bodyMatch[1] : html;
              const textContent = bodyHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
              if (textContent) pageContext += `Page text: ${textContent}\n`;
            }
          }

          const judgment = await llmJudgeMention(pageContext, brand, description, website, industry);

          if (!judgment.genuine) {
            console.log(`[AUTHORITY_T2] REJECTED "${source.name}" for "${brand}" — URL: ${url}`);
            source.data.exists = false;
            source.data.url = undefined;
            source.data.html = undefined;
          } else {
            console.log(`[AUTHORITY_T2] VERIFIED "${source.name}" for "${brand}" — URL: ${url}`);
          }
        })
      );

      // Log failures (fail-closed: errors = rejected by default since source.data.exists unchanged → but allSettled swallows)
      batchResults.forEach((r, j) => {
        if (r.status === "rejected") {
          const src = batch[j];
          console.warn(`[AUTHORITY_T2] Error judging "${src.name}", fail-closed: ${r.reason}`);
          src.data.exists = false;
          src.data.url = undefined;
          src.data.html = undefined;
        }
      });

      // Throttle between batches to avoid rate limiting
      if (i + JUDGE_BATCH_SIZE < ambiguousSources.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  // Strip HTML from source data before returning — no need to send 30KB of LinkedIn HTML to client
  for (const source of sources) {
    if (source.data.html) delete source.data.html;
  }

  const found = sources.filter(s => s.data.exists).length;
  const totalSources = sources.length;

  // Score: universal sources contribute up to 85, industry bonus up to 15
  const universalSources = sources.filter(s => s.category === "universal");
  const industrySources = sources.filter(s => s.category === "industry");

  const universalMaxWeight = universalSources.reduce((s, src) => s + src.weight, 0);
  const universalGotWeight = universalSources.filter(s => s.data.exists).reduce((s, src) => s + src.weight, 0);
  const universalScore = universalMaxWeight > 0 ? Math.round((universalGotWeight / universalMaxWeight) * 85) : 0;

  const industryMaxWeight = industrySources.reduce((s, src) => s + src.weight, 0);
  const industryGotWeight = industrySources.filter(s => s.data.exists).reduce((s, src) => s + src.weight, 0);
  const industryBonus = industryMaxWeight > 0 ? Math.round((industryGotWeight / industryMaxWeight) * 15) : 0;

  const trustScore = Math.min(100, universalScore + industryBonus);

  const missing = sources.filter(s => !s.data.exists).map(s => s.name);

  let verdict = "";
  if (trustScore >= 70) {
    verdict = `Strong authority presence (${found}/${totalSources} sources). AI engines trust brands with verified presence across multiple platforms.`;
  } else if (trustScore >= 30) {
    verdict = `Moderate authority (${found}/${totalSources} sources). Adding presence on ${missing.slice(0, 3).join(", ")} would boost AI citations.`;
  } else {
    verdict = `Low authority presence (${found}/${totalSources}). AI engines rely on Wikipedia, Crunchbase, GitHub, and Product Hunt for brand verification. Building presence here directly improves your AI visibility.`;
  }

  return {
    sources,
    trust_score: trustScore,
    sources_found: found,
    total_sources: totalSources,
    universal_score: universalScore,
    industry_bonus: industryBonus,
    industry_sources_checked: industrySources.map(s => s.name),
    verdict,
  };
}

// ── Combined Technical Audit ──
export async function runTechnicalAudit(website: string, brand: string, apiKey?: string, industry?: string, description?: string): Promise<TechnicalAuditResult> {
  const [robots, llmsTxt, lighthouse, socialProof] = await Promise.all([
    auditRobotsTxt(website),
    auditLlmsTxt(website),
    auditLighthouse(website, apiKey),
    auditSocialProof(brand, website, industry || "", description || ""),
  ]);

  // Overall technical score: weighted average
  const robotsScore = robots.exists
    ? Math.round(100 - (robots.blocked_count / AI_CRAWLERS.length) * 100)
    : 50; // No robots.txt = neutral
  const llmsScore = llmsTxt.exists ? (llmsTxt.has_links ? 100 : 60) : 0;
  const lhScore = lighthouse.seo_score ?? 50;
  const spScore = socialProof.trust_score;

  const overall = Math.round(
    robotsScore * 0.25 +
    llmsScore * 0.2 +
    lhScore * 0.3 +
    spScore * 0.25
  );

  return {
    robots,
    llms_txt: llmsTxt,
    lighthouse,
    social_proof: socialProof,
    overall_technical_score: overall,
    timestamp: new Date().toISOString(),
  };
}

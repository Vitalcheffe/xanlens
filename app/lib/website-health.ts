/**
 * Website Health Audit — 14 SEO/GEO checks from a single HTML fetch
 * 
 * Checks:
 *  1. Meta title quality
 *  2. Meta description quality
 *  3. OG tags (Open Graph)
 *  4. Twitter card tags
 *  5. Heading structure (H1-H3)
 *  6. Sitemap.xml existence
 *  7. Schema/JSON-LD types audit
 *  8. Canonical URL
 *  9. HTTPS
 * 10. Image alt text coverage
 * 11. Language/hreflang tags
 * 12. Content quality signals (word count, readability)
 * 13. Social profile links on site
 * 14. Keyword placement analysis
 * 
 * + Backlink discovery via Tavily/Exa (separate async)
 */

// ── Types ──

export type CheckStatus = "pass" | "warn" | "fail";

export interface HealthCheck {
  name: string;
  status: CheckStatus;
  value: string;
  recommendation?: string;
  impact: "high" | "medium" | "low";  // GEO impact
}

export interface WebsiteHealthResult {
  checks: HealthCheck[];
  score: number;        // 0-100 composite
  passCount: number;
  warnCount: number;
  failCount: number;
  fetchedUrl: string;
  timestamp: string;
  // Raw data for analytics storage
  raw: {
    metaTitleLength: number | null;
    metaDescLength: number | null;
    hasOgTags: boolean;
    hasTwitterCards: boolean;
    h1Count: number;
    headingHierarchyValid: boolean;
    hasSitemap: boolean;
    schemaTypes: string[];
    hasCanonical: boolean;
    isHttps: boolean;
    hasHreflang: boolean;
    imagesTotal: number;
    imagesMissingAlt: number;
    wordCount: number;
    socialLinksOnSite: string[];
    keywordPlacementScore: number;
  };
}

export interface BacklinkResult {
  referringDomains: number;
  categories: Record<string, number>;  // e.g. { news: 3, blog: 5, directory: 2 }
  topReferrers: Array<{ domain: string; title: string }>;
}

// ── Helpers ──

function normalizeUrl(website: string): string {
  if (!website.startsWith("http")) website = `https://${website}`;
  return website;
}

function extractTextContent(html: string): string {
  // Remove scripts, styles, nav, header, footer
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  let count = word.match(/[aeiouy]+/g)?.length || 1;
  if (word.endsWith("e")) count--;
  return Math.max(1, count);
}

function fleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = text.split(/\s+/).filter(w => w.length > 1);
  if (!sentences.length || !words.length) return 50;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Main Audit Function ──

export async function auditWebsiteHealth(
  website: string,
  keywords: string[] = [],
): Promise<WebsiteHealthResult> {
  const url = normalizeUrl(website);
  const checks: HealthCheck[] = [];

  // Fetch the HTML once
  let html = "";
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    html = await resp.text();
  } catch (e) {
    console.warn("[HEALTH] Failed to fetch website:", e);
    return {
      checks: [{ name: "Website Fetch", status: "fail", value: "Could not fetch website", impact: "high" }],
      score: 0, passCount: 0, warnCount: 0, failCount: 1,
      fetchedUrl: url, timestamp: new Date().toISOString(),
      raw: {
        metaTitleLength: null, metaDescLength: null, hasOgTags: false,
        hasTwitterCards: false, h1Count: 0, headingHierarchyValid: false,
        hasSitemap: false, schemaTypes: [], hasCanonical: false,
        isHttps: url.startsWith("https"), hasHreflang: false,
        imagesTotal: 0, imagesMissingAlt: 0, wordCount: 0,
        socialLinksOnSite: [], keywordPlacementScore: 0,
      },
    };
  }

  const htmlLower = html.toLowerCase();

  // ── 1. Meta Title ──
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaTitle = titleMatch ? titleMatch[1].trim() : "";
  const titleLen = metaTitle.length;
  if (!metaTitle) {
    checks.push({ name: "Meta Title", status: "fail", value: "Missing", recommendation: "Add a <title> tag. Ideal: 50-60 characters with primary keyword.", impact: "high" });
  } else if (titleLen < 30) {
    checks.push({ name: "Meta Title", status: "warn", value: `${titleLen} chars (too short)`, recommendation: `Expand to 50-60 chars. Current: "${metaTitle}"`, impact: "high" });
  } else if (titleLen > 70) {
    checks.push({ name: "Meta Title", status: "warn", value: `${titleLen} chars (too long)`, recommendation: "Shorten to 50-60 chars — search engines and AI will truncate it.", impact: "high" });
  } else {
    checks.push({ name: "Meta Title", status: "pass", value: `${titleLen} chars`, impact: "high" });
  }

  // ── 2. Meta Description ──
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)
    || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
  const metaDesc = descMatch ? descMatch[1].trim() : "";
  const descLen = metaDesc.length;
  if (!metaDesc) {
    checks.push({ name: "Meta Description", status: "fail", value: "Missing", recommendation: "Add a meta description. Ideal: 150-160 characters. This appears in search snippets AND is read by AI engines.", impact: "high" });
  } else if (descLen < 80) {
    checks.push({ name: "Meta Description", status: "warn", value: `${descLen} chars (too short)`, recommendation: "Expand to 150-160 chars. Include primary keywords and a clear value proposition.", impact: "high" });
  } else if (descLen > 170) {
    checks.push({ name: "Meta Description", status: "warn", value: `${descLen} chars (too long)`, recommendation: "Shorten to 150-160 chars to avoid truncation.", impact: "high" });
  } else {
    checks.push({ name: "Meta Description", status: "pass", value: `${descLen} chars`, impact: "high" });
  }

  // ── 3. OG Tags ──
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["']/i);
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["']/i);
  const ogImage = html.match(/<meta[^>]*property=["']og:image["']/i);
  const ogType = html.match(/<meta[^>]*property=["']og:type["']/i);
  const ogPresent = [ogTitle, ogDesc, ogImage].filter(Boolean).length;
  const hasOg = ogPresent >= 3;
  if (ogPresent === 0) {
    checks.push({ name: "Open Graph Tags", status: "fail", value: "None found", recommendation: "Add og:title, og:description, og:image, og:type. These control how your site appears when shared — and shared content enters AI training data.", impact: "medium" });
  } else if (ogPresent < 3) {
    const missing = [!ogTitle && "og:title", !ogDesc && "og:description", !ogImage && "og:image"].filter(Boolean);
    checks.push({ name: "Open Graph Tags", status: "warn", value: `${ogPresent}/3 (missing: ${missing.join(", ")})`, recommendation: `Add missing OG tags: ${missing.join(", ")}`, impact: "medium" });
  } else {
    checks.push({ name: "Open Graph Tags", status: "pass", value: `${ogPresent}/3 present${ogType ? " + og:type" : ""}`, impact: "medium" });
  }

  // ── 4. Twitter Cards ──
  const twCard = html.match(/<meta[^>]*name=["']twitter:card["']/i);
  const twTitle = html.match(/<meta[^>]*name=["']twitter:title["']/i);
  const twDesc = html.match(/<meta[^>]*name=["']twitter:description["']/i);
  const twImage = html.match(/<meta[^>]*name=["']twitter:image["']/i);
  const twPresent = [twCard, twTitle || ogTitle, twImage || ogImage].filter(Boolean).length;
  const hasTw = twPresent >= 2;
  if (!twCard) {
    checks.push({ name: "Twitter Card Tags", status: "warn", value: "No twitter:card tag", recommendation: "Add <meta name=\"twitter:card\" content=\"summary_large_image\">. Controls appearance on X/Twitter — a key platform for AI training data.", impact: "medium" });
  } else {
    checks.push({ name: "Twitter Card Tags", status: "pass", value: `twitter:card present${twImage ? " + image" : ""}`, impact: "medium" });
  }

  // ── 5. Heading Structure ──
  const h1Matches = html.match(/<h1[^>]*>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>/gi) || [];
  const h3Matches = html.match(/<h3[^>]*>/gi) || [];
  const h1Count = h1Matches.length;
  const hasH2 = h2Matches.length > 0;
  // Check hierarchy: H3 should not appear before any H2
  const firstH2Pos = htmlLower.indexOf("<h2");
  const firstH3Pos = htmlLower.indexOf("<h3");
  const hierarchyValid = h1Count >= 1 && (firstH3Pos === -1 || firstH2Pos === -1 || firstH2Pos < firstH3Pos);

  if (h1Count === 0) {
    checks.push({ name: "Heading Structure", status: "fail", value: "No H1 tag", recommendation: "Add exactly one H1 tag with your primary keyword. H1 is the strongest on-page signal for both search engines and AI.", impact: "high" });
  } else if (h1Count > 1) {
    checks.push({ name: "Heading Structure", status: "warn", value: `${h1Count} H1 tags (should be 1)`, recommendation: "Use exactly one H1. Multiple H1s confuse search engines and dilute keyword signals.", impact: "high" });
  } else if (!hasH2) {
    checks.push({ name: "Heading Structure", status: "warn", value: "H1 present but no H2 tags", recommendation: "Add H2 subheadings to structure your content. AI engines use heading hierarchy to understand topic structure.", impact: "high" });
  } else if (!hierarchyValid) {
    checks.push({ name: "Heading Structure", status: "warn", value: "H3 appears before H2", recommendation: "Fix heading hierarchy: H1 → H2 → H3. Logical structure helps AI parse your content.", impact: "medium" });
  } else {
    checks.push({ name: "Heading Structure", status: "pass", value: `H1: ${h1Count}, H2: ${h2Matches.length}, H3: ${h3Matches.length}`, impact: "high" });
  }

  // ── 6. Sitemap.xml ──
  let hasSitemap = false;
  try {
    const sitemapUrl = new URL("/sitemap.xml", url).href;
    const sResp = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000), redirect: "follow" });
    if (sResp.ok) {
      const sText = await sResp.text();
      hasSitemap = sText.includes("<urlset") || sText.includes("<sitemapindex");
    }
  } catch { /* ignore */ }

  if (!hasSitemap) {
    checks.push({ name: "Sitemap.xml", status: "warn", value: "Not found or invalid", recommendation: "Add a sitemap.xml. It helps search engines and AI crawlers discover all your pages efficiently.", impact: "medium" });
  } else {
    checks.push({ name: "Sitemap.xml", status: "pass", value: "Found and valid", impact: "medium" });
  }

  // ── 7. Schema/JSON-LD Types ──
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const schemaTypes: string[] = [];
  for (const match of jsonLdMatches) {
    const content = match.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
    try {
      const parsed = JSON.parse(content);
      const types = Array.isArray(parsed) ? parsed : [parsed];
      for (const t of types) {
        if (t["@type"]) {
          const typeVal = Array.isArray(t["@type"]) ? t["@type"] : [t["@type"]];
          schemaTypes.push(...typeVal);
        }
        // Check @graph
        if (t["@graph"] && Array.isArray(t["@graph"])) {
          for (const g of t["@graph"]) {
            if (g["@type"]) {
              const gType = Array.isArray(g["@type"]) ? g["@type"] : [g["@type"]];
              schemaTypes.push(...gType);
            }
          }
        }
      }
    } catch { /* invalid JSON-LD */ }
  }
  const uniqueSchemaTypes = Array.from(new Set(schemaTypes));
  const recommendedTypes = ["Organization", "WebSite", "Product", "FAQPage", "Article", "BreadcrumbList"];
  const missingRecommended = recommendedTypes.filter(t => !uniqueSchemaTypes.some(s => s.toLowerCase() === t.toLowerCase()));
  
  if (uniqueSchemaTypes.length === 0) {
    checks.push({ name: "Schema Markup", status: "fail", value: "No JSON-LD found", recommendation: `Add structured data. Priority: Organization (tells AI who you are), FAQPage (AI loves Q&A format), Product/WebSite. Schema is one of the strongest GEO signals.`, impact: "high" });
  } else if (missingRecommended.length > 3) {
    checks.push({ name: "Schema Markup", status: "warn", value: `Found: ${uniqueSchemaTypes.join(", ")}`, recommendation: `Good start. Add: ${missingRecommended.slice(0, 3).join(", ")} for better AI entity recognition.`, impact: "high" });
  } else {
    checks.push({ name: "Schema Markup", status: "pass", value: `${uniqueSchemaTypes.length} types: ${uniqueSchemaTypes.join(", ")}`, impact: "high" });
  }

  // ── 8. Canonical URL ──
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  const hasCanonical = !!canonicalMatch;
  if (!hasCanonical) {
    checks.push({ name: "Canonical URL", status: "warn", value: "Not set", recommendation: "Add <link rel=\"canonical\"> to prevent duplicate content. AI engines may train on the wrong version of your page without it.", impact: "medium" });
  } else {
    checks.push({ name: "Canonical URL", status: "pass", value: canonicalMatch![1], impact: "medium" });
  }

  // ── 9. HTTPS ──
  const isHttps = url.startsWith("https://");
  if (!isHttps) {
    checks.push({ name: "HTTPS", status: "fail", value: "Not using HTTPS", recommendation: "Switch to HTTPS. Non-HTTPS sites are penalized by search engines and less likely to appear in AI grounded search results.", impact: "high" });
  } else {
    checks.push({ name: "HTTPS", status: "pass", value: "Secure connection", impact: "high" });
  }

  // ── 10. Image Alt Text ──
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imagesTotal = imgTags.length;
  let imagesMissingAlt = 0;
  for (const img of imgTags) {
    const hasAlt = /alt=["'][^"']+["']/i.test(img);
    const isDecorative = /alt=["']\s*["']/i.test(img); // empty alt = decorative, that's fine
    if (!hasAlt && !isDecorative) imagesMissingAlt++;
  }
  const altCoverage = imagesTotal > 0 ? Math.round(((imagesTotal - imagesMissingAlt) / imagesTotal) * 100) : 100;

  if (imagesTotal === 0) {
    checks.push({ name: "Image Alt Text", status: "pass", value: "No images found", impact: "low" });
  } else if (imagesMissingAlt === 0) {
    checks.push({ name: "Image Alt Text", status: "pass", value: `${imagesTotal} images, all have alt text`, impact: "medium" });
  } else if (altCoverage < 50) {
    checks.push({ name: "Image Alt Text", status: "fail", value: `${imagesMissingAlt}/${imagesTotal} missing alt text`, recommendation: "Add descriptive alt text to images. AI engines use alt text for multimodal understanding — it helps them associate your brand with visual concepts.", impact: "medium" });
  } else {
    checks.push({ name: "Image Alt Text", status: "warn", value: `${imagesMissingAlt}/${imagesTotal} missing alt text`, recommendation: `Add alt text to the remaining ${imagesMissingAlt} images.`, impact: "medium" });
  }

  // ── 11. Language/Hreflang ──
  const langAttr = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  const hreflangTags = html.match(/<link[^>]*hreflang/gi) || [];
  const hasHreflang = !!langAttr || hreflangTags.length > 0;
  if (!langAttr) {
    checks.push({ name: "Language Tag", status: "warn", value: "No lang attribute on <html>", recommendation: "Add lang=\"en\" (or appropriate language) to your <html> tag. Helps AI engines serve your content to the right audience.", impact: "low" });
  } else {
    checks.push({ name: "Language Tag", status: "pass", value: `lang="${langAttr[1]}"${hreflangTags.length > 0 ? ` + ${hreflangTags.length} hreflang tags` : ""}`, impact: "low" });
  }

  // ── 12. Content Quality ──
  const textContent = extractTextContent(html);
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 1).length;
  const readability = fleschReadingEase(textContent);

  if (wordCount < 200) {
    checks.push({ name: "Content Depth", status: "fail", value: `${wordCount} words (thin content)`, recommendation: "Add more content. Pages with <300 words are rarely included in AI training data or cited in answers. Aim for 800+ words with substantive, unique information.", impact: "high" });
  } else if (wordCount < 500) {
    checks.push({ name: "Content Depth", status: "warn", value: `${wordCount} words`, recommendation: "Consider expanding to 800+ words. More comprehensive content is more likely to be cited by AI engines.", impact: "high" });
  } else {
    checks.push({ name: "Content Depth", status: "pass", value: `${wordCount} words (readability: ${readability}/100)`, impact: "high" });
  }

  // ── 13. Social Profile Links ──
  const socialPatterns: Record<string, RegExp> = {
    Twitter: /(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i,
    LinkedIn: /linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/i,
    GitHub: /github\.com\/[a-zA-Z0-9_-]+/i,
    YouTube: /youtube\.com\/(?:@|channel\/|c\/)[a-zA-Z0-9_-]+/i,
    Discord: /discord\.(?:gg|com\/invite)\/[a-zA-Z0-9]+/i,
    Medium: /medium\.com\/@?[a-zA-Z0-9_-]+/i,
    Reddit: /reddit\.com\/r\/[a-zA-Z0-9_]+/i,
  };
  const socialLinksFound: string[] = [];
  for (const [name, pattern] of Object.entries(socialPatterns)) {
    if (pattern.test(html)) socialLinksFound.push(name);
  }

  if (socialLinksFound.length === 0) {
    checks.push({ name: "Social Profile Links", status: "warn", value: "No social links found on site", recommendation: "Add links to your social profiles (Twitter/X, LinkedIn, GitHub, etc.). Bidirectional linking strengthens entity connections — AI engines use these to verify your identity.", impact: "medium" });
  } else if (socialLinksFound.length < 3) {
    checks.push({ name: "Social Profile Links", status: "warn", value: `Found: ${socialLinksFound.join(", ")}`, recommendation: `Add more social profile links. Currently only ${socialLinksFound.length} — aim for 3+. Each platform strengthens your entity graph.`, impact: "medium" });
  } else {
    checks.push({ name: "Social Profile Links", status: "pass", value: `${socialLinksFound.length} platforms: ${socialLinksFound.join(", ")}`, impact: "medium" });
  }

  // ── 14. Keyword Placement ──
  let keywordScore = 0;
  if (keywords.length > 0) {
    const titleLower = metaTitle.toLowerCase();
    const descLower = metaDesc.toLowerCase();
    const h1Text = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, "").toLowerCase();
    const bodyLower = textContent.toLowerCase();

    let placementScore = 0;
    let placementMax = 0;
    // Weights: body presence is most important (if keyword is on the page, that matters most)
    const locationWeights = { title: 3, desc: 2, h1: 3, body: 4 };

    for (const kw of keywords.slice(0, 10)) { // Check top 10 keywords
      const kwLower = kw.toLowerCase();
      const words = kwLower.split(/\s+/).filter(w => w.length > 2);

      // matchesIn: exact phrase OR all significant words present
      const matchesIn = (text: string): boolean => {
        if (text.includes(kwLower)) return true;
        if (words.length > 1) return words.every(w => text.includes(w));
        return false;
      };

      // partialMatch: for multi-word keywords, return fraction of words found
      const partialMatch = (text: string): number => {
        if (text.includes(kwLower)) return 1;
        if (words.length <= 1) return text.includes(kwLower) ? 1 : 0;
        const found = words.filter(w => text.includes(w)).length;
        return found / words.length;
      };

      placementMax += locationWeights.title + locationWeights.desc + locationWeights.h1 + locationWeights.body;
      // Full match = full weight, partial match = proportional credit
      placementScore += partialMatch(titleLower) * locationWeights.title;
      placementScore += partialMatch(descLower) * locationWeights.desc;
      placementScore += partialMatch(h1Text) * locationWeights.h1;
      placementScore += partialMatch(bodyLower) * locationWeights.body;
    }
    keywordScore = placementMax > 0 ? Math.round((placementScore / placementMax) * 100) : 0;

    // If most keywords appear in the body, that's at minimum a "warn" not a "fail"
    const bodyHits = keywords.slice(0, 10).filter(kw => {
      const kwLower = kw.toLowerCase();
      const words = kwLower.split(/\s+/).filter(w => w.length > 2);
      if (bodyLower.includes(kwLower)) return true;
      if (words.length > 1) return words.every(w => bodyLower.includes(w));
      return false;
    }).length;
    const bodyRatio = keywords.length > 0 ? bodyHits / Math.min(keywords.length, 10) : 0;

    if (keywordScore < 25 && bodyRatio < 0.5) {
      checks.push({ name: "Keyword Placement", status: "fail", value: `${keywordScore}% coverage`, recommendation: `Your target keywords (${keywords.slice(0, 3).join(", ")}) barely appear in title, description, H1, or body. AI engines associate your brand with the words on your page — make sure your key terms are present.`, impact: "high" });
    } else if (keywordScore < 50) {
      checks.push({ name: "Keyword Placement", status: "warn", value: `${keywordScore}% coverage`, recommendation: "Keywords appear in your content but not consistently across title, H1, and meta description. Place your primary keywords in all three for maximum AI signal.", impact: "high" });
    } else {
      checks.push({ name: "Keyword Placement", status: "pass", value: `${keywordScore}% coverage across title, description, H1, body`, impact: "high" });
    }
  } else {
    checks.push({ name: "Keyword Placement", status: "warn", value: "No keywords to check", recommendation: "Define target keywords for your brand so we can verify they're properly placed.", impact: "high" });
  }

  // ── Scoring ──
  const weights: Record<string, number> = {
    "Meta Title": 10, "Meta Description": 10, "Open Graph Tags": 5,
    "Twitter Card Tags": 5, "Heading Structure": 12, "Sitemap.xml": 5,
    "Schema Markup": 15, "Canonical URL": 5, "HTTPS": 8,
    "Image Alt Text": 5, "Language Tag": 3, "Content Depth": 12,
    "Social Profile Links": 5, "Keyword Placement": 10,  // Total: 110, normalized to 100
  };

  // Don't count keyword placement if no keywords provided
  const activeWeight = keywords.length > 0 ? 110 : 100;

  let weightedScore = 0;
  let passCount = 0, warnCount = 0, failCount = 0;

  for (const check of checks) {
    const w = weights[check.name] || 5;
    if (check.status === "pass") { weightedScore += w; passCount++; }
    else if (check.status === "warn") { weightedScore += w * 0.5; warnCount++; }
    else { failCount++; }
  }

  const score = Math.round((weightedScore / activeWeight) * 100);

  return {
    checks,
    score: Math.min(100, score),
    passCount, warnCount, failCount,
    fetchedUrl: url,
    timestamp: new Date().toISOString(),
    raw: {
      metaTitleLength: titleLen || null,
      metaDescLength: descLen || null,
      hasOgTags: hasOg,
      hasTwitterCards: hasTw,
      h1Count,
      headingHierarchyValid: hierarchyValid,
      hasSitemap,
      schemaTypes: uniqueSchemaTypes,
      hasCanonical,
      isHttps,
      hasHreflang,
      imagesTotal,
      imagesMissingAlt,
      wordCount,
      socialLinksOnSite: socialLinksFound,
      keywordPlacementScore: keywordScore,
    },
  };
}

// ── Backlink Discovery (Tavily + Exa hybrid) ──

export async function discoverBacklinks(website: string, brand: string): Promise<BacklinkResult> {
  const domain = (() => {
    try { return new URL(normalizeUrl(website)).hostname.replace(/^www\./, ""); }
    catch { return website; }
  })();

  const result: BacklinkResult = { referringDomains: 0, categories: {}, topReferrers: [] };
  const seenDomains = new Set<string>();

  // Strategy 1: Tavily with exclude_domains for precise backlink discovery
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `"${domain}" OR "${brand}"`,
          search_depth: "basic",
          max_results: 10,
          exclude_domains: [domain],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const r of data.results || []) {
          try {
            const refDomain = new URL(r.url).hostname.replace(/^www\./, "");
            if (!seenDomains.has(refDomain) && refDomain !== domain) {
              seenDomains.add(refDomain);
              const cat = categorizeReferrer(refDomain, r.title || "");
              result.categories[cat] = (result.categories[cat] || 0) + 1;
              result.topReferrers.push({ domain: refDomain, title: r.title || "" });
            }
          } catch { /* skip bad URLs */ }
        }
      }
    } catch (e) {
      console.warn("[BACKLINKS] Tavily search failed:", e);
    }
  }

  // Strategy 2: Exa for semantic "pages about this brand"
  const exaKey = process.env.EXA_API_KEY;
  if (exaKey) {
    try {
      const resp = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": exaKey },
        body: JSON.stringify({
          query: `${brand} ${domain}`,
          numResults: 10,
          type: "neural",
          excludeDomains: [domain],
          contents: { text: { maxCharacters: 200 } },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const r of data.results || []) {
          try {
            const refDomain = new URL(r.url).hostname.replace(/^www\./, "");
            if (!seenDomains.has(refDomain) && refDomain !== domain) {
              seenDomains.add(refDomain);
              const cat = categorizeReferrer(refDomain, r.title || "");
              result.categories[cat] = (result.categories[cat] || 0) + 1;
              result.topReferrers.push({ domain: refDomain, title: r.title || "" });
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      console.warn("[BACKLINKS] Exa search failed:", e);
    }
  }

  result.referringDomains = seenDomains.size;
  return result;
}

function categorizeReferrer(domain: string, title: string): string {
  const d = domain.toLowerCase();
  const t = title.toLowerCase();

  // News
  if (/\b(news|press|wire|reuters|bloomberg|techcrunch|coindesk|cointelegraph|theblock|decrypt)\b/.test(d + " " + t)) return "news";
  // Academic/Research
  if (/\b(edu|arxiv|scholar|research|journal|university|academic)\b/.test(d)) return "academic";
  // Directories/Listings
  if (/\b(crunchbase|g2|capterra|producthunt|alternativeto|sourceforge|stackshare)\b/.test(d)) return "directory";
  // Social/Forum
  if (/\b(reddit|twitter|x\.com|linkedin|discord|medium|substack|hackernews)\b/.test(d)) return "social";
  // Dev platforms
  if (/\b(github|gitlab|npm|pypi|stackoverflow|dev\.to|hashnode)\b/.test(d)) return "developer";
  // Blog
  if (/\b(blog|wordpress|ghost|blogspot|substack)\b/.test(d + " " + t)) return "blog";

  return "other";
}

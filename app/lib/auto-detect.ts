/**
 * Auto-detect pipeline: Website → Company Profile → Gemini Enrichment
 * 
 * What LLMs "see" when indexing a website (priority order):
 * 1. Title tag + meta description
 * 2. H1 headline
 * 3. First 200 words of body content
 * 4. Schema/structured data (JSON-LD, OpenGraph)
 * 5. H2/H3 subheadings
 * 6. Alt text on images
 * 
 * After ~500 words of content, signal decays rapidly.
 * Our scanner extracts exactly what an LLM would index.
 */

interface DetectedInfo {
  brand: string;
  industry: string;
  competitors: string[];
  website: string;
  description: string;
  keywords: string[];
  features: string[];
  suggestedPrompts: string[];
  websiteContext: string; // Full scraped website text for judge grounding
}

// ── Step 0: Raw website scan ──
// Extracts what an LLM would actually see and index

interface WebsiteProfile {
  title: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogSiteName: string;
  h1: string;
  h2s: string[];
  h3s: string[];
  firstParagraph: string;
  schemaData: string;
  altTexts: string[];
  visibleText: string; // first ~500 words
  metaKeywords: string;
}

function scanWebsite(html: string): WebsiteProfile {
  const get = (pattern: RegExp) => (html.match(pattern)?.[1] || "").trim();
  const getAll = (pattern: RegExp, limit = 10) => {
    const matches: string[] = [];
    let m;
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    while ((m = re.exec(html)) && matches.length < limit) {
      const text = m[1].replace(/<[^>]+>/g, "").trim();
      if (text.length > 1 && text.length < 200) matches.push(text);
    }
    return matches;
  };

  // Title
  const title = get(/<title[^>]*>([^<]+)<\/title>/i);

  // Meta description (both attribute orders)
  const metaDescription = get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  // OpenGraph
  const ogTitle = get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const ogDescription = get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const ogSiteName = get(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);

  // Headings
  const h1 = get(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h2s = getAll(/<h2[^>]*>([\s\S]*?)<\/h2>/i, 8);
  const h3s = getAll(/<h3[^>]*>([\s\S]*?)<\/h3>/i, 6);

  // First paragraph
  const firstParagraph = get(/<p[^>]*>([\s\S]*?)<\/p>/i);

  // Schema/JSON-LD
  const schemaMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const schemaData = schemaMatches.map(s => s.replace(/<\/?script[^>]*>/gi, "").trim()).join("\n").slice(0, 1000);

  // Alt texts
  const altTexts = getAll(/<img[^>]+alt=["']([^"']+)["']/i, 10);

  // Meta keywords
  const metaKeywords = get(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i)
    || get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i);

  // Visible text: strip nav, footer, scripts, styles, then get first ~500 words
  let visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // ~500 words ≈ 3000 chars
  visibleText = visibleText.slice(0, 3000);

  return {
    title, metaDescription, ogTitle, ogDescription, ogSiteName,
    h1, h2s, h3s, firstParagraph, schemaData, altTexts, visibleText,
    metaKeywords,
  };
}

// ── Step 1: Extract brand name ──

function extractBrand(profile: WebsiteProfile, hostname: string, domainBase: string): string {
  // Priority: title first part > og:title > og:site_name > domain
  // Title is more reliable than og:site_name because og:site_name is often a
  // ticker symbol, abbreviation, or parent company name (e.g., "VIRTUAL" instead of "Virtuals Protocol")
  const candidates: string[] = [];
  
  if (profile.title) {
    const name = profile.title.split(/\s*[-–—|:]\s*/)[0].trim();
    if (name.length >= 2 && name.length <= 40) candidates.push(name);
  }
  if (profile.ogTitle) {
    const name = profile.ogTitle.split(/\s*[-–—|:]\s*/)[0].trim();
    if (name.length >= 2 && name.length <= 40 && !candidates.includes(name)) candidates.push(name);
  }
  if (profile.ogSiteName && profile.ogSiteName.length >= 2 && profile.ogSiteName.length <= 40) {
    if (!candidates.includes(profile.ogSiteName)) candidates.push(profile.ogSiteName);
  }
  
  // Return the longest candidate (usually the most descriptive/complete brand name)
  // e.g., "Virtuals Protocol" > "VIRTUAL"
  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.length - a.length)[0];
  }
  
  return domainBase.charAt(0).toUpperCase() + domainBase.slice(1);
}

// ── Step 2: Build LLM-visible context ──
// This is what we send to Gemini for enrichment — mirrors what an LLM actually indexes

function buildLLMContext(profile: WebsiteProfile): string {
  const parts: string[] = [];

  if (profile.title) parts.push(`Page title: ${profile.title}`);
  if (profile.metaDescription) parts.push(`Meta description: ${profile.metaDescription}`);
  if (profile.h1) parts.push(`Main headline (H1): ${profile.h1}`);
  if (profile.ogDescription && profile.ogDescription !== profile.metaDescription) {
    parts.push(`OG description: ${profile.ogDescription}`);
  }
  if (profile.h2s.length > 0) parts.push(`Section headings: ${profile.h2s.join(" | ")}`);
  if (profile.h3s.length > 0) parts.push(`Sub-headings: ${profile.h3s.join(" | ")}`);
  if (profile.firstParagraph) parts.push(`First paragraph: ${profile.firstParagraph}`);
  if (profile.schemaData) parts.push(`Structured data: ${profile.schemaData.slice(0, 500)}`);
  if (profile.altTexts.length > 0) parts.push(`Image descriptions: ${profile.altTexts.join(", ")}`);
  if (profile.visibleText) parts.push(`Page content (first 500 words): ${profile.visibleText}`);

  return parts.join("\n\n");
}

// ── Step 3: Gemini enrichment (single call, multi-part) ──
// One structured prompt that returns: competitors, keywords, features, category, suggested prompts

interface GeminiEnrichment {
  brand: string;
  description: string;
  category: string;
  competitors: string[];
  keywords: string[];
  features: string[];
  suggestedPrompts: string[];
}

async function callGemini(apiKey: string, prompt: string, timeout = 12000, grounded = false): Promise<string | null> {
  // Try up to 2 times — most transient failures resolve on retry
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body: Record<string, unknown> = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      };
      if (grounded) {
        body.tools = [{ google_search: {} }];
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeout),
        }
      );
      if (!res.ok) {
        if (attempt === 0) { await new Promise(r => setTimeout(r, 2000)); continue; }
        return null;
      }
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch {
      if (attempt === 0) { await new Promise(r => setTimeout(r, 2000)); continue; }
      return null;
    }
  }
  return null;
}

function parseJSON(text: string): Record<string, unknown> | null {
  try {
    let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    // Grounded responses may wrap JSON in extra text — extract the JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function enrichWithGemini(brandGuess: string, llmContext: string): Promise<GeminiEnrichment | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // ── Step A: Understand the company (brand, category, keywords, features, prompts) ──
  const profilePrompt = `You are analyzing a website for a GEO (Generative Engine Optimization) audit.

Here is everything an AI engine would see when indexing this website:

---
${llmContext}
---

The brand name appears to be: "${brandGuess}"

Return a JSON object:

1. "brand": Clean brand name as users would say it (no "API"/"Platform" suffix unless it's genuinely part of the brand).

2. "description": One specific sentence about what this company does. Be precise. Example: "Pay-per-call crypto trading signals API built for AI agents and developers" NOT "A crypto platform".

3. "category": Specific market category, 3-8 words. Example: "crypto trading signals API" NOT "cryptocurrency".

4. "keywords": Array of 8-12 search phrases customers would type to find this EXACT type of service. Must reflect what the product actually does. Include feature-specific variations.

5. "features": Array of 3-6 KEY differentiating capabilities from the website. Specific, not generic. Example: ["x402 micropayments", "no API keys needed"] NOT ["fast", "reliable"].

6. "suggestedPrompts": Array of 15 queries a real person would type into ChatGPT/Gemini when looking for this type of service:
   - 5 category discovery ("best [category]", "top [category] tools")
   - 5 use-case ("how to [solve the problem this product solves]")
   - 5 buying intent ("which [category] should I use", "pricing comparison")
   Do NOT include the brand name. These test organic discoverability.
   IMPORTANT: The current year is ${new Date().getFullYear()}. Use it in any time-referenced prompts (e.g., "best X tools ${new Date().getFullYear()}").

Return ONLY valid JSON. No markdown, no code blocks.`;

  // ── Run profile first, then grounded competitor search ──
  const profileText = await callGemini(apiKey, profilePrompt, 25000);
  if (!profileText) return null;
  const profile = parseJSON(profileText);
  if (!profile) return null;

  const category = typeof profile.category === "string" ? profile.category : "general";
  const description = typeof profile.description === "string" ? profile.description : "";

  // ── Single grounded search for DIRECT competitors using description ──
  let competitors: string[] = [];
  try {
    const competitorPrompt = `Product: ${profile?.brand || brandGuess}
Description: ${description}
Category: ${category}

Find 5-8 DIRECT competitors — products targeting the same specific use case, buyer persona, and market positioning as described above. Do NOT list broad category leaders unless they directly compete on the same features and use case.

Return ONLY company/product names as a JSON array. Example: ["Company1", "Company2"]`;

    const body = {
      contents: [
        { role: "user", parts: [{ text: competitorPrompt }] },
      ],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0 },
    };
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const arrMatch = text.match(/\[[\s\S]*?\]/);
      if (arrMatch) {
        const arr = JSON.parse(arrMatch[0]);
        if (Array.isArray(arr)) {
          competitors = arr
            .filter((n: unknown): n is string => typeof n === "string" && n.toLowerCase() !== brandGuess.toLowerCase())
            .slice(0, 8);
        }
      }
    }
  } catch { /* grounded search failed — competitors stays empty, handled by emerging category logic */ }

  return {
    brand: typeof profile.brand === "string" ? profile.brand : brandGuess,
    description,
    category,
    competitors,
    keywords: (profile.keywords as string[] || []).filter((k: string) => typeof k === "string").slice(0, 12),
    features: (profile.features as string[] || []).filter((f: string) => typeof f === "string").slice(0, 6),
    suggestedPrompts: (profile.suggestedPrompts as string[] || []).filter((p: string) => typeof p === "string").slice(0, 15),
  };
}

// ── Main pipeline ──
// Designed to NEVER fail. Every step has fallbacks.
// Worst case: returns brand from domain name + "technology" industry.

export async function autoDetect(websiteUrl: string): Promise<DetectedInfo> {
  const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const domainBase = hostname.split(".")[0];

  // Default fallbacks — always valid, always returned if everything else fails
  let brand = domainBase.charAt(0).toUpperCase() + domainBase.slice(1);
  let industry = "technology";
  let description = "";
  let competitors: string[] = [];
  let keywords: string[] = [];
  let features: string[] = [];
  let suggestedPrompts: string[] = [];

  // Step 0: Fetch and scan the website (5s timeout — fail fast)
  let profile: WebsiteProfile | null = null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (res.ok) {
      const html = await res.text();
      profile = scanWebsite(html);
      brand = extractBrand(profile, hostname, domainBase);
      description = profile.metaDescription || profile.ogDescription || "";
    }
  } catch {
    console.warn(`[auto-detect] Website fetch failed for ${url}, continuing with domain-based fallback`);
  }

  // Step 1: Build LLM-visible context from scan
  const llmContext = profile ? buildLLMContext(profile) : `Brand: ${brand}\nDomain: ${hostname}`;

  // Step 2: Gemini enrichment (20s timeout — if it doesn't respond, use HTML-only data)
  try {
    const enriched = await enrichWithGemini(brand, llmContext);
    if (enriched) {
      brand = enriched.brand || brand;
      industry = enriched.category || industry;
      description = enriched.description || description;
      competitors = enriched.competitors;
      keywords = enriched.keywords;
      features = enriched.features;
      suggestedPrompts = enriched.suggestedPrompts;
    }
  } catch {
    console.warn(`[auto-detect] Gemini enrichment failed for ${brand}, using HTML-only data`);
  }

  // Step 3: Fallback description — always produce SOMETHING
  if (!description && profile) {
    const fallbackParts: string[] = [];
    if (profile.title) fallbackParts.push(profile.title);
    if (profile.h1 && profile.h1 !== profile.title) fallbackParts.push(profile.h1);
    if (profile.firstParagraph) fallbackParts.push(profile.firstParagraph.slice(0, 200));
    if (profile.h2s.length > 0) fallbackParts.push(profile.h2s.slice(0, 3).join(". "));
    description = fallbackParts.join(" — ").slice(0, 500);
  }
  if (!description) {
    description = `${brand} (${hostname}) — ${industry}`;
  }

  // Step 4: Fallback industry from HTML if Gemini didn't enrich
  if (industry === "technology" && profile) {
    // Try to extract something better from meta/title
    const signals = [profile.metaDescription, profile.ogDescription, profile.title, profile.h1].join(" ").toLowerCase();
    if (signals.includes("saas") || signals.includes("software")) industry = "software";
    else if (signals.includes("crypto") || signals.includes("blockchain") || signals.includes("defi")) industry = "cryptocurrency and blockchain";
    else if (signals.includes("ai") || signals.includes("artificial intelligence") || signals.includes("machine learning")) industry = "artificial intelligence";
    else if (signals.includes("fintech") || signals.includes("finance") || signals.includes("banking")) industry = "fintech";
    else if (signals.includes("health") || signals.includes("medical")) industry = "healthcare technology";
    else if (signals.includes("ecommerce") || signals.includes("shop") || signals.includes("store")) industry = "e-commerce";
    else if (signals.includes("education") || signals.includes("learning")) industry = "education technology";
    else if (signals.includes("security") || signals.includes("cyber")) industry = "cybersecurity";
    else if (signals.includes("marketing") || signals.includes("seo") || signals.includes("advertising")) industry = "digital marketing";
    else if (signals.includes("developer") || signals.includes("api") || signals.includes("devtool")) industry = "developer tools";
  }

  return { brand, industry, competitors, website: url, description, keywords, features, suggestedPrompts, websiteContext: llmContext };
}

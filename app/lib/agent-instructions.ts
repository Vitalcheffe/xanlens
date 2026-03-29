/**
 * Build structured agent_instructions for any AI agent consuming XanLens audit results.
 * Single source of truth — used by both cached and fresh code paths in the status route.
 */

// ── Platform content rules (research-backed) ──
// Sources: Averi.ai citation study, Semrush 248K Reddit study, Profound 680M citation analysis

interface PlatformRule {
  platform: string;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  content_type: string;
  word_count: string;
  format: string;
  geo_rules: string[];
}

const PLATFORM_RULES: Record<string, PlatformRule> = {
  website: {
    platform: "Website (on-site content)",
    priority: "critical",
    reason: "Foundation for all AI indexing. Every engine crawls your site first.",
    content_type: "On-page elements: meta title, meta description, H1, first 200 words, H2/H3 structure, schema markup, FAQ schema, llms.txt",
    word_count: "Varies per element — see fix targets for specifics",
    format: "HTML elements and structured data",
    geo_rules: [
      "Meta title: 50-60 chars. Format: '[Brand] — [What It Is] | [Differentiator]'.",
      "Meta description: 150-160 chars. Complete answer sentence with brand name + category + differentiator.",
      "H1: One sentence defining the brand. Must work standalone — if an LLM reads only this, it knows what the brand does.",
      "First 200 words: Sentence 1 = '[Brand] is a [category] that [does what]'. Include 1 stat, 2-3 semantic keywords. Must work as standalone paragraph for RAG extraction.",
      "H2/H3: Feature names as headings, not generic labels. Each heading = entity attribute an LLM would extract.",
      "Schema markup increases citation likelihood by 28-40%. Use Organization, FAQPage, SoftwareApplication, WebSite schemas.",
      "llms.txt: Entity-focused, claim-rich. Include Key Entities, Factual Claims (5-8 verifiable), known URLs.",
    ],
  },
  "dev.to": {
    platform: "Dev.to / Hashnode / Medium",
    priority: "high",
    reason: "Long-form technical authority. Indexed by all engines. Dev.to indexed heavily by Perplexity.",
    content_type: "Technical article / tutorial / guide",
    word_count: "1,500-2,500 words",
    format: "H2/H3 structure. Code snippets if relevant. Answer-first paragraphs. Tables for comparisons.",
    geo_rules: [
      "Title as question or 'How to' format — matches AI query patterns directly.",
      "First paragraph = standalone answer to the title question. Include brand name.",
      "Include 3+ statistics or data points with attribution.",
      "Tables for comparisons (LLMs extract tabular data well).",
      "Brand mentioned by name 4-6 times throughout.",
      "76.4% of Perplexity's most-cited pages updated within 30 days — include publish date prominently.",
    ],
  },
  linkedin: {
    platform: "LinkedIn",
    priority: "high",
    reason: "15.2% of Google AI Overview citations. Professional authority signal trusted by all engines.",
    content_type: "LinkedIn post (feed) or LinkedIn article (long-form)",
    word_count: "Post: 200-300 words (1,200-1,800 chars). Article: 1,500-2,500 words.",
    format: "Hook in first 2 lines (before 'see more'). Short paragraphs (1-2 sentences). Line breaks for readability.",
    geo_rules: [
      "Personal/expert voice — not corporate.",
      "Lead with insight, not promotion. Data point or surprising fact first.",
      "Brand name in first 3 lines.",
      "End with engagement prompt (question or call to action).",
      "3-5 hashtags max. No hashtag stuffing.",
      "For articles: same structure as Dev.to but with professional/business angle.",
    ],
  },
  x: {
    platform: "X (Twitter)",
    priority: "high",
    reason: "Real-time authority signal. Threads get indexed by AI engines.",
    content_type: "Single post (280 chars) or thread (5-10 tweets)",
    word_count: "Thread: 5-10 tweets, each 200-280 chars",
    format: "Tweet 1 = hook with brand mention. Tweets 2-8 = insights with stats. Last tweet = CTA or question.",
    geo_rules: [
      "Text-only performs best — X algorithm penalizes posts with links.",
      "Lead with the insight. Brand name in first tweet.",
      "1 stat or data point per thread minimum.",
      "No emoji spam. Conversational tone.",
      "Each tweet should be a standalone insight that makes sense if extracted alone.",
    ],
  },
  reddit: {
    platform: "Reddit",
    priority: "high",
    reason: "#1 citation source for Perplexity (46.7%), top-3 for all AI engines. Q&A threads dominate citations (50%+).",
    content_type: "Post or comment in relevant subreddit",
    word_count: "200-500 words. Detailed, experience-based.",
    format: "Answer the question directly first. Then elaborate with specifics and data.",
    geo_rules: [
      "NEVER promotional. Genuine helpfulness only.",
      "Mention brand only when directly relevant to answering the question.",
      "Most cited posts have <20 upvotes — engagement doesn't determine AI visibility, content quality does.",
      "Average cited post is 1 year old — write evergreen content.",
      "Q&A format performs best. Answer a real question people are asking.",
      "Include personal experience or specific data to establish authenticity.",
    ],
  },
  youtube: {
    platform: "YouTube",
    priority: "medium",
    reason: "18.8% of Google AI Overview citations. 13.9% of Perplexity citations.",
    content_type: "Video script + description + transcript",
    word_count: "15-30 minute video script (2,000-4,000 words). Full transcript in description.",
    format: "Timestamp chapters. Detailed description with keywords. Title as question format.",
    geo_rules: [
      "AI engines read transcripts, not video content. Transcript quality = visibility.",
      "Full transcript uploaded as subtitles AND embedded in description.",
      "Longer videos (15-30 min) outperform short clips for AI citations.",
      "Title as natural question — matches how people query AI.",
    ],
  },
  quora: {
    platform: "Quora",
    priority: "medium",
    reason: "12.4% of Google AI Overview citations. Q&A format matches AI query patterns directly.",
    content_type: "Answer to a relevant question",
    word_count: "300-800 words per answer",
    format: "Direct answer in first sentence. Then explanation with data. Include credentials.",
    geo_rules: [
      "Answer as expert, not promoter.",
      "Include 1-2 data points or statistics.",
      "Link to supporting resources (not promotional pages).",
      "Update answers periodically — freshness matters.",
    ],
  },
  ai_directories: {
    platform: "AI Directories (TAIFT, Futurepedia, There's An AI For That)",
    priority: "high",
    reason: "Direct listing in AI tool databases that engines reference for product discovery.",
    content_type: "Structured listing",
    word_count: "200-400 words (description + features)",
    format: "Name, description (2-3 sentences), category, features (bullet list), pricing, URL.",
    geo_rules: [
      "Entity-dense description — what the product IS, not marketing fluff.",
      "Exact category match to how the industry names this type of tool.",
      "Complete all available fields.",
      "Include comparison language: 'Unlike [alternative], [Brand] does X'.",
    ],
  },
  github: {
    platform: "GitHub",
    priority: "high",
    reason: "Developer trust signal. README is heavily indexed by AI engines.",
    content_type: "Repository README, docs, open-source presence",
    word_count: "README: 500-1,500 words. Docs: as needed.",
    format: "H2/H3 structure. Code examples. Installation instructions. Clear description.",
    geo_rules: [
      "README first paragraph = standalone definition of what this is.",
      "Include quick-start code examples.",
      "Badge-rich (build status, version, license) — signals active maintenance.",
      "Description field: entity-rich, not clever/cute.",
    ],
  },
  g2: {
    platform: "G2 / Capterra",
    priority: "high",
    reason: "Review platforms heavily cited by AI for product recommendations. 4.8% of ChatGPT top-10 citations.",
    content_type: "Product listing + encourage customer reviews",
    word_count: "Profile: 300-500 words. Reviews: encourage 100+ word detailed reviews.",
    format: "Complete profile with all fields. Accurate pricing. Feature comparison data.",
    geo_rules: [
      "Maintain 70%+ average ratings.",
      "Respond to every review (positive signal to crawlers).",
      "Encourage detailed, keyword-rich customer reviews.",
      "Keep pricing and feature information current.",
    ],
  },
  product_hunt: {
    platform: "Product Hunt",
    priority: "medium",
    reason: "Launch presence feeds AI product knowledge.",
    content_type: "Product listing / launch post",
    word_count: "Tagline: 60 chars. Description: 300-500 words.",
    format: "Clear tagline. Problem → Solution → Features format.",
    geo_rules: [
      "Launch post with clear value proposition.",
      "Include comparison to alternatives.",
      "Maker comments answering questions build entity depth.",
    ],
  },
  wikipedia: {
    platform: "Wikipedia",
    priority: "low",
    reason: "47.9% of ChatGPT's top-10 citations. But requires genuine notability.",
    content_type: "Wikipedia article or category contribution",
    word_count: "N/A — depends on notability",
    format: "Encyclopedic. Neutral point of view. Cited sources only.",
    geo_rules: [
      "Only applicable for brands with sufficient notability (press coverage, usage data, funding).",
      "Do NOT create promotional pages — they will be deleted.",
      "Contribute to category pages where the brand is mentioned in legitimate sources.",
      "Get cited through legitimate press coverage and research.",
    ],
  },
  crunchbase: {
    platform: "Crunchbase",
    priority: "low",
    reason: "Company profile for entity validation. AI engines cross-reference.",
    content_type: "Company profile",
    word_count: "200-400 words",
    format: "Structured: description, funding, team, category.",
    geo_rules: [
      "Complete all fields accurately.",
      "Description = factual entity definition.",
    ],
  },
  farcaster: {
    platform: "Farcaster",
    priority: "high",
    reason: "Crypto-native social platform with growing AI indexing.",
    content_type: "Casts (posts)",
    word_count: "280-320 chars per cast",
    format: "Short-form. Link to longer content. Community engagement.",
    geo_rules: [
      "Similar rules to X/Twitter but for crypto-native audience.",
      "Technical depth appreciated.",
    ],
  },
};

// ── Industry-specific platform selection ──

function getPlatformsForIndustry(industry: string): string[] {
  const lower = industry.toLowerCase();
  const platforms = ["website", "linkedin", "x", "reddit"];

  if (lower.match(/dev|software|api|tool|engineer|code|open.?source/)) {
    platforms.push("github", "dev.to");
  }
  if (lower.match(/saas|b2b|business|product|management|project/)) {
    platforms.push("g2", "product_hunt");
  }
  if (lower.match(/crypto|web3|defi|blockchain/)) {
    platforms.push("farcaster");
  }
  if (lower.match(/\bai\b|machine.?learning|artificial/)) {
    platforms.push("ai_directories");
  }

  // Always include these
  if (!platforms.includes("dev.to")) platforms.push("dev.to");
  platforms.push("youtube", "quora", "crunchbase");

  return platforms;
}

// ── Dynamic fix target generation ──

interface FixTarget {
  id: string;
  type: "on-site" | "off-site";
  platform: string;
  title: string;
  what_is_wrong: string;
  what_to_do: string;
  priority: number; // 1 = highest
  content_rules: string[];
}

interface EngineResult {
  score: number;
  mentions: number;
  sentiment: string;
  sample_snippets: string[];
  prompts_tested: number;
}

interface WebsiteHealthCheck {
  name: string;
  status: string;
  value: string;
  impact: string;
  recommendation?: string;
}

interface BlindSpot {
  prompt: string;
  category: string;
  type?: string;
  severity?: string;
}

interface BuildInput {
  jobId: string;
  brand: string;
  website: string;
  industry: string;
  description: string;
  features: string[];
  keywords: string[];
  competitors: string[];
  overallScore: number;
  grade: string;
  knowledgeScore: number;
  discoverabilityScore: number;
  citationScore: number;
  websiteHealthScore: number;
  websiteHealthChecks: WebsiteHealthCheck[];
  engines: Record<string, EngineResult>;
  blindSpots: BlindSpot[];
  promptDetails: Array<{
    prompt: string;
    engine: string;
    mentioned: boolean;
    blind_spot: boolean;
    snippet: string | null;
    category: string;
  }>;
}

function buildFixTargets(input: BuildInput): FixTarget[] {
  const { brand, website, industry, engines, websiteHealthChecks, blindSpots, promptDetails, knowledgeScore, discoverabilityScore, citationScore, competitors } = input;
  const fixes: FixTarget[] = [];
  let priority = 1;

  // ── ON-SITE FIXES (from website health checks) ──
  const failChecks = websiteHealthChecks.filter(c => c.status === "fail");
  const warnHighChecks = websiteHealthChecks.filter(c => c.status === "warn" && c.impact === "high");
  const warnMedChecks = websiteHealthChecks.filter(c => c.status === "warn" && c.impact === "medium");

  for (const check of [...failChecks, ...warnHighChecks]) {
    fixes.push({
      id: `onsite-${check.name.toLowerCase().replace(/\s+/g, "-")}`,
      type: "on-site",
      platform: "website",
      title: `Fix: ${check.name}`,
      what_is_wrong: `${check.value}`,
      what_to_do: check.recommendation || `Fix ${check.name} to improve AI indexing.`,
      priority: priority++,
      content_rules: PLATFORM_RULES.website.geo_rules.filter(r =>
        r.toLowerCase().includes(check.name.toLowerCase().split(":")[0].split(" ")[0])
      ),
    });
  }

  // On-site content rewrites if knowledge score is low
  if (knowledgeScore < 60) {
    const hasMetaTitleFix = fixes.some(f => f.id.includes("meta-title") || f.id.includes("title"));
    const hasMetaDescFix = fixes.some(f => f.id.includes("meta-desc") || f.id.includes("description"));
    const hasH1Fix = fixes.some(f => f.id.includes("h1"));

    if (!hasMetaTitleFix) {
      fixes.push({
        id: "onsite-rewrite-meta-title",
        type: "on-site",
        platform: "website",
        title: "Rewrite meta title for AI clarity",
        what_is_wrong: `Knowledge score is ${knowledgeScore}/100 — AI engines don't clearly understand what ${brand} does. Meta title must define the brand.`,
        what_to_do: `Write a 50-60 char meta title. Format: '${brand} — [What It Is] | [Key Differentiator]'. Entity-rich, not marketing fluff.`,
        priority: priority++,
        content_rules: ["Meta title: 50-60 chars. Include brand name, category, and one differentiator."],
      });
    }
    if (!hasMetaDescFix) {
      fixes.push({
        id: "onsite-rewrite-meta-description",
        type: "on-site",
        platform: "website",
        title: "Rewrite meta description for AI extraction",
        what_is_wrong: `Meta description must be a complete answer sentence that AI can extract verbatim.`,
        what_to_do: `Write 150-160 chars. Must contain: brand name, category, 1 concrete differentiator. Format as a complete answer sentence.`,
        priority: priority++,
        content_rules: ["Meta description: 150-160 chars. Complete answer sentence with brand + category + differentiator."],
      });
    }
    if (!hasH1Fix) {
      fixes.push({
        id: "onsite-rewrite-h1",
        type: "on-site",
        platform: "website",
        title: "Rewrite H1 as standalone brand definition",
        what_is_wrong: `H1 must work as a standalone definition — if an LLM reads ONLY this, it should know exactly what ${brand} is.`,
        what_to_do: `Write one clear sentence defining ${brand}. Entity-rich. Include category and primary differentiator.`,
        priority: priority++,
        content_rules: ["H1 = one sentence that defines the brand. Standalone definition for LLMs."],
      });
    }

    // First 200 words rewrite
    fixes.push({
      id: "onsite-rewrite-first-200-words",
      type: "on-site",
      platform: "website",
      title: "Rewrite first 200 words (LLM attention window)",
      what_is_wrong: `LLMs process pages top-down with a ~500 word attention window. The first 200 words are 'above the fold' for AI indexing.`,
      what_to_do: `Sentence 1: '${brand} is a [category] that [does what]'. Sentences 2-3: Key differentiators with specifics. Include 1 stat. Natural mention of 2-3 semantic keywords. Must work as standalone paragraph for RAG extraction.`,
      priority: priority++,
      content_rules: PLATFORM_RULES.website.geo_rules,
    });

    // H2/H3 structure
    fixes.push({
      id: "onsite-rewrite-heading-structure",
      type: "on-site",
      platform: "website",
      title: "Restructure H2/H3 headings as entity attributes",
      what_is_wrong: `Headings should be feature names/capabilities that LLMs extract as entity attributes, not generic labels like 'Our Solution'.`,
      what_to_do: `Generate 6-8 H2/H3 headings that define page structure. Each heading = a specific feature or capability name.`,
      priority: priority++,
      content_rules: ["H2/H3: Feature-name headings, not generic. Each should be extractable as an entity attribute."],
    });
  }

  // Schema markup if missing or citation score is low
  if (citationScore < 50) {
    fixes.push({
      id: "onsite-schema-markup",
      type: "on-site",
      platform: "website",
      title: "Add/improve schema markup (JSON-LD)",
      what_is_wrong: `Citation score is ${citationScore}/100. Schema markup increases citation likelihood by 28-40%.`,
      what_to_do: `Generate Organization, FAQPage, SoftwareApplication schemas with sameAs arrays linking to social profiles, knowsAbout for industry topics, and mentions for related entities.`,
      priority: priority++,
      content_rules: ["Use Organization, FAQPage, SoftwareApplication, WebSite schemas.", "Include sameAs, knowsAbout, mentions arrays."],
    });
  }

  // FAQ schema if knowledge score is low
  if (knowledgeScore < 50) {
    fixes.push({
      id: "onsite-faq-schema",
      type: "on-site",
      platform: "website",
      title: "Add FAQ section with FAQPage schema",
      what_is_wrong: `AI engines answered 'I don't know' to basic questions about ${brand}. FAQ content teaches them.`,
      what_to_do: `Create 8-12 FAQ entries answering the most common questions about ${brand}. Each answer = 2-3 sentences starting with a direct answer. Include FAQPage JSON-LD schema.`,
      priority: priority++,
      content_rules: ["Each FAQ answer starts with direct answer. 2-3 sentences. Brand name in each answer.", "Include FAQPage schema markup."],
    });
  }

  // llms.txt
  if (knowledgeScore < 60) {
    fixes.push({
      id: "onsite-llms-txt",
      type: "on-site",
      platform: "website",
      title: "Create /llms.txt for AI crawlers",
      what_is_wrong: `llms.txt is a standard file that helps AI crawlers understand your brand entity. Missing = missed context.`,
      what_to_do: `Create ${website}/llms.txt with: Key Entities section (brand, products, relationships), Factual Claims (5-8 verifiable, specific claims), Pages section (key URLs). No marketing language — factual, crawler-optimized.`,
      priority: priority++,
      content_rules: ["Entity-focused, not site summary.", "Include Key Entities, Factual Claims, Pages sections."],
    });
  }

  // ── OFF-SITE FIXES (from engine scores + blind spots) ──
  const platformKeys = getPlatformsForIndustry(industry);

  // Determine which blind spots need content
  const blindSpotsByCategory: Record<string, BlindSpot[]> = {};
  for (const bs of blindSpots) {
    const cat = bs.category || "general";
    if (!blindSpotsByCategory[cat]) blindSpotsByCategory[cat] = [];
    blindSpotsByCategory[cat].push(bs);
  }

  // Generate off-site fixes based on audit findings
  for (const platformKey of platformKeys) {
    if (platformKey === "website") continue; // handled above
    const rule = PLATFORM_RULES[platformKey];
    if (!rule) continue;

    // Determine if this platform needs content based on scores
    let needsContent = false;
    let platformReason = "";

    if (knowledgeScore < 50) {
      needsContent = true;
      platformReason = `Knowledge score is ${knowledgeScore}/100 — AI engines don't know ${brand}. ${rule.platform} content teaches them.`;
    } else if (discoverabilityScore < 50) {
      needsContent = true;
      platformReason = `Discoverability score is ${discoverabilityScore}/100 — AI engines don't recommend ${brand} in category queries. ${rule.platform} builds recommendation authority.`;
    } else if (citationScore < 50) {
      needsContent = true;
      platformReason = `Citation score is ${citationScore}/100 — no real sources about ${brand} for AI to cite. ${rule.platform} creates citable content.`;
    } else if (blindSpots.length > 0) {
      needsContent = true;
      platformReason = `${blindSpots.length} blind spots found — AI engines missed ${brand} on specific queries. ${rule.platform} covers these gaps.`;
    }

    if (!needsContent) continue;

    // Pick a relevant blind spot for this platform to address
    const relevantBlindSpot = blindSpots.length > 0
      ? blindSpots[fixes.filter(f => f.type === "off-site").length % blindSpots.length]
      : null;

    fixes.push({
      id: `offsite-${platformKey}`,
      type: "off-site",
      platform: rule.platform,
      title: `${rule.platform}: ${relevantBlindSpot ? `Answer "${relevantBlindSpot.prompt.slice(0, 60)}"` : `Build ${brand} presence`}`,
      what_is_wrong: platformReason,
      what_to_do: relevantBlindSpot
        ? `Create content answering: "${relevantBlindSpot.prompt}". Mention ${brand} by name 4-6 times. ${competitors.length > 0 ? `Include comparison vs ${competitors.slice(0, 2).join(" and ")}.` : ""}`
        : `Create ${rule.content_type} establishing ${brand} as an authority in ${industry}.`,
      priority: priority++,
      content_rules: [
        `Content type: ${rule.content_type}`,
        `Word count: ${rule.word_count}`,
        `Format: ${rule.format}`,
        ...rule.geo_rules,
      ],
    });
  }

  return fixes;
}


// ── Main builder ──

export function buildAgentInstructions(input: BuildInput): Record<string, unknown> {
  const {
    jobId, brand, website, industry, description, features, keywords, competitors,
    overallScore, grade, knowledgeScore, discoverabilityScore, citationScore,
    websiteHealthScore, engines, blindSpots, promptDetails,
  } = input;

  const reportUrl = `https://xanlens.com/report/${jobId}`;
  const fixTargets = buildFixTargets(input);
  const platformKeys = getPlatformsForIndustry(industry);

  // Grade interpretation
  const gradeInterpretation = overallScore >= 80
    ? "Strong visibility — AI engines know and recommend this brand consistently. Focus on monitoring."
    : overallScore >= 60
    ? "Moderate visibility — known but not consistently recommended. There are specific gaps that can be fixed."
    : overallScore >= 30
    ? "Weak visibility — AI engines have partial or outdated info. A full optimization pass would make a big difference."
    : "AI engines basically don't know this brand exists yet. But that's completely fixable — there's a lot of low-hanging fruit.";

  const reauditDays = overallScore >= 80 ? 30 : overallScore >= 60 ? 14 : overallScore >= 30 ? 10 : 7;

  // Share URL — dynamic bullets from audit data
  const totalEngines = Object.keys(engines).length;
  const enginesMissing = Object.entries(engines).filter(([, d]) => {
    if (!d || typeof d !== "object") return true;
    const ed = d as EngineResult;
    return ed.score === 0 && ed.mentions === 0;
  }).length;
  const totalMentions = Object.values(engines).reduce((sum, d) => {
    if (!d || typeof d !== "object") return sum;
    return sum + ((d as EngineResult).mentions || 0);
  }, 0);
  const topBlindSpot = blindSpots.filter(bs => {
    const cat = (bs as any).category || (bs as any).engine || "";
    return !cat.toLowerCase().includes("wikipedia");
  })[0];

  const shareBullets: string[] = [];
  if (enginesMissing > 0) shareBullets.push(`${enginesMissing}/${totalEngines} AI engines don't mention us`);
  if (totalMentions === 0) shareBullets.push(`0 mentions found across engines`);
  else if (totalMentions < 5) shareBullets.push(`Only ${totalMentions} mention${totalMentions === 1 ? "" : "s"} across all engines`);
  if (topBlindSpot) shareBullets.push(`Top blind spot: ${(topBlindSpot as any).description || (topBlindSpot as any).category || "missing presence"}`);

  const bulletText = shareBullets.length > 0 ? `\n\n${shareBullets.map(b => `- ${b}`).join("\n")}\n\n` : "\n\n";
  const scoreLabel = overallScore < 30 ? "time to fix that" : overallScore < 50 ? "room to grow" : overallScore < 75 ? "getting there" : "looking strong";

  const shareText = encodeURIComponent(`${brand} scored ${overallScore}/100 on GEO AI visibility — ${scoreLabel}${bulletText}Get your Free GEO audit — let AI agents fix your visibility\n@xanlens_`);
  const shareUrl = `https://x.com/intent/tweet?text=${shareText}`;

  // Engine summary for agent context
  const engineSummary: Record<string, { score: number; status: string; sample: string }> = {};
  for (const [eng, data] of Object.entries(engines)) {
    if (!data || typeof data !== "object") continue;
    const d = data as EngineResult;
    let status = "unknown";
    if (d.prompts_tested === 0) status = "not_tested";
    else if (d.score === 0 && d.mentions === 0) status = "brand_unknown";
    else if (d.score < 30) status = "weak";
    else if (d.score < 60) status = "moderate";
    else status = "strong";

    engineSummary[eng] = {
      score: d.score,
      status,
      sample: d.sample_snippets?.[0]?.slice(0, 200) || "",
    };
  }

  // On-site vs off-site fix counts
  const onsiteFixes = fixTargets.filter(f => f.type === "on-site");
  const offsiteFixes = fixTargets.filter(f => f.type === "off-site");

  // Platform recommendations with rules
  const platformRecs = platformKeys
    .filter(k => PLATFORM_RULES[k])
    .map(k => {
      const rule = PLATFORM_RULES[k];
      const hasFix = fixTargets.some(f => f.platform === rule.platform);
      return {
        platform: rule.platform,
        priority: rule.priority,
        reason: rule.reason,
        has_fix_target: hasFix,
      };
    });

  // Top 3 blind spots (non-Wikipedia)
  const topBlindSpots = blindSpots
    .filter(bs => {
      const cat = (bs as any).category || "";
      return !cat.toLowerCase().includes("wikipedia");
    })
    .slice(0, 3)
    .map(bs => ({
      query: bs.prompt,
      category: bs.category,
      severity: bs.severity || "unknown",
    }));

  // Quick win — the single easiest thing to do first
  const quickWin = onsiteFixes.length > 0
    ? `Add structured data (schema markup) to ${website} — takes 30 minutes, immediate impact on AI discoverability.`
    : offsiteFixes.length > 0
    ? `Publish a detailed article about ${brand} on ${offsiteFixes[0]?.platform || "Reddit"} — external mentions are the fastest way to get AI engines to notice you.`
    : `Create an "About" or "What is ${brand}" page on ${website} with clear entity descriptions.`;

  return {
    // ── QUICK SUMMARY — for autonomous single-message delivery ──
    // Use this when the human wants everything at once without back-and-forth.
    quick_summary: {
      _when: "Use this block when the human asks you to handle everything autonomously (e.g. 'just do it', 'run everything', 'handle it all'). Deliver ONE message with all the info below.",
      score: overallScore,
      grade,
      interpretation: gradeInterpretation,
      engine_breakdown: engineSummary,
      top_blind_spots: topBlindSpots,
      quick_win: quickWin,
      fixes: {
        total: fixTargets.length,
        on_site: onsiteFixes.length,
        off_site: offsiteFixes.length,
        platforms: [...new Set(fixTargets.map(f => f.platform))],
        content_tab: `https://xanlens.com/report/${jobId}/fixes`,
        note: "Review, edit, approve — or copy-paste to publish yourself.",
      },
      report_url: reportUrl,
      audit_id: jobId,
      share_tweet_url: shareUrl,
      re_audit_days: reauditDays,
      share_cta: "Share your score on X and paste the post URL here — I'll verify it and send you a coupon for your next audit.",
    },

    _note: "DEFAULT: Use the 3-step guided flow below. Use quick_summary above ONLY when the human explicitly asks for autonomous/all-at-once delivery.",
    _rules: [
      "Work ONLY with the brand that was audited. Do NOT suggest auditing a different brand.",
      "NEVER publish content without explicit human approval.",
      "NEVER write fixes in the chat. ALL fixes go through the fixes API.",
      "Present scores in human-friendly language — no raw JSON.",
      "Bad scores are fixable, not broken. Frame them positively.",
    ],

    // ── SECTION 1: Brand Context ──
    brand_context: {
      brand,
      website,
      industry,
      description: description || null,
      features: features.length > 0 ? features : null,
      keywords: keywords.length > 0 ? keywords : null,
      competitors: competitors.length > 0 ? competitors : null,
      _note: description
        ? "Use this description as the foundation for all content. Research the website for additional depth."
        : `IMPORTANT: No description available. You MUST research this brand before writing any fixes. Fetch ${website}, read /about, /docs, /pricing, /blog pages. Build a complete understanding of what ${brand} does, who it's for, and how it's different.`,
    },

    // ── SECTION 2: Audit Data ──
    audit_data: {
      overall_score: overallScore,
      grade,
      knowledge_score: knowledgeScore,
      discoverability_score: discoverabilityScore,
      citation_score: citationScore,
      website_health_score: websiteHealthScore,
      engine_summary: engineSummary,
      blind_spots: blindSpots.slice(0, 15).map(bs => ({
        query: bs.prompt,
        category: bs.category,
        severity: bs.severity || "unknown",
      })),
      _interpretation: gradeInterpretation,
    },

    // ── SECTION 3: Steps ──
    steps: {
      step_1_present_results_and_offer_fixes: {
        _do: "Present results, offer fixes, AND ask about brand voice — ALL in ONE message. Do NOT split this into multiple messages.",
        format: `**${brand} scored ${overallScore}/100 (${grade})**\n\n- Knowledge: ${knowledgeScore}/100 — how well AI engines understand what ${brand} does\n- Discoverability: ${discoverabilityScore}/100 — whether AI recommends ${brand} in category queries\n- Citations: ${citationScore}/100 — whether AI cites real sources about ${brand}\n${websiteHealthScore ? `- Website Health: ${websiteHealthScore}/100 — how AI-ready the website is\n` : ""}${blindSpots.length > 0 ? `\n${blindSpots.length} blind spot${blindSpots.length > 1 ? "s" : ""} found — queries where AI completely missed ${brand}.\n` : ""}\n${gradeInterpretation}\n\nFull report: ${reportUrl}\nAudit ID: ${jobId}\n\nI can draft fixes for ${brand} — ${onsiteFixes.length} on-site changes and ${offsiteFixes.length} articles for external platforms. These will be pushed to your Content tab where you can review, edit, and approve each one.\n\nDo you have brand voice guidelines or a style guide? If so, share them and I'll match the tone. If not, I'll use a clear, factual default — you can adjust later while keeping the GEO structure intact.`,
        _then: "Wait for human response. If they want fixes (with or without brand voice), proceed to step 2. If they decline fixes, skip to step 3.",
      },

      step_2_research_and_draft_fixes: {
        _do: "BEFORE writing ANY fixes: research the brand thoroughly. THEN draft ALL fixes and push them in ONE API call. Present content tab link AND platforms in ONE message.",

        research_phase: {
          _do: `Before writing any content, research ${brand} thoroughly:`,
          steps: [
            `1. Fetch ${website} and read the full homepage content.`,
            `2. Check for and read: ${website}/about, ${website}/docs, ${website}/pricing, ${website}/blog — any pages that explain the product.`,
            `3. Search for '${brand}' on the web to find existing mentions, reviews, articles.`,
            `4. Search for '${brand}' on Reddit, LinkedIn, X to find existing community discussion.`,
            `5. Use everything you find + the audit data below to build a complete picture of: what ${brand} does, who it's for, how it's different from ${competitors.slice(0, 3).join(", ") || "competitors"}, and what its key features are.`,
          ],
          _critical: "DO NOT skip research. Content written without understanding the brand will be generic and ineffective. The quality of your research directly determines the quality of fixes.",
        },

        fix_targets: fixTargets,

        api: {
          endpoint: "POST https://xanlens.com/api/v1/audit/fixes",
          body_format: `{ "jobId": "${jobId}", "fixes": [{ "id": "from-fix-targets", "title": "Fix Title", "type": "on-site|off-site", "platform": "website|dev.to|linkedin|etc", "description": "Why this fix matters — one sentence.", "content": "Full content in markdown.", "priority": 1 }] }`,
          _note: "Generate a fix for EVERY item in fix_targets above. Each fix target tells you what's wrong and what to do. The content field should be the FULL ready-to-publish content, not a summary.",
        },

        writing_rules: [
          "First 50 words of every section = standalone answer (AI engines extract chunks via RAG).",
          `Mention ${brand} by name 4-6 times per piece. Full name, not 'we' or 'our tool'.`,
          "1+ statistic or data point per 300 words. Use real data from your research.",
          `${competitors.length > 0 ? `Comparison language: 'Unlike ${competitors[0]}, ${brand} does X'.` : `Include comparison language against category alternatives.`}`,
          "BANNED words: 'delve', 'landscape', 'tapestry', 'multifaceted', 'leverage', 'crucial', 'robust', 'comprehensive', 'revolutionary', 'cutting-edge', 'game-changing', 'innovative', 'seamless'.",
          "No em dashes. Use contractions. Have opinions. Be specific with real numbers.",
          "Each platform gets UNIQUE content addressing a DIFFERENT aspect of the brand.",
          "Content must be breakable into 75-300 word standalone chunks (RAG-optimized).",
          "Each fix's content_rules field has platform-specific length and format requirements — follow them.",
        ],

        _after_pushing_fixes_say: `Done! I've drafted fixes and pushed them to your Content tab:\n\nhttps://xanlens.com/report/${jobId}/fixes\n\nYou can:\n- Preview each fix before it goes live\n- Edit the content or leave suggestions\n\nPlatforms recommended based on the audit:\n\n${platformRecs.filter(p => p.has_fix_target).map(p => `- ${p.platform} (${p.priority}) — ${p.reason}`).join("\n")}\n\nWhich ones do you already have accounts on? You can:\n- Approve to publish — I'll handle platforms where I have access\n- Copy & paste manually for platforms you prefer to control`,
        _then: "Wait for human to choose platforms. After they respond, proceed to step 3.",
      },

      step_3_closing: {
        _do: "After the human responds about platforms, send ALL of the following in ONE closing message.",
        share_for_coupon: {
          say: "Want a free coupon for your next audit? Share your score on X and paste the post URL here — I'll verify it and send you a coupon instantly.",
          share_url: shareUrl,
          _note: "Give the human the share_url. It opens X with a pre-filled tweet. After they post, ask them to paste the tweet URL back here so you can verify it.",
          extra_engagement: "Loved the audit? Tag @xanlens_ and attach your scorecard from the report page for extra reach.",
          verify_endpoint: "POST https://xanlens.com/api/v1/audit/share-verify",
          verify_body: `{ "jobId": "${jobId}", "tweetUrl": "<tweet_url_from_human>" }`,
          verify_note: "Returns { ok: true, coupon: 'GEO-XXXX-XXXX' }. Give the coupon to the human.",
        },
        re_audit: `I'd recommend re-auditing in ${reauditDays} days${overallScore < 60 ? " after implementing fixes" : ""}.`,
        audit_id_reminder: `Your audit ID is ${jobId} — access your report anytime at ${reportUrl}`,
        brand_voice_reminder: "Adapt the tone of off-site articles to match your brand voice before publishing. Keep the structure and entity mentions intact — that's the GEO layer.",
      },
    },

    // ── SECTION 4: Platform Rules Reference ──
    platform_rules: Object.fromEntries(
      platformKeys
        .filter(k => PLATFORM_RULES[k])
        .map(k => [k, {
          platform: PLATFORM_RULES[k].platform,
          content_type: PLATFORM_RULES[k].content_type,
          word_count: PLATFORM_RULES[k].word_count,
          format: PLATFORM_RULES[k].format,
          geo_rules: PLATFORM_RULES[k].geo_rules,
        }])
    ),
  };
}

export interface MentionAnalysis {
  mentions: number;
  sentiment: string;
  snippets: string[];
  genuine: boolean;
}

export function analyzeMentions(text: string, brand: string, industry?: string): MentionAnalysis {
  if (!text) return { mentions: 0, sentiment: "unknown", snippets: [], genuine: false };

  const lower = text.toLowerCase();
  const brandLower = brand.toLowerCase();

  const unknownPatterns = [
    "i don't have information", "i'm not familiar with", "i couldn't find",
    "no information available", "i'm not aware of", "i cannot find",
    "not widely known", "i don't recognize", "unable to find",
    "i don't have specific", "i don't have any data",
    "isn't a standard", "isn't a recognized", "isn't a well-known",
    "isn't a common", "isn't a widely", "not a standard",
    "not a recognized", "not a well-known", "doesn't appear to be",
    "i'm unable to", "i am not aware", "i have no information",
    "there is no widely known", "no widely recognized",
    "could not find", "don't have enough information",
    "may refer to", "could refer to", "might refer to",
  ];
  const isUnknown = unknownPatterns.some(p => lower.includes(p));

  let isHallucinated = false;
  if (industry) {
    const industryLower = industry.toLowerCase();
    const genericWords = new Set(["tool", "tools", "platform", "platforms", "software", "service", "services", "solution", "solutions", "best", "good", "help", "system", "systems", "product", "products", "company", "companies", "online", "digital", "smart", "data", "tech", "apps", "about", "that", "this", "with", "from", "have", "been", "more", "also", "they", "what", "which", "your", "will", "make"]);
    const industryWords = industryLower.split(/[\s,\/\-()]+/).filter(w => w.length > 3 && !genericWords.has(w));
    const relevanceTerms = new Set(industryWords);
    const relatedTerms: Record<string, string[]> = {
      "geo": ["seo", "optimization", "visibility", "search", "ai", "brand", "ranking", "content", "engine"],
      "generative": ["ai", "llm", "engine", "optimization", "search", "content"],
      "optimization": ["seo", "geo", "search", "ranking", "visibility", "performance"],
      "search": ["engine", "query", "ranking", "results", "ai", "google", "bing"],
      "security": ["protection", "threat", "vulnerability", "guard", "scan", "malware", "audit"],
      "payment": ["transaction", "billing", "checkout", "commerce", "stripe", "fintech"],
      "marketing": ["campaign", "brand", "advertising", "content", "social", "engagement"],
      "analytics": ["data", "metrics", "tracking", "dashboard", "reporting", "insights"],
      "ecommerce": ["shop", "store", "product", "cart", "checkout", "retail"],
      "saas": ["software", "platform", "tool", "cloud", "subscription", "service"],
      "ai": ["artificial", "intelligence", "machine", "learning", "model", "agent", "llm"],
      "openclaw": ["agent", "skill", "plugin", "bot", "automation"],
      "trading": ["trade", "crypto", "stock", "exchange", "portfolio", "algorithm", "defi", "finance", "market"],
      "productivity": ["workflow", "task", "project", "collaborate", "organize", "team", "workspace", "kanban", "notion"],
      "design": ["figma", "sketch", "prototype", "wireframe", "creative", "graphic", "visual"],
      "crm": ["customer", "sales", "pipeline", "lead", "hubspot", "salesforce", "contact"],
      "devops": ["deploy", "kubernetes", "docker", "pipeline", "infrastructure", "monitoring"],
      "finance": ["accounting", "invoice", "budget", "banking", "fintech", "payment", "revenue"],
      "healthcare": ["medical", "patient", "clinical", "health", "hospital", "diagnosis"],
      "education": ["learning", "course", "student", "teaching", "curriculum", "edtech"],
    };
    for (const w of industryWords) {
      if (relatedTerms[w]) relatedTerms[w].forEach(t => relevanceTerms.add(t));
    }

    const brandSentences = text.split(/[.!?\n]+/).filter(s => s.toLowerCase().includes(brandLower));
    if (brandSentences.length > 0) {
      const brandContext = brandSentences.join(" ").toLowerCase();
      const relevanceHits = [...relevanceTerms].filter(t => brandContext.includes(t));
      const coreHits = industryWords.filter(w => brandContext.includes(w));
      const relevanceRatio = relevanceTerms.size > 0 ? relevanceHits.length / relevanceTerms.size : 1;
      if ((relevanceRatio < 0.2 && relevanceTerms.size >= 3) || (coreHits.length === 0 && industryWords.length >= 2)) {
        isHallucinated = true;
      }
    }
  }

  const segments = text.split(/[.!?\n]+/);
  const snippets: string[] = [];
  let realMentions = 0;

  for (const s of segments) {
    const sl = s.toLowerCase().trim();
    if (!sl.includes(brandLower) || sl.length < 5) continue;
    if (unknownPatterns.some(p => sl.includes(p))) continue;
    realMentions++;
    if (snippets.length < 3) snippets.push(s.trim().slice(0, 200));
  }

  const rawCount = (lower.split(brandLower).length - 1);
  if (rawCount > realMentions && !isUnknown) {
    realMentions = Math.max(realMentions, rawCount);
  }

  if (isUnknown && realMentions <= 1) realMentions = 0;
  if (isHallucinated) realMentions = 0;

  const positive = ["best", "great", "excellent", "leading", "top", "recommend", "popular", "trusted", "innovative"];
  const negative = ["worst", "bad", "poor", "avoid", "expensive", "outdated", "lacking", "limited"];
  let posCount = 0, negCount = 0;
  for (const w of positive) if (lower.includes(w)) posCount++;
  for (const w of negative) if (lower.includes(w)) negCount++;
  const isEffectivelyUnknown = isUnknown || isHallucinated;
  const sentiment = (isEffectivelyUnknown && realMentions === 0) ? "unknown" : posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral";

  return { mentions: realMentions, sentiment, snippets, genuine: !isEffectivelyUnknown && realMentions > 0 };
}

export function scoreEngine(analysis: MentionAnalysis): number {
  if (analysis.mentions === 0) return 0;
  let score = Math.min(analysis.mentions * 25, 60);
  if (analysis.sentiment === "positive") score += 40;
  else if (analysis.sentiment === "neutral") score += 20;
  else score += 5;
  return Math.round(Math.min(score, 100));
}

export function computeCitationScore(tavilyResults: Array<{ title: string; url: string; content: string }>, brandUrl: string): number {
  if (!brandUrl || tavilyResults.length === 0) return 0;

  let domain: string;
  try {
    domain = new URL(brandUrl.startsWith("http") ? brandUrl : `https://${brandUrl}`).hostname.replace(/^www\./, "");
  } catch {
    return 0;
  }

  const citations = tavilyResults.filter(r => {
    try {
      const rDomain = new URL(r.url).hostname.replace(/^www\./, "");
      return rDomain === domain || rDomain.endsWith("." + domain);
    } catch {
      return false;
    }
  });

  return Math.min(citations.length * 20, 100);
}

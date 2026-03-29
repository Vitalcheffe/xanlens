/**
 * Google Autocomplete + People Also Ask — Free search volume proxy
 * No API key needed. Uses Google's public suggest API.
 */

export interface AutocompleteResult {
  query: string;
  suggestions: string[];
}

export interface PeopleAlsoAsk {
  question: string;
  source?: string;
}

export interface SearchInsights {
  brand_queries: AutocompleteResult[];
  industry_queries: AutocompleteResult[];
  people_also_ask: PeopleAlsoAsk[];
  related_searches: string[];
  total_suggestions: number;
  demand_signal: "high" | "medium" | "low" | "none";
  demand_message: string;
}

/**
 * Get Google Autocomplete suggestions for a query
 * This is the same API Google uses for search bar suggestions
 */
async function getAutocompleteSuggestions(query: string): Promise<string[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&q=${encoded}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    // Response format: [query, [suggestion1, suggestion2, ...]]
    return Array.isArray(data[1]) ? data[1].filter((s: string) => s !== query) : [];
  } catch {
    return [];
  }
}

/**
 * Get search insights for a brand + industry
 */
export async function getSearchInsights(brand: string, industry: string): Promise<SearchInsights> {
  // Brand-specific queries
  const brandQueries = [
    brand,
    `${brand} review`,
    `${brand} vs`,
    `${brand} alternative`,
    `is ${brand} good`,
    `${brand} pricing`,
  ];

  // Simplify industry for autocomplete (Google needs short phrases)
  // "AI-native crypto trading signals API" → "crypto trading signals"
  const shortIndustry = industry
    .replace(/\b(AI-native|for AI agents|for developers|platform|tool|software|API|service)\b/gi, "")
    .replace(/\s+/g, " ").trim()
    || industry.split(" ").slice(0, 3).join(" ");

  // Industry queries (where brand should appear)
  const industryQueries = [
    `best ${shortIndustry}`,
    `best ${shortIndustry} tools`,
    `${shortIndustry} for small business`,
    `how to use ${shortIndustry}`,
    `${shortIndustry} comparison`,
  ];

  // Fire all autocomplete requests in parallel (rate-friendly batches)
  const allQueries = [...brandQueries, ...industryQueries];
  const results: AutocompleteResult[] = [];

  // Batch 3 at a time with small delays
  for (let i = 0; i < allQueries.length; i += 3) {
    const batch = allQueries.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (q) => {
        const suggestions = await getAutocompleteSuggestions(q);
        return { query: q, suggestions };
      })
    );
    results.push(...batchResults);
    if (i + 3 < allQueries.length) {
      await new Promise(r => setTimeout(r, 200)); // Small delay between batches
    }
  }

  const brandResults = results.slice(0, brandQueries.length);
  const industryResults = results.slice(brandQueries.length);

  // Extract "People Also Ask" style questions from suggestions
  const paa: PeopleAlsoAsk[] = [];
  const allSuggestions = results.flatMap(r => r.suggestions);

  const brandLower = brand.toLowerCase();
  const brandNoSpace = brandLower.replace(/\s+/g, "");
  for (const s of allSuggestions) {
    const lower = s.toLowerCase();
    // Only include suggestions that actually contain the brand name
    if (!lower.includes(brandLower) && !lower.includes(brandNoSpace)) continue;
    if (
      lower.startsWith("how") ||
      lower.startsWith("what") ||
      lower.startsWith("why") ||
      lower.startsWith("is ") ||
      lower.startsWith("can ") ||
      lower.startsWith("does ") ||
      lower.startsWith("should") ||
      lower.includes("?")
    ) {
      if (!paa.find(p => p.question === s)) {
        paa.push({ question: s });
      }
    }
  }

  // Related searches (unique suggestions not in the original queries)
  const related = [...new Set(allSuggestions)]
    .filter(s => !allQueries.some(q => q.toLowerCase() === s.toLowerCase()))
    .slice(0, 20);

  const totalSuggestions = allSuggestions.length;

  // Demand signal based on suggestion count
  // More suggestions = more search activity around this brand/topic
  const brandSuggestionCount = brandResults.reduce((sum, r) => sum + r.suggestions.length, 0);

  let demandSignal: "high" | "medium" | "low" | "none";
  let demandMessage: string;

  if (brandSuggestionCount >= 20) {
    demandSignal = "high";
    demandMessage = `Strong search demand detected. Google shows ${brandSuggestionCount} autocomplete suggestions for your brand — people are actively searching for you. AI engines should be recommending you in these queries.`;
  } else if (brandSuggestionCount >= 10) {
    demandSignal = "medium";
    demandMessage = `Moderate search demand. ${brandSuggestionCount} autocomplete suggestions found. There's existing interest — make sure AI engines capture this demand.`;
  } else if (brandSuggestionCount > 0) {
    demandSignal = "low";
    demandMessage = `Low search demand (${brandSuggestionCount} suggestions). Building content around these queries will help both Google and AI engine visibility.`;
  } else {
    demandSignal = "none";
    demandMessage = "No autocomplete suggestions found for your brand. This means very low search awareness — focus on building brand recognition through content and PR.";
  }

  return {
    brand_queries: brandResults,
    industry_queries: industryResults,
    people_also_ask: paa.slice(0, 15),
    related_searches: related,
    total_suggestions: totalSuggestions,
    demand_signal: demandSignal,
    demand_message: demandMessage,
  };
}

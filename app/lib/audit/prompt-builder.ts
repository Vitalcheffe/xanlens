export type PromptCategory = "brand" | "category" | "competitor" | "buying_intent" | "conversational" | "discovery";

export interface CategorizedPrompt {
  prompt: string;
  category: PromptCategory;
}

export const categoryLabels: Record<PromptCategory, { label: string; description: string }> = {
  brand: { label: "Brand", description: "Does the AI know who you are?" },
  category: { label: "Category", description: "Do you appear in 'best of' lists?" },
  competitor: { label: "Competitor", description: "How do you stack up against competitors?" },
  buying_intent: { label: "Buying Intent", description: "Do you show up when users are ready to buy?" },
  conversational: { label: "Conversational", description: "Do casual queries find you?" },
  discovery: { label: "Discovery", description: "Can new users find you organically?" },
};

function expandIndustry(industry: string): string {
  const lower = industry.toLowerCase().trim();
  const expansions: Record<string, string> = {
    "geo": "Generative Engine Optimization",
    "geo optimization": "Generative Engine Optimization",
    "seo": "Search Engine Optimization",
    "ai visibility": "AI brand visibility",
    "ai monitoring": "AI brand monitoring",
  };
  return expansions[lower] || industry;
}

export function buildCategorizedPrompts(brand: string, industry: string, competitors: string[]): CategorizedPrompt[] {
  const ctx = expandIndustry(industry);
  const prompts: CategorizedPrompt[] = [];

  // BRAND (~5%)
  prompts.push(
    { prompt: `What is ${brand}?`, category: "brand" },
    { prompt: `${brand} review`, category: "brand" },
  );

  // CATEGORY (~65%)
  prompts.push(
    { prompt: `Best ${ctx} tools`, category: "category" },
    { prompt: `Top ${ctx} platforms 2025`, category: "category" },
    { prompt: `What are the best ${ctx} solutions?`, category: "category" },
    { prompt: `${ctx} software comparison`, category: "category" },
    { prompt: `Leading companies in ${ctx}`, category: "category" },
    { prompt: `Can you recommend a good ${ctx} tool?`, category: "category" },
    { prompt: `How to use ${ctx}`, category: "category" },
    { prompt: `What tools can help me with ${ctx}?`, category: "category" },
    { prompt: `Best ${ctx} for small business`, category: "buying_intent" },
    { prompt: `Which ${ctx} tool should I use?`, category: "buying_intent" },
    { prompt: `I need help with ${ctx}, what should I use?`, category: "conversational" },
    { prompt: `I'm looking for a ${ctx} solution`, category: "conversational" },
    { prompt: `${ctx} for beginners`, category: "discovery" },
    { prompt: `Getting started with ${ctx}`, category: "discovery" },
  );

  // COMPETITOR (~30%)
  if (competitors.length > 0) {
    prompts.push({ prompt: `${brand} vs ${competitors[0]}`, category: "competitor" });
    if (competitors.length >= 2) {
      prompts.push({ prompt: `${brand} vs ${competitors.slice(0, 3).join(" vs ")}`, category: "competitor" });
    }
    prompts.push({ prompt: `${brand} alternatives`, category: "competitor" });
    prompts.push({ prompt: `${competitors[0]} alternatives`, category: "competitor" });
  }

  return prompts;
}

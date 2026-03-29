import {
  ANTHROPIC_API_KEY, XAI_API_KEY, NVIDIA_API_KEY,
  queryGeminiBatch, queryDeepSeek, queryChatGPT,
  queryClaude, queryGrok, queryLlama, queryQwen,
  queryTavily, queryGeminiGrounded,
} from "./engine-clients";
import { analyzeMentions, scoreEngine, computeCitationScore, type MentionAnalysis } from "./scoring";
import { analyzeSite } from "./site-analysis";
import { generateOptimizationPlan } from "./plan-builder";
import { buildCategorizedPrompts, categoryLabels, type PromptCategory } from "./prompt-builder";
import { checkExternalPresence, analyzeCitations, analyzeCompetitors, detectContentGaps, type CompetitorAnalysis } from "./analysis";

export interface AuditRequest {
  brand: string;
  website?: string;
  industry: string;
  competitors?: string[];
  engines?: string[];
}

export async function runAudit(body: AuditRequest) {
  const { brand, website, industry, competitors = [] } = body;

  const categorizedPrompts = buildCategorizedPrompts(brand, industry, competitors);
  const allPrompts = categorizedPrompts.map(p => p.prompt);
  const webQuery = `"${brand}" ${industry}`;

  const samplePrompts = [allPrompts[0], allPrompts[5], allPrompts[Math.floor(allPrompts.length / 2)], allPrompts[allPrompts.length - 1]];

  // Gemini grounded for web presence (replaces Tavily as primary)
  const geminiGroundedPromise = queryGeminiGrounded(webQuery);

  const [siteAnalysis, groundedResult, externalPresence, geminiResponses, deepseekResponses, gptResponses, claudeResponses, grokResponses, llamaResponses, qwenResponses] = await Promise.all([
    website ? analyzeSite(website) : Promise.resolve(null),
    geminiGroundedPromise,
    checkExternalPresence(brand),
    queryGeminiBatch(allPrompts, 5),
    Promise.all(samplePrompts.map(p => queryDeepSeek(p).catch(() => ""))),
    Promise.all(samplePrompts.map(p => queryChatGPT(p).catch(() => ""))),
    ANTHROPIC_API_KEY ? Promise.all(samplePrompts.map(p => queryClaude(p).catch(() => ""))) : Promise.resolve([] as string[]),
    XAI_API_KEY ? Promise.all(samplePrompts.map(p => queryGrok(p).catch(() => ""))) : Promise.resolve([] as string[]),
    NVIDIA_API_KEY ? Promise.all(samplePrompts.map(p => queryLlama(p).catch(() => ""))) : Promise.resolve([] as string[]),
    NVIDIA_API_KEY ? Promise.all(samplePrompts.map(p => queryQwen(p).catch(() => ""))) : Promise.resolve([] as string[]),
  ]);

  // Fallback to Tavily if Gemini grounded returned no sources
  let webSources = groundedResult.sources;
  let webAnswerText = groundedResult.text;
  let tavilyFallbackUsed = false;
  if (webSources.length === 0) {
    const tavilyResult = await queryTavily(webQuery);
    webSources = tavilyResult.results;
    webAnswerText = tavilyResult.answer || "";
    tavilyFallbackUsed = true;
  }

  // Split responses by category
  const directResponses: string[] = [];
  const nonDirectResponses: string[] = [];
  categorizedPrompts.forEach((cp, i) => {
    if (cp.category === "brand") directResponses.push(geminiResponses[i]);
    else nonDirectResponses.push(geminiResponses[i]);
  });

  // --- Prompt Coverage with Categories ---
  interface CategorizedCoverageDetail {
    prompt: string;
    category: PromptCategory;
    mentioned: boolean;
    snippet: string | null;
  }
  const promptCoverageDetails: CategorizedCoverageDetail[] = categorizedPrompts.map((cp, i) => {
    const response = geminiResponses[i];
    const analysis = analyzeMentions(response, brand, industry);
    const mentioned = analysis.mentions > 0 && analysis.genuine;
    return {
      prompt: cp.prompt,
      category: cp.category,
      mentioned,
      snippet: mentioned && analysis.snippets.length > 0 ? analysis.snippets[0].slice(0, 200) : null,
    };
  });
  const mentionedCount = promptCoverageDetails.filter(d => d.mentioned).length;

  const categories: PromptCategory[] = ["brand", "category", "competitor", "buying_intent", "conversational", "discovery"];
  const categoryBreakdown = categories.map(cat => {
    const catDetails = promptCoverageDetails.filter(d => d.category === cat);
    if (catDetails.length === 0) return null;
    const catMentioned = catDetails.filter(d => d.mentioned).length;
    return {
      category: cat,
      ...categoryLabels[cat],
      tested: catDetails.length,
      mentioned: catMentioned,
      score: Math.round((catMentioned / catDetails.length) * 100),
    };
  }).filter(Boolean);

  const promptCoverage = {
    tested: allPrompts.length,
    mentioned_in: mentionedCount,
    coverage_pct: Math.round((mentionedCount / allPrompts.length) * 100),
    details: promptCoverageDetails,
    category_breakdown: categoryBreakdown,
  };

  // --- Analyze direct vs non-direct ---
  let directMentions = 0;
  let directGenuine = false;
  const directSnippets: string[] = [];
  let directSentiment: "positive" | "negative" | "neutral" | "unknown" = "unknown";
  for (const resp of directResponses) {
    const a = analyzeMentions(resp, brand, industry);
    if (a.genuine) {
      directMentions += a.mentions;
      directGenuine = true;
      directSnippets.push(...a.snippets);
      if (a.sentiment !== "unknown") directSentiment = a.sentiment as typeof directSentiment;
    }
  }
  const brandedAnalysis: MentionAnalysis = {
    mentions: directMentions,
    sentiment: directSentiment,
    snippets: directSnippets.slice(0, 3),
    genuine: directGenuine,
  };

  let nonDirectMentions = 0;
  let nonDirectGenuine = false;
  const nonDirectSnippets: string[] = [];
  let nonDirectSentiment: "positive" | "negative" | "neutral" | "unknown" = "unknown";
  for (const resp of nonDirectResponses) {
    const a = analyzeMentions(resp, brand, industry);
    if (a.genuine) {
      nonDirectMentions += a.mentions;
      nonDirectGenuine = true;
      nonDirectSnippets.push(...a.snippets);
      if (a.sentiment !== "unknown") nonDirectSentiment = a.sentiment as typeof nonDirectSentiment;
    }
  }
  const discoveryAnalysis: MentionAnalysis = {
    mentions: nonDirectMentions,
    sentiment: nonDirectSentiment,
    snippets: nonDirectSnippets.slice(0, 3),
    genuine: nonDirectGenuine,
  };

  const brandedResponses = directResponses;

  const geminiAnalysis = discoveryAnalysis.mentions > 0
    ? discoveryAnalysis
    : brandedAnalysis.genuine
      ? { ...brandedAnalysis, mentions: Math.max(1, brandedAnalysis.mentions - 1) }
      : { mentions: 0, sentiment: "unknown" as const, snippets: [] as string[], genuine: false };

  const baseGeminiScore = scoreEngine(geminiAnalysis);
  const coverageRatio = promptCoverage.coverage_pct / 100;
  const softGeminiCoverage = 0.3 + (0.7 * coverageRatio);
  const adjustedGeminiScore = geminiAnalysis.genuine ? Math.round(baseGeminiScore * softGeminiCoverage) : 0;

  const brandLower = brand.toLowerCase();
  const brandSlug = brandLower.replace(/\s+/g, "");

  // Web presence analysis (Gemini grounded or Tavily fallback)
  // Note: Gemini grounded URLs are redirect links (vertexaisearch.cloud.google.com)
  // so we match on title (which contains the domain) and the grounded answer text
  const webMentionsBrand = webSources.some(r =>
    r.title.toLowerCase().includes(brandLower) ||
    r.url.toLowerCase().includes(brandSlug) ||
    (r.content?.toLowerCase().includes(brandLower))
  ) || webAnswerText?.toLowerCase().includes(brandLower);
  // For grounded results, the answer text is the richest signal (contains brand mentions, context)
  const webAnalysisText = (webAnswerText || "") + " " + webSources.map(r => r.title + " " + r.content).join(" ");
  const webAnalysis = analyzeMentions(webAnalysisText, brand, industry);
  const webPresenceScore = scoreEngine(webAnalysis);

  // Discoverability score from Gemini grounded — uses the full grounded text + source analysis
  const groundedFullText = groundedResult.text + " " + groundedResult.sources.map(s => s.title + " " + s.content).join(" ");
  const groundedAnalysis = analyzeMentions(groundedFullText, brand, industry);
  const discoverability_score = groundedResult.text ? scoreEngine(groundedAnalysis) : 0;

  const analyzeSecondary = (responses: string[]) => {
    if (responses.length === 0) return null;
    let totalMentions = 0;
    let genuineCount = 0;
    const allSnippets: string[] = [];
    let bestSentiment: string = "unknown";
    for (const resp of responses) {
      if (!resp || resp === "__UNAVAILABLE__") continue;
      const a = analyzeMentions(resp, brand, industry);
      totalMentions += a.mentions;
      if (a.genuine) genuineCount++;
      allSnippets.push(...a.snippets);
      if (a.sentiment !== "unknown") bestSentiment = a.sentiment;
    }
    const validResponses = responses.filter(r => r && r.length > 0 && r !== "__UNAVAILABLE__").length;
    const cRatio = validResponses > 0 ? genuineCount / validResponses : 0;
    const analysis: MentionAnalysis = {
      mentions: totalMentions,
      sentiment: bestSentiment,
      snippets: allSnippets.slice(0, 3),
      genuine: genuineCount > 0,
    };
    const baseScore = scoreEngine(analysis);
    const softCoverage = 0.3 + (0.7 * cRatio);
    const adjustedScore = genuineCount === 0 ? 0 : Math.round(baseScore * softCoverage);
    return { score: adjustedScore, analysis };
  };

  const deepseekResult = analyzeSecondary(deepseekResponses);
  const gptResult = analyzeSecondary(gptResponses);
  const claudeResult = analyzeSecondary(claudeResponses);
  const grokResult = analyzeSecondary(grokResponses);
  const llamaResult = analyzeSecondary(llamaResponses);
  const qwenResult = analyzeSecondary(qwenResponses);

  const engineResults: Record<string, { score: number; analysis: MentionAnalysis; unavailable?: boolean }> = {
    gemini: { score: adjustedGeminiScore, analysis: geminiAnalysis },
    web: { score: webPresenceScore, analysis: webAnalysis },
  };

  if (deepseekResult) engineResults.deepseek = deepseekResult;
  if (gptResult) engineResults.gpt4o = gptResult;
  if (claudeResult) engineResults.claude = claudeResult;
  if (grokResult) engineResults.grok = grokResult;
  if (llamaResult) engineResults.llama = llamaResult;
  if (qwenResult) engineResults.qwen = qwenResult;

  // Knowledge score = average of ungrounded AI engine scores (excluding web & perplexity-unavailable)
  const aiEngineScores = [adjustedGeminiScore];
  if (deepseekResult) aiEngineScores.push(deepseekResult.score);
  if (gptResult) aiEngineScores.push(gptResult.score);
  if (claudeResult) aiEngineScores.push(claudeResult.score);
  if (grokResult) aiEngineScores.push(grokResult.score);
  if (llamaResult) aiEngineScores.push(llamaResult.score);
  if (qwenResult) aiEngineScores.push(qwenResult.score);

  const knowledge_score = Math.round(aiEngineScores.reduce((a, b) => a + b, 0) / aiEngineScores.length);

  // Citation score
  const citationScore = computeCitationScore(webSources.map(s => ({ title: s.title, url: s.url, content: s.content })), website || "");

  // GEO Score = weighted: 50% knowledge + 30% discoverability + 20% citation
  const overallScore = Math.round(knowledge_score * 0.5 + discoverability_score * 0.3 + citationScore * 0.2);

  const grade =
    overallScore >= 90 ? "A" :
    overallScore >= 75 ? "B" :
    overallScore >= 60 ? "C" :
    overallScore >= 40 ? "D" : "F";

  const citations = webSources
    .map(x => ({ title: x.title, url: x.url }))
    .filter((c, i, arr) => arr.findIndex(a => a.url === c.url) === i)
    .slice(0, 10);

  const citationIntelligence = analyzeCitations(webSources.map(s => ({ title: s.title, url: s.url, content: s.content })), website || "");

  const competitorAnalysis: CompetitorAnalysis | null = competitors.length > 0
    ? analyzeCompetitors(geminiResponses, brand, competitors, industry)
    : null;

  const [optimization, contentGaps] = await Promise.all([
    generateOptimizationPlan(brand, industry, overallScore, grade, siteAnalysis, engineResults, competitors),
    detectContentGaps(brand, industry, brandedResponses, siteAnalysis).catch(() => []),
  ]);

  const mentionScore = engineResults.gemini.score;

  return {
    brand,
    website: website || null,
    industry,
    overall_score: overallScore,
    knowledge_score,
    discoverability_score,
    mention_score: mentionScore,
    citation_score: citationScore,
    grade,
    engines: Object.fromEntries(
      Object.entries(engineResults).map(([name, r]) => [name, {
        score: r.score,
        mentions: r.analysis.mentions,
        sentiment: r.analysis.sentiment,
        sample_snippets: r.analysis.snippets,
        ...(r.unavailable ? { unavailable: true } : {}),
      }])
    ),
    prompt_coverage: promptCoverage,
    ...(competitorAnalysis ? { competitor_analysis: competitorAnalysis } : {}),
    citation_intelligence: citationIntelligence,
    content_gaps: contentGaps,
    web_presence_score: webPresenceScore,
    category_scores: categoryBreakdown,
    site_analysis: siteAnalysis,
    citations,
    external_presence: externalPresence,
    optimization,
    // Gemini grounded data for comparison in report
    grounded_data: groundedResult.text ? {
      text: groundedResult.text,
      sources: groundedResult.sources,
      brand_found: groundedAnalysis.genuine,
    } : null,
    timestamp: new Date().toISOString(),
  };
}

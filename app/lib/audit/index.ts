// Re-export everything so existing `import { ... } from "@/app/lib/audit"` still works
export { runAudit } from "./run-audit";
export type { AuditRequest } from "./run-audit";
export { queryGemini, queryGeminiBatch, queryChatGPT, queryDeepSeek, queryClaude, queryGrok, queryLlama, queryQwen, queryPerplexity, queryTavily } from "./engine-clients";
export { analyzeMentions, scoreEngine, computeCitationScore } from "./scoring";
export type { MentionAnalysis } from "./scoring";
export { analyzeSite } from "./site-analysis";
export type { SiteAnalysis, ContentScore, JsRendering } from "./site-analysis";
export { generateOptimizationPlan } from "./plan-builder";
export { buildCategorizedPrompts, categoryLabels } from "./prompt-builder";
export type { PromptCategory, CategorizedPrompt } from "./prompt-builder";
export { checkExternalPresence, analyzeCitations, analyzeCompetitors, detectContentGaps } from "./analysis";
export type { ExternalPresence, CitationIntelligence, CompetitorResult, CompetitorAnalysis, ContentGap } from "./analysis";

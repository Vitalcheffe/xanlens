/* ─── Shared Types ─── */

export interface EngineData {
  score: number;
  mentions: number;
  sentiment: string;
  sample_snippets?: string[];
  prompts_tested?: number;
  prompts_total?: number;
  unavailable?: boolean;
  model_name?: string;
  source_type?: string;
  reliability?: number;
}

export interface PromptDetail {
  prompt: string;
  mentioned: boolean;
  snippet?: string | null;
  full_response?: string | null;
  engine?: string;
  engine_model?: string;
  source_type?: string;
  category?: string;
  blind_spot?: boolean;
  search_volume?: number | null;
  cpc?: number | null;
  competition?: string | null;
  persona?: string;
  // debug fields removed — LLM judge handles wrong-entity detection
}

export interface CitationSource {
  domain: string;
  count: number;
  type?: string;
}

export interface Competitor {
  name: string;
  mentions: number;
  sentiment: string;
  visibility?: number;
}

export interface BlindSpotItem {
  prompt: string;
  engine?: string;
  type?: string;
  severity?: string;
}

export interface AuditResult {
  brand?: string;
  industry?: string;
  website?: string;
  overall_score?: number;
  knowledge_score?: number;
  discoverability_score?: number;
  score?: number;
  grade?: string;
  score_confidence?: string;
  engines?: Record<string, EngineData>;
  prompt_coverage?: {
    coverage_pct: number;
    mentioned_in: number;
    tested: number;
    details?: PromptDetail[];
  };
  blind_spots?: {
    count: number;
    message?: string;
    prompts: (string | BlindSpotItem)[];
    by_type?: Record<string, number>;
    critical_count?: number;
  };
  citations?: {
    total?: number;
    top_sources?: CitationSource[];
    all_urls?: string[];
    brand_cited?: boolean;
    citation_gap?: Array<{ domain: string; count: number; type: string }>;
  };
  competitor_analysis?: {
    share_of_voice?: number;
    your_mentions?: number;
    competitors?: Competitor[];
  };
  trend?: {
    status: string;
    message?: string;
    delta?: number | null;
    previous_score?: number | null;
    history?: Array<{ date: string; score: number; grade: string }>;
  };
  nudges?: Array<string | { type?: string; urgency?: string; reason?: string; date?: string }>;
  next_audit_recommended?: string;
  categoryScores?: Record<string, number>;
  search_volume?: {
    enabled: boolean;
    total_missed_volume?: number;
    message?: string;
  };
  estimated_monthly_revenue_impact?: string;
  grounded_data?: {
    queries: Array<{ prompt: string; text: string; mentioned: boolean; sources: Array<{ title: string; url: string; content: string }> }>;
    text: string;
    sources: Array<{ title: string; url: string; content: string }>;
    brand_found: boolean;
    mentioned: number;
    total: number;
  } | null;
  // Attached parallel data
  seo_score?: SEOScoreData;
  technical?: TechnicalData;
  aio?: AIOResult;
  content_optimizer?: ContentOptimizerData;
  persona_analysis?: PersonaAnalysis[];
}

/* ─── AIO (On-Page Analysis) ─── */

export interface AIOCategory {
  score: number;
  details: string[];
  recommendations: string[];
}

export interface AIOResult {
  url: string;
  overall_score: number;
  grade: string;
  categories: Record<string, AIOCategory>;
  schemas_found: string[];
  timestamp: string;
}

/* ─── Technical Audit ─── */

export interface CrawlerResult {
  name: string;
  owner: string;
  status: "allowed" | "blocked" | "unknown";
}

export interface TechnicalData {
  robots?: {
    exists: boolean;
    crawlers: CrawlerResult[];
    blocked_count: number;
    allowed_count: number;
    has_sitemap: boolean;
    verdict: string;
  };
  llms_txt?: {
    exists: boolean;
    size_bytes: number;
    has_description: boolean;
    has_links: boolean;
    link_count: number;
    verdict: string;
  };
  lighthouse?: {
    available: boolean;
    performance_score: number | null;
    accessibility_score: number | null;
    best_practices_score: number | null;
    seo_score: number | null;
    mobile_friendly: boolean;
    https: boolean;
    load_time_ms: number | null;
    verdict: string;
  };
  social_proof?: {
    sources: Array<{
      name: string;
      icon: string;
      data: { exists: boolean; url?: string };
      weight: number;
      category: "universal" | "industry";
    }>;
    trust_score: number;
    sources_found: number;
    total_sources: number;
    universal_score: number;
    industry_bonus: number;
    industry_sources_checked: string[];
    verdict: string;
  };
  search_insights?: {
    brand_queries: Array<{ query: string; suggestions: string[] }>;
    industry_queries: Array<{ query: string; suggestions: string[] }>;
    people_also_ask: Array<{ question: string }>;
    related_searches: string[];
    total_suggestions: number;
    demand_signal: "high" | "medium" | "low" | "none";
    demand_message: string;
  };
  overall_technical_score: number;
}

/* ─── Content Optimizer ─── */

export interface ContentOptimizerData {
  score: number;
  grade: string;
  recommendations: Array<{
    category: string;
    issue: string;
    fix: string;
    priority: "high" | "medium" | "low";
  }>;
  details: {
    headings_score: number;
    faq_score: number;
    schema_score: number;
    citation_worthiness: number;
    entity_density: number;
  };
}

/* ─── SEO Score ─── */

export interface SEOScoreData {
  available: boolean;
  seo_score: number;
  grade: string;
  brand_mentions: number;
  total_results: number;
  brand_in_top3: number;
  queries_tested: number;
  queries_with_brand: number;
  message: string;
}

/* ─── Persona Analysis ─── */

export interface PersonaAnalysis {
  persona: string;
  label: string;
  total: number;
  mentioned: number;
  coverage: number;
  prompts: PromptDetail[];
}

/* ─── Component Props ─── */

export interface AuditReportProps {
  result: AuditResult;
  tier: "free" | "pro";
  aio?: AIOResult;
  technical?: TechnicalData;
  contentOptimizer?: ContentOptimizerData;
  seoScore?: SEOScoreData;
  websiteHealth?: Record<string, unknown>;
  onReset?: () => void;
}

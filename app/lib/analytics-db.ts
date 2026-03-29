/**
 * XanLens Analytics Database (Turso/libSQL)
 * 
 * Permanent storage for all audit data — the foundation of the moat.
 * Every audit generates 132+ data points about how AI engines see brands.
 * Over time, this becomes the world's largest dataset of AI brand visibility.
 */

import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

function getClient(): Client | null {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    console.warn("[ANALYTICS] Turso not configured — skipping analytics storage");
    return null;
  }
  _client = createClient({ url, authToken });
  return _client;
}

// ── Schema Migration ──

export async function initSchema(): Promise<void> {
  const client = getClient();
  if (!client) return;

  await client.batch([
    // Core audit record
    `CREATE TABLE IF NOT EXISTS audits (
      job_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      brand TEXT NOT NULL,
      website TEXT NOT NULL,
      industry TEXT,
      description TEXT,
      tier TEXT DEFAULT 'free',
      overall_score INTEGER,
      grade TEXT,
      knowledge_score INTEGER,
      discoverability_score INTEGER,
      seo_score INTEGER,
      authority_score INTEGER,
      features TEXT,
      keywords TEXT,
      competitors TEXT
    )`,

    // Per-prompt results (132+ rows per audit)
    `CREATE TABLE IF NOT EXISTS audit_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      engine TEXT NOT NULL,
      prompt TEXT NOT NULL,
      category TEXT,
      mentioned INTEGER NOT NULL DEFAULT 0,
      judge_genuine INTEGER,
      judge_confidence REAL,
      snippet TEXT,
      full_response TEXT,
      FOREIGN KEY (job_id) REFERENCES audits(job_id)
    )`,

    // Authority source results (18+ rows per audit)
    `CREATE TABLE IF NOT EXISTS audit_authority (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      exists_found INTEGER NOT NULL DEFAULT 0,
      judge_verified INTEGER,
      url TEXT,
      FOREIGN KEY (job_id) REFERENCES audits(job_id)
    )`,

    // Technical/SEO checks
    `CREATE TABLE IF NOT EXISTS audit_technical (
      job_id TEXT PRIMARY KEY,
      lighthouse_perf INTEGER,
      lighthouse_seo INTEGER,
      lighthouse_a11y INTEGER,
      lighthouse_bp INTEGER,
      has_robots INTEGER,
      has_sitemap INTEGER,
      has_llms_txt INTEGER,
      ai_crawler_blocked TEXT,
      schema_types TEXT,
      meta_title_length INTEGER,
      meta_desc_length INTEGER,
      has_og_tags INTEGER,
      has_twitter_cards INTEGER,
      h1_count INTEGER,
      heading_hierarchy_valid INTEGER,
      has_canonical INTEGER,
      is_https INTEGER,
      has_hreflang INTEGER,
      images_total INTEGER,
      images_missing_alt INTEGER,
      word_count INTEGER,
      social_links_on_site TEXT,
      keyword_placement_score REAL,
      backlink_referring_domains INTEGER,
      backlink_categories TEXT,
      FOREIGN KEY (job_id) REFERENCES audits(job_id)
    )`,

    // Indexes for analytics queries
    `CREATE INDEX IF NOT EXISTS idx_audits_industry ON audits(industry)`,
    `CREATE INDEX IF NOT EXISTS idx_audits_score ON audits(overall_score)`,
    `CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audits_brand ON audits(brand)`,
    `CREATE INDEX IF NOT EXISTS idx_prompts_job ON audit_prompts(job_id)`,
    `CREATE INDEX IF NOT EXISTS idx_prompts_engine ON audit_prompts(engine)`,
    `CREATE INDEX IF NOT EXISTS idx_prompts_category ON audit_prompts(category)`,
    `CREATE INDEX IF NOT EXISTS idx_prompts_mentioned ON audit_prompts(mentioned)`,
    `CREATE INDEX IF NOT EXISTS idx_authority_job ON audit_authority(job_id)`,
    `CREATE INDEX IF NOT EXISTS idx_technical_job ON audit_technical(job_id)`,
  ], "write");

  console.log("[ANALYTICS] Schema initialized");
}

// ── Write Operations ──

export interface AuditRecord {
  jobId: string;
  brand: string;
  website: string;
  industry?: string;
  description?: string;
  tier?: string;
  overallScore?: number;
  grade?: string;
  knowledgeScore?: number;
  discoverabilityScore?: number;
  seoScore?: number;
  authorityScore?: number;
  features?: string[];
  keywords?: string[];
  competitors?: string[];
}

export async function storeAudit(record: AuditRecord): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.execute({
      sql: `INSERT OR REPLACE INTO audits 
            (job_id, created_at, brand, website, industry, description, tier, overall_score, grade,
             knowledge_score, discoverability_score, seo_score, authority_score,
             features, keywords, competitors)
            VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        record.jobId, record.brand, record.website,
        record.industry || null, record.description || null,
        record.tier || "free", record.overallScore ?? null, record.grade || null,
        record.knowledgeScore ?? null, record.discoverabilityScore ?? null,
        record.seoScore ?? null, record.authorityScore ?? null,
        record.features ? JSON.stringify(record.features) : null,
        record.keywords ? JSON.stringify(record.keywords) : null,
        record.competitors ? JSON.stringify(record.competitors) : null,
      ],
    });
  } catch (e) {
    console.error("[ANALYTICS] Failed to store audit:", e);
  }
}

export interface PromptRecord {
  jobId: string;
  engine: string;
  prompt: string;
  category?: string;
  mentioned: boolean;
  judgeGenuine?: boolean;
  judgeConfidence?: number;
  snippet?: string;
  fullResponse?: string;
}

export async function storePrompts(prompts: PromptRecord[]): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    // Batch insert in chunks of 50
    for (let i = 0; i < prompts.length; i += 50) {
      const batch = prompts.slice(i, i + 50);
      await client.batch(
        batch.map((p) => ({
          sql: `INSERT INTO audit_prompts 
                (job_id, engine, prompt, category, mentioned, judge_genuine, judge_confidence, snippet, full_response)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            p.jobId, p.engine, p.prompt, p.category || null,
            p.mentioned ? 1 : 0,
            p.judgeGenuine != null ? (p.judgeGenuine ? 1 : 0) : null,
            p.judgeConfidence ?? null,
            p.snippet || null,
            p.fullResponse ? p.fullResponse.slice(0, 8000) : null,
          ],
        })),
        "write"
      );
    }
  } catch (e) {
    console.error("[ANALYTICS] Failed to store prompts:", e);
  }
}

export interface AuthorityRecord {
  jobId: string;
  sourceName: string;
  exists: boolean;
  judgeVerified?: boolean;
  url?: string;
}

export async function storeAuthority(sources: AuthorityRecord[]): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.batch(
      sources.map((s) => ({
        sql: `INSERT INTO audit_authority (job_id, source_name, exists_found, judge_verified, url)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          s.jobId, s.sourceName, s.exists ? 1 : 0,
          s.judgeVerified != null ? (s.judgeVerified ? 1 : 0) : null,
          s.url || null,
        ],
      })),
      "write"
    );
  } catch (e) {
    console.error("[ANALYTICS] Failed to store authority:", e);
  }
}

export interface TechnicalRecord {
  jobId: string;
  lighthousePerf?: number;
  lighthouseSeo?: number;
  lighthouseA11y?: number;
  lighthouseBp?: number;
  hasRobots?: boolean;
  hasSitemap?: boolean;
  hasLlmsTxt?: boolean;
  aiCrawlerBlocked?: string[];
  schemaTypes?: string[];
  metaTitleLength?: number;
  metaDescLength?: number;
  hasOgTags?: boolean;
  hasTwitterCards?: boolean;
  h1Count?: number;
  headingHierarchyValid?: boolean;
  hasCanonical?: boolean;
  isHttps?: boolean;
  hasHreflang?: boolean;
  imagesTotal?: number;
  imagesMissingAlt?: number;
  wordCount?: number;
  socialLinksOnSite?: string[];
  keywordPlacementScore?: number;
  backlinkReferringDomains?: number;
  backlinkCategories?: Record<string, number>;
}

export async function storeTechnical(record: TechnicalRecord): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.execute({
      sql: `INSERT OR REPLACE INTO audit_technical 
            (job_id, lighthouse_perf, lighthouse_seo, lighthouse_a11y, lighthouse_bp,
             has_robots, has_sitemap, has_llms_txt, ai_crawler_blocked,
             schema_types, meta_title_length, meta_desc_length,
             has_og_tags, has_twitter_cards, h1_count, heading_hierarchy_valid,
             has_canonical, is_https, has_hreflang,
             images_total, images_missing_alt, word_count,
             social_links_on_site, keyword_placement_score,
             backlink_referring_domains, backlink_categories)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        record.jobId,
        record.lighthousePerf ?? null, record.lighthouseSeo ?? null,
        record.lighthouseA11y ?? null, record.lighthouseBp ?? null,
        record.hasRobots != null ? (record.hasRobots ? 1 : 0) : null,
        record.hasSitemap != null ? (record.hasSitemap ? 1 : 0) : null,
        record.hasLlmsTxt != null ? (record.hasLlmsTxt ? 1 : 0) : null,
        record.aiCrawlerBlocked ? JSON.stringify(record.aiCrawlerBlocked) : null,
        record.schemaTypes ? JSON.stringify(record.schemaTypes) : null,
        record.metaTitleLength ?? null, record.metaDescLength ?? null,
        record.hasOgTags != null ? (record.hasOgTags ? 1 : 0) : null,
        record.hasTwitterCards != null ? (record.hasTwitterCards ? 1 : 0) : null,
        record.h1Count ?? null,
        record.headingHierarchyValid != null ? (record.headingHierarchyValid ? 1 : 0) : null,
        record.hasCanonical != null ? (record.hasCanonical ? 1 : 0) : null,
        record.isHttps != null ? (record.isHttps ? 1 : 0) : null,
        record.hasHreflang != null ? (record.hasHreflang ? 1 : 0) : null,
        record.imagesTotal ?? null, record.imagesMissingAlt ?? null,
        record.wordCount ?? null,
        record.socialLinksOnSite ? JSON.stringify(record.socialLinksOnSite) : null,
        record.keywordPlacementScore ?? null,
        record.backlinkReferringDomains ?? null,
        record.backlinkCategories ? JSON.stringify(record.backlinkCategories) : null,
      ],
    });
  } catch (e) {
    console.error("[ANALYTICS] Failed to store technical:", e);
  }
}

// ── Read Operations (Benchmarks) ──

export interface IndustryBenchmark {
  industry: string;
  auditCount: number;
  avgScore: number;
  medianScore: number;
  avgKnowledge: number;
  avgDiscoverability: number;
  avgSeo: number;
  avgAuthority: number;
  topEngineByMentions: string;
  avgMentionRate: number;
}

export async function getIndustryBenchmark(industry: string): Promise<IndustryBenchmark | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const result = await client.execute({
      sql: `SELECT 
              COUNT(*) as audit_count,
              ROUND(AVG(overall_score), 1) as avg_score,
              ROUND(AVG(knowledge_score), 1) as avg_knowledge,
              ROUND(AVG(discoverability_score), 1) as avg_discoverability,
              ROUND(AVG(seo_score), 1) as avg_seo,
              ROUND(AVG(authority_score), 1) as avg_authority
            FROM audits 
            WHERE LOWER(industry) LIKE ?`,
      args: [`%${industry.toLowerCase()}%`],
    });

    if (!result.rows.length || !result.rows[0].audit_count) return null;

    const row = result.rows[0];

    // Get top engine
    const engineResult = await client.execute({
      sql: `SELECT engine, ROUND(AVG(mentioned) * 100, 1) as mention_rate
            FROM audit_prompts ap
            JOIN audits a ON ap.job_id = a.job_id
            WHERE LOWER(a.industry) LIKE ?
            GROUP BY engine
            ORDER BY mention_rate DESC
            LIMIT 1`,
      args: [`%${industry.toLowerCase()}%`],
    });

    // Get median
    const medianResult = await client.execute({
      sql: `SELECT overall_score FROM audits 
            WHERE LOWER(industry) LIKE ? AND overall_score IS NOT NULL
            ORDER BY overall_score
            LIMIT 1 OFFSET (SELECT COUNT(*)/2 FROM audits WHERE LOWER(industry) LIKE ?)`,
      args: [`%${industry.toLowerCase()}%`, `%${industry.toLowerCase()}%`],
    });

    return {
      industry,
      auditCount: Number(row.audit_count),
      avgScore: Number(row.avg_score),
      medianScore: medianResult.rows.length ? Number(medianResult.rows[0].overall_score) : Number(row.avg_score),
      avgKnowledge: Number(row.avg_knowledge),
      avgDiscoverability: Number(row.avg_discoverability),
      avgSeo: Number(row.avg_seo),
      avgAuthority: Number(row.avg_authority),
      topEngineByMentions: engineResult.rows.length ? String(engineResult.rows[0].engine) : "unknown",
      avgMentionRate: engineResult.rows.length ? Number(engineResult.rows[0].mention_rate) : 0,
    };
  } catch (e) {
    console.error("[ANALYTICS] Failed to get benchmark:", e);
    return null;
  }
}

export async function getGlobalStats(): Promise<{
  totalAudits: number;
  avgScore: number;
  topIndustries: Array<{ industry: string; count: number; avgScore: number }>;
} | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const total = await client.execute("SELECT COUNT(*) as c, ROUND(AVG(overall_score),1) as avg FROM audits");
    const industries = await client.execute(
      `SELECT industry, COUNT(*) as c, ROUND(AVG(overall_score),1) as avg 
       FROM audits WHERE industry IS NOT NULL 
       GROUP BY industry ORDER BY c DESC LIMIT 20`
    );

    return {
      totalAudits: Number(total.rows[0]?.c || 0),
      avgScore: Number(total.rows[0]?.avg || 0),
      topIndustries: industries.rows.map((r) => ({
        industry: String(r.industry),
        count: Number(r.c),
        avgScore: Number(r.avg),
      })),
    };
  } catch (e) {
    console.error("[ANALYTICS] Failed to get global stats:", e);
    return null;
  }
}

// ── Pattern Analysis (what predicts high scores?) ──

export async function getSchemaImpact(): Promise<{
  withSchema: { count: number; avgScore: number };
  withoutSchema: { count: number; avgScore: number };
} | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const result = await client.execute(
      `SELECT 
        CASE WHEN t.schema_types IS NOT NULL AND t.schema_types != '[]' THEN 'with' ELSE 'without' END as has_schema,
        COUNT(*) as c,
        ROUND(AVG(a.overall_score), 1) as avg
      FROM audits a
      LEFT JOIN audit_technical t ON a.job_id = t.job_id
      GROUP BY has_schema`
    );

    const withSchema = result.rows.find((r) => r.has_schema === "with");
    const withoutSchema = result.rows.find((r) => r.has_schema === "without");

    return {
      withSchema: { count: Number(withSchema?.c || 0), avgScore: Number(withSchema?.avg || 0) },
      withoutSchema: { count: Number(withoutSchema?.c || 0), avgScore: Number(withoutSchema?.avg || 0) },
    };
  } catch (e) {
    console.error("[ANALYTICS] Failed to get schema impact:", e);
    return null;
  }
}

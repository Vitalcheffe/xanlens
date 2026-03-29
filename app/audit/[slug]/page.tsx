import { notFound } from "next/navigation";
import { Metadata } from "next";
import fs from "fs";
import path from "path";
import AuditDetailClient from "./AuditDetailClient";

interface AuditData {
  brand: string;
  website: string | null;
  industry: string;
  overall_score: number;
  mention_score: number;
  citation_score: number;
  grade: string;
  engines: Record<string, { score: number; mentions: number; sentiment: string; sample_snippets: string[] }>;
  prompt_coverage: {
    tested: number;
    mentioned_in: number;
    coverage_pct: number;
    details: { prompt: string; mentioned: boolean; snippet?: string | null; category?: string }[];
    by_category?: Record<string, { tested: number; mentioned_in: number; coverage_pct: number }>;
  };
  competitor_analysis?: { share_of_voice: number; your_mentions: number; competitors: { name: string; mentions: number; sentiment: string }[] };
  citation_intelligence: { brand_cited: boolean; citing_sources: string[]; total_web_results: number; brand_in_results: number };
  content_gaps: { question: string; status: string; detail: string }[];
  web_presence_score: number;
  category_scores?: Record<string, number>;
  site_analysis?: Record<string, unknown> | null;
  optimization: { immediate_fixes: string[]; content_strategy: string[]; technical_seo: string[]; priority: string };
  timestamp: string;
}

function loadAuditData(slug: string): AuditData | null {
  const filePath = path.join(process.cwd(), "public", "data", "audits", `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function getGradeColor(grade: string): string {
  if (grade === "A" || grade === "A+") return "text-[#2596be]";
  if (grade === "B" || grade === "B+") return "text-[#5cb8d6]";
  if (grade === "C" || grade === "C+") return "text-[#F59E0B]";
  if (grade === "D" || grade === "D+") return "text-[#F97316]";
  return "text-[#EF4444]";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = loadAuditData(slug);
  if (!data) return { title: "Audit Not Found — XanLens" };

  const topFinding = data.optimization?.immediate_fixes?.[0] || "AI visibility analysis complete";
  const title = `XanLens Audit: ${data.brand} — GEO Score ${data.overall_score}/100`;
  const description = `${data.brand} scored ${data.overall_score}/100 (Grade ${data.grade}) in AI visibility. ${topFinding}. Tested across ${data.prompt_coverage.tested} prompts with ${data.prompt_coverage.coverage_pct}% coverage.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://xanlens.com/audit/${slug}`,
      siteName: "XanLens",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = loadAuditData(slug);
  if (!data) notFound();

  const gradeColor = getGradeColor(data.grade);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: `XanLens Audit: ${data.brand}`,
        url: `https://xanlens.com/audit/${slug}`,
        description: `AI visibility audit for ${data.brand}. GEO Score: ${data.overall_score}/100, Grade: ${data.grade}.`,
        datePublished: data.timestamp,
        dateModified: data.timestamp,
        publisher: { "@type": "Organization", name: "XanLens", url: "https://xanlens.com" },
      },
      {
        "@type": "Review",
        itemReviewed: {
          "@type": "SoftwareApplication",
          name: data.brand,
          applicationCategory: data.industry,
          ...(data.website ? { url: data.website } : {}),
        },
        author: { "@type": "Organization", name: "XanLens", url: "https://xanlens.com" },
        reviewRating: {
          "@type": "Rating",
          ratingValue: data.overall_score,
          bestRating: 100,
          worstRating: 0,
        },
        name: `GEO Audit: ${data.brand}`,
        reviewBody: `${data.brand} achieved a GEO score of ${data.overall_score}/100 (Grade ${data.grade}). Prompt coverage: ${data.prompt_coverage.coverage_pct}% across ${data.prompt_coverage.tested} prompts. ${data.optimization?.immediate_fixes?.[0] || ""}`,
        datePublished: data.timestamp,
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="pt-20 pb-24 px-4 sm:px-6">
        <div className="max-w-[900px] mx-auto">

          {/* Breadcrumb */}
          <div className="mb-8 text-[12px] text-[#666]">
            <a href="/" className="hover:text-white transition-colors">Home</a>
            <span className="mx-2">/</span>
            <a href="/audits" className="hover:text-white transition-colors">Audits</a>
            <span className="mx-2">/</span>
            <span className="text-[#999]">{data.brand}</span>
          </div>

          {/* Hero score card */}
          <div className="rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a] p-8 sm:p-10 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold tracking-tight mb-2">{data.brand}</h1>
                <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#999]">
                  <span className="px-2 py-0.5 rounded bg-[#111] border border-[#1a1a1a]">{data.industry}</span>
                  {data.website && (
                    <a href={data.website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{data.website.replace(/^https?:\/\//, "")}</a>
                  )}
                  <span className="text-[#444]">·</span>
                  <span className="text-[#666]">{new Date(data.timestamp).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-[4rem] sm:text-[5rem] font-semibold tracking-tighter leading-none">{data.overall_score}</p>
                <p className="text-[14px] text-[#666]">/ 100 · Grade <span className={`font-semibold ${gradeColor}`}>{data.grade}</span></p>
              </div>
            </div>
          </div>

          {/* Engine breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {Object.entries(data.engines).map(([engine, info]) => (
              <div key={engine} className="rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-5">
                <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">{engine}</p>
                <p className="text-[1.75rem] font-semibold">{info.score}<span className="text-[12px] text-[#666]">/100</span></p>
                <p className="text-[11px] text-[#666] mt-1">{info.mentions} mention{info.mentions !== 1 ? "s" : ""} · {info.sentiment}</p>
              </div>
            ))}
            <div className="rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-5">
              <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">Web Presence</p>
              <p className="text-[1.75rem] font-semibold">{data.web_presence_score}<span className="text-[12px] text-[#666]">/100</span></p>
              <p className="text-[11px] text-[#666] mt-1">citation score: {data.citation_score}</p>
            </div>
          </div>

          {/* Prompt Coverage */}
          <div className="rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-medium">Prompt Coverage</h2>
              <span className="text-[1.5rem] font-semibold">{data.prompt_coverage.coverage_pct}%</span>
            </div>
            <p className="text-[12px] text-[#666] mb-4">
              Mentioned in {data.prompt_coverage.mentioned_in} of {data.prompt_coverage.tested} test prompts
            </p>
            {/* Category breakdown */}
            {data.prompt_coverage.by_category && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {Object.entries(data.prompt_coverage.by_category).map(([cat, info]) => (
                  <div key={cat} className="p-3 rounded-lg bg-[#111] border border-[#1a1a1a]">
                    <p className="text-[11px] text-[#666] capitalize">{cat.replace(/_/g, " ")}</p>
                    <p className="text-[14px] font-medium">{info.coverage_pct}%</p>
                    <p className="text-[10px] text-[#555]">{info.mentioned_in}/{info.tested}</p>
                  </div>
                ))}
              </div>
            )}
            <AuditDetailClient promptDetails={data.prompt_coverage.details} />
          </div>

          {/* Citation Intelligence */}
          <div className="rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-medium">Citation Intelligence</h2>
              <span className={`text-[12px] px-2 py-0.5 rounded ${data.citation_intelligence.brand_cited ? "bg-[#2596be]/10 text-[#2596be]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
                {data.citation_intelligence.brand_cited ? "Cited" : "Not cited"}
              </span>
            </div>
            <p className="text-[12px] text-[#666] mb-3">
              Found in {data.citation_intelligence.brand_in_results} of {data.citation_intelligence.total_web_results} web results
            </p>
            {data.citation_intelligence.citing_sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.citation_intelligence.citing_sources.map((s, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-[#111] border border-[#1a1a1a] text-[#999]">{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Content Gaps */}
          {data.content_gaps.length > 0 && (
            <div className="rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-6 mb-8">
              <h2 className="text-[15px] font-medium mb-4">Content Gaps — What AI Doesn&apos;t Know</h2>
              <div className="space-y-3">
                {data.content_gaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`mt-0.5 text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      gap.status === "missing" ? "bg-[#EF4444]/10 text-[#EF4444]" :
                      gap.status === "inaccurate" ? "bg-[#F59E0B]/10 text-[#F59E0B]" :
                      "bg-orange-500/10 text-[#F97316]"
                    }`}>{gap.status}</span>
                    <div>
                      <p className="text-[13px] text-white">{gap.question}</p>
                      <p className="text-[11px] text-[#666] mt-0.5">{gap.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optimization Recommendations */}
          <div className="rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-6 mb-8">
            <h2 className="text-[15px] font-medium mb-4">Optimization Recommendations</h2>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] uppercase tracking-wider text-[#666]">Priority:</span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                data.optimization.priority === "critical" ? "bg-[#EF4444]/10 text-[#EF4444]" :
                data.optimization.priority === "high" ? "bg-orange-500/10 text-[#F97316]" :
                "bg-[#F59E0B]/10 text-[#F59E0B]"
              }`}>{data.optimization.priority}</span>
            </div>

            {data.optimization.immediate_fixes?.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-wider text-[#666] mb-2">Immediate Fixes</p>
                <ul className="space-y-2">
                  {data.optimization.immediate_fixes.map((fix, i) => (
                    <li key={i} className="text-[13px] text-[#999] flex gap-2">
                      <span className="text-white font-medium shrink-0">{i + 1}.</span> {fix}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.optimization.content_strategy?.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] uppercase tracking-wider text-[#666] mb-2">Content Strategy</p>
                <ul className="space-y-2">
                  {data.optimization.content_strategy.map((s, i) => (
                    <li key={i} className="text-[13px] text-[#999] flex gap-2">
                      <span className="text-white font-medium shrink-0">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.optimization.technical_seo?.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#666] mb-2">Technical SEO</p>
                <ul className="space-y-2">
                  {data.optimization.technical_seo.map((s, i) => (
                    <li key={i} className="text-[13px] text-[#999] flex gap-2">
                      <span className="text-white font-medium shrink-0">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Key Snippets */}
          {Object.values(data.engines).some(e => e.sample_snippets?.length > 0) && (
            <div className="rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-6 mb-8">
              <h2 className="text-[15px] font-medium mb-4">What AI Engines Say</h2>
              <div className="space-y-4">
                {Object.entries(data.engines).filter(([, e]) => e.sample_snippets?.length > 0).map(([engine, info]) => (
                  <div key={engine}>
                    <p className="text-[11px] uppercase tracking-wider text-[#666] mb-2">{engine}</p>
                    {info.sample_snippets.slice(0, 3).map((snippet, i) => (
                      <p key={i} className="text-[13px] text-[#999] leading-relaxed mb-2 pl-3 border-l border-[#222]">
                        &ldquo;{snippet}&rdquo;
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-2xl bg-[#0a0a0a] border border-[#1a1a1a] p-8 text-center">
            <h2 className="text-[1.25rem] font-medium mb-2">Want to improve this score?</h2>
            <p className="text-[13px] text-[#999] mb-6 max-w-[400px] mx-auto">
              XanLens generates ready-to-publish content that boosts your AI visibility — blog posts, FAQ schema, social posts, and more.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/dashboard" className="btn-primary">Audit your brand →</a>
              <a href="/api-docs" className="btn-secondary">Use the API</a>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

"use client";

import AuditReport from "@/app/components/AuditReport";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ReportPageClient({ jobId, result }: { jobId: string; result: any }) {
  const brand = result.brand || "Unknown Brand";
  const score = result.overall_score ?? 0;
  const grade = result.grade || "?";
  const date = result.timestamp
    ? new Date(result.timestamp).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-20">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <a href="/" className="text-[12px] text-[#555] hover:text-white transition-colors">
              ← XanLens
            </a>
            <span className="text-[#333]">·</span>
            <span className="text-[12px] text-[#555]">GEO Audit Report</span>
          </div>
          <h1 className="text-[1.75rem] sm:text-[2rem] font-semibold tracking-tight leading-[1.15] mb-2">
            {brand}
          </h1>
          <div className="flex items-center gap-3 text-[13px] text-[#666] flex-wrap">
            {result.industry && <span>{result.industry}</span>}
            {result.website && (
              <>
                <span>·</span>
                <a href={result.website.startsWith("http") ? result.website : `https://${result.website}`} target="_blank" rel="noopener" className="hover:text-white transition-colors">
                  {result.website}
                </a>
              </>
            )}
            {date && (
              <>
                <span>·</span>
                <span>{date}</span>
              </>
            )}
            <span>·</span>
            <span className="font-mono text-[11px] text-[#444]">{jobId.slice(0, 8)}</span>
          </div>
        </div>

        {/* Full Report */}
        <AuditReport
          result={result}
          tier={(result.tier as "free" | "pro") || "pro"}
          aio={result.aio}
          technical={result.technical}
          contentOptimizer={result.content_optimizer}
          seoScore={result.seo_score}
          websiteHealth={result.website_health}
        />

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[#141414] flex items-center justify-between">
          <span className="text-[11px] text-[#444]">Powered by XanLens</span>
          <div className="flex items-center gap-4">
            <a href={`/dashboard?jobId=${jobId}`} className="text-[11px] text-[#555] hover:text-white transition-colors">
              Open in Dashboard →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

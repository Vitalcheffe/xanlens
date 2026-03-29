"use client";

import React, { useEffect } from "react";
import AuditReport from "@/app/components/AuditReport";
import type { AuditResult } from "@/app/types";

interface ReportClientProps {
  result: AuditResult;
  tier: "free" | "pro";
  jobId: string;
}

export default function ReportClient({ result, tier, jobId }: ReportClientProps) {

  // Hide global nav, promo banner, and footer — report has its own chrome
  useEffect(() => {
    // Hide global chrome elements for clean report view
    const selectors = [".global-nav", ".global-footer"];
    const hidden: HTMLElement[] = [];

    selectors.forEach((sel) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) { el.style.display = "none"; hidden.push(el); }
    });

    // Hide promo banner (first fixed element in body with z-[60])
    document.querySelectorAll<HTMLElement>("body .fixed").forEach((el) => {
      if (el.classList.contains("z-[60]")) { el.style.display = "none"; hidden.push(el); }
    });

    return () => { hidden.forEach((el) => { el.style.display = ""; }); };
  }, []);
  const brand = result.brand || "Unknown";
  const score = result.overall_score ?? result.score ?? 0;
  const grade = result.grade || "?";

  const tweetText = `My brand "${brand}" scored ${score}/100 (${grade}) on AI visibility 🔍\n\nHow visible is YOUR brand to ChatGPT, Gemini & Perplexity?\n\n@xanlens_`;

  const handleShare = () => {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(tweetText).then(() => {
      alert("Tweet text copied! Paste it on X for better reach (no link = more impressions).");
    });
  };

  const handleDownloadCard = () => {
    const link = document.createElement("a");
    link.href = `/api/v1/report/card?jobId=${jobId}`;
    link.download = `xanlens-${brand.toLowerCase().replace(/\s+/g, "-")}-score.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="border-b border-[#222] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="https://xanlens.com" className="text-white font-bold text-sm tracking-wide">
            XANLENS
          </a>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleCopy}
              className="text-[13px] px-4 py-2.5 rounded-lg border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] transition-colors min-w-[100px]"
            >
              Copy tweet
            </button>
            {/* Download button removed for mobile optimization */}
            <button
              onClick={handleShare}
              className="text-[13px] px-4 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors min-w-[120px]"
            >
              Share on 𝕏
            </button>
          </div>
        </div>
      </div>

      {/* Report */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <AuditReport
          result={result}
          tier={tier}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          aio={(result as any).aio}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          technical={(result as any).technical}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contentOptimizer={(result as any).content_optimizer}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          seoScore={(result as any).seo_score}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          websiteHealth={(result as any).website_health}
        />

        {/* Fixes are on separate page: /report/{jobId}/fixes */}
      </div>

      {/* Share CTA footer */}
      <div className="border-t border-[#222] bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <p className="text-[#888] text-sm mb-3">
            Share your score on X → get a <span className="text-white font-medium">free re-audit coupon</span>
          </p>
          <p className="text-[#555] text-xs mb-4">
            Post your score mentioning @xanlens_ and DM us the link
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
            {/* Download score card button removed for mobile optimization */}
            <button
              onClick={handleCopy}
              className="text-[13px] px-4 py-2.5 rounded-lg border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] transition-colors min-w-[140px]"
            >
              Copy tweet text
            </button>
            <button
              onClick={handleShare}
              className="text-[13px] px-4 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors min-w-[180px]"
            >
              Share on 𝕏 → Free re-audit
            </button>
          </div>
          <p className="text-[#333] text-[11px] mt-6">
            Report ID: {jobId} · Powered by <a href="https://xanlens.com" className="text-white/30 hover:text-white/60">XanLens</a>
          </p>
        </div>
      </div>
    </div>
  );
}

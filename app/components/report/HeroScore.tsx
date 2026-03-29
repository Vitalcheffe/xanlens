"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import type { AuditResult, SEOScoreData } from "@/app/types";
import { ScoreRing, Section, SectionTitle, ProBadge, GRADE_COLORS, scoreColor, formatVolume } from "./primitives";

function getRevenueEstimate(score: number): string {
  if (score >= 80) return "$25,000+/mo";
  if (score >= 60) return "$5,000–25,000/mo";
  if (score >= 30) return "$500–5,000/mo";
  return "$0–500/mo";
}

function getVerdict(score: number): string {
  if (score >= 90) return "Excellent AI visibility. AI engines know and recommend you.";
  if (score >= 75) return "Good visibility with room to grow.";
  if (score >= 60) return "Moderate visibility. You're missing key conversations.";
  if (score >= 40) return "Low visibility. Most AI engines don't mention you.";
  return "Critical. You're invisible to AI search engines.";
}

function ShareWithAgent({ jobId }: { jobId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateToken = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/audit/share-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, wallet: (window as unknown as Record<string, unknown>).__WALLET_ADDRESS || "" }),
      });
      const data = await res.json();
      if (data.token) setToken(data.token);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (token) {
    return (
      <div className="flex items-center gap-2">
        <code className="px-3 py-2 rounded-lg bg-[#111] border border-[#333] text-[12px] text-[#aaa] font-mono max-w-[180px] truncate">{token}</code>
        <button
          onClick={copyToken}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-[#ccc] hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={generateToken}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[13px] text-[#ccc] hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-50 min-w-[120px] justify-center"
      title="Generate a token to share this audit with your AI agent"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5z"/><rect x="3" y="10" width="18" height="12" rx="2"/><circle cx="12" cy="16" r="1"/></svg>
      {loading ? "Generating..." : "Share with AI"}
    </button>
  );
}

export function HeroScore({ result, score, grade, gradeClass, activeEngines, isFree, jobId, uniqueTested, uniqueMentioned }: {
  result: AuditResult;
  score: number;
  grade: string;
  gradeClass: string;
  activeEngines: string[];
  isFree: boolean;
  jobId?: string;
  uniqueTested?: number;
  uniqueMentioned?: number;
}) {
  return (
    <Section delay={0.1}>
      <div className="flex flex-col lg:flex-row gap-10 items-center lg:items-start w-full">
        <div className="flex flex-col items-center shrink-0 w-full lg:w-auto">
          {/* Main GEO Score (center, top) */}
          <div className="flex flex-col items-center group relative mb-4">
            <ScoreRing score={score} size={140} strokeWidth={10} delay={0.3} />
            <motion.span
              className={`text-[1.3rem] font-bold mt-3 px-4 py-1 rounded-xl border ${gradeClass}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
            >
              {grade}
            </motion.span>
            <span className="text-[11px] text-[#666] mt-1.5 font-medium flex items-center gap-1">
              GEO Score
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="cursor-help"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </span>
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[11px] text-[#999] w-[220px] text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Your overall Generative Engine Optimization score. Weighted: 60% Knowledge + 35% Discoverability + 5% Citations.
            </div>
          </div>
          {/* Sub scores row */}
          <div className="flex items-center justify-center gap-10 sm:gap-16 w-full">
            {/* Knowledge Score (left) */}
            <div className="flex flex-col items-center group relative">
              <ScoreRing score={result.knowledge_score ?? score} size={80} strokeWidth={6} delay={0.2} />
              <span className="text-[11px] text-[#666] mt-2 font-medium flex items-center gap-1">
                Knowledge
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="cursor-help"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </span>
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[11px] text-[#999] w-[200px] text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Do AI engines already know about you from their training data? Higher = more embedded knowledge.
              </div>
            </div>
            {/* Discoverability Score (right) */}
            <div className="flex flex-col items-center group relative">
              <ScoreRing score={result.discoverability_score ?? 0} size={80} strokeWidth={6} delay={0.4} />
              <span className="text-[11px] text-[#666] mt-2 font-medium flex items-center gap-1">
                Discoverability
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" className="cursor-help"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </span>
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[11px] text-[#999] w-[200px] text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Can AI engines find you when they search the web in real-time? Higher = better online discoverability for AI.
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-[28px] sm:text-[34px] font-bold tracking-tight">{result.brand || "Unknown"}</h2>
              {isFree ? (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#333]/30 text-[#888] font-medium border border-[#333]/50">Free</span>
              ) : (
                <ProBadge />
              )}
            </div>
            <div className="flex flex-row items-center gap-2 flex-wrap">
              <button
                onClick={() => document.getElementById("share-section")?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[13px] text-[#ccc] hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[100px] justify-center"
                title="Share for a free re-audit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share
              </button>
              {!isFree && jobId && <ShareWithAgent jobId={jobId} />}
            </div>
          </div>
          <p className="text-[14px] text-[#666] mb-5">
            {result.industry}{result.website ? ` · ${result.website}` : ""}
          </p>
          <p className="text-[16px] text-[#aaa] leading-relaxed mb-3 max-w-[600px]">{getVerdict(score)}</p>
          <p className="text-[11px] text-[#555] mb-4 max-w-[500px]">AI responses are non-deterministic — scores may vary by a few points between runs.</p>

          <div className="flex items-center gap-2 mb-8 px-4 py-2.5 rounded-lg bg-[#2596be]/10 border border-[#2596be]/20 max-w-fit">
            <span className="text-[#5cb8d6] text-[14px]">Estimated AI-referred traffic value:</span>
            <span className="text-[#8ad0e3] font-semibold text-[15px]">{result.estimated_monthly_revenue_impact || getRevenueEstimate(score)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: `${result.prompt_coverage?.coverage_pct ?? 0}%`, label: "Coverage", color: scoreColor(result.prompt_coverage?.coverage_pct ?? 0) },
              { value: `${uniqueMentioned ?? result.prompt_coverage?.mentioned_in ?? 0}/${uniqueTested ?? result.prompt_coverage?.tested ?? 0}`, label: "Mentioned", color: "text-white" },
              { value: String(result.blind_spots?.count ?? 0), label: "Blind Spots", color: (result.blind_spots?.count ?? 0) > 0 ? "text-[#EF4444]" : "text-[#2596be]" },
              { value: `${activeEngines.filter(e => !(result.engines?.[e] as any)?.unavailable).length}/${activeEngines.length}`, label: "Engines", color: "text-white" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="rounded-xl bg-black/50 border border-[#1a1a1a] p-5 text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                <p className={`text-[24px] sm:text-[28px] font-bold tracking-tight ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] sm:text-[12px] text-[#555] mt-1.5 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {result.search_volume?.enabled && result.search_volume.total_missed_volume != null && result.search_volume.total_missed_volume > 0 && (
            <div className="mt-6 rounded-xl bg-[#EF4444]/[0.05] border border-[#EF4444]/20 p-4 flex items-center gap-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" className="shrink-0"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 6-6"/></svg>
              <div>
                <p className="text-[15px] font-semibold text-[#EF4444]">
                  Missing from {formatVolume(result.search_volume.total_missed_volume)} monthly searches
                </p>
                <p className="text-[12px] text-[#666] mt-0.5">Combined search volume of queries where AI doesn&apos;t mention you</p>
              </div>
            </div>
          )}

          {!result.search_volume?.enabled && isFree && (
            <div className="mt-6 rounded-xl bg-[#0f0f0f] border border-dashed border-[#222] p-4 flex items-center gap-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" className="shrink-0 opacity-40"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 6-6"/></svg>
              <div>
                <p className="text-[13px] text-[#555]">How many monthly searches are you missing?</p>
                <a href="/pricing" className="text-[12px] text-[#777] underline underline-offset-2 hover:text-white">Unlock search volume data with Pro →</a>
              </div>
            </div>
          )}

          {result.score_confidence && (
            <p className="text-[12px] text-[#444] mt-4">Confidence: ±{result.score_confidence} points</p>
          )}

          {isFree && (
            <div className="mt-4 rounded-xl bg-[#111] border border-dashed border-[#333] p-4 max-w-[600px]">
              <p className="text-[12px] text-[#888]">
                <span className="text-[#aaa] font-medium">Basic audit — Gemini only.</span>{" "}
                This score reflects visibility on Google Gemini. Pro audits test across multiple AI engines (DeepSeek, Grok, and more) for a complete picture.
              </p>
              <a href="/dashboard" className="text-[11px] text-[#2596be] hover:text-[#5cb8d6] transition mt-1.5 inline-block">Upgrade to Pro for full visibility →</a>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

export function SEOvsGEO({ seoScore, geoScore }: { seoScore: SEOScoreData; geoScore: number }) {
  if (!seoScore.available) return null;
  const delta = geoScore - seoScore.seo_score;
  const absDelta = Math.abs(delta);

  return (
    <Section delay={0.12}>
      <SectionTitle>SEO vs GEO — The Gap</SectionTitle>
      <p className="text-[13px] text-[#666] -mt-4 mb-7">Good SEO doesn&apos;t mean good AI visibility. Here&apos;s how your brand compares across traditional and AI search.</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 mb-6">
        <div className="flex flex-col items-center">
          <ScoreRing score={seoScore.seo_score} size={140} strokeWidth={8} delay={0.15} />
          <p className="text-[16px] font-semibold mt-3">SEO Score</p>
          <p className="text-[12px] text-[#555] mt-1">Traditional Search</p>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-[2rem] font-bold text-[#333]">vs</div>
          {absDelta <= 5
            ? <p className="text-[12px] text-[#555] mt-1">Similar visibility</p>
            : delta > 0
              ? <p className="text-[12px] text-[#2596be] mt-1">GEO is {absDelta} pts ahead</p>
              : <p className="text-[12px] text-[#EF4444] mt-1">GEO is {absDelta} pts behind</p>
          }
        </div>
        <div className="flex flex-col items-center">
          <ScoreRing score={geoScore} size={140} strokeWidth={8} delay={0.2} />
          <p className="text-[16px] font-semibold mt-3">GEO Score</p>
          <p className="text-[12px] text-[#555] mt-1">AI Search</p>
        </div>
      </div>
      {geoScore < seoScore.seo_score - 10 && (
        <div className="rounded-xl bg-[#EF4444]/[0.05] border border-[#EF4444]/20 p-5 text-center">
          <p className="text-[14px] text-[#EF4444] font-semibold mb-1">Your SEO is {seoScore.seo_score - geoScore} points ahead of your GEO</p>
          <p className="text-[13px] text-[#666]">You rank well in Google but AI engines don&apos;t recommend you. As search shifts to AI, this gap becomes lost revenue.</p>
        </div>
      )}
      {geoScore >= seoScore.seo_score - 10 && geoScore <= seoScore.seo_score + 10 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 text-center">
          <p className="text-[14px] text-white font-semibold mb-1">Your SEO and GEO scores are aligned</p>
          <p className="text-[13px] text-[#666]">Consistent visibility across both traditional and AI search. Keep optimizing both channels.</p>
        </div>
      )}
      {geoScore > seoScore.seo_score + 10 && (
        <div className="rounded-xl bg-[#2596be]/[0.05] border border-[#2596be]/20 p-5 text-center">
          <p className="text-[14px] text-[#2596be] font-semibold mb-1">Your GEO is {geoScore - seoScore.seo_score} points ahead of your SEO</p>
          <p className="text-[13px] text-[#666]">AI engines recommend you more than traditional search shows you. You&apos;re ahead of the curve.</p>
        </div>
      )}
    </Section>
  );
}

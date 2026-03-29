"use client";

import React from "react";
import { motion } from "framer-motion";
import type { AuditReportProps, BlindSpotItem, PersonaAnalysis, PromptDetail } from "@/app/types";
import WebsiteHealthSection from "./report/WebsiteHealthSection";
import type { WebsiteHealthData } from "./report/WebsiteHealthSection";
import {
  ENGINE_META, ALL_ENGINES, CATEGORY_LABELS, AIO_LABELS, GRADE_COLORS, InlineIcon,
  scoreColor, scoreBg, barColor, formatVolume,
  VolumeBadge, ScoreRing, ProLock, ProBadge, Section, SectionTitle,
} from "./report/primitives";
import { HeroScore, SEOvsGEO } from "./report/HeroScore";
import { EngineBreakdown } from "./report/EngineBreakdown";
import { PromptAnalysis } from "./report/PromptAnalysis";
import { KnowledgeVsDiscoverability } from "./report/KnowledgeVsDiscoverability";
// PlatformPresence removed — duplicates Authority Sources
import ShareForDiscount from "./ShareForDiscount";

/* ─── Persona constants ─── */
const PERSONA_LABELS: Record<string, string> = {
  technical_buyer: "Technical Buyer",
  executive: "Executive / Decision Maker",
  end_user: "End User / Consumer",
};
const PERSONA_ICONS: Record<string, string> = {
  technical_buyer: "🔧",
  executive: "💼",
  end_user: "👤",
};

/* ─── Evidence Section with toggleable responses ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Schedule Re-audit component
function ScheduleReaudit({ brand, score }: { brand?: string; score: number }) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const [scheduled, setScheduled] = React.useState(false);
  const recommended = score < 40 ? 7 : score < 75 ? 15 : 30;
  const options = [1, 3, 7, 15, 30];

  const handleSchedule = () => {
    if (!selected) return;
    // Store schedule preference (will be picked up by dashboard/API)
    try {
      const data = { brand, days: selected, scheduledAt: new Date().toISOString() };
      localStorage.setItem("xanlens_reaudit_schedule", JSON.stringify(data));
    } catch {}
    setScheduled(true);
  };

  if (scheduled) {
    return (
      <div className="rounded-xl border border-[#2596be]/20 bg-[#2596be]/5 p-5 mb-8">
        <p className="text-[13px] text-[#2596be] font-medium">✓ Re-audit scheduled for {selected} days from now. We&apos;ll notify you when it&apos;s time.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#191919] bg-[#0c0c0c] p-5 mb-8">
      <p className="text-[13px] text-[#999] mb-3">Schedule a re-audit to track improvement</p>
      <div className="flex items-center gap-2 flex-wrap">
        {options.map(d => (
          <button
            key={d}
            onClick={() => setSelected(d)}
            className={`px-3 py-1.5 rounded-lg text-[12px] border transition-colors cursor-pointer ${
              selected === d
                ? "border-white/30 bg-white/10 text-white"
                : "border-[#222] bg-transparent text-[#666] hover:border-[#444] hover:text-[#999]"
            }`}
          >
            {d}d {d === recommended && <span className="text-[10px] text-cyan-400 ml-1">recommended</span>}
          </button>
        ))}
        <button
          onClick={handleSchedule}
          disabled={!selected}
          className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
            selected ? "bg-white text-black hover:bg-white/90" : "bg-[#111] text-[#444] cursor-not-allowed"
          }`}
        >
          Schedule
        </button>
      </div>
    </div>
  );
}

// Full Report — written narrative + prompt list
function FullReport({ details, result }: { details: any[]; result: any }) {
  const [open, setOpen] = React.useState(false);
  const [showPrompts, setShowPrompts] = React.useState(false);

  // Group by unique prompts — a prompt counts as "mentioned" if ANY engine mentioned the brand
  const promptMap = new Map<string, any[]>();
  for (const d of details) {
    if (!promptMap.has(d.prompt)) promptMap.set(d.prompt, []);
    promptMap.get(d.prompt)!.push(d);
  }
  const total = promptMap.size;
  const mentioned = [...promptMap.values()].filter(responses => responses.some(r => r.mentioned)).length;
  const coverage = total > 0 ? Math.round((mentioned / total) * 100) : 0;
  const engineCount = Object.keys(result.engines || {}).length;
  const score = result.overall_score ?? 0;
  const grade = result.grade ?? "F";
  const brand = result.brand || "your brand";
  const compAnalysis = result.competitor_analysis;
  const hasCompetitors = compAnalysis?.competitors?.length > 0;

  // Generate narrative — use LLM-generated if available, fall back to template
  const narrativeParts: string[] = [];

  if (result.narrative) {
    // LLM-generated narrative from Gemini
    narrativeParts.push(result.narrative);
  } else {
    // Template fallback
    narrativeParts.push(`This report analyzes how visible ${brand} is across ${engineCount} major AI engine${engineCount === 1 ? '' : 's'}. We tested ${total} prompts that real users would ask when looking for products and services in your space.`);

    if (score < 20) {
      narrativeParts.push(`${brand} scored ${score} out of 100 (Grade ${grade}). This is a critical score — AI engines essentially don't know your brand exists.`);
    } else if (score < 40) {
      narrativeParts.push(`${brand} scored ${score} out of 100 (Grade ${grade}). AI engines have minimal awareness of your brand. You appeared in only ${coverage}% of the queries we tested.`);
    } else if (score < 60) {
      narrativeParts.push(`${brand} scored ${score} out of 100 (Grade ${grade}). AI engines have some awareness of your brand, appearing in ${coverage}% of tested queries.`);
    } else if (score < 80) {
      narrativeParts.push(`${brand} scored ${score} out of 100 (Grade ${grade}). Good visibility — AI engines mention your brand in ${coverage}% of relevant queries.`);
    } else {
      narrativeParts.push(`${brand} scored ${score} out of 100 (Grade ${grade}). Excellent visibility across ${coverage}% of tested queries.`);
    }

    narrativeParts.push(`Out of ${total} prompts tested, ${brand} was mentioned in ${mentioned} (${coverage}%). This means ${total - mentioned} queries returned results without mentioning ${brand} at all.`);

    if (hasCompetitors) {
      const topComp = compAnalysis.competitors[0];
      const sovNote = compAnalysis.share_of_voice > topComp.visibility
        ? `${brand} leads with ${compAnalysis.share_of_voice}% share of voice. Closest competitor: ${topComp.name} at ${topComp.visibility}%.`
        : `${topComp.name} leads with ${topComp.visibility}% share of voice. ${brand} holds ${compAnalysis.share_of_voice}%.`;
      narrativeParts.push(sovNote);
    }
  }

  return (
    <Section delay={0.55}>
      <motion.div className="rounded-2xl border border-[#191919] bg-[#0c0c0c]/80 overflow-hidden" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-8 text-left hover:bg-[#0f0f0f] transition-colors cursor-pointer">
          <div>
            <h3 className="text-[15px] font-semibold text-white/90">Full Analysis Report</h3>
            <p className="text-[12px] text-[#444] mt-1">
              Complete summary of what your audit results mean — click to read
            </p>
          </div>
          <span className={`text-[#444] text-[13px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
        </button>
        {open && (
          <div className="px-8 pb-8">
            {/* Written narrative */}
            <div className="space-y-4 mb-8">
              {narrativeParts.map((para, i) => (
                <p key={i} className="text-[13px] text-[#999] leading-relaxed">{para}</p>
              ))}
            </div>

            {/* See all prompts toggle */}
            <button onClick={() => setShowPrompts(!showPrompts)} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition text-left mb-4">
              <span className={`text-[11px] text-[#444] transition-transform ${showPrompts ? "rotate-180" : ""}`}>▼</span>
              <p className="text-[12px] text-[#666]">See all {promptMap.size} prompts tested</p>
            </button>
            {showPrompts && (
              <div className="max-h-[500px] overflow-y-auto pr-2 space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                {[...promptMap.entries()].map(([prompt, responses], idx) => {
                  const anyMentioned = responses.some(r => r.mentioned);
                  return (
                    <div key={idx} className={`rounded-xl border p-3 ${anyMentioned ? "border-[#2596be]/10 bg-[#2596be]/[0.02]" : "border-[#191919] bg-[#0c0c0c]"}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-[11px] font-bold shrink-0 ${anyMentioned ? "text-[#2596be]" : "text-[#EF4444]"}`}>{anyMentioned ? "✓" : "✗"}</span>
                        <p className="text-[12px] text-[#ccc]">&ldquo;{prompt}&rdquo;</p>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-4 mt-1">
                        {responses.map((r, ri) => (
                          <span key={ri} className={`text-[9px] px-1.5 py-0.5 rounded-full ${r.mentioned ? "bg-[#2596be]/10 text-[#2596be]" : "bg-[#111] text-[#555]"}`}>
                            {ENGINE_META[r.engine]?.label || r.engine}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </Section>
  );
}

/* ─── Main Component ─── */
export default function AuditReport({ result, tier, aio, technical, contentOptimizer, seoScore, websiteHealth, onReset }: AuditReportProps) {
  const SOURCE_ICON_MAP: Record<string, string> = {
    "Wikipedia": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20|M2 12h20",
    "Crunchbase": "rect:3,3,18,18,2|M8 12h8|M12 8v8",
    "GitHub": "circle:12,12,10|M9 9h.01|M15 9h.01|M10 14a3.5 3.5 0 0 0 4 0",
    "LinkedIn": "rect:2,2,20,20,2|M8 11v5|M8 8h.01|M12 16v-5|M16 16v-3a2 2 0 0 0-4 0",
    "X / Twitter": "M4 4l7.2 9.6L4 20h2l5.6-5L16 20h4l-7.6-10L19 4h-2l-5.2 4.4L8 4H4",
    "Product Hunt": "circle:12,12,10|M12 7v5l3 3",
    "G2": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2",
    "Discord": "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    "Medium": "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
    "YouTube": "M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.35 29 29 0 0 0-.46-5.33z|M9.75 15.02l5.75-3.27-5.75-3.27v6.54z",
    "Reddit": "circle:12,12,10|circle:8,14,1.5|circle:16,14,1.5|M12 18c2 0 3-1 3-1|M12 2v6",
    "PitchBook": "M3 3v18h18|M7 16l4-8 4 4 6-6",
    "StackShare": "M13 2L3 14h9l-1 8 10-12h-9l1-8",
    "HuggingFace": "circle:12,12,10|M8 14s1.5 2 4 2 4-2 4-2|M9 9h.01|M15 9h.01",
    "DefiLlama": "M3 3v18h18|M7 16l4-8 4 4 6-6",
    "Dune Analytics": "M3 3v18h18|M7 16l4-8 4 4 6-6",
    "npm": "rect:3,3,18,18,0|M7 7v10|M12 7v10|M17 7v4",
    "PyPI": "M12 2l8 4v6c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4",
    "Dev.to": "rect:2,3,20,14,2|M8 21h8|M12 17v4",
  };
  const isFree = tier === "free";

  if (!result || typeof result !== "object") return null;

  const score = result.overall_score ?? result.score ?? 0;
  const grade = result.grade ?? (score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F");
  const gradeClass = GRADE_COLORS[grade.charAt(0).toUpperCase()] || GRADE_COLORS.F;
  const activeEngines = Object.keys(result.engines || {});
  const details = Array.isArray(result.prompt_coverage?.details) ? result.prompt_coverage.details : [];

  // Derive category gap data from prompt category field (set by prompt generator)
  const categories: Record<string, { total: number; mentioned: number }> = {};
  const CATEGORY_MAP: Record<string, string> = {
    brand: "brand_awareness",
    category: "market_positioning",
    discovery: "product_discovery",
    buying_intent: "purchase_intent",
    competitor: "competitive_position",
    conversational: "natural_conversation",
  };
  details.forEach((d) => {
    const cat = (d.category ? CATEGORY_MAP[d.category] : undefined) || "other";
    if (!categories[cat]) categories[cat] = { total: 0, mentioned: 0 };
    categories[cat].total++;
    if (d.mentioned) categories[cat].mentioned++;
  });

  const categoryScores = result.categoryScores || {};
  const gapData = Object.keys(categoryScores).length > 0
    ? Object.entries(categoryScores).map(([k, v]) => ({ key: k, label: CATEGORY_LABELS[k] || k, score: v as number }))
    : Object.entries(categories).filter(([, v]) => v.total > 0).map(([k, v]) => ({
        key: k, label: CATEGORY_LABELS[k] || k, score: Math.round((v.mentioned / v.total) * 100),
      }));

  // Group details by prompt — a prompt is "passed" if ANY engine mentioned the brand
  // Group details by prompt — a prompt is "passed" if ANY engine mentioned the brand
  const promptGroupMap = new Map<string, PromptDetail[]>();
  for (const d of details) {
    if (!promptGroupMap.has(d.prompt)) promptGroupMap.set(d.prompt, []);
    promptGroupMap.get(d.prompt)!.push(d);
  }
  const groupedPrompts: (PromptDetail & { entries?: PromptDetail[] })[] = [...promptGroupMap.entries()].map(([prompt, entries]) => {
    const anyMentioned = entries.some(e => e.mentioned);
    const bestEntry = entries.find(e => e.mentioned) || entries[0];
    return {
      prompt,
      mentioned: anyMentioned,
      engine: entries.map(e => e.engine_model || e.engine || "unknown").join(", "),
      snippet: bestEntry?.snippet,
      full_response: bestEntry?.full_response,
      search_volume: bestEntry?.search_volume,
      cpc: bestEntry?.cpc,
      persona: bestEntry?.persona,
      entries, // keep individual entries for per-model breakdown
    };
  });
  const failedPrompts = groupedPrompts.filter(d => !d.mentioned);
  const passedPrompts = groupedPrompts.filter(d => d.mentioned);

  // Persona analysis (Pro only)
  const personaAnalysis: PersonaAnalysis[] = [];
  if (!isFree) {
    const personaGroups: Record<string, PromptDetail[]> = {};
    for (const d of details) {
      if (d.persona) {
        if (!personaGroups[d.persona]) personaGroups[d.persona] = [];
        personaGroups[d.persona].push(d);
      }
    }
    for (const [persona, prompts] of Object.entries(personaGroups)) {
      const mentioned = prompts.filter(p => p.mentioned).length;
      personaAnalysis.push({
        persona, label: PERSONA_LABELS[persona] || persona,
        total: prompts.length, mentioned,
        coverage: prompts.length > 0 ? Math.round((mentioned / prompts.length) * 100) : 0,
        prompts,
      });
    }
  }

  // Build recommendations
  const recs: { icon: string; title: string; desc: string }[] = [];
  if (result.nudges && result.nudges.length > 0) {
    const icons = [
      "rect:3,3,18,18,2|M3 9h18|M9 21V9",
      "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|circle:9,7,4|M22 21v-2a4 4 0 0 1 3-3.87",
      "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
      "rect:4,4,16,16,2|circle:9,9,2|circle:15,9,2|M9 15h6",
      "circle:11,11,8|m21 21-4.3-4.3",
      "M3 3v18h18|M7 16l4-8 4 4 6-6",
    ];
    result.nudges.forEach((n, i) => {
      const title = typeof n === "string" ? n : n?.reason || n?.type || "Recommendation";
      recs.push({ icon: icons[i % icons.length], title, desc: "" });
    });
  }
  if (recs.length === 0) {
    if (score < 40) recs.push({ icon: "rect:4,4,16,16,2|circle:9,9,2|circle:15,9,2|M9 15h6", title: "Implement llms.txt and schema markup to make your brand machine-readable.", desc: "" });
    if (score < 60) recs.push({ icon: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", title: "Publish authoritative category content positioning you as the leader.", desc: "" });
    recs.push({ icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", title: "Build FAQ content matching how people ask AI assistants.", desc: "" });
    recs.push({ icon: "circle:11,11,8|m21 21-4.3-4.3", title: "Create seed citations on high-authority domains in your category.", desc: "" });
    recs.push({ icon: "M3 3v18h18|M7 16l4-8 4 4 6-6", title: "Add structured data (JSON-LD) for all products and services.", desc: "" });
  }

  const aioCategories = aio ? Object.entries(aio.categories || {}) : [];
  const aioRecCount = aioCategories.reduce((sum, [, cat]) => sum + (cat.recommendations?.length || 0), 0);

  return (
    <motion.div id="audit-top" className="mt-10 text-left w-full max-w-[1200px] mx-auto overflow-x-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* 1. Hero Score */}
      <HeroScore result={result} score={score} grade={grade} gradeClass={gradeClass} activeEngines={activeEngines} isFree={isFree} jobId={(result as Record<string, unknown>).jobId as string || (result as Record<string, unknown>).job_id as string} uniqueTested={promptGroupMap.size} uniqueMentioned={passedPrompts.length} />

      {/* AI Agent CTA */}
      {!isFree && (
        <div className="mb-6 p-5 rounded-2xl bg-[#0a1a1f] border border-[#2596be]/20">
          <div>
            <h3 className="text-[15px] font-semibold text-white mb-1">Let your AI agent handle the rest</h3>
            <p className="text-[13px] text-[#888] leading-relaxed mb-3">
              Your AI agent can read these results, draft GEO-optimized content, and publish fixes across 20+ platforms — automatically.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative group">
                <button
                  onClick={() => {
                    const jobId = (result as any)?.jobId || (result as any)?.job_id || '';
                    if (jobId) navigator.clipboard.writeText(jobId);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2596be]/10 border border-[#2596be]/20 text-[12px] text-[#2596be] hover:bg-[#2596be]/20 transition cursor-pointer font-medium"
                >
                  Copy Audit ID
                </button>
                <div className="absolute bottom-full left-0 mb-2 w-56 p-2.5 rounded-lg bg-[#111] border border-[#333] text-[11px] text-[#aaa] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  Give this Audit ID to your AI agent — it can read your results and draft fixes automatically. No special setup needed.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        {[
          { id: "section-analysis", label: "Analysis" },
          { id: "section-engines", label: "Engines" },
          { id: "section-prompts", label: "Prompts" },
          { id: "section-gaps", label: "Gaps" },
          ...(websiteHealth ? [{ id: "section-health", label: "Health" }] : []),
          ...(isFree ? [] : [{ id: "section-authority", label: "Authority" }]),
          ...(isFree ? [] : [{ id: "section-technical", label: "Technical" }]),
          { id: "section-fix", label: "Fixes" },
        ].map(nav => (
          <button key={nav.id} onClick={() => document.getElementById(nav.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="px-4 py-2 rounded-lg bg-[#111] border border-[#2a2a2a] text-[12px] text-[#aaa] font-medium hover:text-white hover:border-[#2596be] hover:bg-[#0f1a20] transition-colors">
            {nav.label}
          </button>
        ))}
      </div>

      {/* 1b. SEO vs GEO */}
      {seoScore && <SEOvsGEO seoScore={seoScore} geoScore={score} />}

      {/* 1c. Full Analysis Summary */}
      <div id="section-analysis" />
      <Section delay={0.12}>
        <SectionTitle info="A quick overview of your entire GEO audit — what AI engines know about you, where you're visible, and what needs work." icon="M3 3v18h18|M7 16l4-8 4 4 6-6">Full Analysis</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
          <div className="rounded-xl border border-[#191919] bg-[#0c0c0c] p-4 text-center">
            <p className="text-[24px] font-bold text-white">{promptGroupMap.size}</p>
            <p className="text-[11px] text-[#555] mt-1">Prompts Tested</p>
          </div>
          <div className="rounded-xl border border-[#191919] bg-[#0c0c0c] p-4 text-center">
            <p className={`text-[24px] font-bold ${scoreColor(Math.round((passedPrompts.length / Math.max(promptGroupMap.size, 1)) * 100))}`}>{passedPrompts.length}</p>
            <p className="text-[11px] text-[#555] mt-1">Mentioned In</p>
          </div>
          <div className="rounded-xl border border-[#191919] bg-[#0c0c0c] p-4 text-center">
            <p className="text-[24px] font-bold text-white">{activeEngines.length}</p>
            <p className="text-[11px] text-[#555] mt-1">AI Engines</p>
          </div>
        </div>
        {score < 40 && (
          <p className="text-[13px] text-[#EF4444]/80 mt-3">⚠ Critical: AI engines barely know your brand exists. Most users asking about your category won&apos;t hear about you.</p>
        )}
        {score >= 40 && score < 70 && (
          <p className="text-[13px] text-[#F59E0B]/80 mt-3">Your brand has some AI visibility but significant gaps remain in category and discovery queries.</p>
        )}
        {score >= 70 && (
          <p className="text-[13px] text-[#2596be]/80 mt-3">✓ Strong AI visibility — engines consistently recommend you across multiple query types.</p>
        )}
      </Section>

      {/* 2. Engine Breakdown */}
      <div id="section-engines" />
      <EngineBreakdown result={result} activeEngines={activeEngines} isFree={isFree} />

      {/* 3. Prompt Analysis */}
      <div id="section-prompts" />
      <PromptAnalysis passedPrompts={passedPrompts} failedPrompts={failedPrompts} activeEngines={activeEngines} isFree={isFree} brand={result.brand || "your brand"} groundedQueries={result.grounded_data?.queries} />

      {/* Knowledge vs Discoverability — Two Cards */}
      {result.grounded_data && (
        <KnowledgeVsDiscoverability result={result} />
      )}

      {/* ── 2-Column Grid: Category Gaps + Persona / Blind Spots ── */}
      <div id="section-gaps" className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      {/* 4. Category Gap Analysis */}
      {gapData.length > 0 ? (
        <Section delay={0.25}>
          <SectionTitle info="Shows how well AI engines cover different aspects of your brand — awareness, product knowledge, competitive positioning, and features. Low scores mean AI has gaps in understanding you." icon="M3 3v18h18|M7 12h10|M7 16h6|M7 8h14">Category Gap Analysis</SectionTitle>
          <p className="text-[13px] text-[#666] -mt-4 mb-7">How well AI engines cover different aspects of your brand.</p>
          <div className="space-y-6">
            {gapData.sort((a, b) => a.score - b.score).map((cat, i) => (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[15px] text-[#ddd] font-medium">{cat.label}</span>
                  <span className={`text-[15px] font-bold ${scoreColor(cat.score)}`}>{cat.score}%</span>
                </div>
                <div className="w-full h-3 bg-[#111] rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${barColor(cat.score)}`} initial={{ width: 0 }} animate={{ width: `${cat.score}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }} />
                </div>
                {cat.score < 50 && <p className="text-[12px] text-[#EF4444]/70 mt-2">⚠ Low coverage — AI rarely mentions you in {cat.label.toLowerCase()} queries</p>}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* 4b. Persona Analysis (Pro) */}
      {!isFree && personaAnalysis.length > 0 ? (
        <Section delay={0.27} pro>
          <SectionTitle pro icon="circle:12,8,4|M20 21a8 8 0 0 0-16 0">Persona Analysis</SectionTitle>
          <p className="text-[13px] text-[#666] -mt-4 mb-7">How different buyer personas perceive your brand in AI conversations.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {personaAnalysis.map((pa, i) => (
              <motion.div key={pa.persona} className={`rounded-xl border p-6 text-center ${scoreBg(pa.coverage)}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                <div className="text-[1.8rem] mb-2">{PERSONA_ICONS[pa.persona] || "👤"}</div>
                <p className="text-[14px] font-semibold text-white/90 mb-1">{pa.label}</p>
                <p className={`text-[2rem] font-bold ${scoreColor(pa.coverage)}`}>{pa.coverage}%</p>
                <p className="text-[12px] text-[#555] mt-1">{pa.mentioned}/{pa.total} prompts</p>
              </motion.div>
            ))}
          </div>
          <div className="space-y-4">
            {personaAnalysis.map((pa) => {
              const failed = pa.prompts.filter(p => !p.mentioned);
              if (failed.length === 0) return null;
              return (
                <div key={pa.persona} className="rounded-xl bg-black/40 border border-[#191919] p-5">
                  <p className="text-[13px] text-[#888] font-medium mb-3 flex items-center gap-2">{PERSONA_ICONS[pa.persona] || "👤"} {pa.label} — {failed.length} gap{failed.length !== 1 ? "s" : ""}</p>
                  <div className="space-y-2">
                    {failed.slice(0, 3).map((d, i) => (
                      <div key={i} className="flex items-start gap-3 text-[13px]"><span className="text-[#EF4444] shrink-0 mt-0.5">✗</span><span className="text-[#ccc]">&ldquo;{d.prompt}&rdquo;</span></div>
                    ))}
                    {failed.length > 3 && <p className="text-[12px] text-[#444] pl-6">+ {failed.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* Persona Analysis is Pro-only — no tease in free */}

      {/* 5. Blind Spots */}
      {(result.blind_spots && result.blind_spots.count > 0) ? (
        <Section delay={0.3} className="!border-[#EF4444]/15">
          <SectionTitle right={
            <span className="text-[12px] text-[#EF4444] font-medium bg-[#EF4444]/10 px-3 py-1.5 rounded-full">
              {result.blind_spots.count} found{result.blind_spots.critical_count ? ` · ${result.blind_spots.critical_count} critical` : ""}
            </span>
          } icon="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z|circle:12,12,3">Blind Spots</SectionTitle>
          <p className="text-[13px] text-[#666] -mt-4 mb-5">AI engines explicitly said they don&apos;t know about you here. These are your biggest opportunities.</p>
          {!isFree && result.blind_spots.by_type && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Brand Unknown", key: "brand_unknown", color: "text-[#EF4444] bg-[#EF4444]/10" },
                { label: "Product Unknown", key: "product_unknown", color: "text-[#F97316] bg-[#F97316]/10" },
                { label: "Category Unknown", key: "category_unknown", color: "text-[#F59E0B] bg-[#F59E0B]/10" },
                { label: "Outdated Info", key: "outdated_info", color: "text-blue-400 bg-blue-400/10" },
              ].map(({ label, key, color }) => (
                <div key={key} className={`rounded-xl p-4 text-center border border-[#191919] ${color.split(" ")[1]}`}>
                  <p className={`text-[22px] font-bold ${color.split(" ")[0]}`}>{result.blind_spots?.by_type?.[key] ?? 0}</p>
                  <p className="text-[11px] text-[#666] mt-1">{label}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {result.blind_spots.prompts.map((item, i) => {
              const prompt = typeof item === "string" ? item : item.prompt;
              const engine = typeof item === "string" ? undefined : item.engine;
              const severity = typeof item === "string" ? undefined : item.severity;
              return (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-[#EF4444]/[0.03] border border-[#EF4444]/10">
                  <span className="text-[#EF4444]/70 mt-0.5 shrink-0 text-[14px]">⊘</span>
                  <div className="flex-1">
                    <span className="text-[14px] text-[#ddd]">&ldquo;{prompt}&rdquo;</span>
                    <div className="flex items-center gap-2 mt-1">
                      {engine && <span className="text-[11px] text-[#444]">{ENGINE_META[engine]?.label || engine}</span>}
                      {severity && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${severity === "critical" ? "bg-[#EF4444]/10 text-[#EF4444]" : severity === "high" ? "bg-[#F97316]/10 text-[#F97316]" : "bg-[#F59E0B]/10 text-[#F59E0B]"}`}>{severity}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Competitor callout in blind spots */}
          {result.competitor_analysis?.competitors?.[0] && (
            <div className="mt-5 rounded-xl border border-[#191919] bg-[#0c0c0c] p-5">
              <p className="text-[13px] text-[#999]">
                While <span className="text-white font-medium">{result.brand}</span> was missed,{" "}
                <span className="text-white font-medium">{result.competitor_analysis.competitors[0].name}</span>{" "}
                was mentioned with <span className="text-white font-medium">{result.competitor_analysis.competitors[0].visibility ?? result.competitor_analysis.competitors[0].mentions}%</span> visibility across these same queries.
                {result.competitor_analysis.competitors.length > 1 && (
                  <>{" "}{result.competitor_analysis.competitors.slice(1, 3).map(c => c.name).join(" and ")} also appeared.</>
                )}
              </p>
            </div>
          )}
        </Section>
      ) : null}

      </div>{/* close 2-column grid */}

      {/* 6. Content Optimizer (Pro) */}
      {contentOptimizer && !isFree && (
        <Section delay={0.32} pro>
          <SectionTitle pro info="How well your website content is structured for AI consumption. Clear headings, concise answers, and structured data help AI engines extract and recommend your information." icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6">Content AI-Friendliness</SectionTitle>
          <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
            <ScoreRing score={contentOptimizer.score} size={140} strokeWidth={8} delay={0.35} />
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[24px] font-bold">Content Score</span>
                <span className={`text-[1rem] font-bold px-3 py-1 rounded-lg border ${GRADE_COLORS[contentOptimizer.grade?.charAt(0).toUpperCase()] || GRADE_COLORS.F}`}>{contentOptimizer.grade}</span>
              </div>
              <p className="text-[13px] text-[#666] mb-4">How well your content is structured for AI extraction and citation</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Headings", value: contentOptimizer.details.headings_score },
                  { label: "FAQ", value: contentOptimizer.details.faq_score },
                  { label: "Schema", value: contentOptimizer.details.schema_score },
                  { label: "Citations", value: contentOptimizer.details.citation_worthiness },
                  { label: "Entities", value: contentOptimizer.details.entity_density },
                ].map(({ label, value }) => (
                  <div key={label} className={`rounded-lg p-3 text-center border ${scoreBg(value)}`}>
                    <p className={`text-[18px] font-bold ${scoreColor(value)}`}>{value}</p>
                    <p className="text-[10px] text-[#666] mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {contentOptimizer.recommendations.length > 0 && (
            <div className="space-y-3">
              <p className="text-[13px] text-[#888] font-medium mb-3">Recommendations</p>
              {contentOptimizer.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-black/40 border border-[#191919]">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${rec.priority === "high" ? "bg-[#EF4444]/10 text-[#EF4444]" : rec.priority === "medium" ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "bg-[#2596be]/10 text-[#2596be]"}`}>{rec.priority}</span>
                  <div>
                    <p className="text-[13px] text-[#ddd] font-medium">{rec.issue}</p>
                    <p className="text-[12px] text-[#666] mt-1">{rec.fix}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Content optimizer tease for free */}
      {isFree && (
        <Section delay={0.32}>
          <ProLock title="Content AI-Friendliness Score" subtitle="See how well your page content is structured for AI extraction, citations, and recommendations">
            <div className="flex items-center gap-8 p-4">
              <div className="w-[140px] h-[140px] rounded-full bg-[#111] border border-[#222]" />
              <div className="space-y-3 flex-1">
                <div className="h-4 bg-[#111] rounded w-3/4" /><div className="h-4 bg-[#111] rounded w-1/2" /><div className="h-4 bg-[#111] rounded w-2/3" />
              </div>
            </div>
          </ProLock>
        </Section>
      )}

      {/* 7. AIO Site Analysis */}
      {aio && aio.overall_score != null && (
        <Section delay={0.35}>
          <SectionTitle right={isFree && aioRecCount > 0 ? <span className="text-[12px] text-[#555]">{aioRecCount} recommendations locked</span> : undefined} icon="circle:11,11,8|m21 21-4.3-4.3">On-Page AI Optimization <span className="text-[11px] text-cyan-400/60 font-normal">(SEO)</span></SectionTitle>
          <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
            <ScoreRing score={aio.overall_score} size={140} strokeWidth={8} delay={0.35} />
            <div className="text-center sm:text-left">
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <span className="text-[24px] font-bold">AIO Score</span>
                <span className={`text-[1rem] font-bold px-3 py-1 rounded-lg border ${GRADE_COLORS[aio.grade?.charAt(0).toUpperCase()] || GRADE_COLORS.F}`}>{aio.grade}</span>
              </div>
              <p className="text-[13px] text-[#666] mt-2">How well your site is technically optimized for AI crawlers</p>
              {aio.schemas_found && aio.schemas_found.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {aio.schemas_found.map((s, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-[#2596be]/10 text-[#2596be]/80 border border-[#2596be]/20">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {aioCategories.map(([key, cat], i) => {
              const meta = AIO_LABELS[key] || { label: key, icon: "M4 4h16v16H4z|M9 9h6|M9 13h4" };
              return (
                <motion.div key={key} className="rounded-xl border border-[#191919] bg-black/40 overflow-hidden" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.04 }}>
                  <div className="flex flex-col lg:flex-row">
                    <div className="lg:w-[180px] p-5 flex flex-col items-center justify-center lg:border-r border-[#191919] shrink-0">
                      <ScoreRing score={cat.score} size={80} strokeWidth={5} delay={0.45 + i * 0.04} />
                      <p className="text-[12px] font-medium text-[#999] mt-2.5 text-center flex items-center justify-center gap-1.5"><InlineIcon paths={meta.icon} size={14} /> {meta.label}</p>
                    </div>
                    <div className="flex-1 p-5">
                      {cat.details && cat.details.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[11px] uppercase tracking-wider text-[#444] font-medium mb-2.5">What&apos;s Working</p>
                          <div className="space-y-2">
                            {cat.details.map((d, j) => (
                              <p key={j} className="text-[13px] text-[#888] flex items-start gap-2.5"><span className="text-[#2596be] shrink-0 mt-0.5">•</span><span>{d}</span></p>
                            ))}
                          </div>
                        </div>
                      )}
                      {cat.recommendations && cat.recommendations.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-[#444] font-medium mb-2.5 flex items-center gap-2">How to Improve {isFree && <ProBadge />}</p>
                          {isFree ? (
                            <div className="relative">
                              <div className="absolute inset-0 backdrop-blur-[4px] bg-black/50 rounded-lg flex items-center justify-center z-10">
                                <a href="/pricing" className="text-[11px] text-[#999] hover:text-white transition-colors flex items-center gap-1.5">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                  {cat.recommendations.length} fix{cat.recommendations.length !== 1 ? "es" : ""} available
                                </a>
                              </div>
                              <div className="blur-[3px] select-none">
                                {cat.recommendations.slice(0, 2).map((r, j) => (
                                  <p key={j} className="text-[13px] text-[#666] flex items-start gap-2.5 mb-2"><span className="text-blue-400 shrink-0 mt-0.5">→</span><span>{r}</span></p>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {cat.recommendations.map((r, j) => (
                                <p key={j} className="text-[13px] text-[#777] flex items-start gap-2.5"><span className="text-blue-400 shrink-0 mt-0.5">→</span><span>{r}</span></p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 8. AI Crawler Access */}
      {technical?.robots && (
        <Section delay={0.36}>
          <SectionTitle right={
            technical.robots.blocked_count > 0
              ? <span className="text-[12px] text-[#EF4444] font-medium bg-[#EF4444]/10 px-3 py-1.5 rounded-full">{technical.robots.blocked_count} blocked</span>
              : technical.robots.exists ? <span className="text-[12px] text-[#2596be] font-medium bg-[#2596be]/10 px-3 py-1.5 rounded-full">✓ All clear</span> : null
          } icon="rect:4,4,16,16,2|M9 9h.01|M15 9h.01|M9 15h6">AI Crawler Access <span className="text-[11px] text-cyan-400/60 font-normal">(SEO)</span></SectionTitle>
          <div className="mb-5 p-5 rounded-xl bg-black/40 border border-[#191919]">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[14px] font-semibold ${technical.robots.exists ? "text-[#2596be]" : "text-[#F59E0B]"}`}>robots.txt {technical.robots.exists ? "Found" : "Not Found"}</span>
              {technical.robots.has_sitemap && <span className="text-[11px] text-[#555] px-2.5 py-1 rounded-full border border-[#222]">Sitemap ✓</span>}
            </div>
            <p className="text-[13px] text-[#888]">{technical.robots.verdict}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
            {technical.robots.crawlers.map((c) => (
              <div key={c.name} className={`flex items-center gap-3 p-3.5 rounded-xl border text-[12px] ${c.status === "blocked" ? "border-[#EF4444]/20 bg-[#EF4444]/5" : c.status === "allowed" ? "border-[#2596be]/20 bg-[#2596be]/5" : "border-[#191919] bg-[#0c0c0c]"}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.status === "blocked" ? "bg-[#EF4444]" : c.status === "allowed" ? "bg-[#2596be]" : "bg-[#444]"}`} />
                <div><div className="text-white/90 font-medium">{c.name}</div><div className="text-[10px] text-[#555]">{c.owner}</div></div>
              </div>
            ))}
          </div>
          {technical.llms_txt && (
            <div className={`p-5 rounded-xl border ${technical.llms_txt.exists ? "border-[#2596be]/20 bg-[#2596be]/5" : "border-[#F59E0B]/20 bg-[#F59E0B]/5"}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-[14px] font-semibold ${technical.llms_txt.exists ? "text-[#2596be]" : "text-[#F59E0B]"}`}>llms.txt {technical.llms_txt.exists ? "Found" : "Not Found"}</span>
                {technical.llms_txt.exists && technical.llms_txt.link_count > 0 && <span className="text-[11px] text-[#555] px-2.5 py-1 rounded-full border border-[#222]">{technical.llms_txt.link_count} links</span>}
              </div>
              <p className="text-[13px] text-[#888]">{technical.llms_txt.verdict}</p>
            </div>
          )}
        </Section>
      )}

      {/* 9. Technical Health */}
      <div id="section-technical" />
      {technical?.lighthouse?.available && (
        <Section delay={0.37}>
          <SectionTitle info="Lighthouse scores measuring your website's technical performance. These affect traditional SEO but don't directly impact your AI visibility score." icon="M13 2L3 14h9l-1 8 10-12h-9l1-8">Website Technical Health</SectionTitle>
          <p className="text-[13px] text-[#555] -mt-4 mb-5">Traditional web performance metrics. These don&apos;t directly affect your AI visibility score but indicate technical readiness for search engines.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {[
              { label: "Performance", value: technical.lighthouse.performance_score, icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8" },
              { label: "SEO", value: technical.lighthouse.seo_score, icon: "circle:11,11,8|m21 21-4.3-4.3" },
              { label: "Accessibility", value: technical.lighthouse.accessibility_score, icon: "circle:12,12,10|M12 8v4|M12 16h.01" },
              { label: "Best Practices", value: technical.lighthouse.best_practices_score, icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14|M22 4L12 14.01l-3-3" },
            ].map((metric) => (
              <div key={metric.label} className="p-5 rounded-xl bg-black/40 border border-[#191919] text-center">
                <div className="text-[12px] text-[#555] mb-2 flex items-center gap-1.5"><InlineIcon paths={metric.icon} size={12} /> {metric.label}</div>
                <div className={`text-[2rem] font-bold ${metric.value != null ? scoreColor(metric.value) : "text-[#333]"}`}>{metric.value != null ? metric.value : "—"}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5 mb-4">
            <span className={`text-[12px] px-3 py-1.5 rounded-full border ${technical.lighthouse.https ? "border-[#2596be]/20 bg-[#2596be]/5 text-[#2596be]" : "border-[#EF4444]/20 bg-[#EF4444]/5 text-[#EF4444]"}`}>{technical.lighthouse.https ? "HTTPS Secured" : "No HTTPS"}</span>
            <span className={`text-[12px] px-3 py-1.5 rounded-full border ${technical.lighthouse.mobile_friendly ? "border-[#2596be]/20 bg-[#2596be]/5 text-[#2596be]" : "border-[#F59E0B]/20 bg-[#F59E0B]/5 text-[#F59E0B]"}`}>{technical.lighthouse.mobile_friendly ? "📱 Mobile-Friendly" : "📱 Not Mobile-Optimized"}</span>
            {technical.lighthouse.load_time_ms != null && <span className="text-[12px] px-3 py-1.5 rounded-full border border-[#222] text-[#888]">⏱️ {(technical.lighthouse.load_time_ms / 1000).toFixed(1)}s load time</span>}
          </div>
          <p className="text-[13px] text-[#888]">{technical.lighthouse.verdict}</p>
        </Section>
      )}

      {/* ── 2-Column Grid: Authority + Search Demand ── */}
      {/* Website Health */}
      <div id="section-health" />
      {websiteHealth && <WebsiteHealthSection data={websiteHealth as unknown as WebsiteHealthData} />}

      {/* ── 2-Column Grid: Authority + Search Demand ── */}
      <div id="section-authority" className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      {technical?.social_proof && (
        <Section delay={0.38}>
          <SectionTitle right={
            <span className={`text-[12px] font-medium px-3 py-1.5 rounded-full ${technical.social_proof.trust_score >= 70 ? "text-[#2596be] bg-[#2596be]/10" : technical.social_proof.trust_score >= 30 ? "text-[#F59E0B] bg-[#F59E0B]/10" : "text-[#EF4444] bg-[#EF4444]/10"}`}>Trust: {technical.social_proof.trust_score}/100</span>
          } info="Your presence on authoritative platforms (Wikipedia, GitHub, Crunchbase, etc.). AI engines weigh these as trust signals when deciding whether to recommend a brand." icon="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16">Authority Sources <span className="text-[11px] text-cyan-400/60 font-normal">(SEO)</span></SectionTitle>
          <p className="text-[13px] text-[#888] -mt-4 mb-6">AI engines heavily weight these sources when deciding which brands to recommend.</p>

          {/* Universal sources */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {(technical.social_proof.sources || []).filter((s: { category: string }) => s.category === "universal").map((source: { name: string; icon: string; data: { exists: boolean; url?: string }; weight: number }) => (
              <div key={source.name} className={`p-4 rounded-xl border text-center ${source.data.exists ? "border-[#2596be]/20 bg-[#2596be]/5" : "border-[#191919] bg-[#0c0c0c]"}`}>
                <div className="w-8 h-8 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center mb-1.5"><InlineIcon paths={SOURCE_ICON_MAP[source.name] || "circle:12,12,10"} size={16} /></div>
                <div className="text-[13px] text-white/90 font-medium">{source.name}</div>
                <div className={`text-[11px] mt-1 font-medium ${source.data.exists ? "text-[#2596be]" : "text-[#555]"}`}>{source.data.exists ? "✓ Found" : "✗ Not detected"}</div>
              </div>
            ))}
          </div>

          {/* Industry-specific sources (if any) */}
          {(technical.social_proof.sources || []).some((s: { category: string }) => s.category === "industry") && (
            <div className="mt-4 mb-4">
              <p className="text-[11px] text-cyan-400/60 uppercase tracking-widest font-medium mb-3">Industry-Specific Presence</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(technical.social_proof.sources || []).filter((s: { category: string }) => s.category === "industry").map((source: { name: string; icon: string; data: { exists: boolean; url?: string }; weight: number }) => (
                  <div key={source.name} className={`p-4 rounded-xl border text-center ${source.data.exists ? "border-cyan-400/20 bg-cyan-400/5" : "border-[#191919] bg-[#0c0c0c]"}`}>
                    <div className="w-8 h-8 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center mb-1.5"><InlineIcon paths={SOURCE_ICON_MAP[source.name] || "circle:12,12,10"} size={16} /></div>
                    <div className="text-[13px] text-white/90 font-medium">{source.name}</div>
                    <div className={`text-[11px] mt-1 font-medium ${source.data.exists ? "text-cyan-400" : "text-[#555]"}`}>{source.data.exists ? "✓ Found" : "✗ Not detected"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score breakdown */}
          <div className="flex items-center gap-4 mt-4 mb-3">
            <span className="text-[12px] text-[#666]">Universal: {technical.social_proof.universal_score || 0}/85</span>
            {(technical.social_proof.industry_bonus || 0) > 0 && (
              <span className="text-[12px] text-cyan-400/80">+{technical.social_proof.industry_bonus} industry bonus</span>
            )}
          </div>

          <p className="text-[13px] text-[#888]">{technical.social_proof.verdict}</p>
        </Section>
      )}

      {/* 11. Search Demand */}
      {technical?.search_insights && (
        <Section delay={0.39}>
          <SectionTitle right={
            <span className={`text-[12px] font-medium px-3 py-1.5 rounded-full ${technical.search_insights.demand_signal === "high" ? "text-[#2596be] bg-[#2596be]/10" : technical.search_insights.demand_signal === "medium" ? "text-[#F59E0B] bg-[#F59E0B]/10" : technical.search_insights.demand_signal === "low" ? "text-[#F97316] bg-[#F97316]/10" : "text-[#EF4444] bg-[#EF4444]/10"}`}>
              {technical.search_insights.demand_signal} demand
            </span>
          } info="Google Autocomplete data showing how much people search for your brand and industry. High demand means people are actively looking — AI engines should be recommending you in these searches." icon="M3 3v18h18|M7 16l4-8 4 4 6-6">Search Demand <span className="text-[11px] text-cyan-400/60 font-normal">(SEO)</span></SectionTitle>
          <p className="text-[13px] text-[#888] -mt-4 mb-6">{technical.search_insights.demand_message}</p>
          {technical.search_insights.people_also_ask.length > 0 && (
            <div className="mb-6">
              <div className="text-[13px] text-[#666] font-medium mb-3">People Also Ask</div>
              <div className="space-y-2">
                {technical.search_insights.people_also_ask.slice(0, 8).map((paa, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-black/40 border border-[#191919] text-[13px] text-[#ccc]"><span className="text-[#555] shrink-0">❓</span>{paa.question}</div>
                ))}
              </div>
            </div>
          )}
          {technical.search_insights.brand_queries.some(q => q.suggestions.length > 0) && (
            <div className="mb-6">
              <div className="text-[13px] text-[#666] font-medium mb-3">What Google suggests for your brand</div>
              <div className="flex flex-wrap gap-2">
                {technical.search_insights.brand_queries.flatMap(q => q.suggestions).slice(0, 15).map((s, i) => (
                  <span key={i} className="text-[12px] px-3 py-1.5 rounded-full bg-[#0c0c0c] border border-[#191919] text-[#999] hover:text-white hover:border-[#333] transition-colors">{s}</span>
                ))}
              </div>
            </div>
          )}
          {technical.search_insights.industry_queries.some(q => q.suggestions.length > 0) && (
            <div>
              <div className="text-[13px] text-[#666] font-medium mb-3">Industry queries you should appear in</div>
              <div className="flex flex-wrap gap-2">
                {technical.search_insights.industry_queries.flatMap(q => q.suggestions).slice(0, 15).map((s, i) => (
                  <span key={i} className="text-[12px] px-3 py-1.5 rounded-full bg-blue-400/5 border border-blue-400/15 text-blue-400/80 hover:text-blue-300 hover:border-blue-400/30 transition-colors">{s}</span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      </div>{/* close authority+search 2-col grid */}

      {/* Platform Presence removed — duplicates Authority Sources and wastes API credits */}

      {/* 12. Citations */}
      {result.citations?.top_sources && result.citations.top_sources.length > 0 && (
        <Section delay={0.4}>
          <SectionTitle right={
            result.citations.brand_cited
              ? <span className="text-[12px] text-[#2596be] bg-[#2596be]/10 px-3 py-1.5 rounded-full font-medium">✓ Your domain cited</span>
              : <span className="text-[12px] text-[#F97316] bg-[#F97316]/10 px-3 py-1.5 rounded-full font-medium">⚠ Your domain not cited</span>
          } info="Domains that AI engines link to when answering queries in your space. If your domain appears here, AI is actively directing users to your site. These are the websites AI trusts as authorities in your category.">Citation Sources</SectionTitle>
          <p className="text-[13px] text-[#666] -mt-4 mb-5">Domains AI engines reference when answering queries in your space</p>
          <div className="border border-[#191919] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_80px_80px] text-[11px] uppercase tracking-wider text-[#444] px-5 py-3 bg-[#050505] border-b border-[#191919] font-medium">
              <span>#</span><span>Domain</span><span className="text-right">Type</span><span className="text-right">Cited</span>
            </div>
            {result.citations.top_sources.slice(0, isFree ? 3 : undefined).map((src, i) => (
              <div key={i} className="grid grid-cols-[40px_1fr_80px_80px] text-[13px] px-5 py-3.5 border-b border-[#0f0f0f] last:border-0 hover:bg-white/[0.02] transition-colors">
                <span className="text-[#444]">{i + 1}</span>
                <span className="text-[#ccc] font-mono text-[12px]">{src.domain}</span>
                <span className="text-right">{src.type && <span className={`text-[10px] px-2 py-0.5 rounded-full ${src.type === "own" ? "bg-green-500/10 text-green-400" : src.type === "authority" ? "bg-[#2596be]/10 text-[#2596be]" : "bg-[#111] text-[#555]"}`}>{src.type === "own" ? "your site" : src.type}</span>}</span>
                <span className="text-right text-[#555]">{src.count}×</span>
              </div>
            ))}
            {isFree && result.citations.top_sources.length > 3 && (
              <div className="px-5 py-4 bg-[#050505] text-center border-t border-[#191919]">
                <a href="/pricing" className="text-[12px] text-[#666] hover:text-white transition-colors flex items-center justify-center gap-2">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  + {result.citations.top_sources.length - 3} more sources · Unlock with Pro
                </a>
              </div>
            )}
          </div>
          {!isFree && result.citations.citation_gap && result.citations.citation_gap.length > 0 && (
            <div className="mt-5 p-5 rounded-xl bg-[#F97316]/[0.03] border border-[#F97316]/15">
              <p className="text-[13px] text-[#F97316] font-semibold mb-3">Citation Gap — Domains AI cites in your space but not your domain</p>
              <div className="space-y-2">
                {result.citations.citation_gap.map((gap, i) => (
                  <div key={i} className="flex items-center justify-between text-[13px]"><span className="text-[#ccc] font-mono text-[12px]">{gap.domain}</span><span className="text-[#555]">{gap.count}× cited</span></div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* 13. Competitor Ranking */}
      {isFree && (
        <Section delay={0.45}>
          <ProLock title="Competitor Benchmarking" subtitle={`See how ${result.brand || "your brand"} ranks against competitors across all 7 AI engines`}>
            <div>
              <SectionTitle icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|circle:9,7,4">Competitor Ranking</SectionTitle>
              <div className="border border-[#191919] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_80px_80px] text-[11px] uppercase tracking-wider text-[#444] px-5 py-3 bg-[#050505] border-b border-[#191919]">
                  <span>#</span><span>Brand</span><span className="text-right">Mentions</span><span className="text-right">Visibility</span>
                </div>
                <div className="grid grid-cols-[40px_1fr_80px_80px] text-[13px] px-5 py-3.5 border-b border-[#0f0f0f]">
                  <span className="text-[#444]">—</span><span className="text-white font-medium">{result.brand} (you)</span><span className="text-right text-[#999]">—</span><span className="text-right text-[#999]">—%</span>
                </div>
                {["Competitor A", "Competitor B", "Competitor C"].map((c, i) => (
                  <div key={i} className="grid grid-cols-[40px_1fr_80px_80px] text-[13px] px-5 py-3.5 border-b border-[#0f0f0f] last:border-0">
                    <span className="text-[#444]">{i + 1}</span><span className="text-[#ccc]">{c}</span><span className="text-right text-[#555]">—</span><span className="text-right text-[#555]">—%</span>
                  </div>
                ))}
              </div>
            </div>
          </ProLock>
        </Section>
      )}
      {/* Emerging category — no competitors found */}
      {!isFree && result.competitor_analysis && (!result.competitor_analysis.competitors || result.competitor_analysis.competitors.length === 0) && (
        <Section delay={0.45} pro>
          <SectionTitle pro info="Analysis of your competitive position in AI engine knowledge. When no direct competitors are found, it means your category is emerging." icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|circle:9,7,4|M22 21v-2a4 4 0 0 1-3-3.87|M16 3.13a4 4 0 0 1 0 7.75">Competitive Landscape</SectionTitle>
          <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-6">
            <p className="text-[14px] text-cyan-400 font-semibold mb-2">🌱 Emerging Category</p>
            <p className="text-[13px] text-[#999] leading-relaxed mb-4">No direct competitors found in AI engine knowledge. This means your category is emerging — AI engines don&apos;t have established players to compare you against.</p>
            <p className="text-[13px] text-[#ccc] leading-relaxed mb-4">Your priority is <span className="text-white font-medium">category creation</span>: making AI engines understand this market exists and that you&apos;re the leader.</p>
            <div className="border-t border-cyan-400/10 pt-4 mt-2">
              <p className="text-[12px] text-[#666]">Content fixes can generate material specifically designed to establish your category in AI knowledge bases — seed citations, FAQ schema, and authoritative content that teaches AI engines about your space.</p>
            </div>
          </div>
        </Section>
      )}
      {!isFree && result.competitor_analysis?.competitors && result.competitor_analysis.competitors.length > 0 && (
        <Section delay={0.45} pro>
          <SectionTitle pro info="How often AI engines mention your brand vs competitors when answering queries in your space. Higher share of voice = more AI recommendations." icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|circle:9,7,4">Competitor Ranking</SectionTitle>
          <div className="border border-[#191919] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_80px_80px] text-[11px] uppercase tracking-wider text-[#444] px-5 py-3 bg-[#050505] border-b border-[#191919] font-medium">
              <span>#</span><span>Brand</span><span className="text-right">Mentions</span><span className="text-right">Visibility</span>
            </div>
            <div className="grid grid-cols-[40px_1fr_80px_80px] text-[13px] px-5 py-3.5 border-b border-[#0f0f0f] bg-white/[0.02]">
              <span className="text-[#444]">—</span><span className="text-white font-medium">{result.brand} <span className="text-[11px] text-[#444]">(you)</span></span><span className="text-right text-[#999]">{result.competitor_analysis.your_mentions ?? "—"}</span><span className="text-right text-[#999]">{result.competitor_analysis.share_of_voice ?? "—"}%</span>
            </div>
            {result.competitor_analysis.competitors.map((c, i) => (
              <div key={i} className="grid grid-cols-[40px_1fr_80px_80px] text-[13px] px-5 py-3.5 border-b border-[#0f0f0f] last:border-0">
                <span className="text-[#444]">{i + 1}</span><span className="text-[#ccc]">{c.name}</span><span className="text-right text-[#555]">{c.mentions}</span><span className="text-right text-[#555]">{c.visibility ?? "—"}%</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 14. Trend History */}
      {isFree && (
        <Section delay={0.47}>
          <ProLock title="Trend Tracking" subtitle="Track your AI visibility score over time. See if you're improving or declining.">
            <div>
              <SectionTitle icon="circle:12,12,10|M12 6v6l4 2">Score History</SectionTitle>
              <div className="h-[140px] flex items-end gap-2.5 px-4">
                {[35, 42, 38, 50, 55, 48, 62, 58].map((v, i) => (<div key={i} className="flex-1 bg-[#1a1a1a] rounded-t" style={{ height: `${v}%` }} />))}
              </div>
            </div>
          </ProLock>
        </Section>
      )}
      {!isFree && result.trend && result.trend.history && result.trend.history.length > 1 && (
        <Section delay={0.47} pro>
          <SectionTitle pro icon="circle:12,12,10|M12 6v6l4 2">Score History</SectionTitle>
          <div className="h-[160px] flex items-end gap-2 px-2">
            {result.trend.history.map((entry, i) => {
              const maxScore = Math.max(...result.trend!.history!.map(h => h.score), 100);
              const height = (entry.score / maxScore) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#666]">{entry.score}</span>
                  <motion.div className={`w-full rounded-t ${barColor(entry.score)}`} initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }} style={{ minHeight: 4 }} />
                  <span className="text-[9px] text-[#444] mt-1">{entry.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
          {result.trend.delta != null && result.trend.status !== "new" && (
            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-[#191919]">
              <span className={`text-[1.5rem] font-bold ${result.trend.delta > 0 ? "text-[#2596be]" : result.trend.delta < 0 ? "text-[#EF4444]" : "text-[#555]"}`}>{result.trend.delta > 0 ? "▲" : result.trend.delta < 0 ? "▼" : "—"} {Math.abs(result.trend.delta)}</span>
              <span className="text-[13px] text-[#666]">{result.trend.message}</span>
            </div>
          )}
        </Section>
      )}
      {!isFree && result.trend && result.trend.delta != null && result.trend.status !== "new" && (!result.trend.history || result.trend.history.length <= 1) && (
        <Section delay={0.47}><SectionTitle icon="M22 12h-4l-3 9L9 3l-3 9H2">Trend</SectionTitle>
          <div className="flex items-center gap-3">
            <span className={`text-[1.5rem] font-bold ${result.trend.delta > 0 ? "text-[#2596be]" : result.trend.delta < 0 ? "text-[#EF4444]" : "text-[#555]"}`}>{result.trend.delta > 0 ? "▲" : result.trend.delta < 0 ? "▼" : "—"} {Math.abs(result.trend.delta)}</span>
            <span className="text-[13px] text-[#666]">{result.trend.message}</span>
          </div>
        </Section>
      )}

      {/* 15. Recommendations */}
      <Section delay={0.5}>
        {isFree ? (
          <ProLock title="How to Fix It" subtitle={`${recs.length} actionable recommendations tailored to ${result.brand || "your brand"}`} cta="Unlock with Pro — $0.99">
            <div>
              <SectionTitle icon="M9 11l3 3L22 4|M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11">Recommendations</SectionTitle>
              <div className="space-y-3">
                {recs.slice(0, 4).map((rec, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 rounded-xl bg-black border border-[#191919]"><InlineIcon paths={rec.icon} size={20} /><p className="text-[14px]">{rec.title}</p></div>
                ))}
              </div>
            </div>
          </ProLock>
        ) : (
          <>
            <SectionTitle icon="M9 11l3 3L22 4|M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11">Recommendations</SectionTitle>
            <div className="space-y-3">
              {recs.map((rec, i) => (
                <div key={i} className="flex items-start gap-4 p-5 rounded-xl bg-black/40 border border-[#191919] hover:border-[#333] transition-colors">
                  <InlineIcon paths={rec.icon} size={20} />
                  <div><p className="text-[14px] font-medium">{rec.title}</p>{rec.desc && <p className="text-[12px] text-[#666] mt-1">{rec.desc}</p>}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* 15b. Full Report (collapsible) */}
      {!isFree && details.length > 0 && (
        <FullReport details={details} result={result} />
      )}

      {/* 16. Score Summary + GEO Skill CTA */}
      <div id="section-fix" />
      <Section delay={0.6}>
        {/* Actionable score summary */}
        {score < 75 && (
          <div className={`rounded-xl border p-6 mb-8 ${score < 40 ? "border-[#EF4444]/20 bg-[#EF4444]/5" : "border-[#F97316]/20 bg-[#F97316]/5"}`}>
            <p className={`text-[15px] font-bold mb-2 ${score < 40 ? "text-[#EF4444]" : "text-[#F97316]"}`}>
              Score is {score}/100. {score < 40 ? "Critical" : "Needs improvement"} — check your content fixes to start optimizing.
            </p>
            {/* GEO Skill button removed for mobile optimization */}
          </div>
        )}

        {/* Schedule re-audit */}
        <ScheduleReaudit brand={result.brand} score={score} />

        {/* CTA — different for free vs pro */}
        {isFree ? (
          <div className="text-center py-4">
            <p className="text-[26px] font-bold mb-3">Ready to fix it?</p>
            <p className="text-[14px] text-[#666] mb-8 max-w-[500px] mx-auto">Upgrade to Pro Audit — get AI-generated content fixes that show exactly what to fix and where to post.</p>
            <div className="flex justify-center mb-8">
              <div className="rounded-2xl border border-white/20 bg-black/40 p-7 w-full max-w-[360px] text-center ring-1 ring-white/10">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-[#555] line-through text-[15px]">$4.95</span>
                  <p className="text-[22px] font-bold">$0.99</p>
                  <span className="text-[12px] text-[#666]">USDC</span>
                </div>
                <p className="text-[11px] text-[#2596be] mb-4">80% Launch Discount</p>
                <ul className="text-[12px] text-[#555] space-y-2 text-left mb-5">
                  <li className="flex gap-2.5"><span className="text-[#2596be]">✓</span> All 7 AI engines + competitor ranking</li>
                  <li className="flex gap-2.5"><span className="text-[#2596be]">✓</span> AI-generated content fixes (approve/reject/edit)</li>
                  <li className="flex gap-2.5"><span className="text-[#2596be]">✓</span> 4-week playbook + content + seed citations</li>
                  <li className="flex gap-2.5"><span className="text-[#2596be]">✓</span> llms.txt + JSON-LD + schema + blog post</li>
                </ul>
                <a href="/dashboard" className="block py-2.5 rounded-xl bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors">Upgrade to Pro →</a>
              </div>
            </div>
            <p className="text-[12px] text-[#444]">Pro Audit includes content fixes · No subscriptions</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-[26px] font-bold mb-3">Your content fixes are ready</p>
            <p className="text-[14px] text-[#666] mb-6 max-w-[500px] mx-auto">Download the skill file. Your agent reads it, learns what to fix, where to post, and executes the 4-week plan.</p>
            {/* Download GEO Skill button removed for mobile optimization */}
            <p className="text-[12px] text-[#444] mt-4">SKILL.md + content files + playbook · Re-audit to regenerate</p>
          </div>
        )}
      </Section>

      {/* Share for coupon — at the bottom after all sections */}
      <ShareForDiscount
        brand={result.brand || ""}
        score={score}
        grade={result.grade || "F"}
        industry={result.industry}
        jobId={(result as Record<string, unknown>).jobId as string || (result as Record<string, unknown>).job_id as string}
        engines={result.engines}
      />

      {/* Disclaimer + expiration */}
      <p className="text-[11px] text-[#444] text-center my-4">
        Results may slightly vary between audits as LLMs are non-deterministic. Scores reflect a snapshot of AI engine knowledge at the time of testing.
        {isFree
          ? " This report is available for 7 days. Upgrade to Pro for 90-day retention."
          : " This Pro report is available for 90 days."}
      </p>

      {/* Actions */}
      <motion.div className="flex flex-col sm:flex-row gap-3 justify-center mt-2 mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        {onReset && (
          <button onClick={onReset} className="px-8 py-3.5 rounded-xl border border-[#222] text-[14px] text-[#666] font-medium hover:border-[#444] hover:text-white transition-colors">Run another audit</button>
        )}
      </motion.div>

      {/* Jump to top */}
      <div className="flex justify-center mb-10">
        <button
          onClick={() => document.getElementById("audit-top")?.scrollIntoView({ behavior: "smooth" })}
          className="px-5 py-2.5 rounded-xl border border-[#191919] text-[13px] text-[#555] hover:text-white hover:border-[#333] transition-colors"
        >
          ↑ Back to top
        </button>
      </div>
    </motion.div>
  );
}

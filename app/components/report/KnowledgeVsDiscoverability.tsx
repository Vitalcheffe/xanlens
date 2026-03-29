"use client";

import React from "react";
import type { AuditReportProps } from "@/app/types";
import { Section, SectionTitle, scoreColor } from "./primitives";

export function KnowledgeVsDiscoverability({ result }: { result: AuditReportProps["result"] }) {
  const [groundedExpandedIdx, setGroundedExpandedIdx] = React.useState<Set<number>>(new Set());
  const [knowledgeExpanded, setKnowledgeExpanded] = React.useState(false);
  const [showAllGrounded, setShowAllGrounded] = React.useState(false);
  const grounded = result.grounded_data;
  if (!grounded) return null;

  const knowledgeScore = result.knowledge_score ?? 0;
  const discoverabilityScore = result.discoverability_score ?? 0;
  const gap = Math.abs(discoverabilityScore - knowledgeScore);

  const toggleGrounded = (i: number) => {
    setGroundedExpandedIdx(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const PREVIEW_COUNT = 3;
  const queries = grounded.queries || [];

  return (
    <Section delay={0.17}>
      <SectionTitle icon="circle:11,11,8|m21 21-4.3-4.3|M3 3v18h18">Knowledge vs Discoverability</SectionTitle>

      {/* Explanation banner */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 -mt-3 mb-6">
        <p className="text-[13px] text-[#999] leading-relaxed">
          <span className="text-[#F59E0B] font-semibold">Knowledge</span> — what AI returns via API, from training data alone.
          {" "}<span className="text-[#F59E0B]">This is what AI agents get</span> when they query ChatGPT, Claude, or Grok APIs about your brand.
        </p>
        <p className="text-[13px] text-[#999] leading-relaxed mt-2">
          <span className="text-[#2596be] font-semibold">Discoverability</span> — what AI finds with real-time web search enabled.
          {" "}<span className="text-[#2596be]">This is what human users get</span> when they ask ChatGPT, Gemini, or Perplexity in the browser — these UIs search the web before answering.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Knowledge Card */}
        <div className="rounded-xl border border-[#1a1a1a] bg-black/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span className="text-[13px] font-semibold text-white/90">Knowledge Score</span>
            </div>
            <span className={`text-[14px] font-bold ${scoreColor(knowledgeScore)}`}>{knowledgeScore}/100</span>
          </div>
          <p className="text-[11px] text-[#555] mb-4">API responses — training data only, no web search</p>

          {(result.engines?.gemini?.sample_snippets?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {(result.engines?.gemini?.sample_snippets ?? []).slice(0, knowledgeExpanded ? 5 : 2).map((s: string, i: number) => (
                <div key={i} className="bg-black/60 rounded-lg p-3 border border-[#151515]">
                  <p className="text-[12px] text-[#888] leading-relaxed">&ldquo;{knowledgeExpanded ? s : (s.slice(0, 200) + (s.length > 200 ? "..." : ""))}&rdquo;</p>
                </div>
              ))}
              {(result.engines?.gemini?.sample_snippets?.length ?? 0) > 2 && (
                <button onClick={() => setKnowledgeExpanded(!knowledgeExpanded)} className="text-[11px] text-[#555] hover:text-[#888] cursor-pointer transition-colors">
                  {knowledgeExpanded ? "Show less ▲" : `Show ${(result.engines?.gemini?.sample_snippets?.length ?? 0) - 2} more ▼`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-[#555] italic">No brand mentions in training data</p>
          )}

          <p className={`text-[11px] mt-4 font-medium ${knowledgeScore > 50 ? "text-[#2596be]" : knowledgeScore > 0 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>
            {knowledgeScore > 50 ? "AI has embedded knowledge of your brand" : knowledgeScore > 0 ? "Limited brand knowledge in training data" : "Brand not found in training data"}
          </p>
        </div>

        {/* Discoverability Card */}
        <div className={`rounded-xl border p-5 ${grounded.brand_found ? "border-[#2596be]/20 bg-[#2596be]/[0.03]" : "border-[#1a1a1a] bg-black/40"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#2596be]" />
              <span className="text-[13px] font-semibold text-white/90">Discoverability Score</span>
            </div>
            <span className={`text-[14px] font-bold ${scoreColor(discoverabilityScore)}`}>{discoverabilityScore}/100</span>
          </div>
          <p className="text-[11px] text-[#555] mb-2">Gemini + Google Search — {grounded.mentioned ?? 0}/{grounded.total ?? 0} prompts found your brand</p>

          {/* Per-prompt grounded results */}
          {queries.length > 0 ? (
            <div className="space-y-2">
              {queries.slice(0, showAllGrounded ? undefined : PREVIEW_COUNT).map((q, i) => (
                <div key={i} className={`rounded-lg border transition-colors ${q.mentioned ? "border-[#2596be]/15 bg-[#2596be]/[0.02]" : "border-[#1a1a1a] bg-black/40"}`}>
                  <button onClick={() => toggleGrounded(i)} className="w-full flex items-start gap-2 p-3 text-left cursor-pointer hover:bg-white/[0.02] transition-colors">
                    <span className={`mt-0.5 text-[12px] font-bold shrink-0 ${q.mentioned ? "text-[#2596be]" : "text-[#EF4444]"}`}>{q.mentioned ? "✓" : "✗"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[#ccc]">&ldquo;{q.prompt}&rdquo;</p>
                      {!groundedExpandedIdx.has(i) && q.text && (
                        <p className="text-[11px] text-[#555] mt-1 truncate">{q.text.slice(0, 100)}...</p>
                      )}
                    </div>
                    <span className={`text-[10px] text-[#444] shrink-0 transition-transform ${groundedExpandedIdx.has(i) ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  {groundedExpandedIdx.has(i) && (
                    <div className="px-3 pb-3 pt-0 ml-5">
                      <div className="p-3 rounded-lg bg-black/60 border border-[#111]">
                        <p className="text-[10px] text-[#555] uppercase tracking-wider mb-2 font-medium">Gemini + Google Search Response</p>
                        <div className="max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                          <p className="text-[12px] text-[#888] leading-relaxed whitespace-pre-wrap break-words">{q.text || "No response"}</p>
                        </div>
                        {q.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#151515]">
                            <p className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Sources Found</p>
                            {q.sources.map((src, si) => (
                              <div key={si} className="flex items-start gap-1.5 text-[11px] mb-1">
                                <span className="text-[#2596be] shrink-0">•</span>
                                <span className="text-[#888]">{src.title || src.url}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {queries.length > PREVIEW_COUNT && (
                <button onClick={() => setShowAllGrounded(!showAllGrounded)} className="text-[11px] text-[#2596be]/70 hover:text-[#2596be] cursor-pointer transition-colors">
                  {showAllGrounded ? "Show less ▲" : `+ ${queries.length - PREVIEW_COUNT} more grounded queries ▼`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-[#555] italic">No grounded queries executed</p>
          )}

          <p className={`text-[11px] mt-4 font-medium ${grounded.brand_found ? "text-[#2596be]" : "text-[#EF4444]"}`}>
            {grounded.brand_found
              ? `Found via web search — ${grounded.sources.length} unique source${grounded.sources.length !== 1 ? "s" : ""} discovered`
              : "Not found even with web search enabled"}
          </p>
        </div>
      </div>

      {/* All Grounded Sources */}
      {grounded.sources.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#191919] bg-black/40 p-4">
          <p className="text-[11px] text-[#555] uppercase tracking-wider mb-3 font-medium">All Sources Found via Google Search ({grounded.sources.length})</p>
          <div className="space-y-2">
            {grounded.sources.slice(0, 8).map((src: { title: string; url: string; content: string }, i: number) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <span className="text-[#2596be] shrink-0 mt-0.5">•</span>
                <div className="min-w-0">
                  <span className="text-[#ccc] font-medium">{src.title || "Unknown source"}</span>
                  {src.content && <p className="text-[#666] text-[11px] mt-0.5 line-clamp-2">{src.content}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap Insight */}
      {gap > 15 && (
        <div className={`mt-4 rounded-xl p-4 ${
          discoverabilityScore > knowledgeScore
            ? "bg-[#2596be]/[0.05] border border-[#2596be]/20"
            : "bg-[#F59E0B]/[0.05] border border-[#F59E0B]/20"
        }`}>
          {discoverabilityScore > knowledgeScore ? (
            <>
              <p className="text-[13px] text-[#2596be] font-semibold">Discoverability exceeds Knowledge by {gap} points</p>
              <p className="text-[12px] text-[#666] mt-1">AI can find you via search but hasn&apos;t memorized you yet. Consistent content will close this gap over time.</p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[#F59E0B] font-semibold">Knowledge exceeds Discoverability by {gap} points</p>
              <p className="text-[12px] text-[#666] mt-1">AI knows you from training data but struggles to find current info. Improve your web presence with structured data and llms.txt.</p>
            </>
          )}
        </div>
      )}
    </Section>
  );
}

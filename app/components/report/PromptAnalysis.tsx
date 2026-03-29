"use client";

import React from "react";
import type { PromptDetail } from "@/app/types";
import { Section, SectionTitle, VolumeBadge, ENGINE_META, InfoTooltip } from "./primitives";

interface GroundedQuery {
  prompt: string;
  text: string;
  mentioned: boolean;
  sources: Array<{ title: string; url: string; content: string }>;
}

/* ─── Per-model response viewer with tab switching ─── */
function ModelResponseViewer({ entries, grounded }: {
  entries: PromptDetail[];
  grounded?: GroundedQuery;
}) {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const items = entries.length > 0 ? entries : [];
  const active = items[activeIdx];

  if (items.length === 0 && !grounded) {
    return <p className="text-[12px] text-[#555] italic p-3">No response data</p>;
  }

  return (
    <div className="space-y-2">
      {/* Model tabs */}
      <div className="flex flex-wrap gap-1.5">
        {items.map((entry, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`text-[10px] px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeIdx === i
                ? entry.mentioned
                  ? "bg-[#2596be]/20 text-[#2596be] border border-[#2596be]/30"
                  : "bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30"
                : "bg-[#111] text-[#555] border border-[#1a1a1a] hover:text-[#888] hover:border-[#333]"
            }`}
          >
            {entry.mentioned ? "✓" : "✗"} {entry.engine_model || ENGINE_META[entry.engine || ""]?.label || entry.engine}
          </button>
        ))}
      </div>

      {/* Active response */}
      {active && (
        <div className={`p-3 rounded-lg border ${active.mentioned ? "bg-[#2596be]/[0.03] border-[#2596be]/10" : "bg-black/40 border-[#111]"}`}>
          <div className="max-h-[300px] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
            <p className="text-[12px] text-[#888] leading-relaxed whitespace-pre-wrap break-words">
              {active.full_response || active.snippet || "No response"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Grounded response viewer ─── */
function GroundedResponseViewer({ grounded }: { grounded: GroundedQuery }) {
  return (
    <div className={`p-3 rounded-lg border ${grounded.mentioned ? "bg-[#2596be]/[0.03] border-[#2596be]/10" : "bg-black/40 border-[#111]"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${grounded.mentioned ? "bg-[#2596be]/10 text-[#2596be]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
          {grounded.mentioned ? "✓" : "✗"} Gemini 3 Pro (Grounded)
        </span>
      </div>
      <div className="max-h-[300px] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
        <p className="text-[12px] text-[#888] leading-relaxed whitespace-pre-wrap break-words">{grounded.text || "No response"}</p>
      </div>
      {grounded.sources.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#151515]">
          <p className="text-[9px] text-[#555] uppercase tracking-wider mb-1">Sources</p>
          {grounded.sources.slice(0, 5).map((src, si) => (
            <a key={si} href={src.url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-[#666] truncate hover:text-[#2596be] transition-colors">
              • {src.title || src.url}
            </a>
          ))}
          {grounded.sources.length > 5 && <div className="text-[10px] text-[#444]">+ {grounded.sources.length - 5} more</div>}
        </div>
      )}
    </div>
  );
}

/* ─── Single prompt row ─── */
function PromptRow({ d, idx, isMentioned, expandedIdx, toggleExpand, groundedMap, type }: {
  d: PromptDetail & { entries?: PromptDetail[] };
  idx: number;
  isMentioned: boolean;
  expandedIdx: Set<string>;
  toggleExpand: (key: string) => void;
  groundedMap: Map<string, GroundedQuery>;
  type: "training" | "grounded";
}) {
  const key = `${type}-${isMentioned ? "p" : "f"}-${idx}`;
  const isExpanded = expandedIdx.has(key);
  const grounded = groundedMap.get(d.prompt.toLowerCase().trim());
  const entries = d.entries || [];

  // Filter entries by type
  const relevantEntries = type === "training"
    ? entries.filter(e => (e.source_type || "training") === "training")
    : entries.filter(e => e.source_type === "grounded");

  return (
    <div className={`rounded-xl border transition-colors ${isMentioned ? "border-[#2596be]/10 bg-[#2596be]/[0.03]" : "border-[#EF4444]/10 bg-[#EF4444]/[0.03]"}`}>
      <button onClick={() => toggleExpand(key)} className="w-full flex items-start gap-3 p-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors">
        <span className={`mt-0.5 text-[13px] font-bold shrink-0 ${isMentioned ? "text-[#2596be]" : "text-[#EF4444]"}`}>{isMentioned ? "✓" : "✗"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] text-[#ccc]">&ldquo;{d.prompt}&rdquo;</p>
            <VolumeBadge volume={d.search_volume} cpc={d.cpc} />
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {type === "training" ? (
              relevantEntries.map((e, ei) => (
                <span key={ei} className={`text-[10px] px-1.5 py-0.5 rounded ${e.mentioned ? "bg-[#2596be]/10 text-[#2596be]" : "bg-[#333]/30 text-[#555]"}`}>
                  {e.engine_model || ENGINE_META[e.engine || ""]?.label || e.engine}
                </span>
              ))
            ) : (
              grounded && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${grounded.mentioned ? "bg-[#2596be]/10 text-[#2596be]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
                  Gemini 3 Pro (Grounded)
                </span>
              )
            )}
          </div>
        </div>
        <span className={`text-[11px] text-[#444] shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 ml-7">
          {type === "training" ? (
            <ModelResponseViewer entries={relevantEntries} />
          ) : (
            grounded ? <GroundedResponseViewer grounded={grounded} /> : <p className="text-[12px] text-[#555] italic">No grounded data for this prompt</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Prompt card (Knowledge or Discoverability) ─── */
function PromptCard({ title, icon, info, prompts, isFree, brand, groundedMap, type, passedCount, failedCount }: {
  title: string;
  icon: string;
  info: string;
  prompts: (PromptDetail & { entries?: PromptDetail[] })[];
  isFree: boolean;
  brand: string;
  groundedMap: Map<string, GroundedQuery>;
  type: "training" | "grounded";
  passedCount: number;
  failedCount: number;
}) {
  const [expandedIdx, setExpandedIdx] = React.useState<Set<string>>(new Set());
  const [showAllPassed, setShowAllPassed] = React.useState(false);
  const [showAllFailed, setShowAllFailed] = React.useState(false);
  const PREVIEW = 3;

  const toggleExpand = (key: string) => {
    setExpandedIdx(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // For grounded card: determine pass/fail by grounded results
  const passed = type === "grounded"
    ? prompts.filter(p => {
        const g = groundedMap.get(p.prompt.toLowerCase().trim());
        return g?.mentioned;
      })
    : prompts.filter(p => {
        const entries = p.entries || [];
        const training = entries.filter(e => (e.source_type || "training") === "training");
        return training.some(e => e.mentioned);
      });

  const failed = type === "grounded"
    ? prompts.filter(p => {
        const g = groundedMap.get(p.prompt.toLowerCase().trim());
        return !g?.mentioned;
      })
    : prompts.filter(p => {
        const entries = p.entries || [];
        const training = entries.filter(e => (e.source_type || "training") === "training");
        return !training.some(e => e.mentioned);
      });

  return (
    <Section delay={0.2}>
      <SectionTitle icon={icon} info={info}>{title}</SectionTitle>
      <div className="flex items-center gap-4 -mt-4 mb-5">
        <span className="text-[12px] text-[#2596be]">✓ {passed.length} mentioned</span>
        <span className="text-[12px] text-[#EF4444]">✗ {failed.length} missed</span>
      </div>

      {/* Mentioned */}
      {passed.length > 0 && (
        <div className="mb-4">
          <p className="text-[12px] text-[#2596be]/70 font-semibold mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2596be]" />
            Mentioned
          </p>
          <div className="space-y-2">
            {passed.slice(0, PREVIEW).map((d, i) => (
              <PromptRow key={i} d={d} idx={i} isMentioned={true} expandedIdx={expandedIdx} toggleExpand={toggleExpand} groundedMap={groundedMap} type={type} />
            ))}
          </div>
          {passed.length > PREVIEW && (
            <div className="mt-2">
              <button onClick={() => setShowAllPassed(!showAllPassed)} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition text-left">
                <span className={`text-[11px] text-[#444] transition-transform ${showAllPassed ? "rotate-180" : ""}`}>▼</span>
                <p className="text-[12px] text-[#2596be]/70">+ {passed.length - PREVIEW} more</p>
              </button>
              {showAllPassed && (
                <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                  {passed.slice(PREVIEW).map((d, i) => (
                    <PromptRow key={i} d={d} idx={i + PREVIEW} isMentioned={true} expandedIdx={expandedIdx} toggleExpand={toggleExpand} groundedMap={groundedMap} type={type} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Not mentioned */}
      {failed.length > 0 && (
        <div>
          <p className="text-[12px] text-[#EF4444]/70 font-semibold mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            Not Mentioned
          </p>
          <div className="space-y-2">
            {failed.slice(0, PREVIEW).map((d, i) => (
              <PromptRow key={i} d={d} idx={i + 10000} isMentioned={false} expandedIdx={expandedIdx} toggleExpand={toggleExpand} groundedMap={groundedMap} type={type} />
            ))}
          </div>
          {failed.length > PREVIEW && (
            <div className="mt-2">
              {isFree ? (
                <div className="rounded-xl border border-dashed border-[#222] bg-[#050505] p-6 text-center mt-2">
                  <div className="w-10 h-10 rounded-full bg-[#111] border border-[#222] flex items-center justify-center mx-auto mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-[#888] mb-1 font-medium">+ {failed.length - PREVIEW} more missed prompts</p>
                  <p className="text-[12px] text-[#555] mb-3">See exactly where AI engines ignore {brand}</p>
                  <a href="/pricing" className="text-[12px] text-white underline underline-offset-2 hover:no-underline">Unlock with Pro →</a>
                </div>
              ) : (
                <>
                  <button onClick={() => setShowAllFailed(!showAllFailed)} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition text-left">
                    <span className={`text-[11px] text-[#444] transition-transform ${showAllFailed ? "rotate-180" : ""}`}>▼</span>
                    <p className="text-[12px] text-[#EF4444]/70">+ {failed.length - PREVIEW} more missed</p>
                  </button>
                  {showAllFailed && (
                    <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                      {failed.slice(PREVIEW).map((d, i) => (
                        <PromptRow key={i} d={d} idx={i + 10000 + PREVIEW} isMentioned={false} expandedIdx={expandedIdx} toggleExpand={toggleExpand} groundedMap={groundedMap} type={type} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {passed.length === 0 && failed.length === 0 && (
        <p className="text-[12px] text-[#555] italic">No {type === "grounded" ? "grounded search" : "training data"} results available.</p>
      )}
    </Section>
  );
}

/* ─── Main export: Two side-by-side cards ─── */
export function PromptAnalysis({ passedPrompts, failedPrompts, activeEngines, isFree, brand, groundedQueries }: {
  passedPrompts: (PromptDetail & { entries?: PromptDetail[] })[];
  failedPrompts: (PromptDetail & { entries?: PromptDetail[] })[];
  activeEngines: string[];
  isFree: boolean;
  brand: string;
  groundedQueries?: GroundedQuery[];
}) {
  const allPrompts = [...passedPrompts, ...failedPrompts];

  // Build grounded lookup
  const groundedMap = React.useMemo(() => {
    const map = new Map<string, GroundedQuery>();
    (groundedQueries || []).forEach(q => {
      map.set(q.prompt.toLowerCase().trim(), q);
    });
    return map;
  }, [groundedQueries]);

  const hasGrounded = groundedQueries && groundedQueries.length > 0;

  // Get unique prompts that have grounded results
  const groundedPrompts = allPrompts.filter(p => groundedMap.has(p.prompt.toLowerCase().trim()));

  return (
    <div>
      <div className="mb-4">
        <p className="text-[15px] font-semibold text-white flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          Prompt Analysis
        </p>
        <p className="text-[12px] text-[#555] mt-1">We asked real questions to AI engines. Click any result to see individual model responses.</p>
      </div>

      <div className={`grid gap-3 ${hasGrounded ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Knowledge Card — Training Data */}
        <PromptCard
          title="Knowledge (Training Data)"
          icon="M12 2L2 7l10 5 10-5-10-5z|M2 17l10 5 10-5|M2 12l10 5 10-5"
          info="What AI engines know from their training data — this is what developers get via API. Reflects embedded knowledge across all models."
          prompts={allPrompts}
          isFree={isFree}
          brand={brand}
          groundedMap={groundedMap}
          type="training"
          passedCount={passedPrompts.length}
          failedCount={failedPrompts.length}
        />

        {/* Discoverability Card — Grounded/Web Search */}
        {hasGrounded ? (
          <PromptCard
            title="Discoverability (Web Search)"
            icon="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"
            info="What AI engines find via live Google Search — this is what users see in ChatGPT/Gemini web UI. Reflects real-time discoverability."
            prompts={groundedPrompts}
            isFree={isFree}
            brand={brand}
            groundedMap={groundedMap}
            type="grounded"
            passedCount={groundedPrompts.filter(p => groundedMap.get(p.prompt.toLowerCase().trim())?.mentioned).length}
            failedCount={groundedPrompts.filter(p => !groundedMap.get(p.prompt.toLowerCase().trim())?.mentioned).length}
          />
        ) : (
          <Section delay={0.2}>
            <SectionTitle icon="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" info="What AI engines find via live Google Search.">Discoverability (Web Search)</SectionTitle>
            <div className="rounded-xl border border-dashed border-[#222] bg-[#050505] p-8 text-center">
              <p className="text-[13px] text-[#555]">Grounded search results loading...</p>
              <p className="text-[11px] text-[#444] mt-1">Uses Gemini 3 Pro with Google Search grounding</p>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

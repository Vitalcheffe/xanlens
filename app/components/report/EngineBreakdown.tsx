"use client";

import React from "react";
import { motion } from "framer-motion";
import type { AuditResult } from "@/app/types";
import { ScoreRing, Section, SectionTitle, ProBadge, ENGINE_META, ALL_ENGINES } from "./primitives";

export function EngineBreakdown({ result, activeEngines, isFree }: {
  result: AuditResult;
  activeEngines: string[];
  isFree: boolean;
}) {
  const lockedEngines = ALL_ENGINES.filter((e) => !activeEngines.includes(e));

  return (
    <Section delay={0.15}>
      <SectionTitle icon="M3 3v18h18|M7 12h10|M7 8h14|M7 16h6" right={isFree && lockedEngines.length > 0 ? <span className="text-[12px] text-[#555]">{lockedEngines.length} more engines in Pro</span> : undefined}>
        Engine Breakdown
      </SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2">
        {activeEngines.map((engine, i) => {
          const data = (result.engines || {})[engine];
          if (!data) return null;
          const meta = ENGINE_META[engine] || { label: engine, logo: "" };

          // Unavailable state (e.g. paused Perplexity)
          if (data.unavailable) {
            return (
              <motion.div
                key={engine}
                className="rounded-xl border border-[#1a1a1a] bg-black/20 p-3 flex flex-col items-center opacity-50"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 0.5, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.05 }}
              >
                <div className="w-[72px] h-[72px] flex items-center justify-center">
                  <svg className="-rotate-90" width={72} height={72} viewBox="0 0 72 72">
                    <circle cx={36} cy={36} r={30} stroke="#1a1a1a" strokeWidth={5} fill="none" />
                  </svg>
                  <div className="absolute flex items-center justify-center">
                    <span className="text-[14px] text-[#444]">—</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                  {meta.logo && <img src={meta.logo} alt={meta.label} className="w-5 h-5 grayscale opacity-30" />}
                  <span className="text-[12px] text-[#555] font-medium">{meta.label}</span>
                </div>
                <p className="text-[10px] text-[#444] mt-1">Unavailable (Beta)</p>
              </motion.div>
            );
          }

          const sentimentColor = data.sentiment === "positive" ? "text-[#2596be]" : data.sentiment === "negative" ? "text-[#EF4444]" : "text-[#F59E0B]";
          return (
            <motion.div
              key={engine}
              className="rounded-xl border border-[#1a1a1a] bg-black/40 p-3 flex flex-col items-center hover:border-[#333] hover:bg-black/60 transition-all duration-200"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.05 }}
            >
              <ScoreRing score={data.score} size={72} strokeWidth={5} delay={0.3 + i * 0.05} />
              <div className="flex items-center gap-1.5 mt-2.5">
                {meta.logo && <img src={meta.logo} alt={meta.label} className="w-5 h-5 opacity-70" />}
                <span className="text-[12px] text-[#999] font-medium">{meta.label}</span>
              </div>
              {data.model_name && (
                <p className="text-[9px] text-[#444] mt-0.5">{data.model_name}</p>
              )}
              <p className="text-[11px] text-[#555] mt-1">{data.mentions}/{data.prompts_tested ?? 0}</p>
              <span className={`text-[10px] font-medium mt-0.5 ${sentimentColor}`}>{data.sentiment}</span>
              {data.reliability != null && data.reliability < 100 && (
                <span className="text-[9px] text-[#444] mt-0.5">{data.reliability}% responded</span>
              )}
            </motion.div>
          );
        })}
        {isFree && lockedEngines.map((engine) => {
          const meta = ENGINE_META[engine] || { label: engine, logo: "" };
          return (
            <div key={engine} className="rounded-xl border border-[#1a1a1a] bg-black/20 p-3 flex flex-col items-center relative group cursor-pointer hover:border-[#222] transition-all"
              onClick={() => window.location.href = "/pricing"}>
              <div className="w-[72px] h-[72px] flex items-center justify-center">
                <svg className="-rotate-90" width={72} height={72} viewBox="0 0 72 72">
                  <circle cx={36} cy={36} r={30} stroke="#1a1a1a" strokeWidth={5} fill="none" />
                  <circle cx={36} cy={36} r={30} stroke="#222" strokeWidth={5} fill="none" strokeDasharray="188" strokeDashoffset="120" strokeLinecap="round" />
                </svg>
                <div className="absolute flex items-center justify-center">
                  <span className="text-[18px] font-bold text-[#333]">?</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5">
                {meta.logo && <img src={meta.logo} alt={meta.label} className="w-5 h-5 grayscale opacity-20" />}
                <span className="text-[12px] text-[#444] font-medium">{meta.label}</span>
              </div>
              <ProBadge />
              <div className="absolute inset-0 bg-black/80 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[11px] text-[#999]">Unlock →</span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

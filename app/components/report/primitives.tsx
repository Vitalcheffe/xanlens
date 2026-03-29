"use client";

import React from "react";
import { motion } from "framer-motion";

/* ─── Constants ─── */

export const ENGINE_META: Record<string, { label: string; logo: string }> = {
  gemini: { label: "Gemini", logo: "/logos/gemini.svg" },
  gpt4o: { label: "ChatGPT", logo: "/logos/chatgpt.svg" },
  claude: { label: "Claude", logo: "/logos/claude.svg" },
  perplexity: { label: "Perplexity", logo: "/logos/perplexity.svg" },
  grok: { label: "Grok", logo: "/logos/grok.svg" },
  deepseek: { label: "DeepSeek", logo: "/logos/deepseek.svg" },
  llama: { label: "Meta AI", logo: "/logos/meta.svg" },
};

export const ALL_ENGINES = ["gemini", "gpt4o", "claude", "grok", "deepseek", "llama", "perplexity"];

export const CATEGORY_LABELS: Record<string, string> = {
  brand_awareness: "Brand Awareness",
  product_knowledge: "Product Knowledge",
  product_discovery: "Product Discovery",
  competitive_position: "Competitive Position",
  market_positioning: "Market Positioning",
  purchase_intent: "Purchase Intent",
  natural_conversation: "Natural Conversation",
  technical_features: "Technical Features",
  sentiment: "Sentiment",
  other: "Other",
};

export const AIO_LABELS: Record<string, { label: string; icon: string }> = {
  structured_data: { label: "Structured Data", icon: "M3 3v18h18|M7 16l4-8 4 4 6-6" },
  schema_quality: { label: "Schema Quality", icon: "rect:2,2,13,13,2|M16 16h5v5H16z|M16 3h5v5H16z|M21 8v3|M8 21h3" },
  page_structure: { label: "Page Structure", icon: "rect:3,3,18,18,2|M3 9h18|M9 21V9" },
  navigation: { label: "Navigation", icon: "circle:12,12,10|M12 2v4|M12 18v4|M2 12h4|M18 12h4" },
  content_balance: { label: "Content Balance", icon: "M3 3h7v7H3z|M14 3h7v7h-7z|M3 14h7v7H3z|M14 14h7v7h-7z" },
  metadata: { label: "Metadata", icon: "M4 4h16v16H4z|M9 9h6|M9 13h4" },
  ai_crawlers: { label: "AI Crawler Readiness", icon: "rect:4,4,16,16,2|circle:9,9,2|circle:15,9,2|M9 15h6" },
};

export const GRADE_COLORS: Record<string, string> = {
  A: "text-[#2596be] border-[#2596be]/30 bg-[#2596be]/10",
  B: "text-[#5cb8d6] border-[#5cb8d6]/30 bg-[#5cb8d6]/10",
  C: "text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10",
  D: "text-[#F97316] border-[#F97316]/30 bg-[#F97316]/10",
  F: "text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10",
};

/* ─── Helpers ─── */

export function getVerdict(score: number): string {
  if (score >= 90) return "Excellent AI visibility. AI engines know and recommend you.";
  if (score >= 75) return "Good visibility with room to grow.";
  if (score >= 60) return "Moderate visibility. You're missing key conversations.";
  if (score >= 40) return "Low visibility. Most AI engines don't mention you.";
  return "Critical. You're invisible to AI search engines.";
}

export function scoreColor(val: number): string {
  if (val >= 75) return "text-[#2596be]";
  if (val >= 50) return "text-[#F59E0B]";
  if (val >= 25) return "text-[#F97316]";
  return "text-[#EF4444]";
}

export function scoreBg(val: number): string {
  if (val >= 75) return "bg-[#2596be]/10 border-[#2596be]/20";
  if (val >= 50) return "bg-[#F59E0B]/10 border-[#F59E0B]/20";
  if (val >= 25) return "bg-[#F97316]/10 border-[#F97316]/20";
  return "bg-[#EF4444]/10 border-[#EF4444]/20";
}

export function barColor(val: number): string {
  if (val >= 75) return "bg-[#2596be]";
  if (val >= 50) return "bg-[#F59E0B]";
  if (val >= 25) return "bg-[#F97316]";
  return "bg-[#EF4444]";
}

export function formatVolume(vol: number): string {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return String(vol);
}

function ringStroke(val: number): string {
  if (val >= 75) return "#2596be";
  if (val >= 50) return "#F59E0B";
  if (val >= 25) return "#F97316";
  return "#EF4444";
}

/* ─── UI Components ─── */

export function VolumeBadge({ volume, cpc }: { volume?: number | null; cpc?: number | null }) {
  if (!volume) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400/80 border border-blue-400/20">
      {formatVolume(volume)}/mo
      {cpc != null && cpc > 0 && <span className="text-[#555]">· ${cpc.toFixed(2)}</span>}
    </span>
  );
}

export function ScoreRing({ score, size = 160, strokeWidth = 8, delay: d = 0 }: { score: number; size?: number; strokeWidth?: number; delay?: number }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1a1a1a" strokeWidth={strokeWidth} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={ringStroke(score)} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (score / 100) * c }}
          transition={{ duration: 1.2, delay: d, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-bold tracking-tight leading-none"
          style={{ fontSize: size * 0.24 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: d + 0.3 }}
        >
          {score}
        </motion.span>
        <span className="text-[11px] text-[#555] mt-1">/ 100</span>
      </div>
    </div>
  );
}

export function ProLock({ title, subtitle, cta = "Unlock with Pro — $0.99", children }: {
  title: string;
  subtitle?: string;
  cta?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[8px] bg-black/75 rounded-2xl flex flex-col items-center justify-center z-10 p-6">
        <div className="w-12 h-12 rounded-full bg-[#111] border border-[#222] flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <span className="text-[16px] text-white font-semibold mb-1 text-center">{title}</span>
        {subtitle && <span className="text-[13px] text-[#666] mb-5 text-center max-w-[360px]">{subtitle}</span>}
        <a href="/pricing" className="px-6 py-2.5 rounded-full bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors shadow-lg">
          {cta}
        </a>
      </div>
      <div className="blur-[4px] select-none pointer-events-none opacity-60">
        {children}
      </div>
    </div>
  );
}

export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/20 font-medium">
      ✦ Pro
    </span>
  );
}

export function Section({ children, delay: d = 0, className = "", pro = false }: { children: React.ReactNode; delay?: number; className?: string; pro?: boolean }) {
  return (
    <motion.div
      className={`rounded-2xl border bg-[#0c0c0c]/90 backdrop-blur-sm p-6 sm:p-7 mb-3 ${pro ? "border-white/10 shadow-[0_0_40px_-12px_rgba(255,255,255,0.05)]" : "border-[#161616] shadow-[0_2px_8px_rgba(0,0,0,0.4)]"} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: d, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <span className="w-4 h-4 rounded-full bg-[#1a1a1a] border border-[#333] text-[10px] text-[#666] flex items-center justify-center cursor-help hover:text-[#999] hover:border-[#555] transition-colors">i</span>
      <span className="absolute left-6 top-1/2 -translate-y-1/2 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[11px] text-[#bbb] leading-relaxed w-[250px] shadow-lg pointer-events-none">
        {text}
      </span>
    </span>
  );
}

export function SectionIcon({ paths }: { paths: string }) {
  const parts = paths.split("|");
  return (
    <div className="w-7 h-7 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2596be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {parts.map((p, i) => {
          if (p.startsWith("circle:")) {
            const [cx, cy, r] = p.slice(7).split(",");
            return <circle key={i} cx={cx} cy={cy} r={r} />;
          }
          if (p.startsWith("rect:")) {
            const [x, y, w, h, rx] = p.slice(5).split(",");
            return <rect key={i} x={x} y={y} width={w} height={h} rx={rx || "0"} />;
          }
          return <path key={i} d={p} />;
        })}
      </svg>
    </div>
  );
}

export function InlineIcon({ paths, size = 16, className = "" }: { paths: string; size?: number; className?: string }) {
  const parts = paths.split("|");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2596be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {parts.map((p, i) => {
        if (p.startsWith("circle:")) {
          const [cx, cy, r] = p.slice(7).split(",");
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        if (p.startsWith("rect:")) {
          const [x, y, w, h, rx] = p.slice(5).split(",");
          return <rect key={i} x={x} y={y} width={w} height={h} rx={rx || "0"} />;
        }
        return <path key={i} d={p} />;
      })}
    </svg>
  );
}

export function SectionTitle({ children, right, pro = false, info, icon }: { children: React.ReactNode; right?: React.ReactNode; pro?: boolean; info?: string; icon?: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && <SectionIcon paths={icon} />}
        <h3 className="text-[15px] font-semibold text-white/90 tracking-tight">{children}</h3>
        {pro && <ProBadge />}
        {info && <InfoTooltip text={info} />}
      </div>
      {right}
    </div>
  );
}

"use client";

import React from "react";

export const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export const AI_ENGINES = [
  { name: "Gemini", logo: "/logos/gemini.svg" },
  { name: "ChatGPT", logo: "/logos/chatgpt.svg" },
  { name: "Claude", logo: "/logos/claude.svg" },
  { name: "Grok", logo: "/logos/grok.svg" },
  { name: "Perplexity", logo: "/logos/perplexity.svg" },
  { name: "DeepSeek", logo: "/logos/deepseek.svg" },
  { name: "Meta AI", logo: "/logos/meta.svg" },
];

export function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="relative group">
      <div className="bg-black rounded-lg p-4 overflow-x-auto border border-[#1a1a1a]">
        <pre className="text-[13px] text-[#ccc] font-mono leading-relaxed whitespace-pre-wrap">{text}</pre>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-3 right-3 px-2 py-1 rounded-md bg-[#1a1a1a] text-[11px] text-[#666] hover:text-white transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export function TierIcon({ paths }: { paths: string }) {
  const parts = paths.split("|");
  return (
    <div className="w-7 h-7 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

"use client";

import React from "react";
import { motion } from "framer-motion";
import { Section, SectionTitle } from "./primitives";

interface PlatformItem {
  title: string;
  url: string;
  description?: string;
  date?: string;
  stats?: string;
}

interface PlatformResult {
  platform: string;
  found: boolean;
  count: number;
  items: PlatformItem[];
  error?: string;
}

const PLATFORM_META: Record<string, { label: string; icon: string; color: string }> = {
  youtube: { label: "YouTube", icon: "/logos/youtube.svg", color: "#FF0000" },
  twitter: { label: "X / Twitter", icon: "/logos/x.svg", color: "#fff" },
  github: { label: "GitHub", icon: "/logos/github.svg", color: "#fff" },
  reddit: { label: "Reddit", icon: "/logos/reddit.svg", color: "#FF4500" },
};

function PlatformCard({ result }: { result: PlatformResult }) {
  const [expanded, setExpanded] = React.useState(false);
  const meta = PLATFORM_META[result.platform] || { label: result.platform, icon: "", color: "#888" };

  return (
    <motion.div
      className="rounded-xl border border-[#1a1a1a] bg-black/40 p-4 hover:border-[#333] transition-all"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {meta.icon && <img src={meta.icon} alt={meta.label} className="w-5 h-5 opacity-70" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
          <span className="text-[13px] text-[#ccc] font-medium">{meta.label}</span>
        </div>
        {result.error ? (
          <span className="text-[10px] text-[#555] px-2 py-0.5 rounded bg-[#111]">Unavailable</span>
        ) : result.found ? (
          <span className="text-[10px] text-[#2596be] px-2 py-0.5 rounded bg-[#2596be]/10">Found</span>
        ) : (
          <span className="text-[10px] text-[#555] px-2 py-0.5 rounded bg-[#111]">Not Found</span>
        )}
      </div>

      {result.found && (
        <>
          <p className="text-[11px] text-[#666] mb-2">{result.count.toLocaleString()} result{result.count !== 1 ? "s" : ""}</p>
          <div className="space-y-1.5">
            {result.items.slice(0, expanded ? 10 : 3).map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-lg bg-[#0a0a0a] border border-[#111] hover:border-[#333] transition-colors group">
                <p className="text-[11px] text-[#999] group-hover:text-[#2596be] transition-colors truncate">{item.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {item.date && <span className="text-[9px] text-[#444]">{item.date}</span>}
                  {item.stats && <span className="text-[9px] text-[#444]">{item.stats}</span>}
                </div>
              </a>
            ))}
          </div>
          {result.items.length > 3 && (
            <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-[#2596be]/70 mt-2 cursor-pointer hover:text-[#2596be] transition-colors">
              {expanded ? "Show less" : `+ ${result.items.length - 3} more`}
            </button>
          )}
        </>
      )}

      {!result.found && !result.error && (
        <p className="text-[11px] text-[#444]">No presence detected on {meta.label}</p>
      )}

      {result.error && (
        <p className="text-[10px] text-[#444]">Could not check — platform blocked automated access</p>
      )}
    </motion.div>
  );
}

export function PlatformPresence({ brand, jobId }: { brand: string; jobId?: string }) {
  const [platforms, setPlatforms] = React.useState<PlatformResult[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!brand) return;
    setLoading(true);
    fetch("/api/v1/audit/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.platforms) setPlatforms(data.platforms);
        else setError(data.error || "Failed to load");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [brand]);

  const foundCount = platforms?.filter(p => p.found).length || 0;

  return (
    <Section delay={0.3}>
      <SectionTitle icon="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" info="Active platform search — we search YouTube, X/Twitter, and GitHub for real mentions of your brand. Unlike citation tracking (which relies on AI engine responses), this checks the platforms directly.">
        Platform Presence
      </SectionTitle>

      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="w-4 h-4 border-2 border-[#2596be]/30 border-t-[#2596be] rounded-full animate-spin" />
          <p className="text-[12px] text-[#555]">Searching platforms for {brand}...</p>
        </div>
      )}

      {error && <p className="text-[12px] text-[#EF4444]/60">{error}</p>}

      {platforms && (
        <>
          <p className="text-[12px] text-[#666] -mt-4 mb-4">Found on {foundCount}/{platforms.length} platforms</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {platforms.map((p, i) => <PlatformCard key={i} result={p} />)}
          </div>
        </>
      )}
    </Section>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

type FixStatus = "drafted" | "approved" | "rejected" | "published";

interface Fix {
  id: string;
  title: string;
  type: "on-site" | "off-site";
  platform: string;
  description: string;
  content: string;
  priority: number;
  status?: FixStatus;
}

interface FixesClientProps {
  fixes: Fix[];
  brand: string;
  jobId: string;
}

// ── Platform logos (SVG inline for zero dependencies) ──
const PLATFORM_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  website: {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    color: "#10b981",
  },
  linkedin: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    color: "#0a66c2",
  },
  "x": {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    color: "#ffffff",
  },
  reddit: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>,
    color: "#ff4500",
  },
  "dev.to": {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6v4.36h.58c.37 0 .67-.08.84-.23.2-.18.3-.46.3-.91v-2.06c0-.45-.12-.75-.3-.93zm.12 3c0 .3-.04.52-.14.67-.08.12-.24.18-.46.18h-.16v-3.4h.16c.22 0 .38.06.46.18.1.14.14.36.14.67v1.7zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-1.86.77H5V8.97h1.74c.8 0 1.42.18 1.86.8.38.54.56 1.12.56 2.3v.9c0 1.16-.18 1.76-.6 2.33zm4.5-2.26c0 .3 0 .6-.06.84-.04.24-.12.46-.24.62-.14.2-.36.28-.66.28-.24 0-.44-.08-.58-.24-.16-.18-.24-.4-.3-.66-.04-.24-.06-.54-.06-.84v-.54c0-.3 0-.6.06-.84.04-.24.12-.46.28-.64.14-.18.34-.26.6-.26.24 0 .44.08.58.22.16.16.24.4.3.66.04.24.06.54.06.84v.56zm-2.66-4.02c-.78 0-1.38.22-1.78.66-.4.46-.62 1.1-.62 1.96v.92c0 .86.2 1.52.62 1.96.4.44 1 .66 1.78.66.78 0 1.38-.22 1.78-.66.4-.44.62-1.1.62-1.96v-.92c0-.86-.22-1.52-.62-1.96-.4-.44-1-.66-1.78-.66zm7.74 6.28c-.18.42-.52.62-1.02.62-.34 0-.62-.1-.82-.32-.2-.22-.3-.5-.3-.84v-.1h-.02l-1.28-5.62h1.18l.76 4.26.74-4.26h1.16l-1.28 5.62-.12.64z"/></svg>,
    color: "#ffffff",
  },
  youtube: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    color: "#ff0000",
  },
  quora: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12.73 19.55c-.6-1.2-1.35-2.44-2.7-2.44-.42 0-.84.14-1.02.5l-.82-.82c.6-.6 1.38-1.08 2.4-1.08 1.62 0 2.52.84 3.3 1.98.48-1.2.72-2.82.72-4.86 0-5.1-1.62-7.8-5.1-7.8s-5.1 2.7-5.1 7.8 1.62 7.8 5.1 7.8c1.2 0 2.16-.36 2.94-1.08zM9.51 0C15.09 0 19.5 3.66 19.5 11.83c0 5.4-2.1 9.12-5.7 10.77.78 1.08 1.62 1.74 2.88 1.74.66 0 1.08-.18 1.08-.18l.36 1.5s-.72.34-1.98.34c-2.22 0-3.72-1.38-4.86-3.12-.42.06-.84.12-1.26.12C4.41 23 0 19.2 0 11.83 0 3.66 4.41 0 9.51 0z"/></svg>,
    color: "#b92b27",
  },
  github: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>,
    color: "#ffffff",
  },
  g2: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm3.18 17.1H8.82L6.24 12l2.58-5.1h6.36L17.76 12l-2.58 5.1z"/></svg>,
    color: "#ff492c",
  },
  crunchbase: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M21.6 0H2.4C1.08 0 0 1.08 0 2.4v19.2C0 22.92 1.08 24 2.4 24h19.2c1.32 0 2.4-1.08 2.4-2.4V2.4C24 1.08 22.92 0 21.6 0zM7.045 14.465c.472.555 1.162.813 1.96.813.606 0 1.258-.2 1.724-.56l1.028 1.273a4.37 4.37 0 0 1-2.953 1.1c-2.394 0-4.057-1.675-4.057-4.077 0-2.354 1.603-4.078 3.9-4.078 1.19 0 2.14.383 2.914 1.15L10.59 11.36c-.44-.394-1.01-.647-1.662-.647-.895 0-1.905.636-1.905 2.293.001.69.214 1.243.521 1.58v-.12zm9.234 2.4l-.77-1.372c-.334.16-.696.248-1.09.248-1.2 0-2.03-.9-2.03-2.06V13.6c0-1.15.82-2.05 2.03-2.05.32 0 .63.06.91.2l.72-1.37a3.56 3.56 0 0 0-1.63-.4c-2.24 0-3.82 1.65-3.82 3.95v.08c0 2.3 1.53 3.93 3.82 3.93.65 0 1.24-.15 1.86-.47z"/></svg>,
    color: "#0288d1",
  },
  "ai_directories": {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423z"/></svg>,
    color: "#a855f7",
  },
  farcaster: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.24 3.23H5.76v17.54h1.97V12.6h.05c.24-2.38 2.24-4.24 4.68-4.24s4.44 1.86 4.68 4.24h.05v8.17h1.97V3.23h1.04z"/></svg>,
    color: "#855DCD",
  },
  product_hunt: {
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13.604 8.4h-3.405V12h3.405c.995 0 1.801-.806 1.801-1.801 0-.993-.806-1.799-1.801-1.799zM12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm1.604 14.4h-3.405V18H7.801V6h5.804c2.319 0 4.2 1.88 4.2 4.199 0 2.321-1.881 4.201-4.201 4.201z"/></svg>,
    color: "#da552f",
  },
};

function getPlatformIcon(platform: string): { icon: React.ReactNode; color: string } {
  const lower = platform.toLowerCase();
  if (lower.includes("website") || lower.includes("on-site")) return PLATFORM_ICONS.website;
  if (lower.includes("linkedin")) return PLATFORM_ICONS.linkedin;
  if (lower.includes("twitter") || lower === "x") return PLATFORM_ICONS.x;
  if (lower.includes("reddit")) return PLATFORM_ICONS.reddit;
  if (lower.includes("dev.to") || lower.includes("hashnode") || lower.includes("medium")) return PLATFORM_ICONS["dev.to"];
  if (lower.includes("youtube")) return PLATFORM_ICONS.youtube;
  if (lower.includes("quora")) return PLATFORM_ICONS.quora;
  if (lower.includes("github")) return PLATFORM_ICONS.github;
  if (lower.includes("g2") || lower.includes("capterra")) return PLATFORM_ICONS.g2;
  if (lower.includes("crunchbase")) return PLATFORM_ICONS.crunchbase;
  if (lower.includes("ai director") || lower.includes("futurepedia") || lower.includes("taift")) return PLATFORM_ICONS.ai_directories;
  if (lower.includes("farcaster")) return PLATFORM_ICONS.farcaster;
  if (lower.includes("product hunt")) return PLATFORM_ICONS.product_hunt;
  return PLATFORM_ICONS.website;
}

const statusConfig: Record<FixStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  drafted:   { label: "Drafted",   bg: "bg-[#1a1a1a]",        text: "text-[#888]",      border: "border-[#333]",           dot: "bg-[#555]" },
  approved:  { label: "Approved",  bg: "bg-emerald-500/10",   text: "text-emerald-400", border: "border-emerald-500/20",   dot: "bg-emerald-400" },
  rejected:  { label: "Rejected",  bg: "bg-red-500/10",       text: "text-red-400",     border: "border-red-500/20",       dot: "bg-red-400" },
  published: { label: "Published", bg: "bg-white/10",         text: "text-white",       border: "border-white/20",         dot: "bg-white" },
};

function getStatus(fix: Fix): FixStatus {
  return fix.status && fix.status in statusConfig ? fix.status : "drafted";
}

export default function FixesClient({ fixes: initialFixes, brand, jobId }: FixesClientProps) {
  const [fixes, setFixes] = useState<Fix[]>(
    [...initialFixes].sort((a, b) => a.priority - b.priority)
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "on-site" | "off-site">("all");
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionSent, setSuggestionSent] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const hidden: HTMLElement[] = [];
    [".global-nav", ".global-footer"].forEach((sel) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) { el.style.display = "none"; hidden.push(el); }
    });
    document.querySelectorAll<HTMLElement>("body .fixed").forEach((el) => {
      if (el.classList.contains("z-[60]")) { el.style.display = "none"; hidden.push(el); }
    });
    return () => { hidden.forEach((el) => { el.style.display = ""; }); };
  }, []);

  const updateStatus = async (fixId: string, status: "approved" | "rejected" | "drafted") => {
    setFixes(prev => prev.map(f => f.id === fixId ? { ...f, status } : f));
    try {
      const res = await fetch("/api/v1/audit/fixes/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, fixId, status }),
      });
      if (!res.ok) {
        setFixes(prev => prev.map(f => f.id === fixId ? { ...f, status: "drafted" as FixStatus } : f));
      }
    } catch {
      setFixes(prev => prev.map(f => f.id === fixId ? { ...f, status: "drafted" as FixStatus } : f));
    }
  };

  const submitSuggestion = async (fixId: string) => {
    if (!suggestionText.trim()) return;
    try {
      await fetch("/api/v1/audit/fixes/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, fixId, status: "suggestion", suggestion: suggestionText.trim() }),
      });
      setSuggestionSent(prev => new Set([...prev, fixId]));
      setSuggesting(null);
      setSuggestionText("");
    } catch { /* silent fail */ }
  };

  const filtered = filter === "all" ? fixes : fixes.filter(f => f.type === filter);
  const onsiteCount = fixes.filter(f => f.type === "on-site").length;
  const offsiteCount = fixes.filter(f => f.type === "off-site").length;

  const counts = fixes.reduce(
    (acc, f) => {
      const s = getStatus(f);
      if (s === "approved") acc.approved++;
      else if (s === "rejected") acc.rejected++;
      else if (s === "published") acc.published++;
      else acc.pending++;
      return acc;
    },
    { approved: 0, rejected: 0, published: 0, pending: 0 }
  );

  if (fixes.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center text-2xl">
            ?
          </div>
          <h1 className="text-xl font-bold mb-2">No fixes yet</h1>
          <p className="text-[#888] text-sm mb-4">
            Your AI agent hasn&apos;t drafted any fixes for this audit yet.
          </p>
          <a href={`/dashboard?jobId=${jobId}`} className="text-white text-sm hover:underline">
            Back to audit report
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      {/* Top bar */}
      <div className="border-b border-[#1a1a1a] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="https://xanlens.com" className="text-white font-bold text-sm tracking-wide">XANLENS</a>
            <span className="text-[#333]">/</span>
            <a href={`/dashboard?jobId=${jobId}`} className="text-[#666] text-sm hover:text-white transition-colors">
              Audit Report
            </a>
            <span className="text-[#333]">/</span>
            <span className="text-[#888] text-sm">Content</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {counts.approved > 0 && <span className="text-emerald-400">{counts.approved} approved</span>}
            {counts.rejected > 0 && <span className="text-red-400">{counts.rejected} rejected</span>}
            {counts.published > 0 && <span className="text-white">{counts.published} published</span>}
            {counts.pending > 0 && <span className="text-[#555]">{counts.pending} pending</span>}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-white mb-1">
          Content Fixes for {brand}
        </h1>
        <p className="text-[#666] text-sm mb-5">
          AI-generated content fixes based on your GEO audit. Review, edit, and approve each piece.
        </p>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6">
          {([
            ["all", `All (${fixes.length})`],
            ["on-site", `On-Site (${onsiteCount})`],
            ["off-site", `Off-Site (${offsiteCount})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                filter === key
                  ? "bg-white text-black font-medium"
                  : "bg-[#111] text-[#888] hover:text-white border border-[#222]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(fix => {
            const s = getStatus(fix);
            const cfg = statusConfig[s];
            const { icon, color } = getPlatformIcon(fix.platform);
            const isExpanded = expanded === fix.id;

            return (
              <div
                key={fix.id}
                className={`rounded-xl border bg-[#0d0d0d] overflow-hidden transition-all ${
                  isExpanded
                    ? "col-span-1 md:col-span-2 lg:col-span-3 border-[#333]"
                    : "border-[#1a1a1a] hover:border-[#333]"
                }`}
              >
                {/* Card header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-[#555] uppercase tracking-wider mb-0.5">
                          {fix.platform}
                        </div>
                        <div className={`text-sm font-medium leading-tight ${s === "rejected" ? "line-through text-[#555]" : "text-white"}`}>
                          {fix.title}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[#777] text-xs leading-relaxed mb-3">{fix.description}</p>

                  {/* Tags */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                      fix.type === "on-site"
                        ? "bg-emerald-500/8 text-emerald-400/80 border-emerald-500/15"
                        : "bg-blue-500/8 text-blue-400/80 border-blue-500/15"
                    }`}>
                      {fix.type}
                    </span>
                    <span className="text-[10px] text-[#444]">#{fix.priority}</span>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : fix.id)}
                      className="text-[11px] px-3 py-1.5 rounded-md bg-[#151515] text-[#888] border border-[#222] hover:text-white hover:border-[#444] transition-colors"
                    >
                      {isExpanded ? "Collapse" : "Preview"}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(fix.content).then(() => {
                          setCopied(fix.id);
                          setTimeout(() => setCopied(null), 2000);
                        });
                      }}
                      className="text-[11px] px-3 py-1.5 rounded-md bg-[#151515] text-[#888] border border-[#222] hover:text-white hover:border-[#444] transition-colors"
                    >
                      {copied === fix.id ? "Copied" : "Copy"}
                    </button>
                    {s === "drafted" && (
                      <>
                        <button
                          onClick={() => updateStatus(fix.id, "approved")}
                          className="text-[11px] px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(fix.id, "rejected")}
                          className="text-[11px] px-3 py-1.5 rounded-md bg-[#151515] text-[#666] border border-[#222] hover:text-red-400 hover:border-red-500/20 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(s === "approved" || s === "rejected") && (
                      <button
                        onClick={() => updateStatus(fix.id, "drafted")}
                        className="text-[11px] px-3 py-1.5 rounded-md bg-[#151515] text-[#666] border border-[#222] hover:text-white hover:border-[#444] transition-colors"
                      >
                        Revert
                      </button>
                    )}
                    {s === "drafted" && !suggestionSent.has(fix.id) && (
                      <button
                        onClick={() => { setSuggesting(suggesting === fix.id ? null : fix.id); setSuggestionText(""); }}
                        className="text-[11px] px-2.5 py-1.5 rounded-md bg-[#151515] text-[#666] border border-[#222] hover:text-white hover:border-[#444] transition-colors"
                        title="Suggest Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      </button>
                    )}
                    {suggestionSent.has(fix.id) && (
                      <span className="text-[11px] text-[#444]">Suggestion sent</span>
                    )}
                  </div>

                  {/* Suggestion input */}
                  {suggesting === fix.id && (
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        value={suggestionText}
                        onChange={(e) => setSuggestionText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitSuggestion(fix.id); }}
                        placeholder="What would you change?"
                        className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#444]"
                        autoFocus
                      />
                      <button
                        onClick={() => submitSuggestion(fix.id)}
                        disabled={!suggestionText.trim()}
                        className="text-xs px-4 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-30"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-[#1a1a1a] px-5 py-5 bg-[#080808]">
                    <div className="prose prose-invert prose-sm max-w-none text-[#ccc] [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_a]:text-white [&_code]:bg-[#1a1a1a] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-[#111] [&_pre]:border [&_pre]:border-[#1a1a1a] [&_pre]:rounded-lg [&_pre]:p-4 [&_table]:border-collapse [&_td]:border [&_td]:border-[#222] [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-[#222] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[#888] [&_blockquote]:border-l-2 [&_blockquote]:border-[#333] [&_blockquote]:pl-4 [&_blockquote]:text-[#888]">
                      <ReactMarkdown>{fix.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center">
          <p className="text-[#444] text-xs">
            <a href="https://xanlens.com" className="text-[#555] hover:text-white transition-colors">XanLens</a> · {jobId.slice(0, 8)}
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { motion } from "framer-motion";
import { Section, SectionTitle, ScoreRing, InlineIcon, scoreColor, barColor } from "./primitives";

/* ─── Types ─── */

interface HealthCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  value: string;
  recommendation?: string;
  impact: "high" | "medium" | "low";
}

interface BacklinkData {
  referringDomains: number;
  categories: Record<string, number>;
  topReferrers: { domain: string; title?: string }[];
}

export interface WebsiteHealthData {
  checks: HealthCheck[];
  score: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  backlinks?: BacklinkData;
}

/* ─── Status helpers ─── */

const STATUS_CONFIG = {
  pass: { icon: "✓", color: "text-[#2596be]", bg: "bg-[#2596be]/10 border-[#2596be]/20", label: "Pass" },
  warn: { icon: "⚠", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10 border-[#F59E0B]/20", label: "Warning" },
  fail: { icon: "✗", color: "text-[#EF4444]", bg: "bg-[#EF4444]/10 border-[#EF4444]/20", label: "Fail" },
} as const;

const IMPACT_CONFIG = {
  high: { label: "High Impact", color: "text-[#EF4444]", bg: "bg-[#EF4444]/10", border: "border-[#EF4444]/15" },
  medium: { label: "Medium Impact", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/15" },
  low: { label: "Low Impact", color: "text-[#555]", bg: "bg-[#111]", border: "border-[#222]" },
} as const;

function CheckRow({ check, index }: { check: HealthCheck; index: number }) {
  const status = STATUS_CONFIG[check.status];
  const [expanded, setExpanded] = React.useState(false);
  const hasRec = check.status !== "pass" && check.recommendation;

  return (
    <motion.div
      className={`rounded-xl border p-4 ${check.status === "fail" ? "border-[#EF4444]/10 bg-[#EF4444]/[0.02]" : check.status === "warn" ? "border-[#F59E0B]/10 bg-[#F59E0B]/[0.02]" : "border-[#191919] bg-[#0c0c0c]"}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 + index * 0.03 }}
    >
      <div
        className={`flex items-center gap-3 ${hasRec ? "cursor-pointer" : ""}`}
        onClick={() => hasRec && setExpanded(!expanded)}
      >
        {/* Status icon */}
        <span className={`text-[13px] font-bold shrink-0 w-5 text-center ${status.color}`}>
          {status.icon}
        </span>

        {/* Name + value */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] text-[#ddd] font-medium">{check.name}</span>
            <span className="text-[11px] text-[#555]">{check.value}</span>
          </div>
        </div>

        {/* Impact badge */}
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${IMPACT_CONFIG[check.impact].bg} ${IMPACT_CONFIG[check.impact].color}`}>
          {check.impact}
        </span>

        {/* Expand chevron */}
        {hasRec && (
          <span className={`text-[#444] text-[11px] transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}>▼</span>
        )}
      </div>

      {/* Recommendation */}
      {expanded && hasRec && (
        <div className="mt-3 ml-8 pl-3 border-l-2 border-[#222]">
          <p className="text-[12px] text-[#888] leading-relaxed">{check.recommendation}</p>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main Component ─── */

export default function WebsiteHealthSection({ data }: { data: WebsiteHealthData }) {
  if (!data || !data.checks) return null;

  const { checks, score, passCount, warnCount, failCount, backlinks } = data;

  // Group by impact
  const highChecks = checks.filter(c => c.impact === "high");
  const mediumChecks = checks.filter(c => c.impact === "medium");
  const lowChecks = checks.filter(c => c.impact === "low");

  const impactGroups = [
    { key: "high", label: "High Impact", checks: highChecks, config: IMPACT_CONFIG.high },
    { key: "medium", label: "Medium Impact", checks: mediumChecks, config: IMPACT_CONFIG.medium },
    { key: "low", label: "Low Impact", checks: lowChecks, config: IMPACT_CONFIG.low },
  ].filter(g => g.checks.length > 0);

  return (
    <>
      <Section delay={0.4}>
        <SectionTitle
          icon="M22 11.08V12a10 10 0 1 1-5.93-9.14|M22 4L12 14.01l-3-3"
          info="A quick health check of your website's technical fundamentals — meta tags, structured data, accessibility, and content depth. These affect how AI engines crawl and understand your site."
          right={
            <span className={`text-[12px] font-medium px-3 py-1.5 rounded-full ${score >= 75 ? "text-[#2596be] bg-[#2596be]/10" : score >= 50 ? "text-[#F59E0B] bg-[#F59E0B]/10" : "text-[#EF4444] bg-[#EF4444]/10"}`}>
              {passCount} pass · {warnCount} warn · {failCount} fail
            </span>
          }
        >
          Website Health
        </SectionTitle>

        {/* Score + summary row */}
        <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
          <ScoreRing score={score} size={140} strokeWidth={8} delay={0.45} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[24px] font-bold text-white mb-1">Health Score</p>
            <p className="text-[13px] text-[#666] mb-4">
              {score >= 80 ? "Your site is well-optimized. Minor tweaks could push it further." :
               score >= 60 ? "Decent foundation with notable gaps. Address warnings to improve." :
               score >= 40 ? "Several issues need attention. Focus on high-impact items first." :
               "Significant problems detected. Prioritize the failing checks below."}
            </p>

            {/* Pass/Warn/Fail mini bars */}
            <div className="flex items-center gap-4">
              {[
                { label: "Pass", count: passCount, color: "bg-[#2596be]" },
                { label: "Warn", count: warnCount, color: "bg-[#F59E0B]" },
                { label: "Fail", count: failCount, color: "bg-[#EF4444]" },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[12px] text-[#888]">{count} {label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stacked bar showing pass/warn/fail ratio */}
        <div className="w-full h-2 bg-[#111] rounded-full overflow-hidden flex mb-8">
          {checks.length > 0 && (
            <>
              <motion.div
                className="h-full bg-[#2596be]"
                initial={{ width: 0 }}
                animate={{ width: `${(passCount / checks.length) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.5 }}
              />
              <motion.div
                className="h-full bg-[#F59E0B]"
                initial={{ width: 0 }}
                animate={{ width: `${(warnCount / checks.length) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.6 }}
              />
              <motion.div
                className="h-full bg-[#EF4444]"
                initial={{ width: 0 }}
                animate={{ width: `${(failCount / checks.length) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.7 }}
              />
            </>
          )}
        </div>

        {/* Checks grouped by impact */}
        <div className="space-y-6">
          {impactGroups.map((group) => (
            <div key={group.key}>
              <p className={`text-[11px] uppercase tracking-widest font-medium mb-3 ${group.config.color}`}>
                {group.label}
              </p>
              <div className="space-y-2">
                {group.checks.map((check, i) => (
                  <CheckRow key={check.name} check={check} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Backlinks section */}
      {backlinks && backlinks.referringDomains > 0 && (
        <Section delay={0.45}>
          <SectionTitle
            icon="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71|M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            right={
              <span className="text-[12px] font-medium px-3 py-1.5 rounded-full text-[#2596be] bg-[#2596be]/10">
                {backlinks.referringDomains} referring domain{backlinks.referringDomains !== 1 ? "s" : ""}
              </span>
            }
          >
            Backlink Profile
          </SectionTitle>

          {/* Category breakdown */}
          {Object.keys(backlinks.categories).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {Object.entries(backlinks.categories).map(([cat, count]) => (
                <div key={cat} className="rounded-xl border border-[#191919] bg-[#0c0c0c] p-4 text-center">
                  <p className="text-[20px] font-bold text-white">{count}</p>
                  <p className="text-[11px] text-[#555] mt-1 capitalize">{cat}</p>
                </div>
              ))}
            </div>
          )}

          {/* Top referrers */}
          {backlinks.topReferrers && backlinks.topReferrers.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-[#444] font-medium mb-3">Top Referrers</p>
              <div className="space-y-2">
                {backlinks.topReferrers.map((ref, i) => (
                  <motion.div
                    key={ref.domain}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#191919] bg-[#0c0c0c]"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.04 }}
                  >
                    <div className="w-6 h-6 rounded-md bg-[#111] border border-[#222] flex items-center justify-center shrink-0">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${ref.domain}&sz=32`}
                        alt=""
                        width={14}
                        height={14}
                        className="rounded-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#ddd] font-medium truncate">{ref.domain}</p>
                      {ref.title && <p className="text-[11px] text-[#555] truncate">{ref.title}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}
    </>
  );
}

"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

interface AuditEntry {
  slug: string;
  brand: string;
  industry: string;
  website: string | null;
  overall_score: number;
  grade: string;
  timestamp: string;
}

function getGradeColor(grade: string): string {
  if (grade === "A" || grade === "A+") return "text-[#2596be]";
  if (grade === "B" || grade === "B+") return "text-[#5cb8d6]";
  if (grade === "C" || grade === "C+") return "text-[#F59E0B]";
  if (grade === "D" || grade === "D+") return "text-[#F97316]";
  return "text-[#EF4444]";
}

export default function AuditsListClient({ audits, industries }: { audits: AuditEntry[]; industries: string[] }) {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("all");
  const [sortBy, setSortBy] = useState<"score" | "name" | "date">("score");

  const filtered = useMemo(() => {
    let result = audits;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.brand.toLowerCase().includes(q) || a.industry.toLowerCase().includes(q));
    }
    if (industry !== "all") {
      result = result.filter((a) => a.industry === industry);
    }
    if (sortBy === "score") result = [...result].sort((a, b) => b.overall_score - a.overall_score);
    else if (sortBy === "name") result = [...result].sort((a, b) => a.brand.localeCompare(b.brand));
    else result = [...result].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return result;
  }, [audits, search, industry, sortBy]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-white placeholder-[#444] focus:border-[#333] focus:outline-none text-[14px]"
        />
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-[#999] focus:border-[#333] focus:outline-none text-[14px]"
        >
          <option value="all">All industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "score" | "name" | "date")}
          className="px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-[#999] focus:border-[#333] focus:outline-none text-[14px]"
        >
          <option value="score">Sort by score</option>
          <option value="name">Sort by name</option>
          <option value="date">Sort by date</option>
        </select>
      </div>

      <p className="text-[12px] text-[#666] mb-4">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((audit, i) => (
          <motion.a
            key={audit.slug}
            href={`/audit/${audit.slug}`}
            className="block rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-5 hover:border-[#333] transition-colors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5) }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[15px] font-medium">{audit.brand}</h3>
                <p className="text-[11px] text-[#666]">{audit.industry}</p>
              </div>
              <div className="text-right">
                <p className="text-[1.5rem] font-semibold leading-none">{audit.overall_score}</p>
                <p className={`text-[12px] font-medium ${getGradeColor(audit.grade)}`}>{audit.grade}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#555]">
              <span>{new Date(audit.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              <span className="text-[#666]">View →</span>
            </div>
          </motion.a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[15px] text-[#666]">No audits found.</p>
          <a href="/dashboard" className="text-[13px] text-[#999] hover:text-white transition-colors mt-2 inline-block">Audit your brand →</a>
        </div>
      )}
    </div>
  );
}

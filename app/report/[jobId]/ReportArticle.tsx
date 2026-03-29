"use client";

interface Engine {
  score: number;
  mentions: number;
  sentiment: string;
  model_name?: string;
}

interface BlindSpot {
  prompt: string;
  engine: string;
  severity: string;
}

interface AuditResult {
  brand: string;
  website?: string;
  industry?: string;
  overall_score: number;
  knowledge_score: number;
  discoverability_score: number;
  citation_score: number;
  grade: string;
  narrative?: string;
  engines?: Record<string, Engine>;
  prompt_coverage?: { coverage_pct: number; mentioned_in: number; tested: number };
  blind_spots?: { count: number; prompts?: BlindSpot[] };
  timestamp?: string;
  done?: number;
  total?: number;
}

function scoreColor(val: number): string {
  if (val >= 75) return "#2596be";
  if (val >= 50) return "#F59E0B";
  if (val >= 25) return "#F97316";
  return "#EF4444";
}

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "A+") return "#2596be";
  if (grade === "B" || grade === "B+") return "#5cb8d6";
  if (grade === "C" || grade === "C+") return "#F59E0B";
  if (grade === "D" || grade === "D+") return "#F97316";
  return "#EF4444";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-4">
      <span className="text-[13px] text-[#888] w-[120px] shrink-0">{label}</span>
      <div className="flex-1 h-[8px] bg-[#141414] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[15px] font-semibold w-[36px] text-right" style={{ color }}>{value}</span>
    </div>
  );
}

const ENGINE_NAMES: Record<string, string> = {
  gemini: "Gemini",
  chatgpt: "ChatGPT",
  gpt4o: "GPT-4o",
  perplexity: "Perplexity",
  claude: "Claude",
  deepseek: "DeepSeek",
  grok: "Grok",
  copilot: "Copilot",
  llama: "Llama",
  qwen: "Qwen",
};

function getVerdict(score: number): string {
  if (score >= 90) return "Excellent AI visibility. AI engines know and actively recommend this brand.";
  if (score >= 75) return "Good visibility with room to grow. Present in most AI conversations.";
  if (score >= 60) return "Moderate visibility. Missing from key AI conversations.";
  if (score >= 40) return "Low visibility. Most AI engines rarely mention this brand.";
  return "Critical. Virtually invisible to AI search engines.";
}

function extractFindings(result: AuditResult): { type: "positive" | "warning" | "negative"; text: string }[] {
  const findings: { type: "positive" | "warning" | "negative"; text: string }[] = [];
  const engines = result.engines || {};
  const engineNames = Object.entries(engines);

  // Strong engines
  const strong = engineNames.filter(([, e]) => e.score >= 80).map(([k]) => ENGINE_NAMES[k] || k);
  if (strong.length > 0) {
    findings.push({ type: "positive", text: `Strong presence in ${strong.slice(0, 3).join(", ")}${strong.length > 3 ? ` and ${strong.length - 3} more` : ""}` });
  }

  // Knowledge
  if (result.knowledge_score >= 80) {
    findings.push({ type: "positive", text: "Deep knowledge base — AI engines understand this brand well" });
  } else if (result.knowledge_score < 50) {
    findings.push({ type: "negative", text: "Weak knowledge signal — AI engines have limited understanding" });
  }

  // Coverage
  const cov = result.prompt_coverage;
  if (cov) {
    if (cov.coverage_pct >= 80) {
      findings.push({ type: "positive", text: `Mentioned in ${cov.coverage_pct}% of relevant prompts` });
    } else if (cov.coverage_pct < 50) {
      findings.push({ type: "warning", text: `Only mentioned in ${cov.coverage_pct}% of prompts tested` });
    }
  }

  // Blind spots
  if (result.blind_spots && result.blind_spots.count > 0) {
    const high = (result.blind_spots.prompts || []).filter(b => b.severity === "high").length;
    if (high > 0) {
      findings.push({ type: "negative", text: `${high} high-severity blind spot${high > 1 ? "s" : ""} detected` });
    } else {
      findings.push({ type: "warning", text: `${result.blind_spots.count} blind spot${result.blind_spots.count > 1 ? "s" : ""} found across engines` });
    }
  }

  // Weak engines
  const weak = engineNames.filter(([, e]) => e.score < 40).map(([k]) => ENGINE_NAMES[k] || k);
  if (weak.length > 0) {
    findings.push({ type: "negative", text: `Weak or absent in ${weak.join(", ")}` });
  }

  // Citation
  if (result.citation_score < 40) {
    findings.push({ type: "warning", text: "Low citation score — AI rarely links back to official sources" });
  }

  return findings.slice(0, 5);
}

export default function ReportArticle({ jobId, result }: { jobId: string; result: AuditResult }) {
  const engines = result.engines || {};
  const engineCount = Object.keys(engines).length;
  const findings = extractFindings(result);
  const date = result.timestamp ? new Date(result.timestamp).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

  // Extract first paragraph from narrative as summary
  const narrativeLines = (result.narrative || "").split("\n").filter(l => l.trim());
  const narrativeTitle = narrativeLines.find(l => l.startsWith("##"))?.replace(/^#+\s*/, "") || "";
  const narrativeSummary = narrativeLines.filter(l => !l.startsWith("#") && l.trim().length > 20).slice(0, 3).join(" ").replace(/\*\*/g, "");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pt-24 pb-20">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[12px] text-[#555] uppercase tracking-[2px] mb-3">GEO Audit Report</p>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-semibold tracking-tight leading-[1.15] mb-4">
            {result.brand}
          </h1>
          <div className="flex items-center gap-3 text-[13px] text-[#666]">
            {result.industry && <span>{result.industry}</span>}
            {result.website && (
              <>
                <span>·</span>
                <a href={`https://${result.website}`} target="_blank" rel="noopener" className="hover:text-white transition-colors">{result.website}</a>
              </>
            )}
            {date && (
              <>
                <span>·</span>
                <span>{date}</span>
              </>
            )}
          </div>
        </div>

        {/* Score Card Image */}
        <div className="mb-10 rounded-xl overflow-hidden border border-[#1a1a1a]">
          <img
            src={`/api/v1/report/card?jobId=${jobId}`}
            alt={`${result.brand} GEO Score: ${result.overall_score}/100`}
            width={1200}
            height={675}
            className="w-full h-auto"
          />
        </div>

        {/* Verdict */}
        <div className="mb-10">
          <p className="text-[17px] text-[#ccc] leading-relaxed">
            {result.brand} scored <span className="font-semibold" style={{ color: scoreColor(result.overall_score) }}>{result.overall_score}/100</span>{" "}
            (Grade <span className="font-semibold" style={{ color: gradeColor(result.grade) }}>{result.grade}</span>) on AI visibility.{" "}
            {getVerdict(result.overall_score)}
          </p>
        </div>

        {/* Narrative */}
        {narrativeTitle && (
          <div className="mb-10">
            <h2 className="text-[20px] font-semibold mb-4">{narrativeTitle}</h2>
            <p className="text-[15px] text-[#999] leading-[1.7]">{narrativeSummary}</p>
          </div>
        )}

        {/* Score Breakdown */}
        <div className="mb-10">
          <h2 className="text-[18px] font-semibold mb-5">Score Breakdown</h2>
          <div className="flex flex-col gap-4 p-5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <ScoreBar label="Knowledge" value={result.knowledge_score} />
            <ScoreBar label="Discoverability" value={result.discoverability_score} />
            <ScoreBar label="Citation" value={result.citation_score} />
          </div>
          <p className="text-[11px] text-[#444] mt-3">
            Based on {result.prompt_coverage?.tested || result.total || 0} prompts across {engineCount} AI engines
          </p>
        </div>

        {/* Key Findings */}
        {findings.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[18px] font-semibold mb-5">Key Findings</h2>
            <div className="flex flex-col gap-3">
              {findings.map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                  <span className="text-[16px] mt-0.5 shrink-0">
                    {f.type === "positive" ? "✅" : f.type === "warning" ? "⚠️" : "❌"}
                  </span>
                  <p className="text-[14px] text-[#bbb] leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Engine Overview */}
        <div className="mb-10">
          <h2 className="text-[18px] font-semibold mb-5">Engine Coverage</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(engines).map(([key, eng]) => {
              const name = ENGINE_NAMES[key] || key;
              const mentioned = eng.mentions > 0 || eng.score > 20;
              return (
                <div key={key} className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                  <span className={`text-[14px] ${mentioned ? "opacity-100" : "opacity-30"}`}>
                    {mentioned ? "✓" : "✗"}
                  </span>
                  <span className={`text-[13px] ${mentioned ? "text-[#bbb]" : "text-[#444]"}`}>{name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="p-6 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a] text-center">
          <h3 className="text-[16px] font-semibold mb-2">Want the full audit?</h3>
          <p className="text-[13px] text-[#777] mb-5 max-w-[400px] mx-auto">
            Get detailed engine analysis, competitor comparison, blind spot breakdown, and actionable content fixes.
          </p>
          <a
            href={`/dashboard?jobId=${jobId}`}
            className="inline-block px-6 py-2.5 rounded-xl bg-white text-black text-[13px] font-semibold hover:bg-[#e5e5e5] transition-colors"
          >
            View Full Report →
          </a>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[#141414] flex items-center justify-between">
          <span className="text-[11px] text-[#444]">Powered by XanLens</span>
          <a href="/audits" className="text-[11px] text-[#555] hover:text-white transition-colors">← GEO Index</a>
        </div>
      </div>
    </div>
  );
}

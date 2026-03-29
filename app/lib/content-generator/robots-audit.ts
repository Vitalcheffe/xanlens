interface RobotsCrawlerResult {
  crawler: string;
  blocked: boolean;
  rules: string[];
}

interface RobotsAuditResult {
  fetched: boolean;
  error?: string;
  raw?: string;
  crawlers: RobotsCrawlerResult[];
  summary: { allowed: string[]; blocked: string[] };
  recommendations: string[];
}

const AI_CRAWLERS = [
  "GPTBot", "ChatGPT-User", "Google-Extended", "anthropic",
  "ClaudeBot", "Bytespider", "CCBot", "PerplexityBot",
  "Amazonbot", "FacebookBot", "meta-externalagent", "cohere-ai",
];

export async function auditRobotsTxt(url: string): Promise<RobotsAuditResult> {
  const cleanUrl = url.replace(/\/+$/, "");
  let robotsTxt: string;

  try {
    const res = await fetch(`${cleanUrl}/robots.txt`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return {
        fetched: false,
        error: `robots.txt returned ${res.status}`,
        crawlers: AI_CRAWLERS.map(c => ({ crawler: c, blocked: false, rules: [] })),
        summary: { allowed: [...AI_CRAWLERS], blocked: [] },
        recommendations: ["No robots.txt found — all AI crawlers have unrestricted access."],
      };
    }
    robotsTxt = await res.text();
  } catch (e) {
    return {
      fetched: false,
      error: `Failed to fetch robots.txt: ${e instanceof Error ? e.message : "unknown"}`,
      crawlers: AI_CRAWLERS.map(c => ({ crawler: c, blocked: false, rules: [] })),
      summary: { allowed: [...AI_CRAWLERS], blocked: [] },
      recommendations: ["Could not fetch robots.txt — ensure the file is accessible."],
    };
  }

  const lines = robotsTxt.split("\n").map(l => l.trim());
  const crawlerResults: RobotsCrawlerResult[] = [];

  for (const crawler of AI_CRAWLERS) {
    let currentAgent = "";
    let blocked = false;
    const rules: string[] = [];
    const crawlerLower = crawler.toLowerCase();

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith("user-agent:")) {
        currentAgent = lower.replace("user-agent:", "").trim();
      } else if (currentAgent === crawlerLower || currentAgent === "*") {
        if (lower.startsWith("disallow:")) {
          const path = line.split(":").slice(1).join(":").trim();
          if (path === "/" || path === "/*") {
            if (currentAgent === crawlerLower) {
              blocked = true;
              rules.push(line);
            } else if (currentAgent === "*") {
              if (!blocked) { blocked = true; rules.push(`${line} (via User-agent: *)`); }
            }
          } else if (path && currentAgent === crawlerLower) {
            rules.push(line);
          }
        }
      }
    }

    let tempAgent = "";
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith("user-agent:")) {
        tempAgent = lower.replace("user-agent:", "").trim();
      } else if (tempAgent === crawlerLower && lower.startsWith("allow:")) {
        const path = line.split(":").slice(1).join(":").trim();
        if (path === "/" || path === "/*") { blocked = false; }
      }
    }

    crawlerResults.push({ crawler, blocked, rules });
  }

  const allowed = crawlerResults.filter(c => !c.blocked).map(c => c.crawler);
  const blockedList = crawlerResults.filter(c => c.blocked).map(c => c.crawler);

  const recommendations: string[] = [];
  if (blockedList.length === 0) {
    recommendations.push("No AI crawlers are currently blocked.");
  }
  if (allowed.length > 0 && blockedList.length > 0) {
    recommendations.push(`Partial blocking detected: ${blockedList.length} blocked, ${allowed.length} allowed.`);
  }
  if (blockedList.length === AI_CRAWLERS.length) {
    recommendations.push("All major AI crawlers are blocked. This may reduce your visibility in AI-generated answers.");
  }
  if (!blockedList.includes("Bytespider")) {
    recommendations.push("Bytespider (ByteDance) is not blocked — it's one of the most aggressive AI crawlers.");
  }

  return {
    fetched: true,
    raw: robotsTxt.slice(0, 2000),
    crawlers: crawlerResults,
    summary: { allowed, blocked: blockedList },
    recommendations,
  };
}

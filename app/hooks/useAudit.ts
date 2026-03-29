"use client";

import { useState, useCallback } from "react";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) throw new Error(`Empty response (status ${res.status})`);
  try { return JSON.parse(text); } catch { throw new Error(`Invalid response: ${text.slice(0, 100)}`); }
}

// Retry wrapper: tries up to `maxRetries` times with delay between attempts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWithRetry(url: string, maxRetries = 3, retryDelayMs = 3000): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        if (attempt < maxRetries) { await delay(retryDelayMs); continue; }
        return null;
      }
      const data = await res.json();
      if (data.error) {
        if (attempt < maxRetries) { await delay(retryDelayMs); continue; }
        return null;
      }
      return data;
    } catch {
      if (attempt < maxRetries) { await delay(retryDelayMs); continue; }
      return null;
    }
  }
  return null;
}

interface AuditProgress {
  done: number;
  total: number;
  phase: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditResult = any;

export function useAudit(isPro: boolean, wallet?: string | null) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<AuditProgress>({ done: 0, total: 0, phase: "" });

  const runAudit = useCallback(async (url: string) => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setProgress({ done: 0, total: 0, phase: "Detecting brand..." });

    try {
      // Step 1: Auto-detect brand, industry, competitors
      const detectRes = await fetch("/api/v1/audit/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: url.trim() }),
      });
      if (!detectRes.ok) throw new Error(`Brand detection failed (HTTP ${detectRes.status}). Try again.`);
      const detected = await safeJson(detectRes).catch(() => { throw new Error("Brand detection returned invalid data. Try again."); });
      if (detected.error) throw new Error(`Detection: ${detected.error}`);

      const { brand, industry, competitors, website, keywords, features = [], suggestedPrompts = [], description = "" } = detected;
      setProgress({ done: 0, total: 0, phase: "Creating audit plan..." });

      // Step 2: Get the audit plan
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!isPro) headers["X-Source"] = "website";

      const body: Record<string, unknown> = { brand, website, industry, competitors, keywords, features, suggestedPrompts, description };
      if (wallet) body.wallet = wallet;
      const planRes = await fetch("/api/v1/audit", { method: "POST", headers, body: JSON.stringify(body) });
      const plan = await safeJson(planRes).catch(() => { throw new Error("Audit plan returned invalid data. Try again."); });
      if (!planRes.ok || plan.error) {
        throw new Error(plan.error || `Audit plan failed (HTTP ${planRes.status}). Try again.`);
      }

      const jobId = plan.job_id;
      const total = plan.total || 0;
      if (!jobId || total === 0) throw new Error("No audit plan returned. Please try again.");

      setProgress({ done: 0, total, phase: "Querying AI engines..." });

      // Step 3: Fire parallel side-checks with retry (non-blocking)
      const aioUrl = `/api/v1/audit/aio?url=${encodeURIComponent(website)}`;
      const technicalUrl = `/api/v1/audit/technical?url=${encodeURIComponent(website)}&brand=${encodeURIComponent(brand)}&industry=${encodeURIComponent(industry)}`;
      const seoScoreUrl = `/api/v1/audit/seo-score?brand=${encodeURIComponent(brand)}&industry=${encodeURIComponent(industry)}&website=${encodeURIComponent(website)}`;
      const contentOptimizerUrl = `/api/v1/audit/content-optimizer?url=${encodeURIComponent(website)}`;

      const aioPromise = fetchWithRetry(aioUrl, 3, 3000);
      const technicalPromise = fetchWithRetry(technicalUrl, 3, 3000);
      const seoScorePromise = fetchWithRetry(seoScoreUrl, 3, 3000).then(d => d?.available ? d : null);
      const contentOptimizerPromise = isPro ? fetchWithRetry(contentOptimizerUrl, 3, 3000) : Promise.resolve(null);

      // Step 4: Fire prompts with per-engine concurrency control
      // Each engine has its own queue to avoid rate limiting
      const ENGINE_CONCURRENCY: Record<string, number> = {
        gemini: 3,
        gemini_grounded: 2,
        gpt4o: 1,
        claude: 1,
        deepseek: 3,
        grok: 3,
        llama: 5,
        qwen: 5,
      };

      const planItems = plan.plan || [];

      // Group by engine
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byEngine: Record<string, any[]> = {};
      for (const task of planItems) {
        if (!byEngine[task.engine]) byEngine[task.engine] = [];
        byEngine[task.engine].push(task);
      }

      // Per-engine worker: fires prompts sequentially in batches of `concurrency`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function runEngine(engine: string, tasks: any[]) {
        const concurrency = ENGINE_CONCURRENCY[engine] || 3;
        for (let i = 0; i < tasks.length; i += concurrency) {
          const batch = tasks.slice(i, i + concurrency);
          await Promise.allSettled(
            batch.map(task =>
              fetch("/api/v1/audit/prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jobId,
                  engine: task.engine,
                  prompt: task.prompt,
                  promptIndex: task.promptIndex,
                  persona: task.persona,
                }),
              }).catch(() => {})
            )
          );
          // Small delay between batches for the same engine
          if (i + concurrency < tasks.length) await delay(400);
        }
      }

      // All engines run in parallel, each with its own concurrency limit
      const workersPromise = Promise.allSettled(
        Object.entries(byEngine).map(([engine, tasks]) => runEngine(engine, tasks))
      );

      // Step 5: Poll status until done
      let attempts = 0;
      const maxAttempts = 120; // 120 × 3s = 6 min max
      while (attempts < maxAttempts) {
        await delay(3000);
        attempts++;

        try {
          const statusRes = await fetch(`/api/v1/audit/status?jobId=${jobId}&source=${isPro ? "pro" : "website"}`);
          const statusText = await statusRes.text();
          let statusData;
          try { statusData = JSON.parse(statusText); } catch {
            console.warn("Status poll returned non-JSON, retrying...");
            continue;
          }

          if (statusData.status === "processing") {
            const done = statusData.done || 0;
            const pct = Math.round((done / total) * 100);
            setProgress({
              done,
              total,
              phase: `Querying AI engines... ${pct}%`,
            });
            continue;
          }

          // Done or error
          if (statusData.error) throw new Error(String(statusData.error));

          setProgress({ done: total, total, phase: "Finalizing report..." });

          // Wait for all side-checks to finish
          let [aioResult, technicalResult, seoScoreResult, contentOptimizerResult] = await Promise.all([
            aioPromise, technicalPromise, seoScorePromise, contentOptimizerPromise,
          ]);

          // Step 6: Retry any failed side-checks one more time sequentially
          // This catches cases where all parallel requests overwhelmed the server
          if (!aioResult) {
            console.warn("[useAudit] AIO failed, retrying...");
            aioResult = await fetchWithRetry(aioUrl, 2, 2000);
          }
          if (!technicalResult) {
            console.warn("[useAudit] Technical failed, retrying...");
            technicalResult = await fetchWithRetry(technicalUrl, 2, 2000);
          }
          if (!seoScoreResult) {
            console.warn("[useAudit] SEO Score failed, retrying...");
            const seoRetry = await fetchWithRetry(seoScoreUrl, 2, 2000);
            seoScoreResult = seoRetry?.available ? seoRetry : null;
          }
          if (!contentOptimizerResult && isPro) {
            console.warn("[useAudit] Content Optimizer failed, retrying...");
            contentOptimizerResult = await fetchWithRetry(contentOptimizerUrl, 2, 2000);
          }

          const finalResult = statusData;
          finalResult.jobId = jobId;
          if (aioResult) finalResult.aio = aioResult;
          if (technicalResult) finalResult.technical = technicalResult;
          if (contentOptimizerResult) finalResult.content_optimizer = contentOptimizerResult;
          if (seoScoreResult) finalResult.seo_score = seoScoreResult;

          // Log what made it and what didn't
          console.log("[useAudit] Side-checks:", {
            aio: !!aioResult,
            technical: !!technicalResult,
            seoScore: !!seoScoreResult,
            contentOptimizer: !!contentOptimizerResult,
          });
          
          // Update audit record status
          if (wallet && jobId) {
            fetch(`/api/v1/account/audit/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ wallet, jobId, status: "complete", score: finalResult.overall_score }),
              keepalive: true,
            }).catch(() => {});
          }
          
          setResult(finalResult);
          return;
        } catch (pollErr) {
          if (attempts >= maxAttempts) throw pollErr;
        }
      }

      // Ensure workers finish even if polling timed out
      await workersPromise.catch(() => {});
      throw new Error("Audit timed out. Please try again.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setProgress({ done: 0, total: 0, phase: "" });
    }
  }, [isPro, wallet]);

  const reset = useCallback(() => {
    setResult(null);
    setError("");
  }, []);

  return { loading, result, error, progress, runAudit, reset };
}

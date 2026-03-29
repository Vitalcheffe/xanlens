/**
 * DataForSEO Search Volume Lookup
 * Uses task-based endpoint for cost efficiency ($0.05 per batch of up to 700 keywords)
 */

const DATAFORSEO_AUTH = process.env.DATAFORSEO_AUTH; // Base64 encoded login:password

interface VolumeResult {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: string | null;
}

/**
 * Look up search volume for a batch of keywords via DataForSEO
 * Uses live endpoint (slightly more expensive but instant results)
 * Cost: ~$0.025 per keyword, but we batch them
 */
export async function getSearchVolumes(keywords: string[]): Promise<Record<string, VolumeResult>> {
  if (!DATAFORSEO_AUTH || keywords.length === 0) {
    return {};
  }

  // Deduplicate and limit to 700 (API max per request)
  const uniqueKeywords = [...new Set(keywords.map(k => k.toLowerCase().trim()))].slice(0, 700);

  try {
    // Use task_post + task_get for cheaper pricing ($0.05/batch vs $0.025/keyword)
    const postRes = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/task_post", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${DATAFORSEO_AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ keywords: uniqueKeywords }]),
    });

    const postData = await postRes.json();
    if (postData.status_code !== 20000 || !postData.tasks?.[0]?.id) {
      console.error("DataForSEO task_post failed:", postData.status_message);
      return {};
    }

    const taskId = postData.tasks[0].id;

    // Poll for results (usually ready in 2-10 seconds)
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise(r => setTimeout(r, 3000)); // Wait 3s between polls

      const getRes = await fetch(
        `https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/task_get/${taskId}`,
        {
          headers: { "Authorization": `Basic ${DATAFORSEO_AUTH}` },
        }
      );

      const getData = await getRes.json();
      const task = getData.tasks?.[0];

      if (task?.status_code === 20000 && task?.result) {
        // Parse results into a lookup map
        const results: Record<string, VolumeResult> = {};
        for (const r of task.result) {
          if (r.keyword) {
            results[r.keyword.toLowerCase()] = {
              keyword: r.keyword,
              search_volume: r.search_volume ?? null,
              cpc: r.cpc ?? null,
              competition: r.competition ?? null,
            };
          }
        }
        return results;
      }

      // Task not ready yet, keep polling
      if (task?.status_code === 40601) continue; // "Task In Queue"
      if (task?.status_code === 40602) continue; // "Task In Progress"
    }

    console.error("DataForSEO task timed out after 18s");
    return {};
  } catch (err) {
    console.error("DataForSEO error:", err);
    return {};
  }
}

/**
 * Enrich prompt details with search volume data
 */
export function enrichWithVolume(
  prompts: Array<{ prompt: string; [key: string]: unknown }>,
  volumes: Record<string, VolumeResult>
): Array<{ prompt: string; search_volume?: number | null; cpc?: number | null; competition?: string | null; [key: string]: unknown }> {
  return prompts.map(p => {
    const vol = volumes[p.prompt.toLowerCase().trim()];
    return {
      ...p,
      search_volume: vol?.search_volume ?? null,
      cpc: vol?.cpc ?? null,
      competition: vol?.competition ?? null,
    };
  });
}

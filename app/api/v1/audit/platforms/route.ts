import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

interface PlatformResult {
  platform: string;
  found: boolean;
  count: number;
  items: Array<{ title: string; url: string; description?: string; date?: string; stats?: string }>;
  error?: string;
}

// YouTube Data API v3
async function searchYouTube(brand: string, apiKey: string): Promise<PlatformResult> {
  try {
    const q = encodeURIComponent(brand);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&maxResults=10&type=video&order=relevance&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { platform: "youtube", found: false, count: 0, items: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const items = (data.items || []).map((item: any) => ({
      title: item.snippet?.title || "",
      url: `https://youtube.com/watch?v=${item.id?.videoId}`,
      description: item.snippet?.description?.slice(0, 200) || "",
      date: item.snippet?.publishedAt?.split("T")[0] || "",
      stats: item.snippet?.channelTitle || "",
    }));
    return { platform: "youtube", found: items.length > 0, count: data.pageInfo?.totalResults || items.length, items };
  } catch (e: any) {
    return { platform: "youtube", found: false, count: 0, items: [], error: e.message };
  }
}

// X/Twitter API v2 — recent search (last 7 days)
async function searchTwitter(brand: string): Promise<PlatformResult> {
  const CK = process.env.X_CONSUMER_KEY || "";
  const CS = process.env.X_CONSUMER_SECRET || "";
  if (!CK || !CS) return { platform: "twitter", found: false, count: 0, items: [], error: "No X API credentials" };

  try {
    // Get bearer token
    const authRes = await fetch("https://api.twitter.com/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${CK}:${CS}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8000),
    });
    if (!authRes.ok) return { platform: "twitter", found: false, count: 0, items: [], error: `Auth failed: ${authRes.status}` };
    const authData = await authRes.json();
    const bearer = authData.access_token;

    // Search recent tweets
    const q = encodeURIComponent(`${brand} -is:retweet lang:en`);
    const searchRes = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${q}&max_results=10&tweet.fields=created_at,public_metrics,author_id`,
      { headers: { Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!searchRes.ok) {
      if (searchRes.status === 402) {
        return { platform: "twitter", found: false, count: 0, items: [], error: "Paused — search quota reached" };
      }
      const errText = await searchRes.text().catch(() => "");
      return { platform: "twitter", found: false, count: 0, items: [], error: `Search failed: ${searchRes.status}` };
    }
    const searchData = await searchRes.json();
    const tweets = (searchData.data || []).map((t: any) => ({
      title: t.text?.slice(0, 200) || "",
      url: `https://x.com/i/status/${t.id}`,
      date: t.created_at?.split("T")[0] || "",
      stats: t.public_metrics ? `${t.public_metrics.like_count} likes, ${t.public_metrics.retweet_count} RTs` : "",
    }));
    return { platform: "twitter", found: tweets.length > 0, count: searchData.meta?.result_count || tweets.length, items: tweets };
  } catch (e: any) {
    return { platform: "twitter", found: false, count: 0, items: [], error: e.message };
  }
}

// GitHub search API
async function searchGitHub(brand: string): Promise<PlatformResult> {
  try {
    const q = encodeURIComponent(brand);
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=10`,
      { headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { platform: "github", found: false, count: 0, items: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const items = (data.items || []).map((repo: any) => ({
      title: repo.full_name || repo.name,
      url: repo.html_url,
      description: repo.description?.slice(0, 200) || "",
      stats: `⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count}`,
    }));
    return { platform: "github", found: items.length > 0, count: data.total_count || items.length, items };
  } catch (e: any) {
    return { platform: "github", found: false, count: 0, items: [], error: e.message };
  }
}

// Reddit search via old.reddit.com JSON API (no auth, works from server IPs)
async function searchReddit(brand: string): Promise<PlatformResult> {
  try {
    const q = encodeURIComponent(brand);
    const res = await fetch(
      `https://old.reddit.com/search.json?q=${q}&limit=10&sort=relevance&t=year`,
      { headers: { "User-Agent": "XanLens/1.0 (by /u/Fit_Papaya_5495)" }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return { platform: "reddit", found: false, count: 0, items: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const posts = data?.data?.children || [];
    const items = posts.map((p: any) => ({
      title: p.data?.title || "",
      url: `https://reddit.com${p.data?.permalink || ""}`,
      description: (p.data?.selftext || "").slice(0, 200),
      date: p.data?.created_utc ? new Date(p.data.created_utc * 1000).toISOString().split("T")[0] : "",
      stats: `r/${p.data?.subreddit} · ${p.data?.score || 0} pts · ${p.data?.num_comments || 0} comments`,
    }));
    return { platform: "reddit", found: items.length > 0, count: items.length, items };
  } catch (e: any) {
    return { platform: "reddit", found: false, count: 0, items: [], error: e.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled.", status: "maintenance" }, { status: 503 });

    const { brand } = await req.json();
    if (!brand) return NextResponse.json({ error: "Missing brand" }, { status: 400 });

    const geminiKey = process.env.GEMINI_API_KEY || "";

    const results = await Promise.all([
      searchYouTube(brand, geminiKey),
      searchTwitter(brand),
      searchGitHub(brand),
      Promise.resolve({ platform: "reddit", found: false, count: 0, items: [], paused: true, error: "Paused — temporarily unavailable" } as PlatformResult),
    ]);

    return NextResponse.json({ platforms: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}

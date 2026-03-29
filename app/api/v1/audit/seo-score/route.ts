import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Tavily-powered traditional search visibility score
// Compares how visible a brand is in traditional web search vs AI engines

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const industry = req.nextUrl.searchParams.get("industry");
  const website = req.nextUrl.searchParams.get("website") || "";

  if (!brand || !industry) {
    return NextResponse.json({ error: "Missing brand or industry" }, { status: 400 });
  }

  if (!TAVILY_API_KEY) {
    return NextResponse.json({ available: false, message: "Search scoring not configured" });
  }

  try {
    // Run 3 search queries to assess traditional search visibility
    const queries = [
      `"${brand}" ${industry}`,
      `best ${industry} tools`,
      `${brand} review`,
    ];

    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${TAVILY_API_KEY}`,
            },
            body: JSON.stringify({
              query,
              include_answer: true,
              max_results: 10,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return { query, answer: "", results: [] };
          const data = await res.json();
          return {
            query,
            answer: data.answer || "",
            results: (data.results || []).map((r: any) => ({
              title: r.title,
              url: r.url,
              content: (r.content || "").slice(0, 300),
            })),
          };
        } catch {
          return { query, answer: "", results: [] };
        }
      })
    );

    // Normalize brand for matching
    const brandLower = brand.toLowerCase();
    const brandSlug = brandLower.replace(/\s+/g, "");
    let brandDomain = "";
    if (website) {
      try {
        brandDomain = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
      } catch {}
    }

    // Score traditional search visibility
    let totalResults = 0;
    let brandMentions = 0;
    let brandInTop3 = 0;
    let brandInAnswer = 0;
    let brandDomainHits = 0;
    const allSources: string[] = [];

    for (const r of results) {
      // Check answer
      if (r.answer && r.answer.toLowerCase().includes(brandLower)) {
        brandInAnswer++;
      }

      for (let i = 0; i < r.results.length; i++) {
        const item = r.results[i];
        totalResults++;
        const titleLower = (item.title || "").toLowerCase();
        const urlLower = (item.url || "").toLowerCase();
        const contentLower = (item.content || "").toLowerCase();

        const mentioned =
          titleLower.includes(brandLower) ||
          urlLower.includes(brandSlug) ||
          contentLower.includes(brandLower) ||
          (brandDomain && urlLower.includes(brandDomain));

        if (mentioned) {
          brandMentions++;
          if (i < 3) brandInTop3++;
          if (brandDomain && urlLower.includes(brandDomain)) brandDomainHits++;
        }

        try {
          const domain = new URL(item.url).hostname.replace(/^www\./, "");
          if (!allSources.includes(domain)) allSources.push(domain);
        } catch {}
      }
    }

    // Calculate SEO score (0-100)
    let seoScore = 0;

    // Brand appears in search results at all (30 pts)
    if (brandMentions > 0) seoScore += Math.min(brandMentions * 10, 30);

    // Brand in top 3 results (25 pts)
    seoScore += Math.min(brandInTop3 * 12, 25);

    // Brand domain appears in results (20 pts)
    seoScore += Math.min(brandDomainHits * 10, 20);

    // Brand mentioned in Tavily answer (15 pts)
    seoScore += Math.min(brandInAnswer * 8, 15);

    // Coverage across queries (10 pts)
    const queriesWithBrand = results.filter(
      (r) =>
        r.answer?.toLowerCase().includes(brandLower) ||
        r.results.some(
          (item: any) =>
            item.title?.toLowerCase().includes(brandLower) ||
            item.url?.toLowerCase().includes(brandSlug)
        )
    ).length;
    seoScore += Math.round((queriesWithBrand / queries.length) * 10);

    seoScore = Math.min(seoScore, 100);

    const grade =
      seoScore >= 90 ? "A" :
      seoScore >= 75 ? "B" :
      seoScore >= 60 ? "C" :
      seoScore >= 40 ? "D" : "F";

    return NextResponse.json({
      available: true,
      seo_score: seoScore,
      grade,
      brand_mentions: brandMentions,
      total_results: totalResults,
      brand_in_top3: brandInTop3,
      brand_in_answer: brandInAnswer,
      brand_domain_hits: brandDomainHits,
      queries_tested: queries.length,
      queries_with_brand: queriesWithBrand,
      top_sources: allSources.slice(0, 10),
      message:
        seoScore >= 75 && seoScore > 0
          ? "Strong traditional search presence. But how visible are you in AI search?"
          : seoScore >= 40
          ? "Moderate search presence. Your AI visibility may tell a different story."
          : "Low traditional search visibility. AI engines may also struggle to find you.",
    });
  } catch (e: unknown) {
    return NextResponse.json({ available: false, error: (e instanceof Error ? e.message : "Unknown error") }, { status: 500 });
  }
}

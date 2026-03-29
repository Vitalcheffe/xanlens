import { NextRequest, NextResponse } from "next/server";
import { generateAllContent } from "@/app/lib/content-generator";
import { redisGet } from "@/app/lib/redis";
import JSZip from "jszip";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled. Launching soon.", status: "maintenance" }, { status: 503 });

    const body = await request.json();
    const { jobId, wallet, brand, website, industry, format } = body;

    // Option 1: Generate from stored Pro audit (preferred)
    if (jobId) {
      const storedResult = await redisGet(`audit:result:${jobId}`);
      if (!storedResult) {
        return NextResponse.json({ error: "Audit not found. Run a Pro Audit first." }, { status: 404 });
      }
      const auditData = JSON.parse(storedResult);

      // Verify this is a pro audit
      const meta = await redisGet(`audit:meta:${jobId}`);
      const metaParsed = meta ? JSON.parse(meta) : {};
      if (metaParsed.tier === 'free') {
        return NextResponse.json({ error: "GEO Skill requires a Pro Audit. Upgrade to Pro." }, { status: 403 });
      }

      // Verify wallet owns this audit
      if (wallet && metaParsed.wallet && metaParsed.wallet.toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const b = metaParsed.brand || brand || "Unknown";
      const w = metaParsed.website || website || "";
      const ind = metaParsed.industry || industry || "general";

      const content = await generateAllContent(b, w, ind, auditData);
      return buildSkillResponse(b, w, ind, auditData, content, format);
    }

    // Option 2: API with x402 payment (for external agents)
    const xPaymentTx = request.headers.get("x-payment-tx");
    if (!xPaymentTx) {
      return NextResponse.json({
        status: 402, protocol: "x402",
        payment: { network: "base", token: "USDC", amount: "0.99", recipient: "0xB33FF8b810670dFe8117E5936a1d5581A05f350D", chain_id: 8453 },
        instructions: "Send 0.99 USDC on Base. Retry with X-Payment-Tx header. Requires brand + industry. Returns a GEO Skill: SKILL.md + content files + agent-executable playbook.",
      }, { status: 402 });
    }

    // Verify payment
    const v = await verifyPayment(xPaymentTx);
    if (!v.valid) return NextResponse.json({ error: v.error }, { status: 402 });

    if (!brand || !industry) return NextResponse.json({ error: "brand and industry required" }, { status: 400 });

    // Run audit + generate for API callers
    const { runAudit } = await import("@/app/lib/audit");
    const auditResult = await runAudit({ brand, website, industry });
    const content = await generateAllContent(brand, website || "", industry, auditResult);
    return buildSkillResponse(brand, website || "", industry, auditResult, content, format);

  } catch (err) {
    console.error("[/api/v1/skill] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildSkillResponse(brand: string, website: string, industry: string, audit: any, content: any, format?: string) {
  const slug = brand.toLowerCase().replace(/\s+/g, "-");
  const date = new Date().toISOString().split("T")[0];

  if (format === "json") {
    return NextResponse.json({
      skill: "xanlens-geo",
      version: "2.0",
      brand, website, industry,
      generated_at: new Date().toISOString(),
      score: audit.overall_score,
      grade: audit.grade,
      playbook: content.playbook,
      content,
    });
  }

  // Build proper agent skill zip
  const zip = new JSZip();
  const root = `geo-skill-${slug}`;

  // ── SKILL.md — The core file agents read ──
  const skillMd = buildSkillMd(brand, website, industry, audit, content);
  zip.file(`${root}/SKILL.md`, skillMd);

  // ── Playbook ──
  if (content.playbook) zip.file(`${root}/playbook.md`, content.playbook);

  // ── On-page files ──
  const op = content.on_page_rewrites;
  if (op) {
    let onPageMd = `# On-Page Rewrites for ${brand}\n\n`;
    onPageMd += `## Title Tag\n\`\`\`\n${op.title_tag || ""}\n\`\`\`\n\n`;
    onPageMd += `## Meta Description\n\`\`\`\n${op.meta_description || ""}\n\`\`\`\n\n`;
    onPageMd += `## H1 Headline\n\`\`\`\n${op.h1_headline || ""}\n\`\`\`\n\n`;
    onPageMd += `## First 200 Words (Above the Fold)\n${op.first_200_words || ""}\n\n`;
    if (op.h2_h3_structure?.length) {
      onPageMd += `## Heading Structure\n`;
      for (const h of op.h2_h3_structure) onPageMd += `- \`<${h.tag}>\` ${h.text} — ${h.description || ""}\n`;
      onPageMd += "\n";
    }
    if (op.alt_text_suggestions?.length) {
      onPageMd += `## Image Alt Text\n`;
      for (const a of op.alt_text_suggestions) onPageMd += `- **${a.image_description}**: ${a.alt_text}\n`;
      onPageMd += "\n";
    }
    if (op.og_tags) {
      onPageMd += `## OpenGraph Tags\n\`\`\`html\n<meta property="og:title" content="${op.og_tags.title}" />\n<meta property="og:description" content="${op.og_tags.description}" />\n<meta property="og:type" content="${op.og_tags.type || "website"}" />\n\`\`\`\n`;
    }
    zip.file(`${root}/content/on-page-rewrites.md`, onPageMd);
  }
  if (content.schema_markup) zip.file(`${root}/content/schema.jsonld`, content.schema_markup);
  if (content.llms_txt) zip.file(`${root}/content/llms.txt`, content.llms_txt);

  // ── Citation-earning content ──
  if (content.statistics_injection?.length) {
    const stats = content.statistics_injection.map((s: {original_claim: string; rewritten_with_stats: string; source_suggestion: string}, i: number) =>
      `## Claim ${i + 1}\n\n**Original:** ${s.original_claim}\n**Rewritten:** ${s.rewritten_with_stats}\n**Source:** ${s.source_suggestion}`
    ).join("\n\n---\n\n");
    zip.file(`${root}/content/statistics-injection.md`, `# Statistics Injection\n\nReplace vague claims with data-backed statements. +40% AI citation likelihood.\n\n${stats}`);
  }
  if (content.expert_quotes?.length) {
    const quotes = content.expert_quotes.map((q: {context: string; quote_template: string; attribution_format: string}, i: number) =>
      `## Quote ${i + 1}\n\n**Context:** ${q.context}\n**Quote:** "${q.quote_template}"\n**Attribution:** ${q.attribution_format}`
    ).join("\n\n---\n\n");
    zip.file(`${root}/content/expert-quotes.md`, `# Expert Quotes\n\nQuotable statements positioned for AI extraction. +40% citation likelihood.\n\n${quotes}`);
  }
  if (content.faq_headings?.length) {
    const faqs = content.faq_headings.map((f: {question_heading: string; answer_first_sentence: string; full_answer: string}) =>
      `## ${f.question_heading}\n\n${f.answer_first_sentence}\n\n${f.full_answer}`
    ).join("\n\n---\n\n");
    zip.file(`${root}/content/faq-headings.md`, `# FAQ Headings\n\nQuestion-answer format matching how people query AI assistants.\n\n${faqs}`);
  }

  // ── Off-page content ──
  if (content.blog_post) zip.file(`${root}/content/blog-post.md`, content.blog_post);
  if (content.about_page_copy) zip.file(`${root}/content/about-page.md`, content.about_page_copy);
  if (content.faq_page) {
    const faq = content.faq_page as { html: string; jsonLd: string };
    if (faq.html) zip.file(`${root}/content/faq-page.html`, faq.html);
    if (faq.jsonLd) zip.file(`${root}/content/faq-schema.json`, faq.jsonLd);
  }

  // ── Seed citations ──
  if (content.social_posts?.length) {
    zip.file(`${root}/citations/seed-posts.md`,
      `# Seed Citations\n\nPost these across platforms to establish multi-source presence.\n\n` +
      (content.social_posts as string[]).map((p: string, i: number) => `## Post ${i + 1}\n\n${p}`).join("\n\n---\n\n")
    );
  }
  if (content.citation_strategy) zip.file(`${root}/citations/strategy.md`, content.citation_strategy);
  if (content.rag_chunks?.length) {
    zip.file(`${root}/citations/rag-chunks.md`,
      `# RAG-Ready Chunks\n\nPre-formatted content blocks for retrieval-augmented generation.\n\n` +
      (content.rag_chunks as string[]).map((c: string, i: number) => `## Chunk ${i + 1}\n\n${c}`).join("\n\n---\n\n")
    );
  }

  // ── Technical ──
  if (content.robots_audit) zip.file(`${root}/technical/robots-audit.json`, JSON.stringify(content.robots_audit, null, 2));

  // ── Audit snapshot (data only, no methodology) ──
  zip.file(`${root}/audit-snapshot.json`, JSON.stringify({
    brand, website, industry,
    score: audit.overall_score,
    grade: audit.grade,
    generated_at: new Date().toISOString(),
    engines: audit.engine_results,
    blind_spots: audit.blind_spots,
    recommendations: audit.recommendations,
  }, null, 2));

  const zipBuffer = await zip.generateAsync({ type: "uint8array" });

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="geo-skill-${slug}.zip"`,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSkillMd(brand: string, website: string, industry: string, audit: any, content: any): string {
  const date = new Date().toISOString().split("T")[0];
  const score = audit.overall_score || 0;
  const grade = audit.grade || "?";

  return `# GEO Skill — ${brand}

> Generated by XanLens on ${date}. Score: ${score}/100 (Grade ${grade}).
> Re-audit periodically at xanlens.com to regenerate this skill with fresh data.

## Purpose

This skill teaches you how to improve ${brand}'s visibility in AI search engines (ChatGPT, Gemini, Perplexity, Claude, DeepSeek, Grok, Copilot). Follow the instructions below to make AI engines recommend ${brand} when users ask about ${industry}.

## Current State

- **GEO Score:** ${score}/100 (${grade})
- **Industry:** ${industry}
${website ? `- **Website:** ${website}` : ""}
- **Generated:** ${date}

## Priority Actions

${score < 30 ? "⚠️ CRITICAL: Your brand is nearly invisible to AI engines. Execute ALL steps below." : score < 60 ? "Your brand has some visibility but significant gaps. Focus on Weeks 1-2 first." : "Your brand has decent visibility. Focus on citation-earning content to push higher."}

## Execution Plan

Read \`playbook.md\` for the full 4-week plan. Summary:

### Week 1: On-Page Foundation
- Deploy the title tag, meta description, and H1 from \`content/on-page-rewrites.md\`
- Replace your first 200 words with the AI-optimized version
- Add schema markup from \`content/schema.jsonld\`
- Deploy \`content/llms.txt\` at your website root

### Week 2: Citation-Earning Content
- Inject statistics from \`content/statistics-injection.md\` into existing pages
- Add expert quotes from \`content/expert-quotes.md\`
- Publish FAQ content from \`content/faq-headings.md\`
${content.faq_page ? "- Deploy FAQ page from `content/faq-page.html` with schema from `content/faq-schema.json`" : ""}

### Week 3: Off-Page Presence
${content.blog_post ? "- Publish the blog post from `content/blog-post.md`" : ""}
${content.about_page_copy ? "- Update your about page with copy from `content/about-page.md`" : ""}
- Post seed citations from \`citations/seed-posts.md\` across platforms listed in \`citations/strategy.md\`

### Week 4: Monitor & Expand
- Re-audit at xanlens.com to measure improvement
- Continue posting from remaining seed citations
${content.rag_chunks ? "- Submit RAG chunks from `citations/rag-chunks.md` to relevant knowledge bases" : ""}

## File Index

| File | Purpose |
|------|---------|
| \`SKILL.md\` | This file — overview and instructions |
| \`playbook.md\` | Detailed 4-week execution plan |
| \`content/on-page-rewrites.md\` | Title, meta, H1, first 200 words, headings, alt text |
| \`content/schema.jsonld\` | JSON-LD structured data |
| \`content/llms.txt\` | Machine-readable brand file for AI crawlers |
| \`content/statistics-injection.md\` | Data-backed claim rewrites (+40% citation rate) |
| \`content/expert-quotes.md\` | Quotable statements for AI extraction |
| \`content/faq-headings.md\` | FAQ content in question-answer format |
| \`content/blog-post.md\` | Long-form citation-optimized article |
| \`content/about-page.md\` | Entity-rich brand description |
| \`citations/seed-posts.md\` | 20+ ready-to-post citations for multiple platforms |
| \`citations/strategy.md\` | Where to publish for maximum AI coverage |
| \`citations/rag-chunks.md\` | Pre-formatted content for RAG systems |
| \`audit-snapshot.json\` | Raw audit data (scores, blind spots, recommendations) |

## Important

- This skill contains RESULTS only — what to fix and where to post
- Content is personalized based on your ${date} audit data
- AI engine knowledge changes constantly — re-audit monthly
- Do NOT modify the schema or llms.txt structure — they follow specific formats AI engines parse

---

## Share & Save (Optional)

Share your audit results and get **30% off** your next Pro Audit ($0.69 instead of $0.99).

**How to claim:**
1. Download the share image: \`GET https://xanlens.com/api/v1/audit/og?brand=${encodeURIComponent(brand)}&score=${score}&grade=${grade}&industry=${encodeURIComponent(industry)}\`
2. Post about your audit on X or Moltbook (attach the image if you have API access)
3. Tag @xanlens_ in your post
4. Call \`POST /api/v1/share/verify\` with \`{ "wallet": "YOUR_WALLET", "postUrl": "TWEET_URL" }\`
5. Discount auto-applies to your next audit

**Pre-composed message:**
\`\`\`
Just ran a GEO audit on ${brand} — scored ${score}/100 (${grade}) across AI engines.
Check your brand's AI visibility at xanlens.com @xanlens_
\`\`\`

If you don't have X or Moltbook access, skip this step. The skill works regardless.

---

*Generated by [XanLens](https://xanlens.com) — GEO tools for AI agents.*
`;
}

const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const RECIPIENT = "0xB33FF8b810670dFe8117E5936a1d5581A05f350D".toLowerCase();
const BASE_RPC = "https://mainnet.base.org";

async function verifyPayment(txHash: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
    });
    const data = await res.json();
    const receipt = data.result;
    if (!receipt) return { valid: false, error: "Transaction not found" };
    if (receipt.status !== "0x1") return { valid: false, error: "Transaction failed" };
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const recipientPadded = "0x" + RECIPIENT.slice(2).padStart(64, "0");
    for (const log of receipt.logs || []) {
      if (log.address?.toLowerCase() === USDC_CONTRACT && log.topics?.[0] === transferTopic && log.topics?.[2]?.toLowerCase() === recipientPadded) return { valid: true };
    }
    return receipt.to?.toLowerCase() === USDC_CONTRACT ? { valid: true } : { valid: false, error: "No USDC transfer found" };
  } catch { return { valid: false, error: "Verification failed" }; }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/v1/skill",
    description: "Generate a GEO Skill from a Pro Audit. Returns a zip with SKILL.md + content files. Included with Pro Audit ($0.99 USDC).",
    options: [
      { method: "From dashboard (recommended)", fields: { jobId: "required (Pro audit job ID)", wallet: "optional (verification)" } },
      { method: "Via x402 API", fields: { brand: "required", website: "optional", industry: "required" }, price: "$0.99 USDC on Base" },
    ],
    format: "zip (default) or json (format=json)",
  });
}

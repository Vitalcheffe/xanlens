export { generateBlogPost, generateFAQPage, generateSchemaMarkup, generateSocialPosts, generateAboutPageCopy, generateLlmsTxt, generateRagChunks, generateCitationStrategy, generateOnPageRewrites, generateStatisticsInjection, generateExpertQuotes, generateFAQHeadings, generatePlaybook } from "./generators";
export { auditRobotsTxt } from "./robots-audit";
export type { AuditResults } from "./prompt-constants";
export { auditContext } from "./prompt-constants";

import { generateBlogPost, generateFAQPage, generateSchemaMarkup, generateSocialPosts, generateAboutPageCopy, generateLlmsTxt, generateRagChunks, generateCitationStrategy, generateOnPageRewrites, generateStatisticsInjection, generateExpertQuotes, generateFAQHeadings, generatePlaybook } from "./generators";
import { auditRobotsTxt } from "./robots-audit";
import type { AuditResults } from "./prompt-constants";

export async function generateAllContent(brand: string, website: string, industry: string, audit: AuditResults) {
  const robotsAudit = website
    ? await auditRobotsTxt(website).catch(() => ({ fetched: false, error: "Failed", crawlers: [], summary: { allowed: [], blocked: [] }, recommendations: [] }))
    : null;

  // TIER 1 — On-Page Rewrites (highest priority, fastest GEO impact)
  const [onPageRewrites, blogPost, faqPage, schemaMarkup] = await Promise.all([
    generateOnPageRewrites(brand, website, industry, audit).catch((e) => { console.error("[fix] onPage error:", e); return null; }),
    generateBlogPost(brand, industry, audit).catch((e) => { console.error("[fix] blogPost error:", e); return ""; }),
    generateFAQPage(brand, industry, audit).catch((e) => { console.error("[fix] faqPage error:", e); return { html: "", jsonLd: "" }; }),
    generateSchemaMarkup(brand, website || "", industry, audit).catch((e) => { console.error("[fix] schema error:", e); return ""; }),
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  // TIER 2 — Citation-Earning Content (+40% visibility)
  const [statisticsInjection, expertQuotes, faqHeadings, socialPosts] = await Promise.all([
    generateStatisticsInjection(brand, industry, audit).catch((e) => { console.error("[fix] stats error:", e); return []; }),
    generateExpertQuotes(brand, industry, audit).catch((e) => { console.error("[fix] quotes error:", e); return []; }),
    generateFAQHeadings(brand, industry, audit).catch((e) => { console.error("[fix] faqH2 error:", e); return []; }),
    generateSocialPosts(brand, industry, audit).catch((e) => { console.error("[fix] social error:", e); return []; }),
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  // TIER 3 — Off-Page Presence + Technical
  const [aboutPageCopy, llmsTxt, ragChunks, citationStrategy] = await Promise.all([
    generateAboutPageCopy(brand, industry, audit).catch((e) => { console.error("[fix] about error:", e); return ""; }),
    generateLlmsTxt(brand, website || "", audit).catch((e) => { console.error("[fix] llms error:", e); return ""; }),
    generateRagChunks(brand, industry, audit).catch((e) => { console.error("[fix] ragChunks error:", e); return []; }),
    generateCitationStrategy(brand, industry, audit).catch((e) => { console.error("[fix] citation error:", e); return ""; }),
  ]);

  // Generate personalized playbook (references all generated content)
  const playbook = await generatePlaybook(brand, website, industry, audit, {
    hasOnPage: !!onPageRewrites,
    hasStats: Array.isArray(statisticsInjection) && statisticsInjection.length > 0,
    hasQuotes: Array.isArray(expertQuotes) && expertQuotes.length > 0,
    hasFAQ: Array.isArray(faqHeadings) && faqHeadings.length > 0,
    hasBlog: !!blogPost,
    hasSocial: Array.isArray(socialPosts) && socialPosts.length > 0,
    hasSchema: !!schemaMarkup,
    hasLlmsTxt: !!llmsTxt,
  }).catch((e) => { console.error("[fix] playbook error:", e); return ""; });

  return {
    // PLAYBOOK — Start here
    playbook,

    // TIER 1 — On-Page (implement these first)
    on_page_rewrites: onPageRewrites,
    schema_markup: schemaMarkup,
    llms_txt: llmsTxt,

    // TIER 2 — Citation-Earning Content
    statistics_injection: statisticsInjection,
    expert_quotes: expertQuotes,
    faq_headings: faqHeadings,
    faq_page: faqPage,

    // TIER 3 — Off-Page Presence
    blog_post: blogPost,
    social_posts: socialPosts,
    about_page_copy: aboutPageCopy,
    citation_strategy: citationStrategy,
    rag_chunks: ragChunks,

    // Technical
    robots_audit: robotsAudit,

    // Agent toolkit
    agent_toolkit: {
      chrome_setup: {
        description: "Install headless Chrome in restricted sandboxes (no root required).",
        install_command: "curl -fsSL https://xanlens.com/tools/chrome-setup.sh | bash",
        source_command: "source ~/.chrome-sandbox-env",
        github: "https://github.com/FeyDeFi/xanlens/blob/main/tools/agent-chrome-setup.sh",
      },
    },
  };
}

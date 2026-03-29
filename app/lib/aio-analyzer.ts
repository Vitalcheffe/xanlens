// AIO (AI Optimization) On-Page Analyzer
// Analyzes how well a page is optimized for AI engines

export interface CategoryResult {
  score: number;
  details: string[];
  recommendations: string[];
}

export interface AIOResult {
  url: string;
  overall_score: number;
  grade: string;
  categories: {
    structured_data: CategoryResult;
    schema_quality: CategoryResult;
    page_structure: CategoryResult;
    navigation: CategoryResult;
    content_balance: CategoryResult;
    metadata: CategoryResult;
    ai_crawlers: CategoryResult;
  };
  schemas_found: string[];
  timestamp: string;
  partial?: boolean;
  note?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseUrl(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAll(re: RegExp, str: string): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) results.push(m);
  return results;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseJsonLd(html: string): any[] {
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const schemas: any[] = [];
  for (const m of matchAll(re, html)) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) schemas.push(...parsed);
      else schemas.push(parsed);
      // handle @graph
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        schemas.push(...parsed['@graph']);
      }
    } catch { /* skip malformed */ }
  }
  return schemas;
}

function getMeta(html: string, nameOrProp: string): string | null {
  // match name= or property=
  const re = new RegExp(
    `<meta[^>]*(?:name|property)\\s*=\\s*["']${nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>` +
    `|<meta[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:name|property)\\s*=\\s*["']${nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i'
  );
  const m = re.exec(html);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

function countTag(html: string, tag: string): number {
  const re = new RegExp(`<${tag}[\\s>]`, 'gi');
  return matchAll(re, html).length;
}

function getHeadings(html: string): { level: number; text: string }[] {
  const re = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  return matchAll(re, html).map(m => ({
    level: parseInt(m[1][1]),
    text: stripTags(m[2]).substring(0, 80),
  }));
}

function countLinks(html: string, baseUrl: string): { internal: number; external: number } {
  const re = /<a[^>]+href\s*=\s*["']([^"'#]+)["'][^>]*>/gi;
  let internal = 0, external = 0;
  for (const m of matchAll(re, html)) {
    const href = m[1];
    if (href.startsWith('/') || href.startsWith(baseUrl)) internal++;
    else if (href.startsWith('http')) external++;
  }
  return { internal, external };
}

// ---------------------------------------------------------------------------
// Category Analyzers
// ---------------------------------------------------------------------------

const KNOWN_TYPES = ['Organization', 'Product', 'FAQ', 'FAQPage', 'HowTo', 'WebSite', 'BreadcrumbList', 'SoftwareApplication', 'Service', 'Review'];

function analyzeStructuredData(schemas: any[]): CategoryResult {
  const types = schemas.map(s => s['@type']).flat().filter(Boolean);
  const uniqueTypes = [...new Set(types.map(t => typeof t === 'string' ? t : ''))].filter(Boolean);
  const knownFound = uniqueTypes.filter(t => KNOWN_TYPES.includes(t));
  const count = knownFound.length;

  let score = 0;
  if (count === 0) score = 0;
  else if (count <= 2) score = 40;
  else if (count <= 4) score = 60;
  else if (count <= 6) score = 75;
  else score = Math.min(100, 90 + (count - 7) * 2);

  const details: string[] = [
    `Found ${schemas.length} JSON-LD block(s) with ${uniqueTypes.length} unique @type(s)`,
    ...(knownFound.length ? [`Known schemas: ${knownFound.join(', ')}`] : ['No recognized schema types found']),
  ];

  const recommendations: string[] = [];
  const missing = KNOWN_TYPES.filter(t => !knownFound.includes(t) && t !== 'FAQPage');
  if (count === 0) {
    recommendations.push('Add JSON-LD structured data — start with Organization and WebSite schemas');
    recommendations.push('Include FAQ schema to surface Q&A content in AI responses');
    recommendations.push('Add BreadcrumbList schema for navigation context');
  } else {
    if (!knownFound.includes('Organization')) recommendations.push('Add Organization schema with company details for entity recognition');
    if (!knownFound.includes('FAQ') && !knownFound.includes('FAQPage')) recommendations.push('Add FAQPage schema to help AI engines extract Q&A pairs');
    if (!knownFound.includes('BreadcrumbList')) recommendations.push('Add BreadcrumbList schema for navigation hierarchy');
    if (missing.length > 2) recommendations.push(`Consider adding: ${missing.slice(0, 3).join(', ')} schemas`);
  }
  if (recommendations.length === 0) recommendations.push('Structured data coverage is strong — maintain as content evolves');

  return { score, details, recommendations: recommendations.slice(0, 4) };
}

function analyzeSchemaQuality(schemas: any[]): CategoryResult {
  if (schemas.length === 0) {
    return {
      score: 0,
      details: ['No JSON-LD schemas found to evaluate'],
      recommendations: [
        'Add JSON-LD structured data before schema quality can be assessed',
        'Start with Organization schema including name, url, logo, and description',
        'Use Google\'s Rich Results Test to validate your schemas',
      ],
    };
  }

  const BASE_FIELDS = ['@type', 'name', 'description', 'url'];
  const TYPE_FIELDS: Record<string, string[]> = {
    Organization: ['logo', 'sameAs', 'contactPoint', 'foundingDate'],
    FAQPage: ['mainEntity'],
    FAQ: ['mainEntity'],
    Product: ['offers', 'image', 'brand'],
    Service: ['provider', 'serviceType', 'areaServed'],
    WebSite: ['potentialAction', 'publisher'],
    SoftwareApplication: ['operatingSystem', 'applicationCategory', 'offers'],
    Review: ['reviewRating', 'author', 'itemReviewed'],
    HowTo: ['step', 'totalTime'],
    BreadcrumbList: ['itemListElement'],
  };

  let totalFields = 0;
  let presentFields = 0;
  const issues: string[] = [];

  for (const schema of schemas) {
    const type = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
    const required = [...BASE_FIELDS, ...(TYPE_FIELDS[type] || [])];
    totalFields += required.length;
    const missing: string[] = [];
    for (const f of required) {
      if (schema[f] !== undefined && schema[f] !== null && schema[f] !== '') presentFields++;
      else missing.push(f);
    }
    if (missing.length) issues.push(`${type}: missing ${missing.join(', ')}`);
  }

  const pct = totalFields > 0 ? presentFields / totalFields : 0;
  const score = Math.round(pct * 100);

  const details = [
    `Schema completeness: ${Math.round(pct * 100)}% (${presentFields}/${totalFields} fields)`,
    ...(issues.length ? issues.slice(0, 4) : ['All checked schemas have complete required fields']),
  ];

  const recommendations: string[] = [];
  if (pct < 0.5) recommendations.push('Fill in missing required fields — incomplete schemas may be ignored by AI crawlers');
  if (issues.some(i => i.includes('description'))) recommendations.push('Add description field to all schemas — critical for AI content extraction');
  if (issues.some(i => i.includes('sameAs'))) recommendations.push('Add sameAs links (Wikipedia, social profiles) for entity disambiguation');
  if (issues.some(i => i.includes('logo'))) recommendations.push('Add logo URL to Organization schema for brand recognition');
  if (recommendations.length === 0) recommendations.push('Schema quality is solid — consider adding optional fields for richer AI understanding');
  if (recommendations.length < 2) recommendations.push('Validate schemas at https://validator.schema.org/ periodically');

  return { score, details, recommendations: recommendations.slice(0, 4) };
}

function analyzePageStructure(html: string): CategoryResult {
  const headings = getHeadings(html);
  const h1Count = headings.filter(h => h.level === 1).length;
  const semanticTags = ['section', 'article', 'aside', 'header', 'footer', 'main', 'nav'];
  const counts: Record<string, number> = {};
  let semanticTotal = 0;
  for (const tag of semanticTags) {
    const c = countTag(html, tag);
    counts[tag] = c;
    semanticTotal += c;
  }

  // Check heading hierarchy
  let hierarchyOk = true;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      hierarchyOk = false;
      break;
    }
  }

  let score = 0;
  if (h1Count === 1) score += 25;
  else if (h1Count > 1) score += 10;
  if (hierarchyOk && headings.length > 0) score += 20;
  if (counts['main']) score += 15;
  if (counts['nav']) score += 10;
  if (counts['header'] && counts['footer']) score += 10;
  if (semanticTotal >= 5) score += 20;
  else if (semanticTotal >= 3) score += 10;

  const details = [
    `H1 tags: ${h1Count}, total headings: ${headings.length}`,
    `Heading hierarchy: ${hierarchyOk ? 'valid' : 'has gaps (skipped levels)'}`,
    `Semantic elements: ${semanticTags.map(t => `${t}(${counts[t]})`).join(', ')}`,
  ];

  const recommendations: string[] = [];
  if (h1Count === 0) recommendations.push('Add exactly one H1 tag as the primary page heading');
  else if (h1Count > 1) recommendations.push(`Reduce to a single H1 tag (found ${h1Count}) — multiple H1s dilute heading significance`);
  if (!hierarchyOk) recommendations.push('Fix heading hierarchy — don\'t skip levels (e.g., H1→H3 without H2)');
  if (!counts['main']) recommendations.push('Wrap primary content in a <main> element for AI content extraction');
  if (semanticTotal < 3) recommendations.push('Use semantic HTML (<section>, <article>, <aside>) instead of generic <div> elements');
  if (!counts['nav']) recommendations.push('Add <nav> elements to help AI engines understand site navigation');
  if (recommendations.length === 0) recommendations.push('Page structure is well-organized for AI parsing');

  return { score: Math.min(100, score), details, recommendations: recommendations.slice(0, 4) };
}

function analyzeNavigation(html: string, baseUrl: string, hasSitemap: boolean): CategoryResult {
  const links = countLinks(html, baseUrl);
  const hasBreadcrumb = /breadcrumb|aria-label\s*=\s*["']breadcrumb/i.test(html) || /class\s*=\s*["'][^"']*breadcrumb/i.test(html);
  const hasSkipNav = /skip.{0,5}(nav|content|main)/i.test(html);

  let score = 0;
  if (links.internal >= 5) score += 25;
  else if (links.internal >= 2) score += 15;
  if (links.internal > 0 && links.internal > links.external) score += 10;
  if (hasBreadcrumb) score += 20;
  if (hasSitemap) score += 25;
  if (hasSkipNav) score += 10;
  if (links.internal >= 10) score += 10;

  const details = [
    `Internal links: ${links.internal}, External links: ${links.external}`,
    `Breadcrumb navigation: ${hasBreadcrumb ? 'detected' : 'not found'}`,
    `Sitemap.xml: ${hasSitemap ? 'accessible' : 'not found or inaccessible'}`,
    `Skip navigation: ${hasSkipNav ? 'present' : 'not found'}`,
  ];

  const recommendations: string[] = [];
  if (!hasSitemap) recommendations.push('Create and serve a sitemap.xml — essential for AI crawler discovery');
  if (!hasBreadcrumb) recommendations.push('Add breadcrumb navigation to help AI engines understand page hierarchy');
  if (links.internal < 5) recommendations.push('Increase internal linking — helps AI crawlers discover and relate content');
  if (!hasSkipNav) recommendations.push('Add skip navigation links for accessibility and content structure signals');
  if (recommendations.length === 0) recommendations.push('Navigation structure is well-optimized for AI crawlers');

  return { score: Math.min(100, score), details, recommendations: recommendations.slice(0, 4) };
}

function analyzeContentBalance(html: string): CategoryResult {
  const text = stripTags(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const textLen = text.length;
  const htmlLen = html.length;
  const ratio = htmlLen > 0 ? (textLen / htmlLen) * 100 : 0;
  const hasLang = /<html[^>]+lang\s*=/i.test(html);
  const codeBlocks = countTag(html, 'pre') + countTag(html, 'code');

  let score = 0;
  if (ratio >= 40) score += 40;
  else if (ratio >= 25) score += 30;
  else if (ratio >= 20) score += 20;
  else score += 10;

  if (hasLang) score += 20;
  if (wordCount >= 300) score += 25;
  else if (wordCount >= 100) score += 15;
  else score += 5;
  if (codeBlocks > 0) score += 5;
  if (ratio >= 30 && wordCount >= 200) score += 10;

  const details = [
    `Text-to-HTML ratio: ${ratio.toFixed(1)}%`,
    `Word count: ${wordCount.toLocaleString()}`,
    `Lang attribute: ${hasLang ? 'present' : 'missing'}`,
    `Code blocks (pre/code): ${codeBlocks}`,
  ];

  const recommendations: string[] = [];
  if (ratio < 20) recommendations.push(`Text-to-HTML ratio is low (${ratio.toFixed(1)}%) — reduce boilerplate markup and increase content`);
  else if (ratio < 30) recommendations.push('Improve text-to-HTML ratio by reducing unnecessary wrapper elements');
  if (!hasLang) recommendations.push('Add lang attribute to <html> tag — helps AI engines determine content language');
  if (wordCount < 300) recommendations.push(`Content is thin (${wordCount} words) — aim for 500+ words for substantive AI extraction`);
  if (recommendations.length === 0) recommendations.push('Content balance is healthy for AI consumption');
  if (recommendations.length < 2) recommendations.push('Consider adding structured content sections with clear topic delineation');

  return { score: Math.min(100, score), details, recommendations: recommendations.slice(0, 4) };
}

function analyzeMetadata(html: string): CategoryResult {
  const checks: [string, boolean][] = [
    ['title', /<title[^>]*>[^<]+<\/title>/i.test(html)],
    ['meta description', !!getMeta(html, 'description')],
    ['og:title', !!getMeta(html, 'og:title')],
    ['og:description', !!getMeta(html, 'og:description')],
    ['og:image', !!getMeta(html, 'og:image')],
    ['og:type', !!getMeta(html, 'og:type')],
    ['og:url', !!getMeta(html, 'og:url')],
    ['twitter:card', !!getMeta(html, 'twitter:card')],
    ['twitter:title', !!getMeta(html, 'twitter:title')],
    ['twitter:description', !!getMeta(html, 'twitter:description')],
    ['canonical', /<link[^>]+rel\s*=\s*["']canonical["'][^>]*>/i.test(html)],
    ['robots meta', !!getMeta(html, 'robots')],
    ['lang attribute', /<html[^>]+lang\s*=/i.test(html)],
  ];

  const present = checks.filter(([, v]) => v);
  const pct = present.length / checks.length;
  const score = Math.round(pct * 100);

  const details = [
    `Metadata completeness: ${present.length}/${checks.length} (${Math.round(pct * 100)}%)`,
    `Present: ${present.map(([k]) => k).join(', ') || 'none'}`,
    `Missing: ${checks.filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none'}`,
  ];

  const missing = checks.filter(([, v]) => !v).map(([k]) => k);
  const recommendations: string[] = [];
  if (missing.includes('meta description')) recommendations.push('Add a meta description — AI engines use this as a primary content summary');
  if (missing.some(m => m.startsWith('og:'))) recommendations.push(`Add Open Graph tags (${missing.filter(m => m.startsWith('og:')).join(', ')}) for rich AI previews`);
  if (missing.some(m => m.startsWith('twitter:'))) recommendations.push('Add Twitter Card meta tags for social AI integration');
  if (missing.includes('canonical')) recommendations.push('Add a canonical URL to prevent duplicate content confusion for AI crawlers');
  if (recommendations.length === 0) recommendations.push('Metadata is comprehensive — review periodically as pages change');

  return { score, details, recommendations: recommendations.slice(0, 4) };
}

interface AICrawlerData {
  robotsTxt: string | null;
  hasLlmsTxt: boolean;
}

const AI_BOTS = ['GPTBot', 'Google-Extended', 'anthropic-ai', 'CCBot', 'Amazonbot', 'FacebookBot', 'cohere-ai', 'Bytespider', 'meta-externalagent'];

function analyzeAICrawlers(data: AICrawlerData, schemas: any[]): CategoryResult {
  const hasSameAs = schemas.some(s => s.sameAs);
  let botMentions = 0;
  let blocked = 0;
  const blockedBots: string[] = [];
  const allowedBots: string[] = [];

  if (data.robotsTxt) {
    for (const bot of AI_BOTS) {
      const re = new RegExp(`user-agent:\\s*${bot}`, 'i');
      if (re.test(data.robotsTxt)) {
        botMentions++;
        const blockRe = new RegExp(`user-agent:\\s*${bot}[\\s\\S]*?disallow:\\s*/`, 'i');
        if (blockRe.test(data.robotsTxt)) {
          blocked++;
          blockedBots.push(bot);
        } else {
          allowedBots.push(bot);
        }
      }
    }
  }

  let score = 0;
  // Having robots.txt at all
  if (data.robotsTxt !== null) score += 20;
  // Not blocking AI bots
  if (blocked === 0) score += 30;
  else score += Math.max(0, 30 - blocked * 5);
  // Having explicit AI bot rules (shows awareness)
  if (botMentions > 0 && blocked < botMentions) score += 15;
  // llms.txt
  if (data.hasLlmsTxt) score += 20;
  // sameAs for entity linking
  if (hasSameAs) score += 15;

  const details = [
    `robots.txt: ${data.robotsTxt !== null ? 'found' : 'not found'}`,
    `AI bots mentioned in robots.txt: ${botMentions} (${blocked} blocked)`,
    ...(blockedBots.length ? [`Blocked: ${blockedBots.join(', ')}`] : []),
    `llms.txt: ${data.hasLlmsTxt ? 'found' : 'not found'}`,
    `Schema sameAs links: ${hasSameAs ? 'present' : 'not found'}`,
  ];

  const recommendations: string[] = [];
  if (data.robotsTxt === null) recommendations.push('Create a robots.txt file — AI crawlers check this for access permissions');
  if (blocked > 0) recommendations.push(`Unblock AI crawlers (${blockedBots.join(', ')}) in robots.txt to improve AI visibility`);
  if (!data.hasLlmsTxt) recommendations.push('Create an llms.txt file — emerging standard for providing AI-friendly site summaries');
  if (!hasSameAs) recommendations.push('Add sameAs links in Organization schema to Wikipedia/social profiles for entity disambiguation');
  if (recommendations.length === 0) recommendations.push('AI crawler configuration is well-optimized');
  if (recommendations.length < 2) recommendations.push('Monitor new AI crawler user-agents and update robots.txt accordingly');

  return { score: Math.min(100, score), details, recommendations: recommendations.slice(0, 4) };
}

// ---------------------------------------------------------------------------
// Main Analyzer
// ---------------------------------------------------------------------------

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export async function analyzeAIO(url: string): Promise<AIOResult> {
  const base = getBaseUrl(url);

  // Fetch HTML + robots.txt + sitemap + llms.txt in parallel
  const fetchOpts = { signal: AbortSignal.timeout(15000), redirect: 'follow' as RequestRedirect, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.5' } };

  const [htmlRes, robotsRes, sitemapRes, llmsRes] = await Promise.allSettled([
    fetch(url, fetchOpts).then(async (r) => {
      // If blocked (403/503), try with a simpler user-agent
      if (!r.ok && (r.status === 403 || r.status === 503)) {
        return fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow', headers: { 'User-Agent': 'XanLens-Audit/1.0 (+https://xanlens.com)', 'Accept': 'text/html' } });
      }
      return r;
    }),
    fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(4000) }),
    fetch(`${base}/sitemap.xml`, { method: 'HEAD', signal: AbortSignal.timeout(4000) }),
    fetch(`${base}/llms.txt`, { method: 'HEAD', signal: AbortSignal.timeout(4000) }),
  ]);

  let html = '';
  if (htmlRes.status === 'fulfilled' && htmlRes.value.ok) {
    html = await htmlRes.value.text();
  } else {
    // Fallback: try Tavily extract for Cloudflare-protected sites
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (tavilyKey) {
      try {
        const tavilyRes = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tavilyKey}` },
          body: JSON.stringify({ urls: [url] }),
          signal: AbortSignal.timeout(15000),
        });
        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          const content = data.results?.[0]?.raw_content || data.results?.[0]?.text || '';
          if (content) html = `<html><body>${content}</body></html>`;
        }
      } catch { /* fallback failed */ }
    }
    if (!html) {
      // Last resort: return a minimal result instead of failing entirely
      // The section will show with low scores rather than disappearing
      const robotsTxt2 = robotsRes.status === 'fulfilled' && robotsRes.value.ok ? await robotsRes.value.text() : null;
      const hasSitemap2 = sitemapRes.status === 'fulfilled' && sitemapRes.value.ok;
      const hasLlmsTxt2 = llmsRes.status === 'fulfilled' && llmsRes.value.ok;
      const ai_crawlers2 = analyzeAICrawlers({ robotsTxt: robotsTxt2, hasLlmsTxt: hasLlmsTxt2 }, []);
      const emptyCategory = { score: 0, details: ['Could not fetch page content for analysis'], recommendations: ['Ensure your site is accessible to automated crawlers (not blocked by Cloudflare or similar)'] };
      return {
        url,
        overall_score: Math.round(ai_crawlers2.score * 0.10),
        grade: gradeFromScore(Math.round(ai_crawlers2.score * 0.10)),
        categories: {
          structured_data: emptyCategory,
          schema_quality: emptyCategory,
          page_structure: emptyCategory,
          navigation: { score: hasSitemap2 ? 40 : 0, details: hasSitemap2 ? ['Sitemap found'] : ['Could not fetch page'], recommendations: ['Ensure your site is accessible'] },
          content_balance: emptyCategory,
          metadata: emptyCategory,
          ai_crawlers: ai_crawlers2,
        },
        schemas_found: [],
        timestamp: new Date().toISOString(),
        partial: true,
        note: 'Page content could not be fetched directly. Results are limited to robots.txt, sitemap, and llms.txt checks.',
      };
    }
  }

  const robotsTxt = robotsRes.status === 'fulfilled' && robotsRes.value.ok ? await robotsRes.value.text() : null;
  const hasSitemap = sitemapRes.status === 'fulfilled' && sitemapRes.value.ok;
  const hasLlmsTxt = llmsRes.status === 'fulfilled' && llmsRes.value.ok;

  const schemas = parseJsonLd(html);

  const structured_data = analyzeStructuredData(schemas);
  const schema_quality = analyzeSchemaQuality(schemas);
  const page_structure = analyzePageStructure(html);
  const navigation = analyzeNavigation(html, base, hasSitemap);
  const content_balance = analyzeContentBalance(html);
  const metadata = analyzeMetadata(html);
  const ai_crawlers = analyzeAICrawlers({ robotsTxt, hasLlmsTxt }, schemas);

  const overall_score = Math.round(
    structured_data.score * 0.25 +
    schema_quality.score * 0.15 +
    page_structure.score * 0.15 +
    navigation.score * 0.10 +
    content_balance.score * 0.15 +
    metadata.score * 0.10 +
    ai_crawlers.score * 0.10
  );

  const allTypes = schemas.map(s => s['@type']).flat().filter(Boolean);
  const schemas_found = [...new Set(allTypes.map((t: any) => typeof t === 'string' ? t : String(t)))];

  return {
    url,
    overall_score,
    grade: gradeFromScore(overall_score),
    categories: {
      structured_data,
      schema_quality,
      page_structure,
      navigation,
      content_balance,
      metadata,
      ai_crawlers,
    },
    schemas_found,
    timestamp: new Date().toISOString(),
  };
}

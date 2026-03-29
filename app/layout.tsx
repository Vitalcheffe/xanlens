import type { Metadata } from "next";
import Script from "next/script";
import LayoutChrome from "./components/LayoutChrome";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "XanLens — AI Visibility Audit Tool | GEO Score Across 7 AI Engines",
  description: "XanLens audits your brand visibility across 7 AI engines. Get a GEO score from 0-100, see which AIs mention you, and get specific content fixes. $0.99 per audit.",
  keywords: ["GEO", "generative engine optimization", "AI visibility audit", "AI search visibility", "brand visibility AI", "ChatGPT visibility", "Perplexity visibility", "AI agents", "AI visibility API", "x402", "MCP server"],
  alternates: {
    canonical: "https://xanlens.com",
  },
  openGraph: {
    title: "XanLens — AI Visibility Audit Tool | GEO Score Across 7 AI Engines",
    description: "Audit your brand visibility across ChatGPT, Gemini, Perplexity, Claude, Grok, DeepSeek, and Meta AI. Score 0-100 with actionable fixes.",
    url: "https://xanlens.com",
    siteName: "XanLens",
    type: "website",
    images: [
      {
        url: "https://xanlens.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "XanLens — AI Visibility Audit Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "XanLens — AI Visibility Audit Tool | GEO Score Across 7 AI Engines",
    description: "Audit your brand visibility across 7 AI engines. Score 0-100 with actionable fixes. $0.99 per audit.",
    images: ["https://xanlens.com/og-image.png"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

function Footer() {
  return (
    <footer className="global-footer border-t border-[#1a1a1a] py-16">
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-start gap-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <img src="/logo.svg" alt="" width={24} height={24} />
            <p className="text-[15px] font-semibold">XanLens</p>
          </div>
          <p className="text-[13px] text-[#666]">Making brands visible in the age of AI.</p>
        </div>
        <div className="flex gap-12 text-[13px] text-[#999]">
          <div className="space-y-3">
            <p className="text-[#666] text-[11px] uppercase tracking-wider font-medium">Product</p>
            <a href="/dashboard" className="block hover:text-white transition-colors">Audit</a>
            <a href="/pricing" className="block hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="space-y-3">
            <p className="text-[#666] text-[11px] uppercase tracking-wider font-medium">Developers</p>
            <a href="/api-docs" className="block hover:text-white transition-colors">API Docs</a>
            <a href="/api-docs#x402" className="block hover:text-white transition-colors">x402 Payments</a>
            <a href="/methodology" className="block hover:text-white transition-colors">Methodology</a>
            <a href="/brand" className="block hover:text-white transition-colors">Brand Kit</a>
          </div>
          <div className="space-y-3">
            <p className="text-[#666] text-[11px] uppercase tracking-wider font-medium">Company</p>
            <a href="/about" className="block hover:text-white transition-colors">About</a>
            <a href="/whitepaper" className="block hover:text-white transition-colors">Whitepaper</a>
            <a href="https://x.com/xanlens_" target="_blank" rel="noopener" className="block hover:text-white transition-colors">X/Twitter</a>
            <a href="https://dev.to/fey_" target="_blank" rel="noopener" className="block hover:text-white transition-colors">Dev.to</a>
            <a href="https://feydefi.hashnode.dev" target="_blank" rel="noopener" className="block hover:text-white transition-colors">Hashnode</a>
            <a href="https://github.com/FayAndXan" target="_blank" rel="noopener" className="block hover:text-white transition-colors">GitHub</a>
            <a href="mailto:hello@xanlens.com" className="block hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto px-6 mt-12 pt-6 border-t border-[#1a1a1a] text-[12px] text-[#444]">
        © 2026 XanLens
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-KDSEFZ59QR" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-KDSEFZ59QR');`}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "XanLens",
              url: "https://xanlens.com",
              logo: "https://xanlens.com/logo.svg",
              description: "Generative Engine Optimization (GEO) platform that audits brand visibility across 7 AI engines including ChatGPT, Gemini, Perplexity, Claude, Grok, DeepSeek, and Meta AI. Scores 0-100 with actionable content fixes.",
              foundingDate: "2026",
              founder: [
                { "@type": "Person", name: "Fey", url: "https://x.com/fayandxan" },
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                url: "https://xanlens.com",
                email: "hello@xanlens.com",
              },
              sameAs: [
                "https://x.com/xanlens_",
                "https://x.com/fayandxan",
                "https://github.com/FayAndXan",
                "https://dev.to/fey_",
                "https://feydefi.hashnode.dev",
                "https://clawhub.ai/FeyDeFi/geo-audit-optimizer"
              ],
              offers: [
                {
                  "@type": "Offer",
                  name: "Pro Audit + Content Fixes",
                  price: "0.99",
                  priceCurrency: "USD",
                  description: "Full AI visibility audit across 7 AI engines with 132 prompts, competitor ranking, content AI-friendliness, trend tracking, plus AI-generated content fixes.",
                },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: "XanLens GEO Audit",
              url: "https://xanlens.com",
              image: "https://xanlens.com/og-image.png",
              description: "AI visibility audit that tests your brand across 7 AI engines with 132 prompts. Returns a GEO score from 0-100, engine-by-engine breakdown, blind spots, competitor analysis, and AI-generated content fixes.",
              brand: { "@type": "Brand", name: "XanLens" },
              offers: [
                { "@type": "Offer", name: "Pro Audit + Content Fixes", price: "0.99", priceCurrency: "USD", url: "https://xanlens.com/pricing" },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "XanLens",
              url: "https://xanlens.com",
              description: "AI visibility audit platform that scores brand presence across 7 AI engines",
              publisher: { "@type": "Organization", name: "XanLens", url: "https://xanlens.com" },
              potentialAction: {
                "@type": "SearchAction",
                target: "https://xanlens.com/#audit?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "XanLens GEO Audit Tool",
              featureList: ["Multi-engine audit across 7 AI engines", "GEO score 0-100 with Knowledge/Discoverability/Citation subscores", "AI-generated content fixes", "REST API and MCP integration", "x402 pay-per-call protocol", "GEO Index public database"],
              url: "https://xanlens.com/api-docs",
              description: "REST API for AI visibility audits. Send a URL, get a structured GEO score with engine-by-engine breakdown and content fixes. Supports MCP for agent-to-agent communication.",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0.99", priceCurrency: "USD" },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "HowTo",
              name: "How to Run a GEO Audit",
              step: [
                { "@type": "HowToStep", name: "Enter your website URL", text: "Enter your website URL. XanLens auto-detects your brand, industry, and competitors." },
                { "@type": "HowToStep", name: "Wait for analysis", text: "XanLens queries real AI engines with ~132 targeted prompts about your brand across multiple engines." },
                { "@type": "HowToStep", name: "Review results", text: "Get your GEO score, SEO vs GEO comparison, engine breakdown, competitor ranking, blind spots, and actionable recommendations." },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://xanlens.com" },
                { "@type": "ListItem", position: 2, name: "Pricing", item: "https://xanlens.com/pricing" },
                { "@type": "ListItem", position: 3, name: "API Docs", item: "https://xanlens.com/api-docs" },
                { "@type": "ListItem", position: 4, name: "Methodology", item: "https://xanlens.com/methodology" },
                { "@type": "ListItem", position: 5, name: "About", item: "https://xanlens.com/about" },
              ],
            }),
          }}
        />
        {/* FAQPage schema is in page.tsx — single source of truth */}
        <Providers>
          <LayoutChrome />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

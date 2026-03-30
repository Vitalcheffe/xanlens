# XanLens

<p align="center">
  <b>Open Source GEO Audit Engine.</b><br>
  <i>See what AI engines actually say about your brand.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/7%20AI%20Engines-Gemini%20%7C%20ChatGPT%20%7C%20Claude%20%7C%20Grok%20%7C%20DeepSeek%20%7C%20Llama%20%7C%20Qwen-green" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" />
</p>

---

Most GEO tools score your page against heuristics — "does your content look citable?"

XanLens doesn't guess. It asks ChatGPT, Gemini, Grok, DeepSeek, Claude, Llama, and Qwen directly: "Do you know this brand?" Then shows you exactly what each one says.

Same brand. Seven different answers. That's the insight.

---

## What It Does

1. **You enter a URL**
2. **XanLens auto-detects** your brand, industry, competitors, and keywords
3. **Generates 30+ real prompts** — the kind your customers actually ask AI
4. **Queries 7 AI engines simultaneously** — not heuristics, real queries to real models
5. **Scores you 0-100** — knowledge score, discoverability score, citation quality
6. **Generates content fixes** — specific, actionable changes

---

## How It's Different

| Feature | XanLens | Heuristic tools |
|---------|---------|-----------------|
| Queries real AI engines | **Yes — 7 engines** | No — scores page structure |
| Shows what AI actually says | **Real responses** | Estimated citability |
| Multi-engine comparison | **Side-by-side** | Single score |
| Content fix generation | **AI-generated** | Generic recommendations |
| Auto-detect (zero config) | **Scrapes your site** | Manual input |

---

## Quick Start

```bash
git clone https://github.com/Vitalcheffe/xanlens.git
cd xanlens
cp .env.example .env.local
# Add GEMINI_API_KEY (required), others optional
npm install
npm run dev
```

Open `localhost:3000` and audit your first brand.

---

## Self-Host vs Hosted

**Self-host (free):** Clone the repo, add your own API keys, run it. Full control, no limits.

**Don't want to self-host?** [xanlens.com](https://xanlens.com) — pay per audit, zero setup.

---

## License

MIT.

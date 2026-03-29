# XanLens — Open Source GEO Audit Engine

**See what AI engines actually say about your brand.**

Most GEO tools score your page against heuristics — "does your content look citable?"

XanLens doesn't guess. It asks ChatGPT, Gemini, Grok, DeepSeek, Claude, Llama, and Qwen directly: *"Do you know this brand?"* Then shows you exactly what each one says.

Same brand. Seven different answers. That's the insight.

## What It Does

1. **You enter a URL**
2. **XanLens auto-detects** your brand, industry, competitors, and keywords by scraping your site
3. **Generates 30+ real prompts** — the kind your customers actually ask AI ("best CRM for startups", "alternatives to Salesforce")
4. **Queries 7 AI engines simultaneously** — not heuristics, real queries to real models
5. **Scores you 0-100** — knowledge score, discoverability score, citation quality
6. **Generates content fixes** — specific, actionable changes to improve your AI visibility

## Get Started

**Self-host (free):** Clone the repo, add your own API keys, run it. Full control, no limits.

**Don't want to self-host?** [xanlens.com](https://xanlens.com) — hosted version, pay per audit, zero setup.

## How It's Different

| Feature | XanLens | Heuristic-based tools |
|---|---|---|
| Queries real AI engines | ✅ Yes — 7 engines | ❌ No — scores page structure |
| Shows what AI actually says | ✅ Real responses | ❌ Estimated citability |
| Multi-engine comparison | ✅ Side-by-side | ❌ Single score |
| Brand verification (LLM Judge) | ✅ Catches name collisions | ❌ None |
| Content fix generation | ✅ AI-generated fixes | ❌ Generic recommendations |
| Auto-detect (zero config) | ✅ Scrapes your site | ⚠️ Manual input |

## Quick Start

```bash
git clone https://github.com/FayAndXan/xanlens.git
cd xanlens
cp .env.example .env.local
# Add your API keys (Gemini required, others optional)
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000) and audit your first brand.

## Engines Supported

| Engine | API Key Required | Status | What It Tests |
|---|---|---|---|
| Gemini Flash (knowledge) | `GEMINI_API_KEY` | **Required** | Does Google's AI know your brand? |
| Gemini Grounded (search) | `GEMINI_API_KEY` | **Required** | Are you discoverable via Google search? |
| ChatGPT (GPT-4o) | `OPENAI_API_KEY` | Optional | What does ChatGPT say about you? |
| DeepSeek | `DEEPSEEK_API_KEY` | Optional | Are you in DeepSeek's training data? |
| Claude | `ANTHROPIC_API_KEY` | Optional | Does Anthropic's model know you? |
| Grok | `XAI_API_KEY` | Optional | What does xAI's model say? |
| Llama | `NVIDIA_API_KEY` | Optional | Open-source model visibility |
| Qwen | `NVIDIA_API_KEY` | Optional | Alibaba's model visibility |

**Gemini is required** — it powers both knowledge scoring and grounded search (discoverability), plus the LLM judge that verifies brand accuracy. Get a free key at [ai.google.dev](https://ai.google.dev). Add other engines for the full multi-engine picture.

## How Scoring Works

XanLens generates prompts in three categories:

- **Category queries (65%)** — "Best [your industry]", "How to [your use case]" — the queries your customers actually ask
- **Competitor queries (30%)** — "Alternatives to [competitor]", "[you] vs [competitor]" — comparison intent
- **Brand queries (5%)** — "What is [your brand]?" — baseline awareness check

Each engine response is scored by an LLM judge that verifies:
1. Is the response actually about YOUR brand (not a name collision)?
2. Does it accurately describe what you do?
3. Are you recommended, mentioned, or cited?

Final score combines: knowledge (k), discoverability (d), and citation quality (c).

## Architecture

```
Next.js 15 app
├── /api/v1/audit/run     — Combined detect + submit + execute
├── /api/v1/audit/status  — Poll results + get agent instructions
├── /api/v1/audit/fixes   — AI-generated content fixes
├── /app/lib/
│   ├── engine-config.ts  — All 7 engine configs (add your own here)
│   ├── prompts.ts        — Prompt generation from brand data
│   ├── auto-detect.ts    — Website scraping + brand detection
│   └── scoring.ts        — LLM judge + score computation
├── Turso/LibSQL          — Audit history + results storage
└── Upstash Redis         — Caching + rate limiting
```

## API Usage

```bash
# Start an audit
curl -X POST http://localhost:3000/api/v1/audit/run \
  -H "Content-Type: application/json" \
  -d '{"website": "yourbrand.com"}'

# Returns: { job_id, poll_url }

# Poll for results
curl http://localhost:3000/api/v1/audit/status?id=JOB_ID

# Returns: scores, engine responses, content fixes
```

## Agent API (for AI agents)

XanLens has a 3-step agent flow:

1. `POST /api/v1/audit/run` — Score the brand
2. `GET /api/v1/audit/status` — Get results + `agent_instructions`
3. `POST /api/v1/audit/fixes/push` — Push drafted content fixes

Any AI agent can audit a brand, get actionable instructions, draft fixes, and push them back.

## Self-Hosting Requirements

- Node.js 18+
- A [Turso](https://turso.tech) database (free tier works)
- An [Upstash](https://upstash.com) Redis instance (free tier works)
- At least one AI engine API key

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Turso (LibSQL)
- **Cache:** Upstash Redis
- **AI Engines:** Gemini, GPT-4o, DeepSeek, Claude, Grok, Llama, Qwen
- **Payments:** Coinbase Smart Wallet (USDC on Base) — optional
- **Hosting:** Vercel (or any Node.js host)

## Why GEO Matters

- **63% of B2B software decisions** now start with an AI query
- **AI referral traffic grew 527%** year-over-year (Previsible 2025)
- **28.3% of ChatGPT's most-cited pages** have zero Google visibility
- **Same brand, 46x citation gap** — 0.59% on ChatGPT vs 27% on Grok
- **GEO market:** $886M today → $7.3B by 2031

Traditional SEO tools don't show this. XanLens does.

## Contributing

PRs welcome. The biggest impact areas:

1. **Add new engines** — extend `engine-config.ts`
2. **Improve prompts** — better category/competitor prompt templates
3. **Better scoring** — improve the LLM judge rubric
4. **CLI tool** — `npx xanlens audit domain.com` (not built yet)

## License

MIT

## Built By

[Fay](https://x.com/fayandxan) — building AI products in the era of AGI.

Part of the [xanOS](https://github.com/FayAndXan) fleet.

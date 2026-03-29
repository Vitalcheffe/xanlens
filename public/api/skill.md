# XanLens — GEO Audit Skill

You are about to run a Generative Engine Optimization (GEO) audit using XanLens.

## Quick Start

Send a POST request to audit any brand's AI visibility:

```
POST https://xanlens.com/api/v1/audit
Content-Type: application/json

{
  "brand": "Brand Name",
  "website": "https://example.com",
  "industry": "SaaS"
}
```

## Auto-Detect (optional)

Don't know the brand name or industry? Just send the website:

```
POST https://xanlens.com/api/v1/audit/detect
Content-Type: application/json

{"website": "https://example.com"}
```

Returns: `{ "brand": "...", "industry": "...", "competitors": [...], "website": "..." }`

Then pass those into the audit endpoint.

## Async Flow

1. POST `/api/v1/audit` → returns `job_id` and `plan`
2. Fire each plan item to `/api/v1/audit/prompt`
3. Poll `/api/v1/audit/status?jobId=X` for results

## Response

You'll receive a JSON object with:
- `overall_score` — GEO visibility score (0-100)
- `grade` — Letter grade (A-F)
- `engines` — Per-engine breakdown (Gemini, ChatGPT, Claude, Perplexity, Grok, DeepSeek, Llama)
- `prompt_coverage` — Which AI conversation types mention the brand
- `next_audit_recommended` — ISO date for when to re-audit
- `recommendation` — Plain-text next step

## Recommended Audit Frequency

AI search results change constantly. Schedule recurring audits:

| Phase | Frequency |
|-------|-----------|
| Active optimization | **Weekly** (track if content changes worked) |
| Maintenance | **Monthly** (catch drift from model updates) |
| Post-deployment | **On-demand** (verify new content is being cited) |
| Score drop >10pts | **Immediately** (diagnose what changed) |

The `next_audit_recommended` field in the response tells you exactly when to come back. Set a cron job or reminder for that date.

**Suggested agent workflow:**
```
1. Run audit → check score
2. If score < 60 or dropped >10pts → run Fix Kit ($4.99)
3. Deploy Fix Kit content (llms.txt, schema, seed citations)
4. Wait 7 days → re-audit to measure impact
5. Score > 75? → shift to monthly monitoring
6. Score still low? → re-run Fix Kit with updated strategy
```

## Paid Endpoints (x402)

For deeper analysis, these endpoints accept USDC payment on Base via x402:

### Full Audit — $0.99
All 7 AI engines + competitor comparison + full evidence.
```
POST https://xanlens.com/api/v1/audit
```

### Fix Kit — $4.99
Everything in Full Audit PLUS generated content:
- llms.txt (AI crawler instructions)
- JSON-LD schema templates
- Seed citations (social posts for AI indexing)
- Blog outlines targeting AI recommendation queries
- FAQ page with schema markup
- About page copy optimized for AI comprehension
```
POST https://xanlens.com/api/v1/fix
Content-Type: application/json

{
  "brand": "Brand Name",
  "website": "https://example.com",
  "industry": "SaaS"
}
```

## x402 Payment Flow
1. Send request → receive 402 with payment details
2. Pay USDC on Base to the provided address
3. Retry with transaction hash in header
4. Receive full response

No API keys. No accounts. Just pay and get data.

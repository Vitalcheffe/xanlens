# Contributing to XanLens

We want help. Here's how to make it easy.

## What We Need Most

### 1. Add New AI Engines
The biggest impact contribution. Each engine is a single config in `app/lib/engine-config.ts`.

Want to add Meta AI, Mistral, Cohere, or any other model? One function, one PR.

```typescript
// engine-config.ts — add your engine here
export const ENGINES: Record<string, EngineConfig> = {
  // ... existing engines
  your_engine: {
    url: "https://api.example.com/v1/chat/completions",
    makeHeaders: () => ({ Authorization: `Bearer ${process.env.YOUR_API_KEY}` }),
    makeBody: (prompt) => ({ /* model-specific body */ }),
    parseResponse: (d) => d?.choices?.[0]?.message?.content || "",
  },
};
```

### 2. Improve Prompts
`app/lib/prompts.ts` generates the queries we send to AI engines. Better prompts = more accurate audits.

- Industry-specific prompt templates
- Better competitor comparison prompts
- Localized prompts (non-English markets)

### 3. Better Scoring
The LLM judge (`app/lib/scoring.ts`) verifies responses. It can be improved:
- More accurate brand verification
- Better citation quality detection
- Industry-specific scoring weights

### 4. CLI Tool
We don't have one yet. `npx xanlens audit domain.com` would be huge.

### 5. Fix Bugs
Check the [Issues](https://github.com/FayAndXan/xanlens/issues) tab.

## How to Submit a PR

1. Fork the repo
2. Create a branch (`git checkout -b add-mistral-engine`)
3. Make your changes
4. Test locally (`npm run dev`, run an audit)
5. Open a PR with a clear description of what changed and why

## Rules

- **One PR, one thing.** Don't bundle unrelated changes.
- **Test your changes.** Run at least one audit with your modifications.
- **No secrets.** Never commit API keys. Use `.env.local`.
- **Keep it simple.** If a change needs a paragraph to explain, it might be too complex.

## Good First Issues

Look for issues tagged `good-first-issue`. These are small, well-scoped tasks perfect for a first contribution.

## Questions?

Open an issue or reach out to [@fayandxan](https://x.com/fayandxan) on X.

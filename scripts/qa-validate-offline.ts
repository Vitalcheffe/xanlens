#!/usr/bin/env npx tsx
/**
 * OFFLINE QA Validation — tests the mention analyzer against known responses.
 * No API calls needed. Tests edge cases that have caused bugs.
 * 
 * Run: npx tsx scripts/qa-validate-offline.ts
 */

import { analyzeMentions } from "../app/lib/mention-analyzer";

interface TestCase {
  name: string;
  brand: string;
  website?: string;
  prompt: string;
  response: string;
  descriptionKeywords?: string[];
  expectedGenuine: boolean;
  reason: string;
}

const TESTS: TestCase[] = [
  // ═══ TRUE POSITIVES — brand IS mentioned, analyzer should say genuine=true ═══
  
  {
    name: "Monad in numbered list with (Upcoming) qualifier",
    brand: "Monad",
    website: "monad.xyz",
    prompt: "fastest ethereum compatible blockchains with high TPS",
    response: `### 1. The "Parallel EVM" Leaders (The New Frontier)
Parallel execution allows the chain to process multiple transactions simultaneously rather than one by one. This is currently the "holy grail" of EVM scaling.

* **Monad (Upcoming):**
  * **Performance:** Claims >10,000 TPS with 1-second block times.
  * Monad rebuilds the EVM from the ground up to match Solana's performance while keeping full compatibility with Ethereum tooling (MetaMask, Etherscan, etc.).`,
    descriptionKeywords: ["parallel", "evm", "blockchain", "layer"],
    expectedGenuine: true,
    reason: "Brand appears as #1 contender in list with bold formatting",
  },
  
  {
    name: "Brand in markdown bold recommendation",
    brand: "Monad",
    website: "monad.xyz",
    prompt: "Best high-performance EVM-compatible Layer 1 blockchain",
    response: `Here are the best high-performance EVM-compatible Layer 1 blockchains:

1. **Monad** - A next-generation Layer 1 that uses parallel execution to achieve 10,000+ TPS while maintaining full EVM compatibility.
2. **Sei** - Optimized for trading with a built-in order book engine.
3. **Fantom** - Fast finality using DAG-based consensus.`,
    descriptionKeywords: ["parallel", "execution", "tps"],
    expectedGenuine: true,
    reason: "Brand is #1 in a recommendation list",
  },

  {
    name: "Brand mentioned as subject in flowing text",
    brand: "Monad",
    website: "monad.xyz",
    prompt: "Can you recommend a high-performance blockchain?",
    response: `For high-performance EVM compatibility, Monad is one of the most promising projects. It aims to deliver over 10,000 transactions per second while maintaining full Ethereum compatibility. Monad achieves this through pipelined execution and optimistic parallel processing.`,
    descriptionKeywords: ["parallel", "evm"],
    expectedGenuine: true,
    reason: "Brand is subject of recommendation",
  },

  {
    name: "Brand in bullet list without bold",
    brand: "Stripe",
    website: "stripe.com",
    prompt: "Best online payment processing",
    response: `The best online payment processors include:
- Stripe: Full-featured API, great developer experience
- Square: Good for in-person payments
- PayPal: Widely recognized brand`,
    descriptionKeywords: ["payment", "api", "developer"],
    expectedGenuine: true,
    reason: "Brand appears in recommendation bullet list",
  },

  {
    name: "Brand mentioned once in large response",
    brand: "XanLens",
    website: "xanlens.com",
    prompt: "Best GEO tools",
    response: `Generative Engine Optimization (GEO) is an emerging field. Some tools to consider include WordLift for semantic markup, XanLens for AI visibility auditing, and Profound for content optimization. Each tool takes a different approach to making your brand more visible to AI engines.`,
    descriptionKeywords: ["geo", "audit", "visibility"],
    expectedGenuine: true,
    reason: "Brand mentioned in tool list even if only once",
  },

  {
    name: "Brand with .xyz domain in response",
    brand: "Monad",
    website: "monad.xyz",
    prompt: "What is Monad?",
    response: `Monad is a high-performance Layer 1 blockchain designed for EVM compatibility. You can learn more at monad.xyz. The project focuses on parallel transaction execution to achieve higher throughput than existing chains.`,
    descriptionKeywords: [],
    expectedGenuine: true,
    reason: "Brand name + domain both appear, clearly about the right entity",
  },

  {
    name: "Notion mentioned naturally in productivity context",
    brand: "Notion",
    website: "notion.so",
    prompt: "Best productivity software",
    response: `For all-in-one productivity, Notion stands out as a versatile workspace that combines notes, databases, wikis, and project management. It's particularly popular among startups and small teams.`,
    descriptionKeywords: ["workspace", "notes", "project"],
    expectedGenuine: true,
    reason: "Brand mentioned with positive context",
  },

  // ═══ TRUE NEGATIVES — brand NOT mentioned, analyzer should say genuine=false ═══

  {
    name: "Response about blockchain but brand not mentioned",
    brand: "Monad",
    website: "monad.xyz",
    prompt: "Best high-performance blockchain",
    response: `The top high-performance blockchains include Solana, Avalanche, and Fantom. Solana leads with its proof of history consensus mechanism, achieving over 50,000 TPS. Avalanche offers subnet customization for enterprise use cases.`,
    descriptionKeywords: ["parallel", "evm"],
    expectedGenuine: false,
    reason: "Brand simply not in the response",
  },

  {
    name: "AI says it doesn't know the brand",
    brand: "XanLens",
    website: "xanlens.com",
    prompt: "What is XanLens?",
    response: `I don't have specific information about XanLens. It doesn't appear to be a widely known tool or platform in my training data. Could you provide more context about what XanLens is?`,
    descriptionKeywords: ["geo", "audit"],
    expectedGenuine: false,
    reason: "AI explicitly says it doesn't know",
  },

  {
    name: "Echo response — AI just rephrasing the question",
    brand: "FooBar",
    website: "foobar.io",
    prompt: "What is FooBar?",
    response: `Okay, I'm ready to review FooBar for you. Let me look into it.`,
    descriptionKeywords: [],
    expectedGenuine: false,
    reason: "Just echoing, no real knowledge",
  },

  // ═══ WRONG ENTITY — brand name exists but refers to something else ═══

  {
    name: "Monad as programming concept (wrong entity)",
    brand: "Monad",
    website: "monad.xyz",
    prompt: "What is Monad?",
    response: `In functional programming, a Monad is a concept used in Haskell and other languages. It refers to a design pattern for handling side effects in pure functional code. A monad is essentially a type with two operations: return and bind.`,
    descriptionKeywords: ["blockchain", "evm", "layer"],
    expectedGenuine: false,
    reason: "Talking about Haskell monads, not the blockchain",
  },

  {
    name: "Monad as philosophy concept (wrong entity)",
    brand: "Monad",
    website: "monad.xyz",
    prompt: "What is Monad?",
    response: `In philosophy, a monad refers to an elementary individual substance that reflects the order of the world, as described by Gottfried Wilhelm Leibniz. The term comes from Greek "monas" meaning "unit" or "alone."`,
    descriptionKeywords: ["blockchain", "evm"],
    expectedGenuine: false,
    reason: "Talking about philosophy, not the blockchain",
  },

  // ═══ EDGE CASES ═══

  {
    name: "Brand mentioned but with negative unknown context",
    brand: "TinyStartup",
    website: "tinystartup.com",
    prompt: "What is TinyStartup?",
    response: `I'm not familiar with TinyStartup. It doesn't appear to be a widely recognized company or product. Could you provide more context about what TinyStartup does?`,
    descriptionKeywords: [],
    expectedGenuine: false,
    reason: "AI explicitly says it doesn't know even though brand appears in text",
  },

  {
    name: "Brand in comparison table format",
    brand: "Stripe",
    website: "stripe.com",
    prompt: "Stripe vs PayPal",
    response: `| Feature | Stripe | PayPal |
|---------|--------|--------|
| API Quality | Excellent | Good |
| Pricing | 2.9% + 30¢ | 2.9% + 30¢ |
| Developer Experience | Best-in-class | Average |

Stripe is generally preferred by developers for its clean API and extensive documentation.`,
    descriptionKeywords: ["payment", "api"],
    expectedGenuine: true,
    reason: "Brand featured prominently in comparison",
  },

  {
    name: "Monad mentioned alongside blockchain context (not wrong entity)",
    brand: "Monad",
    website: "monad.xyz",
    prompt: "What is Monad?",
    response: `Monad is a concept in functional programming that represents computations as a series of steps. However, Monad is also the name of a high-performance Layer 1 blockchain that uses parallel execution for EVM compatibility.`,
    descriptionKeywords: ["blockchain", "evm"],
    expectedGenuine: true,
    reason: "Response mentions both meanings but includes the blockchain — should count",
  },

  {
    name: "Brand name appears only in URL",
    brand: "Notion",
    website: "notion.so",
    prompt: "productivity tools comparison",
    response: `Here are some great productivity tools: Obsidian for local-first note-taking, Todoist for task management, and Coda for documents. Check out https://notion.so for another option.`,
    descriptionKeywords: ["workspace", "notes"],
    expectedGenuine: true,
    reason: "Brand domain appears — counts as mention",
  },
];

// Run tests
let passed = 0;
let failed = 0;
const failures: string[] = [];

console.log("\n🧪 OFFLINE QA VALIDATION — Mention Analyzer Edge Cases");
console.log("=".repeat(70));

for (const test of TESTS) {
  const result = analyzeMentions(test.response, test.brand, test.website, test.prompt, test.descriptionKeywords);
  const actual = result.genuine;
  const correct = actual === test.expectedGenuine;

  if (correct) {
    passed++;
    console.log(`  ✅ ${test.name}`);
  } else {
    failed++;
    const type = test.expectedGenuine ? "FALSE NEGATIVE" : "FALSE POSITIVE";
    console.log(`  ❌ ${test.name} — ${type}`);
    failures.push(`\n  ❌ ${type}: ${test.name}\n     Brand: "${test.brand}" | Expected: genuine=${test.expectedGenuine} | Got: genuine=${actual}\n     Reason: ${test.reason}\n     Mentions: ${result.mentions} | Sentiment: ${result.sentiment}\n     Response: "${test.response.slice(0, 150)}..."`);
  }
}

console.log("\n" + "=".repeat(70));
console.log(`📊 RESULTS: ${passed}/${TESTS.length} passed (${Math.round(passed/TESTS.length*100)}%)`);

if (failures.length > 0) {
  console.log(`\n🚨 ${failures.length} FAILURE(S):`);
  for (const f of failures) console.log(f);
  console.log("\n❌ QA FAILED — DO NOT DEPLOY");
  process.exit(1);
} else {
  console.log("\n✅ ALL EDGE CASES PASSED — Safe to deploy");
  process.exit(0);
}

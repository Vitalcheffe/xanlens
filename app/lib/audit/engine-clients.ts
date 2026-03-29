/**
 * Engine clients for lib/audit/ system (used by fix + MCP routes).
 * Models aligned with lib/engine-config.ts (the primary audit system).
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";

export {
  GEMINI_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY,
  ANTHROPIC_API_KEY, XAI_API_KEY, TAVILY_API_KEY, NVIDIA_API_KEY,
};

/* ─── Gemini (direct) ─── */

export async function queryGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } }),
        signal: AbortSignal.timeout(20000),
      }
    );
    const data = await res.json();
    if (data?.error) { console.error(`[GeminiFlash] API error: ${data.error.message || JSON.stringify(data.error)}`); return ""; }
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (e) {
    console.error(`[GeminiFlash] Error: ${e}`);
    return "";
  }
}

export async function queryGeminiBatch(prompts: string[], batchSize = 3): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < prompts.length; i += batchSize) {
    const batch = prompts.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(p => queryGemini(p).catch(() => "")));
    results.push(...batchResults);
    if (i + batchSize < prompts.length) {
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return results;
}

/* ─── Gemini Grounded (with Google Search) ─── */

export interface GeminiGroundedResult {
  text: string;
  sources: Array<{ title: string; url: string; content: string }>;
}

export async function queryGeminiGrounded(prompt: string): Promise<GeminiGroundedResult> {
  if (!GEMINI_API_KEY) return { text: "", sources: [] };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0 },
          tools: [{ google_search: {} }],
        }),
        signal: AbortSignal.timeout(30000),
      }
    );
    const data = await res.json();
    if (data?.error) { console.error(`[GeminiGrounded] API error: ${data.error.message || JSON.stringify(data.error)}`); return { text: "", sources: [] }; }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const groundingMeta = data?.candidates?.[0]?.groundingMetadata;
    const sources: Array<{ title: string; url: string; content: string }> = [];

    if (groundingMeta?.groundingChunks) {
      for (const chunk of groundingMeta.groundingChunks) {
        if (chunk.web) sources.push({ title: chunk.web.title || "", url: chunk.web.uri || "", content: "" });
      }
    }
    if (groundingMeta?.groundingSupports) {
      for (const support of groundingMeta.groundingSupports) {
        if (support.segment?.text && support.groundingChunkIndices?.length > 0) {
          const idx = support.groundingChunkIndices[0];
          if (sources[idx] && !sources[idx].content) sources[idx].content = support.segment.text;
        }
      }
    }

    return { text, sources };
  } catch (e) {
    console.error(`[GeminiGrounded] Error: ${e}`);
    return { text: "", sources: [] };
  }
}

/* ─── Direct API engines ─── */

export async function queryChatGPT(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) return "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.2", messages: [{ role: "user", content: prompt }], max_completion_tokens: 512, temperature: 0.7 }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (data.error) { console.error(`[GPT] ${data.error.message}`); return ""; }
    return data?.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error(`[GPT] Error: ${e}`);
    return "";
  }
}

export async function queryDeepSeek(prompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) return "";
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], max_tokens: 512 }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (data.error) { console.error(`[DeepSeek] ${data.error.message}`); return ""; }
    return data?.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error(`[DeepSeek] Error: ${e}`);
    return "";
  }
}

export async function queryClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (data.error) { console.error(`[Claude] ${data.error.message}`); return ""; }
    return data?.content?.[0]?.text || "";
  } catch (e) {
    console.error(`[Claude] Error: ${e}`);
    return "";
  }
}

export async function queryGrok(prompt: string): Promise<string> {
  if (!XAI_API_KEY) return "";
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${XAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "grok-4-1-fast-non-reasoning", messages: [{ role: "user", content: prompt }], max_tokens: 512, temperature: 0.7 }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    if (data.error) { console.error(`[Grok] ${data.error.message}`); return ""; }
    return data?.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error(`[Grok] Error: ${e}`);
    return "";
  }
}

function queryNvidia(model: string, label: string) {
  return async (prompt: string): Promise<string> => {
    if (!NVIDIA_API_KEY) return "";
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 512, temperature: 0.7 }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (data?.error) { console.error(`[${label}] ${data.error.message || JSON.stringify(data.error)}`); return ""; }
      return data?.choices?.[0]?.message?.content || "";
    } catch (e) {
      console.error(`[${label}] Error: ${e}`);
      return "";
    }
  };
}

export const queryLlama = queryNvidia("meta/llama-4-maverick-17b-128e-instruct", "Llama");
export const queryQwen = queryNvidia("qwen/qwen3-next-80b-a3b-instruct", "Qwen");

/* Perplexity — paused, waiting for API key */
export async function queryPerplexity(_prompt: string): Promise<string> {
  return "__UNAVAILABLE__";
}

export async function queryTavily(query: string): Promise<{ answer: string; results: Array<{ title: string; url: string; content: string }> }> {
  if (!TAVILY_API_KEY) return { answer: "", results: [] };
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_API_KEY}` },
      body: JSON.stringify({ query, include_answer: true, max_results: 5 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { answer: "", results: [] };
    const data = await res.json();
    if (data.status === "error") return { answer: "", results: [] };
    return { answer: data.answer || "", results: data.results || [] };
  } catch (e) {
    console.error(`[Tavily] Error: ${e}`);
    return { answer: "", results: [] };
  }
}

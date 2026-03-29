import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const ENGINE_NAMES: Record<string, string> = {
  gemini: "Gemini", chatgpt: "ChatGPT", perplexity: "Perplexity",
  claude: "Claude", deepseek: "DeepSeek", grok: "Grok", copilot: "Copilot",
};

function scoreColor(s: number) { return s >= 70 ? "#2596be" : s >= 40 ? "#F59E0B" : "#EF4444"; }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand") || "Unknown";
  const score = parseInt(searchParams.get("score") || "0");
  const grade = searchParams.get("grade") || "F";
  const industry = searchParams.get("industry") || "";
  const enginesRaw = searchParams.get("engines") || "";

  const engines = enginesRaw.split(",").filter(Boolean).map((e) => {
    const [key, val] = e.split(":");
    return { name: ENGINE_NAMES[key] || key, score: parseInt(val) || 0 };
  }).slice(0, 7);

  const color = scoreColor(score);

  try {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", background: "#050505", display: "flex", flexDirection: "column", padding: "48px 56px" }}>
          {/* Top */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "36px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "38px", fontWeight: "bold", color: "white" }}>{brand}</div>
              {industry ? <div style={{ fontSize: "16px", color: "#666", marginTop: "4px" }}>{industry.toUpperCase()}</div> : null}
            </div>
            <div style={{ display: "flex", padding: "8px 20px", borderRadius: "999px", background: `${color}22`, border: `2px solid ${color}44` }}>
              <span style={{ fontSize: "20px", fontWeight: "bold", color }}>{`Grade ${grade}`}</span>
            </div>
          </div>

          {/* Main */}
          <div style={{ display: "flex", flex: "1", alignItems: "center" }}>
            {/* Score */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "280px" }}>
              <div style={{
                width: "200px", height: "200px", borderRadius: "50%",
                border: `10px solid ${color}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: `${color}08`,
              }}>
                <span style={{ fontSize: "72px", fontWeight: "bold", color, lineHeight: "1" }}>{score}</span>
                <span style={{ fontSize: "18px", color: "#666" }}>/100</span>
              </div>
              <span style={{ fontSize: "14px", color: "#555", marginTop: "16px", letterSpacing: "3px" }}>GEO SCORE</span>
            </div>

            {/* Engines */}
            {engines.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", flex: "1", marginLeft: "48px" }}>
                <span style={{ fontSize: "13px", color: "#555", letterSpacing: "2px", marginBottom: "16px" }}>AI ENGINE RESULTS</span>
                {engines.map((eng) => (
                  <div key={eng.name} style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "15px", color: "#999", width: "100px", textAlign: "right" }}>{eng.name}</span>
                    <div style={{ flex: "1", height: "24px", background: "#111", borderRadius: "6px", marginLeft: "12px", marginRight: "12px", overflow: "hidden", display: "flex" }}>
                      <div style={{ width: `${Math.max(eng.score, 3)}%`, height: "100%", background: scoreColor(eng.score), borderRadius: "6px" }} />
                    </div>
                    <span style={{ fontSize: "16px", fontWeight: "bold", color: scoreColor(eng.score), width: "36px" }}>{eng.score}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Bottom */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #222" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "white" }}>XanLens</span>
              <span style={{ fontSize: "14px", color: "#555", marginLeft: "10px" }}>AI Visibility Audit</span>
            </div>
            <span style={{ fontSize: "14px", color: "#444" }}>xanlens.com</span>
          </div>
        </div>
      ),
      { width: 1200, height: 675 },
    );
  } catch (e) {
    return new Response(`Error: ${e}`, { status: 500 });
  }
}

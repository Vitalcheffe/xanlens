import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

async function getResult(jobId: string) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  for (const key of [`audit:${jobId}:scored`, `audit:result:${jobId}`]) {
    try {
      const res = await fetch(`${url}/get/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.result) return JSON.parse(data.result);
    } catch { continue; }
  }
  return null;
}

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "A+") return "#22c55e";
  if (grade === "B" || grade === "B+") return "#84cc16";
  if (grade === "C" || grade === "C+") return "#eab308";
  if (grade === "D" || grade === "D+") return "#f97316";
  return "#ef4444"; // F
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const result = await getResult(jobId);
  if (!result) return new Response("Not found", { status: 404 });

  const brand = result.brand || "Unknown";
  const score = result.overall_score ?? result.score ?? 0;
  const grade = result.grade || "?";
  const knowledge = result.knowledge_score ?? 0;
  const discoverability = result.discoverability_score ?? 0;
  const citation = result.citation_score ?? 0;
  const color = gradeColor(grade);
  const engines = Object.keys(result.engines || {}).length;
  const totalPrompts = result.total ?? result.done ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: 800,
          height: 420,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)",
          color: "white",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: "40px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid bg */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "radial-gradient(circle at 1px 1px, #222 1px, transparent 0)",
            backgroundSize: "32px 32px",
            opacity: 0.4,
            display: "flex",
          }}
        />

        {/* Top: brand + xanlens */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}>{brand}</span>
            <span style={{ fontSize: 14, color: "#666", marginTop: 4 }}>AI Visibility Audit</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#f59e0b", letterSpacing: "1px" }}>XANLENS</span>
          </div>
        </div>

        {/* Middle: score + grade */}
        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 36, zIndex: 1 }}>
          {/* Score circle */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: "50%",
              border: `6px solid ${color}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: `${color}11`,
            }}
          >
            <span style={{ fontSize: 56, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 14, color: "#888", marginTop: 2 }}>/100</span>
          </div>

          {/* Grade + stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 48, fontWeight: 700, color }}>{grade}</span>
              <span style={{ fontSize: 16, color: "#666" }}>grade</span>
            </div>
            <div style={{ display: "flex", gap: 32 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 24, fontWeight: 600 }}>{knowledge}</span>
                <span style={{ fontSize: 11, color: "#888", letterSpacing: "0.5px" }}>KNOWLEDGE</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 24, fontWeight: 600 }}>{discoverability}</span>
                <span style={{ fontSize: 11, color: "#888", letterSpacing: "0.5px" }}>DISCOVERY</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 24, fontWeight: 600 }}>{citation}</span>
                <span style={{ fontSize: 11, color: "#888", letterSpacing: "0.5px" }}>CITATION</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 20,
            borderTop: "1px solid #222",
            zIndex: 1,
          }}
        >
          <span style={{ fontSize: 13, color: "#555" }}>
            {engines} AI engines · {totalPrompts} prompts tested
          </span>
          <span style={{ fontSize: 13, color: "#555" }}>
            xanlens.com · @xanlens_
          </span>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 420,
    }
  );
}

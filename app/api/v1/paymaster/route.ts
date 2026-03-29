import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Proxy for CDP Paymaster — keeps API key server-side
const CDP_PAYMASTER_URL = process.env.CDP_PAYMASTER_URL || "";

export async function POST(req: NextRequest) {
  if (!CDP_PAYMASTER_URL) {
    return NextResponse.json({ error: "Paymaster not configured" }, { status: 503 });
  }

  const body = await req.text();

  try {
    const res = await fetch(CDP_PAYMASTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Paymaster proxy error:", err);
    return NextResponse.json({ error: "Paymaster proxy failed" }, { status: 502 });
  }
}

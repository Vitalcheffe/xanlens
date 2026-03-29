import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/v1/coinbase-onramp
 * Creates a Coinbase Onramp session and returns the URL.
 * Body: { address: string, amount?: number }
 */
export async function POST(req: NextRequest) {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;

  if (!apiKeyId || !apiKeySecret) {
    return NextResponse.json({ error: "Coinbase Onramp not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { address, amount } = body as { address?: string; amount?: number };

  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  try {
    // Generate JWT using CDP SDK
    const { generateJwt } = await import("@coinbase/cdp-sdk/auth");

    const jwt = await generateJwt({
      apiKeyId,
      apiKeySecret,
      requestMethod: "POST",
      requestHost: "api.cdp.coinbase.com",
      requestPath: "/platform/v2/onramp/sessions",
      expiresIn: 120,
    });

    // Create onramp session
    const sessionBody: Record<string, unknown> = {
      destinationAddress: address,
      purchaseCurrency: "USDC",
      destinationNetwork: "base",
    };
    if (amount) {
      sessionBody.paymentAmount = String(amount);
      sessionBody.paymentCurrency = "USD";
    }

    const res = await fetch("https://api.cdp.coinbase.com/platform/v2/onramp/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
      },
      body: JSON.stringify(sessionBody),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[coinbase-onramp] Session creation failed:", data);
      return NextResponse.json({ error: data?.message || "Failed to create onramp session" }, { status: res.status });
    }

    // Return the session URL
    const sessionUrl = data?.session?.onrampUrl || data?.session?.url || data?.url;
    if (!sessionUrl) {
      return NextResponse.json({ error: "No session URL returned" }, { status: 500 });
    }

    return NextResponse.json({ url: sessionUrl });
  } catch (e: unknown) {
    console.error("[coinbase-onramp] Error:", e);
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Internal error") }, { status: 500 });
  }
}

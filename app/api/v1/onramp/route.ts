import { NextRequest, NextResponse } from "next/server";
import { createOnrampSession } from "@/app/lib/cdp-auth";

export const runtime = "edge";

// POST /api/v1/onramp
// Generate a Coinbase Onramp URL for buying USDC on Base
// Body: { wallet: "0x...", amount?: number }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, amount } = body;

    if (!wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }

    const sessionToken = await createOnrampSession(wallet);

    // Build onramp URL
    const params = new URLSearchParams({
      sessionToken,
      defaultAsset: "USDC",
      defaultNetwork: "base",
      defaultExperience: "buy",
    });

    if (amount) {
      params.set("presetFiatAmount", String(amount));
    }

    const onrampUrl = `https://pay.coinbase.com/buy/select-asset?${params.toString()}`;

    return NextResponse.json({
      status: "ok",
      url: onrampUrl,
      message: "Open this URL to buy USDC on Base via Coinbase.",
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("CDP_API_KEY")) {
      return NextResponse.json({ error: "Onramp not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Failed to create onramp session") }, { status: 500 });
  }
}

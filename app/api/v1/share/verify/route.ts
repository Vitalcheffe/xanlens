import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const { wallet, postUrl } = await request.json();

    if (!wallet || !postUrl) {
      return NextResponse.json({ error: "wallet and postUrl required" }, { status: 400 });
    }

    // Validate URL format — X posts only (Moltbook removed for human flow)
    const url = postUrl.trim();
    const isX = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/i.test(url);

    if (!isX) {
      return NextResponse.json({ error: "URL must be a valid X post (x.com/username/status/...)" }, { status: 400 });
    }

    // Check for duplicate shares
    const existingShares = await redisGet(`shares:${wallet.toLowerCase()}`);
    const shares = existingShares ? JSON.parse(existingShares) : [];
    if (shares.some((s: { url: string }) => s.url === url)) {
      return NextResponse.json({ error: "This post was already used for a discount." }, { status: 400 });
    }

    // Store the share (trust the URL format — X blocks server-side verification)
    shares.push({
      url,
      platform: "x",
      timestamp: new Date().toISOString(),
    });
    await redisSet(`shares:${wallet.toLowerCase()}`, JSON.stringify(shares));

    // Set discount flag
    await redisSet(`discount:${wallet.toLowerCase()}`, JSON.stringify({
      active: true,
      percentage: 30,
      reason: "Shared on X",
      created: new Date().toISOString(),
      shareUrl: url,
    }));

    return NextResponse.json({
      success: true,
      discount: {
        percentage: 30,
        message: "Free re-audit coupon unlocked! Use it anytime on your next audit.",
        auto_applied: true,
      },
    });
  } catch (err) {
    console.error("[/api/v1/share/verify] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Check discount status
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const discount = await redisGet(`discount:${wallet.toLowerCase()}`);
  if (!discount) {
    return NextResponse.json({ hasDiscount: false });
  }

  const data = JSON.parse(discount);
  return NextResponse.json({
    hasDiscount: data.active,
    percentage: data.percentage,
    message: data.active ? "Free re-audit coupon ready" : undefined,
  });
}

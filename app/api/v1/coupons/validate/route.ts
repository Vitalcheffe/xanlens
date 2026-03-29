import { NextRequest, NextResponse } from "next/server";
import { redisGet } from "@/app/lib/redis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase().trim();
  if (!code) {
    return NextResponse.json({ error: "code parameter required" }, { status: 400 });
  }

  const raw = await redisGet(`coupon:${code}`);
  if (!raw) {
    return NextResponse.json({ valid: false, reason: "Invalid or expired coupon code" });
  }

  const coupon = JSON.parse(raw);
  const isUnlimited = coupon.maxUses === 0;
  if (coupon.status === "used" && !isUnlimited) {
    return NextResponse.json({ valid: false, reason: "Coupon already used" });
  }

  return NextResponse.json({ valid: true, campaign: coupon.campaign });
}

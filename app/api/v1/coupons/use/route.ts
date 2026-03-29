import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "code required" }, { status: 400 });
    }

    const key = `coupon:${code.toUpperCase().trim()}`;
    const raw = await redisGet(key);
    if (!raw) {
      return NextResponse.json({ error: "Invalid coupon" }, { status: 404 });
    }

    const coupon = JSON.parse(raw);
    // maxUses === 0 means unlimited
    const isUnlimited = coupon.maxUses === 0;

    if (coupon.status === "used" && !isUnlimited) {
      return NextResponse.json({ error: "Already used" }, { status: 409 });
    }

    coupon.usedCount = (coupon.usedCount || 0) + 1;

    // Only mark as "used" if it has a finite limit and we've hit it
    if (!isUnlimited && coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      coupon.status = "used";
    }

    coupon.lastUsedAt = Date.now();
    await redisSet(key, JSON.stringify(coupon));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

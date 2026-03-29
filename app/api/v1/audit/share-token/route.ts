import { NextRequest, NextResponse } from "next/server";
import { redisGet } from "@/app/lib/redis";
import { getOrCreateSessionToken } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { jobId, wallet } = body;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // Load audit meta
  const metaRaw = await redisGet(`audit:${jobId}:meta`);
  if (!metaRaw) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }
  const meta = JSON.parse(metaRaw);

  // Auth: either wallet owns this audit, or admin secret
  const authHeader = request.headers.get("Authorization");
  const adminSecret = process.env.ADMIN_SECRET;
  const isAdmin = authHeader === `Bearer ${adminSecret}`;

  if (!isAdmin) {
    // Wallet must match the audit's wallet
    if (!wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }
    if (!meta.wallet || meta.wallet.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json({ error: "Not authorized — wallet doesn't own this audit" }, { status: 403 });
    }
  }

  // Generate or retrieve session token for the audit's wallet
  // If admin and audit has no wallet, create a temporary token tied to the jobId
  const targetWallet = meta.wallet || `admin:${jobId}`;
  const token = await getOrCreateSessionToken(targetWallet);

  return NextResponse.json({
    ok: true,
    token,
    jobId,
    brand: meta.brand,
    message: "Share this token with your AI agent. They can paste it on the dashboard to access your audit history.",
  });
}

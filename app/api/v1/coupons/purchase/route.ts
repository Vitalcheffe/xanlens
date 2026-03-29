import { NextRequest, NextResponse } from "next/server";
import { redisSet } from "@/app/lib/redis";

export const runtime = "nodejs";

const XANLENS_WALLET = "0xB33FF8b810670dFe8117E5936a1d5581A05f350D".toLowerCase();
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const MIN_AMOUNT = 990000; // $0.99 in USDC (6 decimals)
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const seg2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `GEO-${seg1}-${seg2}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { txHash, wallet } = body;

  if (!txHash || !wallet) {
    return NextResponse.json({ error: "txHash and wallet required" }, { status: 400 });
  }

  // Check if this tx was already used to generate a coupon
  const txKey = `purchase:tx:${txHash.toLowerCase()}`;
  const { redisGet } = await import("@/app/lib/redis");
  const existing = await redisGet(txKey);
  if (existing) {
    const data = JSON.parse(existing);
    return NextResponse.json({ ok: true, code: data.code, cached: true });
  }

  // Verify the transaction on Base via RPC
  try {
    const res = await fetch(BASE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
    });
    const data = await res.json();
    const receipt = data.result;

    if (!receipt || receipt.status !== "0x1") {
      return NextResponse.json({ error: "Transaction not confirmed or failed" }, { status: 400 });
    }

    // Check logs for USDC Transfer event to our wallet
    // Transfer(address,address,uint256) = 0xddf252ad...
    const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const transferLog = receipt.logs?.find((log: any) => {
      if (log.address?.toLowerCase() !== USDC_ADDRESS) return false;
      if (log.topics?.[0] !== TRANSFER_TOPIC) return false;
      // topics[2] is the recipient (padded to 32 bytes)
      const to = "0x" + (log.topics?.[2] || "").slice(26).toLowerCase();
      return to === XANLENS_WALLET;
    });

    if (!transferLog) {
      return NextResponse.json({ error: "No USDC transfer to XanLens found in this transaction" }, { status: 400 });
    }

    // Check amount (data field is the uint256 amount)
    const amount = parseInt(transferLog.data, 16);
    if (amount < MIN_AMOUNT) {
      return NextResponse.json({ error: `Payment too low: $${(amount / 1e6).toFixed(2)} (min $0.99)` }, { status: 400 });
    }

    // Generate coupon
    const code = generateCode();
    await redisSet(`coupon:${code}`, JSON.stringify({
      status: "active",
      campaign: "purchase",
      maxUses: 1,
      usedCount: 0,
      createdAt: Date.now(),
      purchaseTx: txHash,
      purchaseWallet: wallet.toLowerCase(),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000, // 7 days
    }), 7 * 24 * 3600);

    // Mark tx as used
    await redisSet(txKey, JSON.stringify({ code, wallet: wallet.toLowerCase(), createdAt: Date.now() }), 30 * 24 * 3600);

    return NextResponse.json({ ok: true, code, amount: amount / 1e6 });
  } catch (err: any) {
    console.error("Purchase verification error:", err);
    return NextResponse.json({ error: "Failed to verify transaction" }, { status: 500 });
  }
}

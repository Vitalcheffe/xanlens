import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/app/lib/auth";
import { createServerWallet } from "@/app/lib/cdp-auth";
import { redisGet, redisSet } from "@/app/lib/redis";

export const runtime = "edge";

// POST /api/v1/wallet
// Create a wallet for an agent that doesn't have one
// Returns: { wallet: "0x...", network: "base" }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    // Check if agent already has a wallet
    const existingKey = `agent:wallet:${agentId}`;
    const existing = await redisGet(existingKey);
    if (existing) {
      const data = JSON.parse(existing);
      return NextResponse.json({
        status: "existing",
        wallet: data.address,
        walletId: data.walletId,
        network: "base",
        message: "Wallet already exists for this agent.",
      });
    }

    // Create new wallet via CDP Server Wallet
    const { walletId, address, networkId } = await createServerWallet("base-mainnet");

    // Store mapping
    await redisSet(existingKey, JSON.stringify({ walletId, address, networkId, createdAt: Date.now() }));

    // Create user account
    await createUser(address, { isAgent: true });

    return NextResponse.json({
      status: "created",
      wallet: address,
      walletId,
      network: "base",
      message: "Wallet created. Fund it with USDC on Base to pay for audits.",
      fund_options: [
        "Transfer USDC to this address on Base network",
        "Use Coinbase to send USDC",
        "Bridge from other chains via Base Bridge",
      ],
    });
  } catch (e: unknown) {
    // If CDP isn't configured, return helpful error
    if (e instanceof Error && e.message.includes("CDP_API_KEY")) {
      return NextResponse.json({
        error: "Wallet creation not configured yet.",
        alternatives: [
          "Use your own EVM wallet address",
          "Use Coinbase AgentKit: npm install @coinbase/agentkit",
          "Pass wallet=0x... in your audit request body",
        ],
      }, { status: 503 });
    }
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Internal server error") }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/v1/wallet",
    description: "Create a wallet for AI agents without one. Powered by Coinbase CDP Server Wallet.",
    usage: { agentId: "required — unique identifier for the agent" },
    returns: { wallet: "0x... EVM address on Base", walletId: "CDP wallet ID" },
  });
}

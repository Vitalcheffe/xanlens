/**
 * x402 Payment-Gated Audit Route
 * 
 * Uses @x402/next withX402 wrapper + @coinbase/x402 CDP facilitator.
 */

import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402";

export const maxDuration = 30;

const PAY_TO = "0x66397dd3d80e55366616f301c632694acec802a0";
const NETWORK = "eip155:8453" as const; // Base mainnet

// Create resource server with CDP facilitator
const facilitatorClient = new HTTPFacilitatorClient(facilitator);
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register(NETWORK, new ExactEvmScheme());

const routeConfig = {
  accepts: {
    scheme: "exact" as const,
    network: NETWORK,
    payTo: PAY_TO,
    price: "$0.99",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    extra: {
      name: "USD Coin",
      version: "2",
    },
  },
  description: "XanLens Pro GEO Audit - 78+ prompts across 4 AI engines",
};

// The actual handler — runs AFTER payment is verified
async function handler(request: NextRequest) {
  const body = await request.json();
  const baseUrl = new URL(request.url).origin;

  // 1. Create the audit job
  const internalRes = await fetch(`${baseUrl}/api/v1/audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Source": "x402",
    },
    body: JSON.stringify({
      ...body,
      wallet: body.wallet || "x402-paid",
    }),
  });

  const data = await internalRes.json();

  // 2. Auto-trigger execution if audit was created
  if (internalRes.ok && data.job_id) {
    // Fire-and-forget: trigger execute endpoint separately.
    // Don't await — the execute function runs independently on Vercel.
    fetch(`${baseUrl}/api/v1/audit/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: data.job_id }),
    }).catch(() => {}); // Ignore errors — agent can call execute manually if needed
  }

  return NextResponse.json(data, { status: internalRes.status });
}

// Wrap with x402 payment protection
export const POST = withX402(handler, routeConfig, resourceServer);

// GET returns payment info
export async function GET() {
  return NextResponse.json({
    status: "x402_endpoint_active",
    price: "$0.99 USDC",
    network: "Base (eip155:8453)",
    description: routeConfig.description,
  });
}

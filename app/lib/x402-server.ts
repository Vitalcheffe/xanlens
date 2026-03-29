/**
 * x402 Payment Server Configuration
 * 
 * Wraps API routes with x402 payment requirements.
 * Agents pay $0.99 USDC on Base mainnet for Pro audits.
 */

import { x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const FACILITATOR_URL = "https://facilitator.x402.org";
const PAY_TO = "0xB33FF8b810670dFe8117E5936a1d5581A05f350D"; // Our wallet on Base
const NETWORK = "eip155:8453" as `${string}:${string}`; // Base mainnet

// Create facilitator client and resource server (singleton)
let _server: InstanceType<typeof x402ResourceServer> | null = null;

export function getX402Server() {
  if (!_server) {
    const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
    _server = new x402ResourceServer(facilitatorClient);
    _server.register(NETWORK, new ExactEvmScheme());
  }
  return _server;
}

export const AUDIT_PAYMENT_CONFIG = {
  accepts: {
    scheme: "exact" as const,
    price: "$0.99",
    network: NETWORK,
    payTo: PAY_TO,
  },
  description: "XanLens Pro GEO Audit — 78+ prompts across 4 AI engines with grounded search data",
};

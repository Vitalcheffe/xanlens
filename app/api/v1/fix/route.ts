import { NextRequest, NextResponse } from "next/server"
import { runAudit, AuditRequest } from "@/app/lib/audit"
import { generateAllContent } from "@/app/lib/content-generator"

const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase()
const RECIPIENT = "0xB33FF8b810670dFe8117E5936a1d5581A05f350D".toLowerCase()
const BASE_RPC = "https://mainnet.base.org"

const PAYMENT_REQUIRED_RESPONSE = {
  status: 402,
  protocol: "x402",
  payment: {
    network: "base",
    token: "USDC",
    amount: "4.99",
    recipient: "0xB33FF8b810670dFe8117E5936a1d5581A05f350D",
    chain_id: 8453,
  },
  instructions: "Send 4.99 USDC on Base to the recipient address. Retry with X-Payment-Tx header containing the transaction hash. You'll receive a full GEO audit + AI-generated content: optimized blog post, FAQ page with schema, JSON-LD markup, seed citations, and about page copy.",
}

async function verifyPayment(txHash: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
    })
    const data = await res.json()
    const receipt = data.result
    if (!receipt) return { valid: false, error: "Transaction not found or not yet confirmed" }
    if (receipt.status !== "0x1") return { valid: false, error: "Transaction failed" }

    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    const recipientPadded = "0x" + RECIPIENT.slice(2).padStart(64, "0")

    for (const log of receipt.logs || []) {
      if (
        log.address?.toLowerCase() === USDC_CONTRACT &&
        log.topics?.[0] === transferTopic &&
        log.topics?.[2]?.toLowerCase() === recipientPadded
      ) {
        return { valid: true }
      }
    }

    if (receipt.to?.toLowerCase() === USDC_CONTRACT) {
      return { valid: true }
    }

    return { valid: false, error: "No USDC transfer to recipient found in transaction" }
  } catch {
    return { valid: false, error: "Failed to verify transaction on Base" }
  }
}

export async function POST(request: NextRequest) {
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled. Launching soon.", status: "maintenance" }, { status: 503 });

    const xSource = request.headers.get("x-source")
    const xPayment = request.headers.get("x-payment")
    const xPaymentTx = request.headers.get("x-payment-tx")

    const isFreeRequest = xSource?.toLowerCase() === "website"

    if (!isFreeRequest) {
      if (xPayment?.toLowerCase() === "x402" && !xPaymentTx) {
        return NextResponse.json(PAYMENT_REQUIRED_RESPONSE, { status: 402 })
      }
      if (!xPaymentTx) {
        return NextResponse.json(PAYMENT_REQUIRED_RESPONSE, { status: 402 })
      }
      const verification = await verifyPayment(xPaymentTx)
      if (!verification.valid) {
        return NextResponse.json(
          { ...PAYMENT_REQUIRED_RESPONSE, error: verification.error },
          { status: 402 }
        )
      }
    }

    const body = await request.json()
    const { brand, website, industry } = body

    if (!brand || !industry) {
      return NextResponse.json({ error: "brand and industry are required" }, { status: 400 })
    }

    // Run audit first
    const auditRequest: AuditRequest = { brand, website, industry }
    const auditResult = await runAudit(auditRequest)

    // Generate all content in parallel
    const content = await generateAllContent(brand, website || "", industry, auditResult)

    return NextResponse.json({
      audit: auditResult,
      content,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[/api/v1/fix] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "POST /api/v1/fix",
    description: "Full GEO audit + AI-generated content. $4.99 via x402 (USDC on Base).",
    fields: { brand: "required", website: "optional", industry: "required" },
  })
}

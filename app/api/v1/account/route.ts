import { NextRequest, NextResponse } from "next/server";
import { getUser, createUser, getAuditHistory, getWalletBySessionToken, getOrCreateSessionToken } from "@/app/lib/auth";

export const runtime = "edge";

// GET /api/v1/account?wallet=0x... OR ?token=<sessionToken>
// Returns user account + audit history
export async function GET(request: NextRequest) {
  let wallet = request.nextUrl.searchParams.get("wallet");
  const token = request.nextUrl.searchParams.get("token");

  // Resolve wallet from session token if no wallet provided
  if (!wallet && token) {
    wallet = await getWalletBySessionToken(token);
    if (!wallet) {
      return NextResponse.json({ error: "Invalid or expired session token" }, { status: 401 });
    }
  }

  if (!wallet) {
    return NextResponse.json({ error: "wallet or token parameter required" }, { status: 400 });
  }

  const user = await getUser(wallet);
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const audits = await getAuditHistory(wallet);
  const sessionToken = await getOrCreateSessionToken(wallet);

  return NextResponse.json({ user, audits, sessionToken });
}

// POST /api/v1/account
// Create or login to account
// Body: { wallet: "0x...", email?: "...", isAgent?: boolean }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, email, isAgent } = body;

    if (!wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }

    // Validate wallet format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Invalid EVM wallet address" }, { status: 400 });
    }

    const user = await createUser(wallet, { email, isAgent });
    const audits = await getAuditHistory(wallet);

    return NextResponse.json({ user, audits });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : "Internal server error") }, { status: 500 });
  }
}

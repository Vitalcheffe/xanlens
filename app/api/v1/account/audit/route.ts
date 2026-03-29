import { NextRequest, NextResponse } from "next/server";
import { getAuditHistory } from "@/app/lib/auth";
import { redisSet } from "@/app/lib/redis";

export const runtime = "edge";

// DELETE /api/v1/account/audit?wallet=0x...&jobId=...
// Remove an audit from history
export async function DELETE(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!wallet || !jobId) {
    return NextResponse.json({ error: "wallet and jobId required" }, { status: 400 });
  }

  const audits = await getAuditHistory(wallet);
  const filtered = audits.filter(a => a.jobId !== jobId);

  await redisSet(`user:audits:${wallet.toLowerCase()}`, JSON.stringify(filtered));

  return NextResponse.json({ ok: true, remaining: filtered.length });
}

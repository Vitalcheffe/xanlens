import { NextRequest, NextResponse } from "next/server";
import { updateAuditStatus } from "@/app/lib/auth";

export const runtime = "edge";

// POST /api/v1/account/audit/status
// Update an audit record's status (called by frontend when audit completes)
export async function POST(request: NextRequest) {
  try {
    const { wallet, jobId, status, score } = await request.json();
    if (!wallet || !jobId || !status) {
      return NextResponse.json({ error: "wallet, jobId, and status required" }, { status: 400 });
    }
    if (status !== "complete" && status !== "failed") {
      return NextResponse.json({ error: "status must be 'complete' or 'failed'" }, { status: 400 });
    }
    await updateAuditStatus(wallet, jobId, status, score);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

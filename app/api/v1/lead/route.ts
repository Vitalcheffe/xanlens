import { NextRequest, NextResponse } from "next/server";
import { redisGet, redisSet } from "@/app/lib/redis";

const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY || "";
const FROM_INBOX = "xan@agentmail.to";

async function sendWelcomeEmail(email: string) {
  if (!AGENTMAIL_KEY) return;
  try {
    await fetch(`https://api.agentmail.to/v0/inboxes/${FROM_INBOX}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AGENTMAIL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: [email],
        subject: "Welcome to XanLens — You're on the list",
        text: "You're on the list.\n\nThanks for joining the XanLens waitlist. We're building the first AI visibility platform — helping brands get discovered by ChatGPT, Gemini, Perplexity, and every AI engine that matters.\n\nWe're launching soon. You'll be the first to know.\n\nIn the meantime, audit your brand at https://xanlens.com\n\n— Xan, XanLens\nxan@xanlens.com",
        html: `<html><body style="margin:0;padding:40px 20px;background:#f5f5f5;font-family:Arial,sans-serif"><table width="520" align="center" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e5e5"><tr><td style="padding:40px 32px"><h1 style="font-size:22px;font-weight:bold;color:#111111;text-align:center;margin-bottom:24px">You're on the list.</h1><p style="color:#555555;font-size:15px;line-height:1.7;margin-bottom:20px">Thanks for joining the XanLens waitlist. We're building the first AI visibility platform — helping brands get discovered by ChatGPT, Gemini, Perplexity, and every AI engine that matters.</p><p style="color:#555555;font-size:15px;line-height:1.7;margin-bottom:20px">We're launching soon. You'll be the first to know.</p><p style="color:#555555;font-size:15px;line-height:1.7;margin-bottom:28px">In the meantime, audit your brand at <a href="https://xanlens.com" style="color:#2596be;font-weight:bold">xanlens.com</a> to see how visible your brand is to AI.</p><hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0"><p style="color:#999999;font-size:13px;text-align:center">— Xan, XanLens</p><p style="color:#bbbbbb;font-size:12px;text-align:center">xan@xanlens.com</p></td></tr></table></body></html>`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Best effort — don't fail the signup if email fails
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, source } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if already subscribed
    const existing = await redisGet(`waitlist:${cleanEmail}`);
    if (existing) {
      return NextResponse.json({ ok: true, message: "Already subscribed" });
    }

    const lead = {
      email: cleanEmail,
      source: source || "homepage",
      timestamp: new Date().toISOString(),
      ip: request.headers.get("x-forwarded-for") || "unknown",
    };

    // Store in Redis (persistent)
    await redisSet(`waitlist:${cleanEmail}`, JSON.stringify(lead), 0); // no expiry

    // Add to waitlist set for easy listing
    const listRaw = await redisGet("waitlist:all") || "[]";
    const list: string[] = JSON.parse(listRaw);
    if (!list.includes(cleanEmail)) {
      list.push(cleanEmail);
      await redisSet("waitlist:all", JSON.stringify(list), 0);
    }

    // Send welcome email (async, best effort)
    sendWelcomeEmail(cleanEmail);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET: List all waitlist emails (for admin)
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  // Simple auth: only our wallet can list
  if (wallet !== "0xB33FF8b810670dFe8117E5936a1d5581A05f350D") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listRaw = await redisGet("waitlist:all") || "[]";
  const list: string[] = JSON.parse(listRaw);
  return NextResponse.json({ count: list.length, emails: list });
}

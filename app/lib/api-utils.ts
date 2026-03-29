import { NextResponse } from "next/server";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Source, X-Payment-Tx",
} as const;

export function corsJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function errorJson(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function corsErrorJson(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export function handleOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

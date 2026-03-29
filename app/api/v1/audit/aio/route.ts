import { NextRequest, NextResponse } from 'next/server';
import { analyzeAIO } from '@/app/lib/aio-analyzer';
import { errorJson, getErrorMessage, CORS_HEADERS } from '@/app/lib/api-utils';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return errorJson('Missing required parameter: url', 400);
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return errorJson('URL must use http or https protocol', 400);
    }
  } catch {
    return errorJson('Invalid URL format', 400);
  }

  try {
    const result = await analyzeAIO(url);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        ...CORS_HEADERS,
      },
    });
  } catch (err: unknown) {
    return errorJson(`Analysis failed: ${getErrorMessage(err)}`, 502);
  }
}

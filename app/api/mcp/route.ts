import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/app/lib/audit";

interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

function jsonrpc(id: number | string | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonrpcError(id: number | string | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function POST(request: NextRequest) {
  let body: JsonRpcRequest;
  try {
    // KILL SWITCH
    const ENABLED = true;
    if (!ENABLED) return NextResponse.json({ error: "Temporarily disabled.", status: "maintenance" }, { status: 503 });
    body = await request.json();
  } catch {
    return jsonrpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = body;

  if (method === "initialize") {
    return jsonrpc(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "xanlens", version: "1.0.0" },
    });
  }

  if (method === "tools/list") {
    return jsonrpc(id, {
      tools: [
        {
          name: "xanlens_audit",
          description: "Run a GEO visibility audit for a brand across AI search engines",
          inputSchema: {
            type: "object",
            properties: {
              brand: { type: "string", description: "Brand name to audit" },
              website: { type: "string", description: "Brand website URL (optional)" },
              industry: { type: "string", description: "Industry vertical", default: "general" },
            },
            required: ["brand"],
          },
        },
      ],
    });
  }

  if (method === "tools/call") {
    const toolName = params?.name as string;
    if (toolName !== "xanlens_audit") {
      return jsonrpcError(id, -32602, `Unknown tool: ${toolName}`);
    }
    const args = (params?.arguments || {}) as Record<string, string>;
    if (!args.brand) {
      return jsonrpcError(id, -32602, "Missing required parameter: brand");
    }
    try {
      const result = await runAudit({
        brand: args.brand,
        website: args.website,
        industry: args.industry || "general",
      });
      return jsonrpc(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    } catch {
      return jsonrpcError(id, -32603, "Audit failed");
    }
  }

  return jsonrpcError(id, -32601, `Method not found: ${method}`);
}

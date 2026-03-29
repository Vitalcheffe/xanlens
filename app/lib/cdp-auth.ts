// CDP API JWT authentication for edge runtime
// Uses jose library (edge-compatible)

import { SignJWT, importJWK, importPKCS8 } from "jose";

const CDP_API_HOST = "api.developer.coinbase.com";
const CDP_API_URL = `https://${CDP_API_HOST}`;

function base64ToBase64url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateJWT(
  apiKeyId: string,
  apiKeySecret: string,
  requestMethod: string,
  requestPath: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const randomNonce = nonce();

  const claims = {
    sub: apiKeyId,
    iss: "cdp",
    aud: ["cdp_service"],
    uris: [`${requestMethod} ${CDP_API_HOST}${requestPath}`],
  };

  // Check if it's an Ed25519 key (64 bytes base64) or EC PEM key
  const isEdwards = !apiKeySecret.includes("BEGIN");

  if (isEdwards) {
    // Ed25519: 64 bytes = 32 seed + 32 public
    const raw = atob(apiKeySecret);
    const decoded = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) decoded[i] = raw.charCodeAt(i);

    if (decoded.length !== 64) {
      throw new Error(`Invalid Ed25519 key length: ${decoded.length}, expected 64`);
    }

    const seed = decoded.slice(0, 32);
    const publicKey = decoded.slice(32);

    // Create JWK
    const jwk = {
      kty: "OKP" as const,
      crv: "Ed25519" as const,
      d: base64ToBase64url(btoa(String.fromCharCode(...seed))),
      x: base64ToBase64url(btoa(String.fromCharCode(...publicKey))),
    };

    const key = await importJWK(jwk, "EdDSA");

    return await new SignJWT(claims)
      .setProtectedHeader({ alg: "EdDSA", kid: apiKeyId, typ: "JWT", nonce: randomNonce })
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + 120)
      .sign(key);
  } else {
    // EC (ES256) PEM key
    const key = await importPKCS8(apiKeySecret, "ES256");

    return await new SignJWT(claims)
      .setProtectedHeader({ alg: "ES256", kid: apiKeyId, typ: "JWT", nonce: randomNonce })
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + 120)
      .sign(key);
  }
}

export async function cdpFetch(
  method: string,
  path: string,
  body?: object,
): Promise<any> {
  const apiKeyId = process.env.CDP_API_KEY;
  const apiKeySecret = process.env.CDP_API_SECRET;

  if (!apiKeyId || !apiKeySecret) {
    throw new Error("CDP_API_KEY and CDP_API_SECRET required");
  }

  const jwt = await generateJWT(apiKeyId, apiKeySecret, method, path);

  const res = await fetch(`${CDP_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CDP API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function createServerWallet(networkId: string = "base-mainnet"): Promise<{
  walletId: string;
  address: string;
  networkId: string;
}> {
  const result = await cdpFetch("POST", "/platform/v1/wallets", {
    wallet: { network_id: networkId },
  });

  return {
    walletId: result.id,
    address: result.default_address?.address_id || "",
    networkId: result.network_id,
  };
}

// Generate onramp session token
export async function createOnrampSession(walletAddress: string): Promise<string> {
  const result = await cdpFetch("POST", "/onramp/v1/token", {
    addresses: [{
      address: walletAddress,
      blockchains: ["base"],
    }],
  });

  return result.token;
}

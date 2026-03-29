// Upstash Redis REST client
const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";

async function redisCmd(...args: string[]): Promise<any> {
  const res = await fetch(`${KV_URL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  return data.result;
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await redisCmd("SET", key, value, "EX", String(ttlSeconds));
  } else {
    await redisCmd("SET", key, value);
  }
}

export async function redisGet(key: string): Promise<string | null> {
  return redisCmd("GET", key);
}

export async function redisIncr(key: string): Promise<number> {
  return redisCmd("INCR", key);
}

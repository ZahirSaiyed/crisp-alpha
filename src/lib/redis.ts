import { createClient, RedisClientType } from "redis";

let client: RedisClientType | null = null;

export function redis(): RedisClientType {
  if (!client) {
    const url = process.env.REDIS_URL || "";
    if (!url) throw new Error("REDIS_URL not set");
    client = createClient({ url });
    client.on("error", (err) => console.error("Redis error", err));
    // Lazy connect; command will auto-connect if needed
  }
  return client;
}

export function ns(key: string): string {
  const env = process.env.NODE_ENV || "dev";
  return `crisp:${env}:${key}`;
}



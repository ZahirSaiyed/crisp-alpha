import { NextRequest } from "next/server";
import { redis, ns } from "../../../lib/redis";
import { generateId } from "../../../lib/ids";

function hashIdempotency(transcript: string, promptId: string): string {
  const data = `${promptId}::${transcript}`;
  let h = 2166136261 >>> 0; // FNV-1a-ish
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export async function POST(req: NextRequest) {
  // TODO: replace with real auth and userId resolution
  const userId = (await req.headers.get("x-user-id")) || "dev-user";
  const body = await req.json().catch(() => ({}));
  const { promptId, timeboxSec, transcript, basicMetrics } = body || {};
  if (!transcript || typeof transcript !== "string") return Response.json({ error: "Missing transcript" }, { status: 400 });
  if (!promptId) return Response.json({ error: "Missing promptId" }, { status: 400 });

  const r = redis();
  await r.connect().catch(() => {});

  const id = generateId("rec");
  const baseKey = `rec:${id}`;
  const ttlSec = 60 * 60 * 48; // 48h

  // Persist session basics (for GET later)
  const sessionData = {
    id,
    userId,
    createdAt: Date.now(),
    promptId,
    timeboxSec: Number(timeboxSec) || null,
    transcript,
    basicMetrics: basicMetrics || null,
    coachStatus: "pending",
  };
  await r.set(ns(`${baseKey}:basic`), JSON.stringify(sessionData), { EX: ttlSec });

  // Set status pending for coach
  await r.set(ns(`${baseKey}:status`), "pending", { EX: ttlSec });

  // Idempotency key
  const idem = hashIdempotency(transcript, String(promptId));
  await r.set(ns(`${baseKey}:idem`), idem, { EX: ttlSec });

  // Enqueue job (for now, write to a Redis list as a stub; worker will pop it)
  const job = { sessionId: id, promptId, timeboxSec: Number(timeboxSec) || null, transcript, basicMetrics: basicMetrics || null };
  await r.lPush(ns("coach:jobs"), JSON.stringify(job));

  return Response.json({ id }, { status: 201 });
}



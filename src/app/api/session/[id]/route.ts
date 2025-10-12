import { NextRequest } from "next/server";
import { redis, ns } from "../../../../lib/redis";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = String(params?.id || "");
  const r = redis();
  await r.connect().catch(() => {});
  const val = await r.get(ns(`rec:${id}:basic`));
  if (!val) return Response.json({ error: "Not found" }, { status: 404 });
  // TODO: enforce ownership via auth
  return Response.json(JSON.parse(val), { headers: { "Cache-Control": "no-store" } });
}



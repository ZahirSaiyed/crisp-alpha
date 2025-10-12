import { NextRequest } from "next/server";

// Placeholder in-memory store to simulate Redis-backed coach status
const mem = new Map<string, { status: "pending"|"ready"|"error"; coach?: any }>();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = String(params?.id || "");
  const val = mem.get(id) || { status: "pending" as const };
  return Response.json(val, { status: 200, headers: { "Cache-Control": "no-store" } });
}



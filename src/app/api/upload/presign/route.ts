import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const contentType = typeof body?.contentType === "string" ? body.contentType : "audio/webm";

    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    if (!bucket || !region) {
      return NextResponse.json({ error: "S3 not configured" }, { status: 500 });
    }
    const prefix = process.env.S3_UPLOAD_PREFIX || "uploads/";

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const base = `${prefix}${y}/${m}/${d}`.replace(/\/+/, "/");
    const id = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ||
      `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext = contentType.includes("mpeg") ? ".mp3" : contentType.includes("mp4") ? ".m4a" : contentType.includes("ogg") ? ".ogg" : ".webm";
    const objectKey = `${base}/recording-${id}${ext}`;

    // Lazy-import AWS SDK only when needed to avoid dev server issues on parse
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const s3 = new S3Client({ region });
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType });
    const expiresIn = 24 * 60 * 60; // 24h seconds
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn });

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return NextResponse.json({ uploadUrl, objectKey, bucket, region, expiresAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Presign failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}



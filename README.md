This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Storage presigned uploads (audio privacy)

This app can upload recorded audio directly from the browser to S3 using presigned URLs. The server never receives raw audio; it only receives an object key to transcribe.

Environment variables:

- `S3_BUCKET` – S3 bucket name
- `S3_REGION` – S3 region (e.g. `us-east-1`)
- `S3_UPLOAD_PREFIX` – Optional prefix for uploads (default `uploads/`)
- `DEEPGRAM_API_KEY` – Deepgram API key for transcription
- `NEXT_PUBLIC_ALLOW_DIRECT_UPLOAD_FALLBACK` – Optional (default unset/false). If set to `true`, enables legacy direct upload to the transcription API for development only.

Endpoints:

- `POST /api/upload/presign` → `{ uploadUrl, objectKey, expiresAt }`
- `POST /api/transcribe` with JSON `{ objectKey }`

Notes:

- Presigned URL TTL: 24h.
- If presign fails and the fallback flag is not enabled, the client will show an error to preserve privacy.

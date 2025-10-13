# Architecture Documentation

## System Overview

Crisp is a Next.js application that provides real-time speech analysis and feedback. The system is designed to be stateless, secure, and performant.

## Request Flow

```
Client → Middleware → API Route → External Service → Response
```

### Detailed Flow

1. **Client Request**: Audio data sent to `/api/transcribe`
2. **Middleware**: 
   - Request ID generation
   - Rate limiting (20 requests/10min per IP)
   - Origin validation
   - Security headers injection
3. **API Route**: 
   - Input validation with Zod
   - Audio processing
   - External API calls (Deepgram/Gemini)
   - Response validation
4. **Response**: Structured JSON with request ID

## Security Posture

### Rate Limiting
- 20 requests per 10-minute window per IP
- In-memory storage (single instance)
- Headers: `X-RateLimit-*` for client awareness

### Headers
- `X-Request-ID`: UUID for request tracing
- `Strict-Transport-Security`: HSTS enforcement
- `X-Content-Type-Options`: MIME sniffing protection
- `X-Frame-Options`: Clickjacking protection
- `Referrer-Policy`: Referrer information control

### Content Security Policy
- **Development**: Allows `unsafe-eval` for Next.js HMR
- **Production**: Strict CSP with no unsafe directives
- No external script sources
- No inline scripts (except Tailwind CSS)

### Origin Validation
- API routes validate `Origin` header against `NEXT_PUBLIC_BASE_URL`
- Rejects requests from unauthorized origins

## Performance Budgets

### Bundle Size
- **Target**: < 120 kB JavaScript on `/` and `/record` routes
- **Fonts**: Inter via `next/font/google` with subset and `display: swap`
- **Images**: WebP/AVIF formats enabled

### Time to Interactive
- **Target**: < 1.5s on mid-range mobile devices
- **Optimizations**:
  - React Strict Mode enabled
  - SWC minifier
  - No source maps in production
  - Lazy loading for non-critical components

## API Design

### Request/Response Format
All API responses follow a consistent structure:

```typescript
// Success
{ data: T, rid?: string }

// Error
{ code: string, message: string, rid?: string }
```

### Validation
- **Input**: Zod schemas for all request data
- **Output**: Zod schemas for all response data
- **Headers**: Validated content-type and size limits

### Timeouts
- **Deepgram**: 25s timeout with AbortController
- **Gemini**: 25s timeout with AbortController
- **File Upload**: 20MB size limit with streaming

## Environment Configuration

### Required Variables
- `DEEPGRAM_API_KEY`: Deepgram API authentication
- `GEMINI_API_KEY`: Google Gemini API authentication
- `NEXT_PUBLIC_BASE_URL`: Application base URL for origin validation
- `NODE_ENV`: Environment (development/production/test)

### Development Flags
- `USE_FIXTURE`: Enable fixture mode for testing (dev only)

## Logging

### Structure
```json
{
  "level": "info|warn|error",
  "rid": "request-id",
  "path": "/api/transcribe",
  "method": "POST",
  "status": 200,
  "durMs": 1500,
  "message": "Request completed",
  "meta": { "additional": "context" },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Redaction
- Automatic redaction of sensitive patterns
- No PII or transcripts in logs
- Structured JSON in production, human-readable in development

## Fixture Mode

### Development Only
- Set `USE_FIXTURE=true` in development
- Returns mock data from `src/fixtures/transcript.json`
- Bypasses external API calls
- Useful for testing and development

### Usage
```bash
# Enable fixture mode
USE_FIXTURE=true npm run dev
```

## Error Handling

### HTTP Status Codes
- `400`: Bad Request (validation errors)
- `403`: Forbidden (origin mismatch)
- `408`: Request Timeout
- `413`: Payload Too Large
- `429`: Too Many Requests
- `500`: Internal Server Error
- `503`: Service Unavailable

### Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `INVALID_MIME_TYPE`: Unsupported audio format
- `FILE_TOO_LARGE`: Exceeds 20MB limit
- `DEEPGRAM_ERROR`: Transcription service error
- `GEMINI_ERROR`: AI feedback service error
- `RATE_LIMITED`: Too many requests

## Monitoring

### Request Tracing
- Every request gets a unique UUID
- Request ID propagated through AsyncLocalStorage
- Included in all logs and responses
- Enables end-to-end request tracing

### Metrics
- Request duration logging
- API call timing
- Error rate tracking
- Rate limit hit tracking

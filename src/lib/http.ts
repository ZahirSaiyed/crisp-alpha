import { NextResponse } from 'next/server'
import { z } from 'zod'

// Standard error response schema
const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  rid: z.string().optional(),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

// Success response schema
const SuccessResponseSchema = z.object({
  data: z.unknown().optional(),
  rid: z.string().optional(),
})

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>

// HTTP status code helpers
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const

// Typed response helpers
export function ok<T = unknown>(data?: T, rid?: string): NextResponse {
  return NextResponse.json({ data, rid }, { status: HTTP_STATUS.OK })
}

export function created<T = unknown>(data?: T, rid?: string): NextResponse {
  return NextResponse.json({ data, rid }, { status: HTTP_STATUS.CREATED })
}

export function badRequest(message: string, code = 'BAD_REQUEST', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.BAD_REQUEST }
  )
}

export function unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.UNAUTHORIZED }
  )
}

export function forbidden(message = 'Forbidden', code = 'FORBIDDEN', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.FORBIDDEN }
  )
}

export function notFound(message = 'Not Found', code = 'NOT_FOUND', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.NOT_FOUND }
  )
}

export function methodNotAllowed(message = 'Method Not Allowed', code = 'METHOD_NOT_ALLOWED', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.METHOD_NOT_ALLOWED }
  )
}

export function requestTimeout(message = 'Request Timeout', code = 'REQUEST_TIMEOUT', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.REQUEST_TIMEOUT }
  )
}

export function entityTooLarge(message = 'Payload Too Large', code = 'PAYLOAD_TOO_LARGE', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.PAYLOAD_TOO_LARGE }
  )
}

export function unprocessableEntity(message = 'Unprocessable Entity', code = 'UNPROCESSABLE_ENTITY', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
  )
}

export function tooManyRequests(message = 'Too Many Requests', code = 'TOO_MANY_REQUESTS', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.TOO_MANY_REQUESTS }
  )
}

export function serverError(message = 'Internal Server Error', code = 'INTERNAL_SERVER_ERROR', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
  )
}

export function badGateway(message = 'Bad Gateway', code = 'BAD_GATEWAY', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.BAD_GATEWAY }
  )
}

export function serviceUnavailable(message = 'Service Unavailable', code = 'SERVICE_UNAVAILABLE', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
  )
}

export function gatewayTimeout(message = 'Gateway Timeout', code = 'GATEWAY_TIMEOUT', rid?: string): NextResponse {
  return NextResponse.json(
    { code, message, rid },
    { status: HTTP_STATUS.GATEWAY_TIMEOUT }
  )
}

// Validation helpers
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: badRequest(
      `Validation failed: ${result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      'VALIDATION_ERROR'
    )
  }
}

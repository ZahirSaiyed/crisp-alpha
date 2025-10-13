import { ENV, IS_PROD } from './env'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  rid?: string
  path?: string
  method?: string
  status?: number
  durMs?: number
  message: string
  meta?: Record<string, unknown> | undefined
  timestamp: string
}

// Redaction patterns for sensitive data
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /auth/i,
  /transcript/i,
  /audio/i,
  /recording/i,
]

function redactSensitiveData(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // Check if string contains sensitive patterns
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(obj))
    if (isSensitive) {
      return '[REDACTED]'
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData)
  }

  if (obj && typeof obj === 'object') {
    const redacted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const isSensitiveKey = SENSITIVE_PATTERNS.some(pattern => pattern.test(key))
      if (isSensitiveKey) {
        redacted[key] = '[REDACTED]'
      } else {
        redacted[key] = redactSensitiveData(value)
      }
    }
    return redacted
  }

  return obj
}

function formatLogEntry(entry: LogEntry): string {
  if (IS_PROD) {
    // Structured JSON in production
    return JSON.stringify(entry)
  } else {
    // Human-readable in development
    const parts = [
      `[${entry.timestamp}]`,
      entry.level.toUpperCase(),
      entry.rid ? `[${entry.rid}]` : '',
      entry.path ? `${entry.method || 'GET'} ${entry.path}` : '',
      entry.status ? `→ ${entry.status}` : '',
      entry.durMs ? `(${entry.durMs}ms)` : '',
      entry.message,
    ].filter(Boolean)

    if (entry.meta && Object.keys(entry.meta).length > 0) {
      parts.push(`\n  Meta: ${JSON.stringify(entry.meta, null, 2)}`)
    }

    return parts.join(' ')
  }
}

function createLogEntry(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): LogEntry {
  return {
    level,
    message,
    meta: meta ? redactSensitiveData(meta) as Record<string, unknown> : undefined,
    timestamp: new Date().toISOString(),
  }
}

export function logInfo(message: string, meta?: Record<string, unknown>, rid?: string): void {
  const entry = createLogEntry('info', message, meta)
  if (rid) entry.rid = rid
  console.log(formatLogEntry(entry))
}

export function logWarn(message: string, meta?: Record<string, unknown>, rid?: string): void {
  const entry = createLogEntry('warn', message, meta)
  if (rid) entry.rid = rid
  console.warn(formatLogEntry(entry))
}

export function logError(message: string, meta?: Record<string, unknown>, rid?: string): void {
  const entry = createLogEntry('error', message, meta)
  if (rid) entry.rid = rid
  console.error(formatLogEntry(entry))
}

// Request logging helpers
export function logRequest(
  method: string,
  path: string,
  status: number,
  durMs: number,
  rid?: string,
  meta?: Record<string, unknown>
): void {
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
  const entry = createLogEntry(level, `${method} ${path}`, meta)
  entry.method = method
  entry.path = path
  entry.status = status
  entry.durMs = durMs
  if (rid) entry.rid = rid

  const formatter = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  formatter(formatLogEntry(entry))
}

// API logging helpers
export function logApiCall(
  service: string,
  endpoint: string,
  status: number,
  durMs: number,
  rid?: string,
  meta?: Record<string, unknown>
): void {
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
  const message = `${service} API call to ${endpoint}`
  
  const entry = createLogEntry(level, message, meta)
  entry.status = status
  entry.durMs = durMs
  if (rid) entry.rid = rid

  const formatter = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  formatter(formatLogEntry(entry))
}

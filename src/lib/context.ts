import { AsyncLocalStorage } from 'async_hooks'

export interface RequestContext {
  requestId: string
  startTime: number
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>()

export function getRequestId(): string | undefined {
  const context = requestContextStorage.getStore()
  return context?.requestId
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore()
}

export function withRequestId<T>(requestId: string, callback: () => T): T {
  const context: RequestContext = {
    requestId,
    startTime: Date.now(),
  }
  return requestContextStorage.run(context, callback)
}

export function createRequestId(): string {
  // Use Web Crypto API for Edge Runtime compatibility
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export function getRequestDuration(): number | undefined {
  const context = requestContextStorage.getStore()
  return context ? Date.now() - context.startTime : undefined
}

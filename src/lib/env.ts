import { z } from 'zod'

const serverSchema = z.object({
  DEEPGRAM_API_KEY: z.string().min(1, 'DEEPGRAM_API_KEY is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  NEXT_PUBLIC_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL').optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  USE_FIXTURE: z.string().optional(),
})

// Parse and validate environment variables at boot time
const parseResult = serverSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error('❌ Environment validation failed:')
  console.error(parseResult.error.format())
  // In Edge Runtime, we can't use process.exit(), so we throw an error instead
  throw new Error(`Environment validation failed: ${parseResult.error.format()}`)
}

export const ENV = parseResult.data
export const IS_PROD = ENV.NODE_ENV === 'production'
export const IS_DEV = ENV.NODE_ENV === 'development'
export const IS_TEST = ENV.NODE_ENV === 'test'
export const USE_FIXTURE = IS_DEV && ENV.USE_FIXTURE === 'true'

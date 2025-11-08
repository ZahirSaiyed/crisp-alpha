/**
 * Database types for Supabase
 * Generate with: npx supabase gen types typescript --project-id <project-id>
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          session_id: string
          user_id: string | null
          anon_id: string | null
          timestamp: string
          clarity_score: number
          pace_wpm: number
          filler_word_rate: number
          confidence_score: number
          total_words: number
          talk_time_sec: number
          pause_count: number
          scenario: string | null
          intent: string | null
        }
        Insert: {
          session_id?: string
          user_id?: string | null
          anon_id?: string | null
          timestamp?: string
          clarity_score: number
          pace_wpm: number
          filler_word_rate: number
          confidence_score: number
          total_words: number
          talk_time_sec: number
          pause_count: number
          scenario?: string | null
          intent?: string | null
        }
        Update: {
          session_id?: string
          user_id?: string | null
          anon_id?: string | null
          timestamp?: string
          clarity_score?: number
          pace_wpm?: number
          filler_word_rate?: number
          confidence_score?: number
          total_words?: number
          talk_time_sec?: number
          pause_count?: number
          scenario?: string | null
          intent?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}


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
      guided_sessions: {
        Row: {
          session_id: string
          user_id: string | null
          anon_id: string | null
          context_bundle: Json
          prep_path: Json
          status: 'planning' | 'in_progress' | 'completed' | 'abandoned'
          created_at: string
          updated_at: string
        }
        Insert: {
          session_id?: string
          user_id?: string | null
          anon_id?: string | null
          context_bundle?: Json
          prep_path?: Json
          status?: 'planning' | 'in_progress' | 'completed' | 'abandoned'
          created_at?: string
          updated_at?: string
        }
        Update: {
          session_id?: string
          user_id?: string | null
          anon_id?: string | null
          context_bundle?: Json
          prep_path?: Json
          status?: 'planning' | 'in_progress' | 'completed' | 'abandoned'
          created_at?: string
          updated_at?: string
        }
      }
      module_runs: {
        Row: {
          run_id: string
          guided_session_id: string
          module_type: 'signal_map' | 'coach_rep'
          module_index: number
          status: 'pending' | 'in_progress' | 'completed' | 'skipped'
          attempt: number
          parent_run_id: string | null
          inputs: Json
          recording_ref: string | null
          transcript: string | null
          scores: Json
          feedback: Json
          created_at: string
          completed_at: string | null
        }
        Insert: {
          run_id?: string
          guided_session_id: string
          module_type: 'signal_map' | 'coach_rep'
          module_index: number
          status?: 'pending' | 'in_progress' | 'completed' | 'skipped'
          attempt?: number
          parent_run_id?: string | null
          inputs?: Json
          recording_ref?: string | null
          transcript?: string | null
          scores?: Json
          feedback?: Json
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          run_id?: string
          guided_session_id?: string
          module_type?: 'signal_map' | 'coach_rep'
          module_index?: number
          status?: 'pending' | 'in_progress' | 'completed' | 'skipped'
          attempt?: number
          parent_run_id?: string | null
          inputs?: Json
          recording_ref?: string | null
          transcript?: string | null
          scores?: Json
          feedback?: Json
          created_at?: string
          completed_at?: string | null
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


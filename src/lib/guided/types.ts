import { z } from 'zod'

const SignalSchema = z.object({
  id: z.string(),
  label: z.string(),
  evidence: z.array(z.string()),
})

const SignalMapModuleSchema = z.object({
  type: z.literal('signal_map'),
  goal: z.string(),
  signals: z.array(SignalSchema),
})

const CoachRepModuleSchema = z.object({
  type: z.literal('coach_rep'),
  goal: z.string(),
  prompt: z.string(),
  constraints: z.object({
    time_limit_sec: z.number(),
    rubric_focus: z.enum(['clarity', 'structure', 'specificity']),
  }),
  success_criteria: z.string(),
})

export const PrepPathSchema = z.object({
  title: z.string(),
  objective: z.string(),
  signals: z.array(SignalSchema),
  modules: z.array(z.union([SignalMapModuleSchema, CoachRepModuleSchema])),
})

export type PrepPath = z.infer<typeof PrepPathSchema>

export const ModuleScoresSchema = z.object({
  filler_rate: z.number(),
  structure_score: z.number(),
  clarity_score: z.number(),
  pace_wpm: z.number(),
  total_words: z.number(),
})

export type ModuleScores = z.infer<typeof ModuleScoresSchema>

export const ModuleFeedbackSchema = z.object({
  score_label: z.string(),
  fix: z.string(),
  rerun_challenge: z.string().optional(),
  nudge: z.object({ type: z.string(), text: z.string() }).optional(),
})

export type ModuleFeedback = z.infer<typeof ModuleFeedbackSchema>

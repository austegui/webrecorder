import { z } from "zod"

export const ActionItemSchema = z.object({
  description: z.string(),
  assignee: z.string().nullable(),
  dueDate: z.string().nullable(),
  priority: z.enum(["high", "medium", "low"]),
})

export const DecisionSchema = z.object({
  decision: z.string(),
  context: z.string().nullable(),
  madeBy: z.string().nullable(),
})

export const MeetingSummarySchema = z.object({
  title: z.string(),
  overview: z.string(),
  keyPoints: z.array(z.string()),
  actionItems: z.array(ActionItemSchema),
  decisions: z.array(DecisionSchema),
  meetingType: z.enum(["general", "standup", "one_on_one", "design_review", "other"]),
  participants: z.array(z.string()),
  duration: z.string().nullable(),
})

export type MeetingSummary = z.infer<typeof MeetingSummarySchema>
export type ActionItem = z.infer<typeof ActionItemSchema>
export type Decision = z.infer<typeof DecisionSchema>

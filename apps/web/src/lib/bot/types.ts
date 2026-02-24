export interface TranscriptSegment {
  speaker: string | null
  text: string
  startTime: string
  endTime: string
  absoluteStartTime?: string
  absoluteEndTime?: string
  language?: string
}

export interface BotJoinRequest {
  meetingUrl: string
  meetingId: string
  botName?: string
}

export interface BotJoinResponse {
  success: boolean
  botId?: string
  error?: string
}

export interface BotStatusResponse {
  status: "joining" | "active" | "completed" | "failed"
  meetingId: string
}

export interface BotService {
  joinMeeting(request: BotJoinRequest): Promise<BotJoinResponse>
  leaveMeeting(botId: string): Promise<void>
  getStatus(botId: string): Promise<BotStatusResponse>
}

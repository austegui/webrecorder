import type {
  BotService,
  BotJoinRequest,
  BotJoinResponse,
  BotStatusResponse,
} from "./types"

const VEXA_API_URL = process.env.VEXA_API_URL
const VEXA_API_KEY = process.env.VEXA_API_KEY

/**
 * Vexa HTTP client.
 * Returns mock responses when VEXA_API_URL is not set.
 */
export class VexaClient implements BotService {
  private isMocked(): boolean {
    return !VEXA_API_URL
  }

  async joinMeeting(request: BotJoinRequest): Promise<BotJoinResponse> {
    if (this.isMocked()) {
      console.log(`[MOCK] Bot joining meeting: ${request.meetingUrl}`)
      return { success: true, botId: `mock_bot_${Date.now()}` }
    }

    const res = await fetch(`${VEXA_API_URL}/api/bots/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VEXA_API_KEY}`,
      },
      body: JSON.stringify({
        meeting_url: request.meetingUrl,
        meeting_id: request.meetingId,
        bot_name: request.botName ?? "TargetDialer Bot",
      }),
    })

    if (!res.ok) {
      return { success: false, error: `Vexa API error: ${res.status}` }
    }

    const data = await res.json()
    return { success: true, botId: data.bot_id }
  }

  async leaveMeeting(botId: string): Promise<void> {
    if (this.isMocked()) {
      console.log(`[MOCK] Bot leaving: ${botId}`)
      return
    }

    await fetch(`${VEXA_API_URL}/api/bots/${botId}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${VEXA_API_KEY}` },
    })
  }

  async getStatus(botId: string): Promise<BotStatusResponse> {
    if (this.isMocked()) {
      return { status: "active", meetingId: botId }
    }

    const res = await fetch(`${VEXA_API_URL}/api/bots/${botId}/status`, {
      headers: { Authorization: `Bearer ${VEXA_API_KEY}` },
    })

    return res.json()
  }
}

export const vexaClient = new VexaClient()

import { db } from "@/lib/db"
import { tdMeetings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { vexaClient } from "./vexa-client"

/**
 * Dispatch a bot to join a meeting.
 * Updates meeting botStatus through the lifecycle.
 */
export async function dispatchBot(meetingId: string) {
  const meeting = await db
    .select()
    .from(tdMeetings)
    .where(eq(tdMeetings.id, meetingId))
    .limit(1)

  if (!meeting[0]) {
    throw new Error(`Meeting not found: ${meetingId}`)
  }

  const { vexaMeetingId, meetingTitle } = meeting[0]

  // Update status to joining
  await db
    .update(tdMeetings)
    .set({ botStatus: "joining" })
    .where(eq(tdMeetings.id, meetingId))

  try {
    const result = await vexaClient.joinMeeting({
      meetingUrl: vexaMeetingId,
      meetingId: vexaMeetingId,
      botName: `TargetDialer - ${meetingTitle ?? "Meeting"}`,
    })

    if (result.success) {
      await db
        .update(tdMeetings)
        .set({
          botStatus: "awaiting_admission",
          botJoinedAt: new Date(),
        })
        .where(eq(tdMeetings.id, meetingId))
    } else {
      await db
        .update(tdMeetings)
        .set({ botStatus: "failed" })
        .where(eq(tdMeetings.id, meetingId))
    }

    return result
  } catch (error) {
    await db
      .update(tdMeetings)
      .set({ botStatus: "failed" })
      .where(eq(tdMeetings.id, meetingId))
    throw error
  }
}

import { db } from "@/lib/db"
import { tdTranscriptSegments, tdMeetings, tdSummaries } from "@/lib/db/schema"
import { eq, asc, and } from "drizzle-orm"

/**
 * Export meeting transcript as plain text.
 */
export async function exportAsText(meetingId: string): Promise<string> {
  const meeting = await db
    .select()
    .from(tdMeetings)
    .where(eq(tdMeetings.id, meetingId))
    .limit(1)

  if (!meeting[0]) throw new Error("Meeting not found")

  const segments = await db
    .select()
    .from(tdTranscriptSegments)
    .where(eq(tdTranscriptSegments.vexaMeetingId, meeting[0].vexaMeetingId))
    .orderBy(asc(tdTranscriptSegments.absoluteStartTime))

  const header = [
    `Meeting: ${meeting[0].meetingTitle ?? "Untitled"}`,
    `Date: ${meeting[0].scheduledStartAt ? new Date(meeting[0].scheduledStartAt).toLocaleString() : "Unknown"}`,
    `Platform: ${meeting[0].platform}`,
    `Segments: ${segments.length}`,
    "",
    "--- TRANSCRIPT ---",
    "",
  ].join("\n")

  const body = segments
    .map((s) => {
      const time = s.absoluteStartTime
        ? new Date(s.absoluteStartTime).toLocaleTimeString()
        : ""
      return `[${time}] ${s.speaker ?? "Unknown"}: ${s.text}`
    })
    .join("\n")

  return header + body
}

/**
 * Export meeting data as JSON (meeting metadata + transcript + summary).
 */
export async function exportAsJson(meetingId: string): Promise<object> {
  const meeting = await db
    .select()
    .from(tdMeetings)
    .where(eq(tdMeetings.id, meetingId))
    .limit(1)

  if (!meeting[0]) throw new Error("Meeting not found")

  const segments = await db
    .select()
    .from(tdTranscriptSegments)
    .where(eq(tdTranscriptSegments.vexaMeetingId, meeting[0].vexaMeetingId))
    .orderBy(asc(tdTranscriptSegments.absoluteStartTime))

  const summary = await db
    .select()
    .from(tdSummaries)
    .where(
      and(eq(tdSummaries.meetingId, meetingId), eq(tdSummaries.status, "completed"))
    )
    .limit(1)

  return {
    meeting: meeting[0],
    transcript: segments,
    summary: summary[0]?.summaryJson ?? null,
    exportedAt: new Date().toISOString(),
  }
}

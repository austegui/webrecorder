import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { tdMeetings, tdTranscriptSegments, tdSummaries } from "@/lib/db/schema"
import { eq, asc, and } from "drizzle-orm"

/**
 * Meeting detail API: metadata + transcript + summary.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const meeting = await db
    .select()
    .from(tdMeetings)
    .where(eq(tdMeetings.id, id))
    .limit(1)

  if (!meeting[0]) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 })
  }

  const transcript = await db
    .select({
      id: tdTranscriptSegments.id,
      speaker: tdTranscriptSegments.speaker,
      text: tdTranscriptSegments.text,
      startTime: tdTranscriptSegments.startTime,
      endTime: tdTranscriptSegments.endTime,
      absoluteStartTime: tdTranscriptSegments.absoluteStartTime,
    })
    .from(tdTranscriptSegments)
    .where(eq(tdTranscriptSegments.vexaMeetingId, meeting[0].vexaMeetingId))
    .orderBy(asc(tdTranscriptSegments.absoluteStartTime))

  const summary = await db
    .select()
    .from(tdSummaries)
    .where(
      and(
        eq(tdSummaries.meetingId, id),
        eq(tdSummaries.status, "completed")
      )
    )
    .limit(1)

  return NextResponse.json({
    meeting: meeting[0],
    transcript,
    summary: summary[0]?.summaryJson ?? null,
    summaryMeta: summary[0]
      ? { modelUsed: summary[0].modelUsed, confidence: summary[0].confidence }
      : null,
  })
}

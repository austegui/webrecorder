import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { tdTranscriptSegments, tdMeetings, tdProcessingJobs } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

const SegmentSchema = z.object({
  meetingId: z.string(),
  platform: z.string().default("google_meet"),
  sessionUid: z.string().optional(),
  speaker: z.string().nullable().optional(),
  text: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  absoluteStartTime: z.string().optional(),
  absoluteEndTime: z.string().optional(),
  language: z.string().default("en"),
})

const WebhookPayloadSchema = z.object({
  event: z.enum(["transcript_segment", "meeting_ended"]),
  data: z.union([SegmentSchema, z.object({ meetingId: z.string() })]),
})

/**
 * Receive transcript segments from Vexa bot.
 * Also handles meeting_ended events to trigger summary generation.
 */
export async function POST(request: NextRequest) {
  // Verify API key if set
  const apiKey = request.headers.get("x-api-key")
  if (process.env.VEXA_API_KEY && apiKey !== process.env.VEXA_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = WebhookPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { event, data } = parsed.data

  if (event === "transcript_segment") {
    const segment = data as z.infer<typeof SegmentSchema>

    // Insert transcript segment
    await db.insert(tdTranscriptSegments).values({
      vexaMeetingId: segment.meetingId,
      platform: segment.platform,
      sessionUid: segment.sessionUid ?? null,
      speaker: segment.speaker ?? null,
      text: segment.text,
      startTime: segment.startTime ?? null,
      endTime: segment.endTime ?? null,
      absoluteStartTime: segment.absoluteStartTime
        ? new Date(segment.absoluteStartTime)
        : null,
      absoluteEndTime: segment.absoluteEndTime
        ? new Date(segment.absoluteEndTime)
        : null,
      language: segment.language,
    })

    // Update meeting segment count and first segment time
    const meeting = await db
      .select({ id: tdMeetings.id, firstSegmentAt: tdMeetings.firstSegmentAt })
      .from(tdMeetings)
      .where(eq(tdMeetings.vexaMeetingId, segment.meetingId))
      .limit(1)

    if (meeting[0]) {
      await db
        .update(tdMeetings)
        .set({
          segmentCount: sql`(CAST(${tdMeetings.segmentCount} AS INTEGER) + 1)::TEXT`,
          botStatus: "active",
          ...(meeting[0].firstSegmentAt ? {} : { firstSegmentAt: new Date() }),
        })
        .where(eq(tdMeetings.id, meeting[0].id))
    }

    return NextResponse.json({ ok: true })
  }

  if (event === "meeting_ended") {
    const { meetingId } = data as { meetingId: string }

    // Update meeting status
    const meeting = await db
      .select({ id: tdMeetings.id })
      .from(tdMeetings)
      .where(eq(tdMeetings.vexaMeetingId, meetingId))
      .limit(1)

    if (meeting[0]) {
      await db
        .update(tdMeetings)
        .set({
          botStatus: "completed",
          meetingEndedAt: new Date(),
        })
        .where(eq(tdMeetings.id, meeting[0].id))

      // Create a summary processing job
      await db.insert(tdProcessingJobs).values({
        jobType: "summarize",
        meetingId: meeting[0].id,
        status: "pending",
      })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown event" }, { status: 400 })
}

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  tdProcessingJobs,
  tdTranscriptSegments,
  tdSummaries,
  tdMeetings,
  tdTeamSettings,
} from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { generateMeetingSummary } from "@/lib/ai/summarize"
import { postSlackSummary } from "@/lib/integrations/slack"

/**
 * Vercel Cron: Process pending summary and notification jobs.
 * Schedule: every 1 minute (* * * * *)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: { jobId: string; type: string; status: string }[] = []

  try {
    // Pick up pending jobs (oldest first, max 3 per run to stay within timeout)
    const jobs = await db
      .select()
      .from(tdProcessingJobs)
      .where(eq(tdProcessingJobs.status, "pending"))
      .orderBy(asc(tdProcessingJobs.createdAt))
      .limit(3)

    for (const job of jobs) {
      // Mark as processing
      await db
        .update(tdProcessingJobs)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(tdProcessingJobs.id, job.id))

      try {
        if (job.jobType === "summarize") {
          await processSummaryJob(job.meetingId)

          // Also create a Slack notification job if webhook is configured
          const slackWebhook = await db
            .select({ value: tdTeamSettings.value })
            .from(tdTeamSettings)
            .where(eq(tdTeamSettings.key, "slack_webhook_url"))
            .limit(1)

          if (slackWebhook[0]?.value) {
            await db.insert(tdProcessingJobs).values({
              jobType: "slack_notification",
              meetingId: job.meetingId,
              status: "pending",
            })
          }
        } else if (job.jobType === "slack_notification") {
          await processSlackJob(job.meetingId)
        }

        await db
          .update(tdProcessingJobs)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(tdProcessingJobs.id, job.id))

        results.push({ jobId: job.id, type: job.jobType, status: "completed" })
      } catch (error) {
        const attempts = (job.attempts ?? 0) + 1
        const maxAttempts = 3

        await db
          .update(tdProcessingJobs)
          .set({
            status: attempts >= maxAttempts ? "failed" : "pending",
            attempts,
            lastError: error instanceof Error ? error.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(tdProcessingJobs.id, job.id))

        results.push({ jobId: job.id, type: job.jobType, status: "error" })
      }
    }

    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (error) {
    console.error("Process summaries cron error:", error)
    return NextResponse.json({ error: "Cron failed" }, { status: 500 })
  }
}

async function processSummaryJob(meetingId: string) {
  // Fetch all transcript segments for this meeting
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

  if (segments.length === 0) {
    throw new Error("No transcript segments found")
  }

  // Build transcript text
  const transcriptText = segments
    .map((s) => {
      const speaker = s.speaker ?? "Unknown"
      return `[${speaker}]: ${s.text}`
    })
    .join("\n")

  // Generate summary
  const { summary, modelUsed } = await generateMeetingSummary(transcriptText)

  // Store summary
  await db.insert(tdSummaries).values({
    meetingId,
    summaryJson: summary,
    modelUsed,
    confidence: "high",
    status: "completed",
  })
}

async function processSlackJob(meetingId: string) {
  const meeting = await db
    .select()
    .from(tdMeetings)
    .where(eq(tdMeetings.id, meetingId))
    .limit(1)

  if (!meeting[0]) throw new Error("Meeting not found")

  const summary = await db
    .select()
    .from(tdSummaries)
    .where(
      and(
        eq(tdSummaries.meetingId, meetingId),
        eq(tdSummaries.status, "completed")
      )
    )
    .limit(1)

  if (!summary[0]) throw new Error("No summary found")

  await postSlackSummary(meeting[0], summary[0].summaryJson as Record<string, unknown>)
}

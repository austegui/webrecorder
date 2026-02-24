import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { tdMeetings } from "@/lib/db/schema"
import { eq, and, isNull, lt, sql } from "drizzle-orm"
import { dispatchBot } from "@/lib/bot/dispatch"

// Vercel Cron: Detect deaf bots (no segments after 3 min), attempt restart.
// Schedule: every 5 minutes
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000)

    // Find meetings where bot joined > 3 min ago but no segments received
    const deafBots = await db
      .select()
      .from(tdMeetings)
      .where(
        and(
          eq(tdMeetings.botStatus, "active"),
          isNull(tdMeetings.firstSegmentAt),
          lt(tdMeetings.botJoinedAt, threeMinAgo)
        )
      )

    // Also find bots stuck in "joining" or "awaiting_admission" for > 3 min
    const stuckBots = await db
      .select()
      .from(tdMeetings)
      .where(
        and(
          sql`${tdMeetings.botStatus} IN ('joining', 'awaiting_admission')`,
          lt(tdMeetings.botJoinedAt, threeMinAgo)
        )
      )

    const allProblematic = [...deafBots, ...stuckBots]
    const results: { meetingId: string; action: string }[] = []

    for (const meeting of allProblematic) {
      const restartCount = meeting.restartCount ?? 0

      if (restartCount >= 2) {
        // Mark as failed after 2 restart attempts
        await db
          .update(tdMeetings)
          .set({ botStatus: "failed" })
          .where(eq(tdMeetings.id, meeting.id))
        results.push({ meetingId: meeting.id, action: "marked_failed" })
      } else {
        // Attempt restart
        try {
          await db
            .update(tdMeetings)
            .set({
              botStatus: "requested",
              restartCount: restartCount + 1,
              botJoinedAt: null,
              firstSegmentAt: null,
            })
            .where(eq(tdMeetings.id, meeting.id))

          await dispatchBot(meeting.id)
          results.push({ meetingId: meeting.id, action: "restarted" })
        } catch {
          results.push({ meetingId: meeting.id, action: "restart_failed" })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: allProblematic.length,
      results,
    })
  } catch (error) {
    console.error("Bot health cron error:", error)
    return NextResponse.json(
      { error: "Cron failed" },
      { status: 500 }
    )
  }
}

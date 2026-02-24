import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

/**
 * Speaker analytics API.
 * Aggregates talk-time and segment counts across meetings.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const days = parseInt(url.searchParams.get("days") ?? "30")
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await db.execute(sql`
    SELECT ms.speaker_stats
    FROM td_meeting_stats ms
    JOIN td_meetings m ON m.id = ms.meeting_id
    WHERE m.scheduled_start_at >= ${since}
      AND ms.speaker_stats IS NOT NULL
  `)

  // Aggregate speaker stats across meetings
  const aggregated: Record<
    string,
    { talkTimeSeconds: number; segmentCount: number; meetingCount: number }
  > = {}

  for (const row of rows as unknown as { speaker_stats: Record<string, { talkTimeSeconds: number; segmentCount: number }> }[]) {
    const stats = row.speaker_stats
    if (stats && typeof stats === "object") {
      for (const [speaker, data] of Object.entries(stats)) {
        if (!aggregated[speaker]) {
          aggregated[speaker] = { talkTimeSeconds: 0, segmentCount: 0, meetingCount: 0 }
        }
        aggregated[speaker].talkTimeSeconds += data.talkTimeSeconds ?? 0
        aggregated[speaker].segmentCount += data.segmentCount ?? 0
        aggregated[speaker].meetingCount += 1
      }
    }
  }

  const speakers = Object.entries(aggregated)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.talkTimeSeconds - a.talkTimeSeconds)

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    speakers,
  })
}

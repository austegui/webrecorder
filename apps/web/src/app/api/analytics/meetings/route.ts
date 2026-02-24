import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { tdMeetings, tdMeetingStats } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

/**
 * Aggregated meeting analytics API.
 * Returns meeting frequency and duration trends.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const days = parseInt(url.searchParams.get("days") ?? "30")
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Meeting count by day
  const dailyCounts = await db.execute(sql`
    SELECT
      DATE(scheduled_start_at) as date,
      COUNT(*) as count,
      AVG(CASE WHEN ms.duration_seconds IS NOT NULL THEN ms.duration_seconds END) as avg_duration
    FROM td_meetings m
    LEFT JOIN td_meeting_stats ms ON ms.meeting_id = m.id
    WHERE m.scheduled_start_at >= ${since}
    GROUP BY DATE(scheduled_start_at)
    ORDER BY date ASC
  `)

  // Total stats
  const totals = await db.execute(sql`
    SELECT
      COUNT(*) as total_meetings,
      AVG(ms.duration_seconds) as avg_duration,
      SUM(CAST(m.segment_count AS INTEGER)) as total_segments,
      AVG(ms.participant_count) as avg_participants
    FROM td_meetings m
    LEFT JOIN td_meeting_stats ms ON ms.meeting_id = m.id
    WHERE m.scheduled_start_at >= ${since}
  `)

  // Top topics across all meetings
  const topicRows = await db.execute(sql`
    SELECT topics_detected
    FROM td_meeting_stats
    WHERE meeting_id IN (
      SELECT id FROM td_meetings WHERE scheduled_start_at >= ${since}
    )
  `)

  const topicCounts: Record<string, number> = {}
  for (const row of topicRows as unknown as { topics_detected: string[] | null }[]) {
    const topics = row.topics_detected
    if (Array.isArray(topics)) {
      for (const topic of topics.slice(0, 10)) {
        topicCounts[topic] = (topicCounts[topic] ?? 0) + 1
      }
    }
  }

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([topic, count]) => ({ topic, count }))

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    dailyCounts: Array.from(dailyCounts),
    totals: (totals as unknown as Record<string, unknown>[])[0] ?? null,
    topTopics,
  })
}

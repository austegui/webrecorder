import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

export interface SearchResult {
  segmentId: string
  meetingId: string
  speaker: string | null
  text: string
  headline: string
  absoluteStartTime: Date | null
  rank: number
}

/**
 * Full-text search across transcript segments using PostgreSQL GIN index.
 * Returns results with highlighted excerpts via ts_headline.
 */
export async function searchTranscripts(
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ results: SearchResult[]; total: number }> {
  const { limit = 20, offset = 0 } = options

  const tsQuery = query
    .trim()
    .split(/\s+/)
    .map((w) => `${w}:*`)
    .join(" & ")

  const results = await db.execute(sql`
    SELECT
      ts.id as "segmentId",
      ts.vexa_meeting_id as "meetingId",
      ts.speaker,
      ts.text,
      ts_headline('english', ts.text, to_tsquery('english', ${tsQuery}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
      ) as headline,
      ts.absolute_start_time as "absoluteStartTime",
      ts_rank(to_tsvector('english', ts.text), to_tsquery('english', ${tsQuery})) as rank
    FROM td_transcript_segments ts
    WHERE to_tsvector('english', ts.text) @@ to_tsquery('english', ${tsQuery})
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM td_transcript_segments
    WHERE to_tsvector('english', text) @@ to_tsquery('english', ${tsQuery})
  `)

  return {
    results: Array.from(results) as unknown as SearchResult[],
    total: Number((countResult as unknown as { total: number }[])[0]?.total ?? 0),
  }
}

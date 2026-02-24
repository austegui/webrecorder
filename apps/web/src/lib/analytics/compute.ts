import { db } from "@/lib/db"
import { tdTranscriptSegments, tdMeetings, tdMeetingStats } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

interface SpeakerStat {
  talkTimeSeconds: number
  segmentCount: number
}

/**
 * Compute and store per-meeting stats from transcript segments.
 */
export async function computeMeetingStats(meetingId: string) {
  const meeting = await db
    .select()
    .from(tdMeetings)
    .where(eq(tdMeetings.id, meetingId))
    .limit(1)

  if (!meeting[0]) return

  const segments = await db
    .select()
    .from(tdTranscriptSegments)
    .where(eq(tdTranscriptSegments.vexaMeetingId, meeting[0].vexaMeetingId))

  const speakerStats: Record<string, SpeakerStat> = {}
  const speakers = new Set<string>()

  for (const seg of segments) {
    const speaker = seg.speaker ?? "Unknown"
    speakers.add(speaker)

    if (!speakerStats[speaker]) {
      speakerStats[speaker] = { talkTimeSeconds: 0, segmentCount: 0 }
    }
    speakerStats[speaker].segmentCount += 1

    if (seg.startTime && seg.endTime) {
      const duration = parseFloat(seg.endTime) - parseFloat(seg.startTime)
      if (!isNaN(duration) && duration > 0) {
        speakerStats[speaker].talkTimeSeconds += duration
      }
    }
  }

  // Calculate total duration from meeting timestamps
  let durationSeconds: number | null = null
  if (meeting[0].scheduledStartAt && meeting[0].meetingEndedAt) {
    durationSeconds = Math.round(
      (new Date(meeting[0].meetingEndedAt).getTime() -
        new Date(meeting[0].scheduledStartAt).getTime()) /
        1000
    )
  }

  // Extract topics from segment text (simple keyword frequency)
  const wordCounts: Record<string, number> = {}
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "i", "you", "he", "she",
    "it", "we", "they", "me", "him", "her", "us", "them", "my", "your",
    "his", "its", "our", "their", "this", "that", "these", "those",
    "and", "but", "or", "not", "so", "if", "then", "than", "to", "of",
    "in", "on", "at", "for", "with", "about", "from", "by", "as",
    "into", "like", "just", "also", "very", "really", "yeah", "yes",
    "no", "okay", "ok", "um", "uh", "well", "right", "going", "think",
    "know", "get", "got", "go", "make", "want", "need", "see", "look",
    "thing", "things", "way", "said",
  ])

  for (const seg of segments) {
    const words = seg.text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/)
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        wordCounts[word] = (wordCounts[word] ?? 0) + 1
      }
    }
  }

  const topicsDetected = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word)

  // Upsert stats
  const existing = await db
    .select({ id: tdMeetingStats.id })
    .from(tdMeetingStats)
    .where(eq(tdMeetingStats.meetingId, meetingId))
    .limit(1)

  if (existing[0]) {
    await db
      .update(tdMeetingStats)
      .set({
        durationSeconds,
        participantCount: speakers.size,
        speakerStats,
        topicsDetected,
      })
      .where(eq(tdMeetingStats.meetingId, meetingId))
  } else {
    await db.insert(tdMeetingStats).values({
      meetingId,
      durationSeconds,
      participantCount: speakers.size,
      speakerStats,
      topicsDetected,
    })
  }
}

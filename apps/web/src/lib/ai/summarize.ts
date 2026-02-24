import { generateText } from "ai"
import { getModel, getProviderInfo } from "./provider"
import { MeetingSummarySchema, type MeetingSummary } from "./schemas"
import { SUMMARY_SYSTEM_PROMPT, MAP_CHUNK_PROMPT, REDUCE_PROMPT } from "./prompts"

const MAX_CHUNK_CHARS = 12000 // ~3000 tokens per chunk

/**
 * Generate a meeting summary from transcript text.
 * Uses map-reduce for long transcripts.
 */
export async function generateMeetingSummary(
  transcriptText: string
): Promise<{ summary: MeetingSummary; modelUsed: string }> {
  const { model } = await getProviderInfo()
  const aiModel = await getModel()

  if (transcriptText.length <= MAX_CHUNK_CHARS) {
    const result = await generateText({
      model: aiModel,
      system: SUMMARY_SYSTEM_PROMPT,
      prompt: `Meeting transcript:\n\n${transcriptText}`,
    })

    const parsed = MeetingSummarySchema.parse(JSON.parse(result.text))
    return { summary: parsed, modelUsed: model }
  }

  // Map-reduce for long transcripts
  const chunks = splitIntoChunks(transcriptText, MAX_CHUNK_CHARS)

  // Map phase: summarize each chunk
  const chunkSummaries = await Promise.all(
    chunks.map(async (chunk) => {
      const chunkModel = await getModel()
      const result = await generateText({
        model: chunkModel,
        system: MAP_CHUNK_PROMPT,
        prompt: `Transcript section:\n\n${chunk}`,
      })
      return result.text
    })
  )

  // Reduce phase: combine chunk summaries
  const combinedChunks = chunkSummaries
    .map((s, i) => `--- Section ${i + 1} ---\n${s}`)
    .join("\n\n")

  const reduceModel = await getModel()
  const result = await generateText({
    model: reduceModel,
    system: REDUCE_PROMPT,
    prompt: `Partial summaries:\n\n${combinedChunks}`,
  })

  const parsed = MeetingSummarySchema.parse(JSON.parse(result.text))
  return { summary: parsed, modelUsed: model }
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  const lines = text.split("\n")
  let current = ""

  for (const line of lines) {
    if (current.length + line.length + 1 > maxChars && current.length > 0) {
      chunks.push(current)
      current = ""
    }
    current += (current ? "\n" : "") + line
  }

  if (current) chunks.push(current)
  return chunks
}

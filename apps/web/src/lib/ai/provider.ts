import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"

const AI_PROVIDER = process.env.AI_PROVIDER ?? "anthropic"
const AI_MODEL = process.env.AI_MODEL ?? "claude-sonnet-4-20250514"

export function getModel() {
  if (AI_PROVIDER === "openai") {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    return openai(AI_MODEL)
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return anthropic(AI_MODEL)
}

export function getProviderInfo() {
  return { provider: AI_PROVIDER, model: AI_MODEL }
}

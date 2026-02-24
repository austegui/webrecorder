import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { db } from "@/lib/db"
import { tdTeamSettings } from "@/lib/db/schema"
import { inArray } from "drizzle-orm"

interface AiConfig {
  provider: string
  model: string
  apiKey: string
}

/**
 * Load AI config from tdTeamSettings (DB), falling back to env vars.
 */
async function loadConfig(): Promise<AiConfig> {
  const rows = await db
    .select({ key: tdTeamSettings.key, value: tdTeamSettings.value })
    .from(tdTeamSettings)
    .where(
      inArray(tdTeamSettings.key, ["ai_provider", "ai_model", "ai_api_key"])
    )

  const settings: Record<string, string | null> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }

  const provider = settings["ai_provider"] || process.env.AI_PROVIDER || "anthropic"
  const model = settings["ai_model"] || process.env.AI_MODEL || "claude-sonnet-4-20250514"
  const apiKey =
    settings["ai_api_key"] ||
    (provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY) ||
    ""

  return { provider, model, apiKey }
}

export async function getModel() {
  const config = await loadConfig()

  if (!config.apiKey) {
    throw new Error(
      "AI API key not configured. Go to Settings > AI Configuration to set it up."
    )
  }

  if (config.provider === "openai") {
    const openai = createOpenAI({ apiKey: config.apiKey })
    return openai(config.model)
  }

  const anthropic = createAnthropic({ apiKey: config.apiKey })
  return anthropic(config.model)
}

export async function getProviderInfo() {
  const config = await loadConfig()
  return { provider: config.provider, model: config.model }
}

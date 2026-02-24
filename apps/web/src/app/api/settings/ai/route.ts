import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { tdTeamSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const AiSettingsSchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  model: z.string().min(1),
  apiKey: z.string().min(1),
})

const SETTING_KEYS = {
  provider: "ai_provider",
  model: "ai_model",
  apiKey: "ai_api_key",
} as const

async function upsertSetting(key: string, value: string) {
  const existing = await db
    .select({ id: tdTeamSettings.id })
    .from(tdTeamSettings)
    .where(eq(tdTeamSettings.key, key))
    .limit(1)

  if (existing[0]) {
    await db
      .update(tdTeamSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(tdTeamSettings.key, key))
  } else {
    await db.insert(tdTeamSettings).values({ key, value })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = AiSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 })
  }

  await upsertSetting(SETTING_KEYS.provider, parsed.data.provider)
  await upsertSetting(SETTING_KEYS.model, parsed.data.model)

  // Only update API key if a real new key was provided (not the placeholder)
  if (parsed.data.apiKey !== "KEEP_EXISTING") {
    await upsertSetting(SETTING_KEYS.apiKey, parsed.data.apiKey)
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const rows = await db
    .select({ key: tdTeamSettings.key, value: tdTeamSettings.value })
    .from(tdTeamSettings)

  const settings: Record<string, string | null> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }

  return NextResponse.json({
    provider: settings[SETTING_KEYS.provider] ?? "",
    model: settings[SETTING_KEYS.model] ?? "",
    hasApiKey: !!settings[SETTING_KEYS.apiKey],
  })
}

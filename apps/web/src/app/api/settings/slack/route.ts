import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { tdTeamSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const SlackSettingsSchema = z.object({
  webhookUrl: z.string().url().or(z.literal("")),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = SlackSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 })
  }

  // Upsert the setting
  const existing = await db
    .select({ id: tdTeamSettings.id })
    .from(tdTeamSettings)
    .where(eq(tdTeamSettings.key, "slack_webhook_url"))
    .limit(1)

  if (existing[0]) {
    await db
      .update(tdTeamSettings)
      .set({ value: parsed.data.webhookUrl, updatedAt: new Date() })
      .where(eq(tdTeamSettings.key, "slack_webhook_url"))
  } else {
    await db.insert(tdTeamSettings).values({
      key: "slack_webhook_url",
      value: parsed.data.webhookUrl,
    })
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

  const setting = await db
    .select({ value: tdTeamSettings.value })
    .from(tdTeamSettings)
    .where(eq(tdTeamSettings.key, "slack_webhook_url"))
    .limit(1)

  return NextResponse.json({
    webhookUrl: setting[0]?.value ?? "",
  })
}

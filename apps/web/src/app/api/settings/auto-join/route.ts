import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { tdUsers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const AutoJoinSchema = z.object({
  autoJoin: z.enum(["all", "keywords", "disabled"]),
  keywords: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = AutoJoinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  await db
    .update(tdUsers)
    .set({
      calendarAutoJoin: parsed.data.autoJoin,
      calendarKeywords: parsed.data.keywords ?? null,
    })
    .where(eq(tdUsers.authUserId, session.user.id))

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db
    .select({
      calendarAutoJoin: tdUsers.calendarAutoJoin,
      calendarKeywords: tdUsers.calendarKeywords,
    })
    .from(tdUsers)
    .where(eq(tdUsers.authUserId, session.user.id))
    .limit(1)

  return NextResponse.json(user[0] ?? { calendarAutoJoin: "all", calendarKeywords: null })
}

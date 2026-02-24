import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { tdMeetings, tdSummaries } from "@/lib/db/schema"
import { eq, desc, and, gte, lte, like, sql } from "drizzle-orm"

/**
 * Meeting list API with date/speaker/keyword filters + pagination.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50)
  const offset = (page - 1) * limit
  const status = url.searchParams.get("status")
  const dateFrom = url.searchParams.get("dateFrom")
  const dateTo = url.searchParams.get("dateTo")
  const keyword = url.searchParams.get("keyword")

  const conditions = []

  if (status) {
    conditions.push(eq(tdMeetings.botStatus, status))
  }
  if (dateFrom) {
    conditions.push(gte(tdMeetings.scheduledStartAt, new Date(dateFrom)))
  }
  if (dateTo) {
    conditions.push(lte(tdMeetings.scheduledStartAt, new Date(dateTo)))
  }
  if (keyword) {
    conditions.push(like(tdMeetings.meetingTitle, `%${keyword}%`))
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined

  const meetings = await db
    .select({
      id: tdMeetings.id,
      vexaMeetingId: tdMeetings.vexaMeetingId,
      platform: tdMeetings.platform,
      meetingTitle: tdMeetings.meetingTitle,
      scheduledStartAt: tdMeetings.scheduledStartAt,
      meetingEndedAt: tdMeetings.meetingEndedAt,
      botStatus: tdMeetings.botStatus,
      segmentCount: tdMeetings.segmentCount,
      createdAt: tdMeetings.createdAt,
    })
    .from(tdMeetings)
    .where(whereClause)
    .orderBy(desc(tdMeetings.scheduledStartAt))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tdMeetings)
    .where(whereClause)

  const total = Number(countResult[0]?.count ?? 0)

  return NextResponse.json({
    meetings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

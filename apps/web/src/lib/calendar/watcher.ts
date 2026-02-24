import { db } from "@/lib/db"
import {
  tdCalendarSubscriptions,
  tdMeetings,
  tdUsers,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getCalendarClient } from "./token"

const PUBLIC_URL = process.env.PUBLIC_URL || "https://web-three-teal-87.vercel.app"

/**
 * Register a Google Calendar connection for a user.
 * Tries push notifications first; falls back to poll-only mode.
 */
export async function registerCalendarWatch(userId: string) {
  const calendar = await getCalendarClient(userId)

  let channelId: string | null = null
  let resourceId: string | null = null
  let expiresAt: Date
  let mode: "push" | "poll"

  // Try registering push notifications
  try {
    channelId = crypto.randomUUID()
    const response = await calendar.events.watch({
      calendarId: "primary",
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: `${PUBLIC_URL}/api/calendar/webhook`,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    resourceId = response.data.resourceId ?? null
    expiresAt = new Date(Number(response.data.expiration))
    mode = "push"
  } catch {
    // Push failed (domain not verified, etc.) — use poll-only mode
    channelId = `poll_${crypto.randomUUID()}`
    resourceId = null
    expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    mode = "poll"
  }

  // Do initial full sync to get syncToken and detect existing Meet events
  let syncToken: string | undefined
  let pageToken: string | undefined
  let meetEventsFound = 0

  do {
    const events = await calendar.events.list({
      calendarId: "primary",
      pageToken,
      maxResults: 250,
      singleEvents: true,
      timeMin: new Date().toISOString(), // Only future events
      orderBy: "startTime",
    })

    // Process events with Meet links during initial sync
    for (const event of events.data.items ?? []) {
      if (event.status === "cancelled") continue

      const meetLink =
        event.conferenceData?.entryPoints?.find(
          (e) => e.entryPointType === "video"
        )?.uri ?? event.hangoutLink

      if (!meetLink) continue

      // Check user auto-join preferences
      const tdUser = await db
        .select({
          calendarAutoJoin: tdUsers.calendarAutoJoin,
          calendarKeywords: tdUsers.calendarKeywords,
        })
        .from(tdUsers)
        .where(eq(tdUsers.authUserId, userId))
        .limit(1)

      const autoJoin = tdUser[0]?.calendarAutoJoin ?? "all"
      if (autoJoin === "disabled") continue

      if (autoJoin === "keywords") {
        const keywords = tdUser[0]?.calendarKeywords
          ?.split(",")
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
        if (keywords?.length) {
          const title = (event.summary ?? "").toLowerCase()
          if (!keywords.some((kw) => title.includes(kw))) continue
        }
      }

      // Check if we already have this meeting
      const existing = await db
        .select({ id: tdMeetings.id })
        .from(tdMeetings)
        .where(
          and(
            eq(tdMeetings.calendarEventId, event.id!),
            eq(tdMeetings.userId, userId)
          )
        )
        .limit(1)

      if (existing.length > 0) continue

      await db.insert(tdMeetings).values({
        vexaMeetingId: `cal_${event.id}_${Date.now()}`,
        platform: "google_meet",
        userId,
        calendarEventId: event.id!,
        meetingTitle: event.summary ?? "Untitled Meeting",
        scheduledStartAt: event.start?.dateTime
          ? new Date(event.start.dateTime)
          : event.start?.date
            ? new Date(event.start.date)
            : null,
        botStatus: "requested",
      })
      meetEventsFound++
    }

    pageToken = events.data.nextPageToken ?? undefined
    if (!pageToken) {
      syncToken = events.data.nextSyncToken ?? undefined
    }
  } while (pageToken)

  await db.insert(tdCalendarSubscriptions).values({
    userId,
    googleChannelId: channelId,
    resourceId,
    calendarId: "primary",
    syncToken: syncToken ?? null,
    expiresAt,
  })

  return { channelId, resourceId, mode, meetEventsFound }
}

/**
 * Process calendar changes using incremental sync (delta).
 * Called by push webhook or fallback poll cron.
 */
export async function processCalendarNotification(channelId: string) {
  const sub = await db
    .select()
    .from(tdCalendarSubscriptions)
    .where(eq(tdCalendarSubscriptions.googleChannelId, channelId))
    .limit(1)

  if (!sub[0]) {
    console.warn(`Unknown calendar channel: ${channelId}`)
    return
  }

  const { userId, syncToken } = sub[0]

  const tdUser = await db
    .select({
      calendarAutoJoin: tdUsers.calendarAutoJoin,
      calendarKeywords: tdUsers.calendarKeywords,
    })
    .from(tdUsers)
    .where(eq(tdUsers.authUserId, userId))
    .limit(1)

  const autoJoin = tdUser[0]?.calendarAutoJoin ?? "all"
  if (autoJoin === "disabled") return

  const keywords = tdUser[0]?.calendarKeywords
    ?.split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)

  const calendar = await getCalendarClient(userId)

  let pageToken: string | undefined
  let newSyncToken: string | undefined

  try {
    do {
      const response = await calendar.events.list({
        calendarId: "primary",
        syncToken: syncToken ?? undefined,
        pageToken,
        maxResults: 50,
        singleEvents: true,
      })

      for (const event of response.data.items ?? []) {
        if (event.status === "cancelled") continue

        const meetLink =
          event.conferenceData?.entryPoints?.find(
            (e) => e.entryPointType === "video"
          )?.uri ?? event.hangoutLink

        if (!meetLink) continue

        if (autoJoin === "keywords" && keywords?.length) {
          const title = (event.summary ?? "").toLowerCase()
          if (!keywords.some((kw) => title.includes(kw))) continue
        }

        const existing = await db
          .select({ id: tdMeetings.id })
          .from(tdMeetings)
          .where(
            and(
              eq(tdMeetings.calendarEventId, event.id!),
              eq(tdMeetings.userId, userId)
            )
          )
          .limit(1)

        if (existing.length > 0) continue

        await db.insert(tdMeetings).values({
          vexaMeetingId: `cal_${event.id}_${Date.now()}`,
          platform: "google_meet",
          userId,
          calendarEventId: event.id!,
          meetingTitle: event.summary ?? "Untitled Meeting",
          scheduledStartAt: event.start?.dateTime
            ? new Date(event.start.dateTime)
            : event.start?.date
              ? new Date(event.start.date)
              : null,
          botStatus: "requested",
        })
      }

      pageToken = response.data.nextPageToken ?? undefined
      if (!pageToken) {
        newSyncToken = response.data.nextSyncToken ?? undefined
      }
    } while (pageToken)
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: number }).code === 410
    ) {
      console.log("Sync token expired, clearing for full re-sync")
      await db
        .update(tdCalendarSubscriptions)
        .set({ syncToken: null })
        .where(eq(tdCalendarSubscriptions.googleChannelId, channelId))
      return
    }
    throw error
  }

  if (newSyncToken) {
    await db
      .update(tdCalendarSubscriptions)
      .set({ syncToken: newSyncToken })
      .where(eq(tdCalendarSubscriptions.googleChannelId, channelId))
  }
}

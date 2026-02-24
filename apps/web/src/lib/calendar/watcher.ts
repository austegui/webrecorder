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
 * Register a Google Calendar push notification channel for a user.
 */
export async function registerCalendarWatch(userId: string) {
  const calendar = await getCalendarClient(userId)
  const channelId = crypto.randomUUID()

  const response = await calendar.events.watch({
    calendarId: "primary",
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: `${PUBLIC_URL}/api/calendar/webhook`,
      expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  })

  // Do an initial full sync to get the syncToken
  let syncToken: string | undefined
  let pageToken: string | undefined

  do {
    const events = await calendar.events.list({
      calendarId: "primary",
      pageToken,
      maxResults: 250,
      singleEvents: true,
    })
    pageToken = events.data.nextPageToken ?? undefined
    if (!pageToken) {
      syncToken = events.data.nextSyncToken ?? undefined
    }
  } while (pageToken)

  await db.insert(tdCalendarSubscriptions).values({
    userId,
    googleChannelId: channelId,
    resourceId: response.data.resourceId ?? "",
    calendarId: "primary",
    syncToken: syncToken ?? null,
    expiresAt: new Date(Number(response.data.expiration)),
  })

  return { channelId, resourceId: response.data.resourceId }
}

/**
 * Process a Google Calendar push notification.
 * Uses incremental sync (syncToken) to detect new/changed events with Meet links.
 */
export async function processCalendarNotification(channelId: string) {
  // Look up the subscription
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

  // Get user's auto-join settings
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

      const events = response.data.items ?? []

      for (const event of events) {
        // Skip cancelled events
        if (event.status === "cancelled") continue

        // Check for Google Meet link
        const meetLink =
          event.conferenceData?.entryPoints?.find(
            (e) => e.entryPointType === "video"
          )?.uri ?? event.hangoutLink

        if (!meetLink) continue

        // Apply auto-join filter
        if (autoJoin === "keywords" && keywords?.length) {
          const title = (event.summary ?? "").toLowerCase()
          const matchesKeyword = keywords.some((kw) => title.includes(kw))
          if (!matchesKeyword) continue
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

        // Create meeting record
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
    // If sync token is invalid (410 Gone), do a full re-sync
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: number }).code === 410
    ) {
      console.log("Sync token expired, performing full re-sync")
      // Clear sync token to force full sync on next notification
      await db
        .update(tdCalendarSubscriptions)
        .set({ syncToken: null })
        .where(eq(tdCalendarSubscriptions.googleChannelId, channelId))
      return
    }
    throw error
  }

  // Save new sync token
  if (newSyncToken) {
    await db
      .update(tdCalendarSubscriptions)
      .set({ syncToken: newSyncToken })
      .where(eq(tdCalendarSubscriptions.googleChannelId, channelId))
  }
}

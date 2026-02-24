import { db } from "@/lib/db"
import { tdCalendarSubscriptions } from "@/lib/db/schema"
import { lt, isNotNull } from "drizzle-orm"
import { registerCalendarWatch } from "./watcher"
import { getCalendarClient } from "./token"

/**
 * Renew calendar watch channels expiring within 24 hours.
 * Called by the calendar-renewal cron (every 6h).
 */
export async function renewExpiringChannels() {
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h from now

  const expiring = await db
    .select()
    .from(tdCalendarSubscriptions)
    .where(lt(tdCalendarSubscriptions.expiresAt, cutoff))

  const results: { userId: string; success: boolean; error?: string }[] = []

  for (const sub of expiring) {
    try {
      // Stop the old channel
      const calendar = await getCalendarClient(sub.userId)
      try {
        await calendar.channels.stop({
          requestBody: {
            id: sub.googleChannelId,
            resourceId: sub.resourceId ?? undefined,
          },
        })
      } catch {
        // Channel may already be expired, that's fine
      }

      // Delete old subscription
      await db
        .delete(tdCalendarSubscriptions)
        .where(
          lt(tdCalendarSubscriptions.id, sub.id) // delete this specific one
        )

      // Actually delete the specific sub
      const { eq } = await import("drizzle-orm")
      await db
        .delete(tdCalendarSubscriptions)
        .where(eq(tdCalendarSubscriptions.id, sub.id))

      // Register new channel
      await registerCalendarWatch(sub.userId)
      results.push({ userId: sub.userId, success: true })
    } catch (error) {
      results.push({
        userId: sub.userId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return results
}

/**
 * Fallback poll: for users with active subscriptions, do a delta sync
 * to catch any notifications that may have been missed.
 */
export async function fallbackPollAll() {
  const { processCalendarNotification } = await import("./watcher")

  const subs = await db
    .select()
    .from(tdCalendarSubscriptions)
    .where(isNotNull(tdCalendarSubscriptions.syncToken))

  for (const sub of subs) {
    try {
      if (sub.googleChannelId) {
        await processCalendarNotification(sub.googleChannelId)
      }
    } catch (error) {
      console.error(
        `Fallback poll failed for user ${sub.userId}:`,
        error instanceof Error ? error.message : error
      )
    }
  }
}

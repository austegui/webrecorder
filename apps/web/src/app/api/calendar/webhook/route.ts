import { NextRequest, NextResponse } from "next/server"
import { processCalendarNotification } from "@/lib/calendar/watcher"

/**
 * Google Calendar push notification receiver.
 * Google sends POST with X-Goog-Channel-ID header when calendar events change.
 */
export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id")
  const resourceState = request.headers.get("x-goog-resource-state")

  if (!channelId) {
    return NextResponse.json({ error: "Missing channel ID" }, { status: 400 })
  }

  // Google sends a "sync" notification when the channel is first created — ignore it
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true })
  }

  try {
    await processCalendarNotification(channelId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Calendar webhook error:", error)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

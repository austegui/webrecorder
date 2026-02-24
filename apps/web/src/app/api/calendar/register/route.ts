import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { registerCalendarWatch } from "@/lib/calendar/watcher"

/**
 * Auth-protected endpoint to register a Google Calendar watch.
 * Only admins can register calendar watches.
 */
export async function POST() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  try {
    const result = await registerCalendarWatch(session.user.id)
    return NextResponse.json({
      ok: true,
      channelId: result.channelId,
      message: "Calendar watch registered. Meet events will be detected automatically.",
    })
  } catch (error) {
    console.error("Calendar register error:", error)
    return NextResponse.json(
      {
        error: "Failed to register calendar watch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

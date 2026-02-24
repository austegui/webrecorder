import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { registerCalendarWatch } from "@/lib/calendar/watcher"

export async function POST() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await registerCalendarWatch(session.user.id)

    const modeMessage =
      result.mode === "push"
        ? "Calendar connected with real-time push notifications."
        : "Calendar connected in poll mode (checked every 6 hours). To enable real-time push, verify your domain in Google Search Console."

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      meetEventsFound: result.meetEventsFound,
      message: `${modeMessage} Found ${result.meetEventsFound} upcoming meeting(s) with Google Meet.`,
    })
  } catch (error: unknown) {
    console.error("Calendar register error:", error)

    let details = "Unknown error"
    if (error instanceof Error) {
      details = error.message
    }
    const gaxiosError = error as { response?: { data?: { error?: { message?: string; code?: number } } } }
    if (gaxiosError?.response?.data?.error?.message) {
      details = `Google API: ${gaxiosError.response.data.error.message} (code ${gaxiosError.response.data.error.code})`
    }

    return NextResponse.json({ error: details }, { status: 500 })
  }
}

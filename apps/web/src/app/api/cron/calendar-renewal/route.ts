import { NextRequest, NextResponse } from "next/server"
import { renewExpiringChannels, fallbackPollAll } from "@/lib/calendar/renewal"

// Vercel Cron: Renew expiring calendar channels + fallback poll.
// Schedule: every 6 hours
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization")
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const renewalResults = await renewExpiringChannels()
    await fallbackPollAll()

    return NextResponse.json({
      ok: true,
      renewed: renewalResults.length,
      results: renewalResults,
    })
  } catch (error) {
    console.error("Calendar renewal cron error:", error)
    return NextResponse.json(
      { error: "Cron failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}

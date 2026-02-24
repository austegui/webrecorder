import { google } from "googleapis"
import { db } from "@/lib/db"
import { accounts } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)

/**
 * Get a valid Google access token for a user.
 * Reads the refresh_token from the Auth.js `account` table,
 * refreshes it via Google OAuth, and returns a fresh access_token.
 */
export async function getGoogleAccessToken(
  userId: string
): Promise<string | null> {
  const account = await db
    .select({
      refreshToken: accounts.refresh_token,
      accessToken: accounts.access_token,
      expiresAt: accounts.expires_at,
    })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.provider, "google"))
    )
    .limit(1)

  if (!account[0]?.refreshToken) return null

  const { refreshToken, accessToken, expiresAt } = account[0]

  // If token is still valid (with 5-minute buffer), return it
  const now = Math.floor(Date.now() / 1000)
  if (accessToken && expiresAt && expiresAt > now + 300) {
    return accessToken
  }

  // Refresh the token
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2Client.refreshAccessToken()

  // Update the stored token
  await db
    .update(accounts)
    .set({
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date
        ? Math.floor(credentials.expiry_date / 1000)
        : null,
    })
    .where(
      and(eq(accounts.userId, userId), eq(accounts.provider, "google"))
    )

  return credentials.access_token ?? null
}

/**
 * Get a Google Calendar client for a user.
 */
export async function getCalendarClient(userId: string) {
  const accessToken = await getGoogleAccessToken(userId)
  if (!accessToken) throw new Error("No Google access token for user")

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  return google.calendar({ version: "v3", auth })
}

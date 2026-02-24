import { db } from "@/lib/db"
import { tdTeamSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Post a meeting summary to Slack via incoming webhook.
 */
export async function postSlackSummary(
  meeting: { meetingTitle: string | null; scheduledStartAt: Date | null; id: string },
  summary: Record<string, unknown>
) {
  const webhookSetting = await db
    .select({ value: tdTeamSettings.value })
    .from(tdTeamSettings)
    .where(eq(tdTeamSettings.key, "slack_webhook_url"))
    .limit(1)

  const webhookUrl = webhookSetting[0]?.value
  if (!webhookUrl) {
    console.log("No Slack webhook URL configured, skipping notification")
    return
  }

  const summaryData = summary as {
    title?: string
    overview?: string
    keyPoints?: string[]
    actionItems?: { description: string; assignee: string | null; priority: string }[]
    decisions?: { decision: string }[]
  }

  const keyPoints = summaryData.keyPoints?.map((kp) => `• ${kp}`).join("\n") ?? ""
  const actionItems =
    summaryData.actionItems
      ?.map(
        (ai) =>
          `• ${ai.description}${ai.assignee ? ` (${ai.assignee})` : ""}${ai.priority === "high" ? " [HIGH]" : ""}`
      )
      .join("\n") ?? ""

  const meetingDate = meeting.scheduledStartAt
    ? new Date(meeting.scheduledStartAt).toLocaleDateString()
    : "Unknown date"

  const publicUrl = process.env.PUBLIC_URL ?? ""

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Meeting Summary: ${meeting.meetingTitle ?? "Untitled"}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Date:* ${meetingDate}\n*Overview:* ${summaryData.overview ?? "No overview"}`,
      },
    },
  ]

  if (keyPoints) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Key Points:*\n${keyPoints}`,
      },
    })
  }

  if (actionItems) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Items:*\n${actionItems}`,
      },
    })
  }

  if (publicUrl) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${publicUrl}/meetings/${meeting.id}|View full meeting details>`,
      },
    })
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  })
}

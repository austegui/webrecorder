"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"

interface TranscriptSegment {
  id: string
  speaker: string | null
  text: string
  startTime: string | null
  absoluteStartTime: string | null
}

interface Summary {
  title: string
  overview: string
  keyPoints: string[]
  actionItems: { description: string; assignee: string | null; priority: string }[]
  decisions: { decision: string; context: string | null; madeBy: string | null }[]
  meetingType: string
  participants: string[]
}

interface MeetingData {
  meeting: {
    id: string
    meetingTitle: string | null
    scheduledStartAt: string | null
    meetingEndedAt: string | null
    botStatus: string
    segmentCount: string
    platform: string
  }
  transcript: TranscriptSegment[]
  summary: Summary | null
  summaryMeta: { modelUsed: string; confidence: string } | null
}

export default function MeetingDetailPage() {
  const params = useParams()
  const [data, setData] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"summary" | "transcript">("summary")

  useEffect(() => {
    fetch(`/api/meetings/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <p style={{ color: "#6b7280" }}>Loading...</p>
  if (!data?.meeting) return <p style={{ color: "#ef4444" }}>Meeting not found</p>

  const { meeting, transcript, summary } = data

  return (
    <div style={{ maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <a href="/meetings" style={{ color: "#2563eb", fontSize: "0.875rem", textDecoration: "none" }}>
          &larr; Back to Meetings
        </a>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", marginTop: "8px" }}>
          {meeting.meetingTitle ?? "Untitled Meeting"}
        </h1>
        <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "4px" }}>
          {meeting.scheduledStartAt
            ? new Date(meeting.scheduledStartAt).toLocaleString()
            : "No date"}{" "}
          · {meeting.botStatus} · {meeting.segmentCount} segments
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
        {(["summary", "transcript"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              background: tab === t ? "#2563eb" : "#fff",
              color: tab === t ? "#fff" : "#374151",
              cursor: "pointer",
            }}
          >
            {t === "summary" ? "Summary" : "Transcript"}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {tab === "summary" && (
        <div>
          {summary ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Overview */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "20px",
                }}
              >
                <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
                  Overview
                </h3>
                <p style={{ color: "#374151", lineHeight: "1.6" }}>{summary.overview}</p>
              </div>

              {/* Key Points */}
              {summary.keyPoints.length > 0 && (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
                    Key Points
                  </h3>
                  <ul style={{ paddingLeft: "20px", color: "#374151", lineHeight: "1.8" }}>
                    {summary.keyPoints.map((kp, i) => (
                      <li key={i}>{kp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {summary.actionItems.length > 0 && (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "12px" }}>
                    Action Items
                  </h3>
                  {summary.actionItems.map((ai, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: i < summary.actionItems.length - 1 ? "1px solid #f3f4f6" : "none",
                      }}
                    >
                      <span style={{ color: "#374151" }}>{ai.description}</span>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {ai.assignee && (
                          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{ai.assignee}</span>
                        )}
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontSize: "0.7rem",
                            fontWeight: "500",
                            background:
                              ai.priority === "high"
                                ? "#fef2f2"
                                : ai.priority === "medium"
                                  ? "#fffbeb"
                                  : "#f0fdf4",
                            color:
                              ai.priority === "high"
                                ? "#dc2626"
                                : ai.priority === "medium"
                                  ? "#d97706"
                                  : "#16a34a",
                          }}
                        >
                          {ai.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Decisions */}
              {summary.decisions.length > 0 && (
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
                    Decisions
                  </h3>
                  {summary.decisions.map((d, i) => (
                    <div key={i} style={{ marginBottom: "8px", color: "#374151" }}>
                      <strong>{d.decision}</strong>
                      {d.context && (
                        <span style={{ color: "#6b7280" }}> — {d.context}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                background: "#fff",
                borderRadius: "12px",
                border: "1px dashed #d1d5db",
              }}
            >
              <p style={{ color: "#6b7280" }}>
                {meeting.botStatus === "completed"
                  ? "Summary is being generated..."
                  : "Summary will be available after the meeting ends."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Transcript Tab */}
      {tab === "transcript" && (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "20px",
            maxHeight: "600px",
            overflowY: "auto",
          }}
        >
          {transcript.length === 0 ? (
            <p style={{ color: "#6b7280", textAlign: "center" }}>No transcript segments yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {transcript.map((seg) => (
                <div key={seg.id}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                    <span
                      style={{
                        fontWeight: "600",
                        color: "#2563eb",
                        fontSize: "0.875rem",
                        minWidth: "100px",
                      }}
                    >
                      {seg.speaker ?? "Unknown"}
                    </span>
                    {seg.absoluteStartTime && (
                      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                        {new Date(seg.absoluteStartTime).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <p style={{ color: "#374151", margin: "4px 0 0 0", lineHeight: "1.5" }}>
                    {seg.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

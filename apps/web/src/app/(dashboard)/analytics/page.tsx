"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

interface DailyCount {
  date: string
  count: number
  avg_duration: number | null
}

interface Totals {
  total_meetings: number
  avg_duration: number | null
  total_segments: number
  avg_participants: number | null
}

interface Speaker {
  name: string
  talkTimeSeconds: number
  segmentCount: number
  meetingCount: number
}

interface TopicEntry {
  topic: string
  count: number
}

const COLORS = [
  "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
]

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [topTopics, setTopTopics] = useState<TopicEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/analytics/meetings?days=${days}`).then((r) => r.json()),
      fetch(`/api/analytics/speakers?days=${days}`).then((r) => r.json()),
    ])
      .then(([meetingData, speakerData]) => {
        setDailyCounts(meetingData.dailyCounts ?? [])
        setTotals(meetingData.totals ?? null)
        setTopTopics(meetingData.topTopics ?? [])
        setSpeakers(speakerData.speakers ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const speakerPieData = speakers.slice(0, 8).map((s) => ({
    name: s.name,
    value: Math.round(s.talkTimeSeconds / 60),
  }))

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827" }}>Analytics</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {[30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "6px 14px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                background: days === d ? "#2563eb" : "#fff",
                color: days === d ? "#fff" : "#374151",
                cursor: "pointer",
              }}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading analytics...</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            {[
              {
                label: "Total Meetings",
                value: totals?.total_meetings ?? 0,
              },
              {
                label: "Avg Duration",
                value: totals?.avg_duration
                  ? `${Math.round(totals.avg_duration / 60)}m`
                  : "N/A",
              },
              {
                label: "Total Segments",
                value: totals?.total_segments ?? 0,
              },
              {
                label: "Avg Participants",
                value: totals?.avg_participants
                  ? Math.round(totals.avg_participants)
                  : "N/A",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: "#fff",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "20px",
                }}
              >
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{card.label}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", marginTop: "4px" }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Meeting Frequency Chart */}
          {dailyCounts.length > 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "20px",
                marginBottom: "24px",
              }}
            >
              <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "16px" }}>
                Meeting Frequency
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyCounts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Speaker Talk Time */}
          {speakerPieData.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "20px",
                }}
              >
                <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "16px" }}>
                  Speaker Talk Time (minutes)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={speakerPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}m`}
                    >
                      {speakerPieData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Topic Frequency */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "20px",
                }}
              >
                <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "16px" }}>
                  Top Topics
                </h3>
                {topTopics.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {topTopics.slice(0, 10).map((t, i) => (
                      <div key={t.topic} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: `${Math.max(20, (t.count / (topTopics[0]?.count ?? 1)) * 100)}%`,
                            height: "24px",
                            background: COLORS[i % COLORS.length] + "30",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            paddingLeft: "8px",
                          }}
                        >
                          <span style={{ fontSize: "0.8rem", color: "#374151" }}>
                            {t.topic} ({t.count})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>No topic data yet</p>
                )}
              </div>
            </div>
          )}

          {/* Speaker Table */}
          {speakers.length > 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "20px",
              }}
            >
              <h3 style={{ fontWeight: "600", color: "#111827", marginBottom: "16px" }}>
                Speaker Breakdown
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "8px", color: "#6b7280" }}>Speaker</th>
                    <th style={{ textAlign: "right", padding: "8px", color: "#6b7280" }}>Talk Time</th>
                    <th style={{ textAlign: "right", padding: "8px", color: "#6b7280" }}>Segments</th>
                    <th style={{ textAlign: "right", padding: "8px", color: "#6b7280" }}>Meetings</th>
                  </tr>
                </thead>
                <tbody>
                  {speakers.map((s) => (
                    <tr key={s.name} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px", color: "#111827" }}>{s.name}</td>
                      <td style={{ padding: "8px", textAlign: "right", color: "#374151" }}>
                        {Math.round(s.talkTimeSeconds / 60)}m
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", color: "#374151" }}>
                        {s.segmentCount}
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", color: "#374151" }}>
                        {s.meetingCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dailyCounts.length === 0 && speakers.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "64px 24px",
                background: "#fff",
                borderRadius: "12px",
                border: "1px dashed #d1d5db",
              }}
            >
              <p style={{ color: "#6b7280", fontSize: "1rem" }}>No analytics data yet</p>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginTop: "4px" }}>
                Analytics will populate as meetings are recorded and transcribed.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

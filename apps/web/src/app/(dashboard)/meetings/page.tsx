"use client"

import { useState, useEffect, useCallback } from "react"

interface Meeting {
  id: string
  meetingTitle: string | null
  scheduledStartAt: string | null
  meetingEndedAt: string | null
  botStatus: string
  segmentCount: string
  platform: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: "",
    keyword: "",
    dateFrom: "",
    dateTo: "",
  })
  const [page, setPage] = useState(1)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(page))
    if (filters.status) params.set("status", filters.status)
    if (filters.keyword) params.set("keyword", filters.keyword)
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
    if (filters.dateTo) params.set("dateTo", filters.dateTo)

    try {
      const res = await fetch(`/api/meetings?${params}`)
      const data = await res.json()
      setMeetings(data.meetings ?? [])
      setPagination(data.pagination ?? null)
    } catch {
      setMeetings([])
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const statusColors: Record<string, string> = {
    requested: "#f59e0b",
    joining: "#3b82f6",
    active: "#10b981",
    completed: "#6b7280",
    failed: "#ef4444",
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", marginBottom: "24px" }}>
        Meetings
      </h1>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "4px" }}>
            Search
          </label>
          <input
            type="text"
            placeholder="Meeting title..."
            value={filters.keyword}
            onChange={(e) => {
              setFilters((f) => ({ ...f, keyword: e.target.value }))
              setPage(1)
            }}
            style={{
              padding: "6px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "4px" }}>
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => {
              setFilters((f) => ({ ...f, status: e.target.value }))
              setPage(1)
            }}
            style={{
              padding: "6px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
          >
            <option value="">All</option>
            <option value="requested">Requested</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "4px" }}>
            From
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => {
              setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              setPage(1)
            }}
            style={{
              padding: "6px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "4px" }}>
            To
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => {
              setFilters((f) => ({ ...f, dateTo: e.target.value }))
              setPage(1)
            }}
            style={{
              padding: "6px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
          />
        </div>
      </div>

      {/* Meeting list */}
      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading...</p>
      ) : meetings.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            background: "#fff",
            borderRadius: "12px",
            border: "1px dashed #d1d5db",
          }}
        >
          <p style={{ color: "#6b7280", fontSize: "1rem", marginBottom: "8px" }}>
            No meetings found
          </p>
          <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
            Meetings will appear here once the Calendar Watcher detects them.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {meetings.map((m) => (
            <a
              key={m.id}
              href={`/meetings/${m.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div style={{ fontWeight: "600", color: "#111827", marginBottom: "4px" }}>
                  {m.meetingTitle ?? "Untitled Meeting"}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                  {m.scheduledStartAt
                    ? new Date(m.scheduledStartAt).toLocaleString()
                    : "No date"}
                  {" · "}
                  {m.segmentCount} segments
                </div>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: "500",
                  background: `${statusColors[m.botStatus] ?? "#6b7280"}20`,
                  color: statusColors[m.botStatus] ?? "#6b7280",
                }}
              >
                {m.botStatus}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "24px",
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: "6px 14px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              cursor: page <= 1 ? "default" : "pointer",
              opacity: page <= 1 ? 0.5 : 1,
              background: "#fff",
            }}
          >
            Previous
          </button>
          <span style={{ padding: "6px 14px", fontSize: "0.875rem", color: "#6b7280" }}>
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            style={{
              padding: "6px 14px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              cursor: page >= pagination.totalPages ? "default" : "pointer",
              opacity: page >= pagination.totalPages ? 0.5 : 1,
              background: "#fff",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

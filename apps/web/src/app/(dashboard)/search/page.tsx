"use client"

import { useState } from "react"

interface SearchResult {
  segmentId: string
  meetingId: string
  speaker: string | null
  text: string
  headline: string
  absoluteStartTime: string | null
  rank: number
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setTotal(data.pagination?.total ?? 0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: "800px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", marginBottom: "24px" }}>
        Search Transcripts
      </h1>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meeting transcripts..."
          style={{
            flex: 1,
            padding: "10px 16px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            fontSize: "0.9rem",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 24px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.9rem",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {searched && !loading && (
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "16px" }}>
          {total} result{total !== 1 ? "s" : ""} found
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {results.map((r) => (
          <div
            key={r.segmentId}
            style={{
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontWeight: "600", color: "#2563eb", fontSize: "0.875rem" }}>
                {r.speaker ?? "Unknown"}
              </span>
              {r.absoluteStartTime && (
                <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                  {new Date(r.absoluteStartTime).toLocaleString()}
                </span>
              )}
            </div>
            <p
              style={{ color: "#374151", lineHeight: "1.5", fontSize: "0.9rem" }}
              dangerouslySetInnerHTML={{ __html: r.headline }}
            />
          </div>
        ))}
      </div>

      {searched && !loading && results.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "#fff",
            borderRadius: "12px",
            border: "1px dashed #d1d5db",
          }}
        >
          <p style={{ color: "#6b7280" }}>No results found for &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  )
}

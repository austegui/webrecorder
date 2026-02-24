"use client"

import { useState, useEffect } from "react"

export default function SettingsPage() {
  const [autoJoin, setAutoJoin] = useState<"all" | "keywords" | "disabled">("all")
  const [keywords, setKeywords] = useState("")
  const [calendarStatus, setCalendarStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  // AI settings state
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai">("anthropic")
  const [aiModel, setAiModel] = useState("")
  const [aiApiKey, setAiApiKey] = useState("")
  const [aiHasKey, setAiHasKey] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiMessage, setAiMessage] = useState("")

  useEffect(() => {
    fetch("/api/settings/auto-join")
      .then((r) => r.json())
      .then((data) => {
        setAutoJoin(data.calendarAutoJoin ?? "all")
        setKeywords(data.calendarKeywords ?? "")
      })
      .catch(() => {})

    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((data) => {
        if (data.provider) setAiProvider(data.provider)
        if (data.model) setAiModel(data.model)
        setAiHasKey(data.hasApiKey ?? false)
      })
      .catch(() => {})
  }, [])

  async function connectCalendar() {
    setCalendarStatus("connecting")
    setMessage("")
    try {
      const res = await fetch("/api/calendar/register", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setCalendarStatus("connected")
        setMessage(data.message)
      } else {
        setCalendarStatus("error")
        setMessage(data.error || "Failed to connect calendar")
      }
    } catch {
      setCalendarStatus("error")
      setMessage("Network error")
    }
  }

  async function saveAutoJoin() {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/settings/auto-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoJoin, keywords }),
      })
      if (res.ok) {
        setMessage("Settings saved")
      } else {
        setMessage("Failed to save settings")
      }
    } catch {
      setMessage("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: "600px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", marginBottom: "24px" }}>
        Settings
      </h1>

      {/* Calendar Connection */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
          Google Calendar
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "16px" }}>
          Connect your Google Calendar to automatically detect meetings with Google Meet links.
        </p>
        <button
          onClick={connectCalendar}
          disabled={calendarStatus === "connecting"}
          style={{
            padding: "8px 20px",
            background: calendarStatus === "connected" ? "#059669" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.875rem",
            cursor: calendarStatus === "connecting" ? "wait" : "pointer",
            opacity: calendarStatus === "connecting" ? 0.7 : 1,
          }}
        >
          {calendarStatus === "connecting"
            ? "Connecting..."
            : calendarStatus === "connected"
              ? "Connected"
              : "Connect Calendar"}
        </button>
      </div>

      {/* Auto-join Configuration */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
          Auto-Join Settings
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "16px" }}>
          Control which meetings the bot should automatically join.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
          {(["all", "keywords", "disabled"] as const).map((option) => (
            <label
              key={option}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "#374151",
              }}
            >
              <input
                type="radio"
                name="autoJoin"
                value={option}
                checked={autoJoin === option}
                onChange={() => setAutoJoin(option)}
              />
              {option === "all" && "Join all meetings with Meet links"}
              {option === "keywords" && "Only join meetings matching keywords"}
              {option === "disabled" && "Don't auto-join any meetings"}
            </label>
          ))}
        </div>

        {autoJoin === "keywords" && (
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{ display: "block", fontSize: "0.875rem", color: "#374151", marginBottom: "4px" }}
            >
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="standup, sprint, retrospective"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        <button
          onClick={saveAutoJoin}
          disabled={saving}
          style={{
            padding: "8px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.875rem",
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* AI Configuration */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
          AI Summarization
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "16px" }}>
          Configure the AI provider used to generate meeting summaries.
          {aiHasKey && (
            <span style={{ color: "#16a34a", marginLeft: "8px" }}>API key configured</span>
          )}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", color: "#374151", marginBottom: "4px" }}>
              Provider
            </label>
            <select
              value={aiProvider}
              onChange={(e) => {
                const p = e.target.value as "anthropic" | "openai"
                setAiProvider(p)
                if (!aiModel || aiModel.startsWith("claude") || aiModel.startsWith("gpt")) {
                  setAiModel(p === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o")
                }
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", color: "#374151", marginBottom: "4px" }}>
              Model ID
            </label>
            <input
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={aiProvider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o"}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.875rem", color: "#374151", marginBottom: "4px" }}>
              API Key {aiHasKey && <span style={{ color: "#6b7280" }}>(leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder={aiHasKey ? "••••••••••••••••" : "sk-..."}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontFamily: "monospace",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <button
          onClick={async () => {
            if (!aiApiKey && !aiHasKey) {
              setAiMessage("API key is required")
              return
            }
            setAiSaving(true)
            setAiMessage("")
            try {
              const res = await fetch("/api/settings/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  provider: aiProvider,
                  model: aiModel || (aiProvider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o"),
                  apiKey: aiApiKey || "KEEP_EXISTING",
                }),
              })
              if (res.ok) {
                setAiMessage("AI settings saved")
                setAiHasKey(true)
                setAiApiKey("")
              } else {
                const data = await res.json()
                setAiMessage(data.error || "Failed to save")
              }
            } catch {
              setAiMessage("Network error")
            } finally {
              setAiSaving(false)
            }
          }}
          disabled={aiSaving}
          style={{
            padding: "8px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.875rem",
            cursor: aiSaving ? "wait" : "pointer",
            opacity: aiSaving ? 0.7 : 1,
          }}
        >
          {aiSaving ? "Saving..." : "Save AI Settings"}
        </button>

        {aiMessage && (
          <p
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              borderRadius: "6px",
              background: aiMessage.includes("Failed") || aiMessage.includes("error") || aiMessage.includes("required") ? "#fef2f2" : "#f0fdf4",
              color: aiMessage.includes("Failed") || aiMessage.includes("error") || aiMessage.includes("required") ? "#dc2626" : "#16a34a",
              fontSize: "0.875rem",
            }}
          >
            {aiMessage}
          </p>
        )}
      </div>

      {/* Integrations Link */}
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>
          Integrations
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "16px" }}>
          Configure Slack notifications and other integrations.
        </p>
        <a
          href="/settings/integrations"
          style={{
            padding: "8px 20px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.875rem",
            textDecoration: "none",
          }}
        >
          Manage Integrations
        </a>
      </div>

      {message && (
        <p
          style={{
            padding: "12px",
            borderRadius: "6px",
            background: message.includes("Failed") || message.includes("error") ? "#fef2f2" : "#f0fdf4",
            color: message.includes("Failed") || message.includes("error") ? "#dc2626" : "#16a34a",
            fontSize: "0.875rem",
          }}
        >
          {message}
        </p>
      )}
    </div>
  )
}

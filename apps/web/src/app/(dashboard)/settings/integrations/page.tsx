"use client"

import { useState, useEffect } from "react"

export default function IntegrationsPage() {
  const [webhookUrl, setWebhookUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/settings/slack")
      .then((r) => r.json())
      .then((data) => setWebhookUrl(data.webhookUrl ?? ""))
      .catch(() => {})
  }, [])

  async function saveSlackSettings() {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/settings/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      })
      if (res.ok) {
        setMessage("Slack settings saved")
      } else {
        const data = await res.json()
        setMessage(data.error || "Failed to save")
      }
    } catch {
      setMessage("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function testSlack() {
    setMessage("")
    try {
      const res = await fetch("/api/settings/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      })
      if (res.ok) {
        setMessage("Settings saved. Summaries will be sent to Slack after meetings end.")
      } else {
        setMessage("Failed to save Slack settings")
      }
    } catch {
      setMessage("Network error")
    }
  }

  return (
    <div style={{ maxWidth: "600px" }}>
      <div style={{ marginBottom: "24px" }}>
        <a href="/settings" style={{ color: "#2563eb", fontSize: "0.875rem", textDecoration: "none" }}>
          &larr; Back to Settings
        </a>
      </div>

      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", marginBottom: "24px" }}>
        Integrations
      </h1>

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
          Slack Notifications
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "16px" }}>
          Meeting summaries will be posted to Slack automatically after each meeting ends.
          Use an incoming webhook URL from your Slack workspace.
        </p>

        <label
          style={{ display: "block", fontSize: "0.875rem", color: "#374151", marginBottom: "4px" }}
        >
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "0.875rem",
            marginBottom: "16px",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={saveSlackSettings}
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
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
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

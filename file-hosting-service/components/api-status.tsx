"use client"

import { useState } from "react"

export default function ApiStatus() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function check() {
    setLoading(true)
    setMessage(null)
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
    try {
      const res = await fetch(`${API_BASE}/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      setMessage(`OK: ${text}`)
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 text-center">
      <button
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        onClick={check}
        disabled={loading}
      >
        {loading ? "Checking…" : "Check API"}
      </button>
      {message && <div className="mt-3 text-sm text-muted-foreground">{message}</div>}
    </div>
  )
}

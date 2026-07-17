// Formats a timestamp into a short, human-readable time (e.g. "3:42 PM").
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Formats an ISO date string (YYYY-MM-DD) into a short label, e.g. "Mon, Jan 5".
export function formatDayLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

// Basic guard against empty/whitespace-only chat submissions.
export function isBlank(text) {
  return !text || text.trim().length === 0
}

// Formats an ISO timestamp as a short relative time, e.g. "5m ago", "3h ago".
export function formatRelativeTime(isoString) {
  const then = new Date(isoString.endsWith('Z') || isoString.includes('+') ? isoString : `${isoString}Z`)
  const diffSeconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000))

  if (diffSeconds < 60) return 'Just now'
  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return then.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Formats a duration in whole seconds as "M:SS" (or "H:MM:SS" past an hour).
export function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

// FastAPI error responses come in two shapes: a plain string detail (e.g.
// "Email is already registered") or a validation-error array of
// {loc, msg, type} objects (e.g. from a malformed email). This normalizes
// either into a single readable string for display.
export function extractErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg).filter(Boolean).join(' ') || fallback
  }
  return fallback
}

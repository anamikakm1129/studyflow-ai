import { useState } from 'react'
import { Plus, Trash2, MessageSquare } from 'lucide-react'
import { useToast } from '../context/ToastContext.jsx'

function dateGroupFor(isoDateTime) {
  const date = new Date(isoDateTime)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  if (date >= startOfToday) return 'Today'
  if (date >= startOfYesterday) return 'Yesterday'
  return 'Earlier'
}

function groupSessions(sessions) {
  const groups = { Today: [], Yesterday: [], Earlier: [] }
  for (const s of sessions) {
    groups[dateGroupFor(s.updated_at)].push(s)
  }
  return groups
}

export default function ChatHistorySidebar({ sessions, activeSessionId, onSelect, onNewChat, onDelete }) {
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const toast = useToast()
  const groups = groupSessions(sessions)

  const handleDeleteClick = async (e, sessionId) => {
    e.stopPropagation()
    if (pendingDeleteId !== sessionId) {
      // First click arms it; this avoids an intrusive confirm() dialog while
      // still requiring a deliberate second click before anything is removed.
      setPendingDeleteId(sessionId)
      return
    }
    setPendingDeleteId(null)
    try {
      await onDelete(sessionId)
      toast.success('Conversation deleted')
    } catch {
      toast.error('Could not delete that conversation.')
    }
  }

  return (
    <div className="chat-history-panel">
      <button className="chat-history-new-btn" onClick={onNewChat}>
        <Plus size={16} /> New Chat
      </button>

      <div className="chat-history-list">
        {sessions.length === 0 && (
          <p className="chat-history-empty">Your past conversations will show up here.</p>
        )}

        {Object.entries(groups).map(([label, items]) =>
          items.length > 0 ? (
            <div key={label} className="chat-history-group">
              <div className="chat-history-group-label">{label}</div>
              {items.map((s) => (
                <div
                  key={s.id}
                  className={`chat-history-item ${s.id === activeSessionId ? 'active' : ''}`}
                  onClick={() => onSelect(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(s.id)}
                >
                  <MessageSquare size={14} />
                  <span className="chat-history-item-title">{s.title || 'New chat'}</span>
                  <button
                    className={`chat-history-delete-btn ${pendingDeleteId === s.id ? 'confirm' : ''}`}
                    onClick={(e) => handleDeleteClick(e, s.id)}
                    onBlur={() => setPendingDeleteId(null)}
                    aria-label={pendingDeleteId === s.id ? 'Click again to confirm delete' : 'Delete conversation'}
                    title={pendingDeleteId === s.id ? 'Click again to confirm' : 'Delete'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

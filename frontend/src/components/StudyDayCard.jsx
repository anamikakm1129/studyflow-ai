import { Check } from 'lucide-react'
import Badge from './ui/Badge.jsx'
import { formatDayLabel } from '../utils/formatters.js'

export default function StudyDayCard({ day, isDone, onToggleDone }) {
  return (
    <div className="timeline-day">
      <button
        type="button"
        className={`timeline-marker ${isDone ? 'done' : ''}`}
        onClick={onToggleDone}
        aria-label={isDone ? 'Mark day as not completed' : 'Mark day as completed'}
        aria-pressed={isDone}
      >
        {isDone && <Check size={16} />}
      </button>
      <div className="timeline-content">
        <div className="timeline-date-row">
          <span className="timeline-date">{formatDayLabel(day.date)}</span>
          <Badge variant={day.total_hours > 0 ? 'primary' : 'neutral'}>
            {day.total_hours > 0 ? `${day.total_hours}h planned` : 'Rest day'}
          </Badge>
        </div>

        {day.sessions.length === 0 ? (
          <p className="timeline-rest">No sessions scheduled -- take a break or catch up.</p>
        ) : (
          day.sessions.map((s, i) => (
            <div className="timeline-session" key={i}>
              <span>
                <span className="timeline-session-subject">{s.subject}</span> — {s.focus}
              </span>
              <Badge variant="neutral">{s.hours}h</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

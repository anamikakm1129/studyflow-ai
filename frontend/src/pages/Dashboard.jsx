import '../styles/dashboard.css'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  FileQuestion,
  CalendarDays,
  PlayCircle,
  Clock,
  Flame,
  MessageCircle,
  Award,
  Lock
} from 'lucide-react'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'
import Skeleton from '../components/ui/Skeleton.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchDashboardStats } from '../services/api.js'
import { formatRelativeTime } from '../utils/formatters.js'

const QUICK_ACTIONS = [
  { to: '/tutor', label: 'Start Learning', icon: Sparkles },
  { to: '/quiz', label: 'Generate Quiz', icon: FileQuestion },
  { to: '/planner', label: 'Create Study Plan', icon: CalendarDays },
  { to: '/tutor', label: 'Continue Last Session', icon: PlayCircle }
]

const ACTIVITY_ICONS = {
  chat: MessageCircle,
  quiz: FileQuestion,
  study_plan: CalendarDays
}

function examDueLabel(daysUntil) {
  if (daysUntil === 0) return 'Due today'
  if (daysUntil === 1) return 'Due tomorrow'
  return `Due in ${daysUntil} days`
}

function formatHours(totalMinutes) {
  const hours = totalMinutes / 60
  return hours < 10 ? hours.toFixed(1) : Math.round(hours).toString()
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  useEffect(() => {
    let cancelled = false
    fetchDashboardStats()
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const statCards = stats
    ? [
        { label: 'Study Streak', value: `${stats.streak_days} day${stats.streak_days === 1 ? '' : 's'}`, icon: Flame, color: 'var(--color-warning)' },
        { label: 'Quizzes Completed', value: String(stats.quizzes_completed), icon: FileQuestion, color: 'var(--color-primary)' },
        { label: 'Total Study Hours', value: `${formatHours(stats.total_study_minutes)}h`, icon: Clock, color: 'var(--color-success)' },
        { label: 'Total XP', value: String(stats.xp), icon: Award, color: 'var(--color-warning)' }
      ]
    : []

  const xpPercent = stats ? Math.round((stats.xp_into_level / stats.xp_for_next_level) * 100) : 0

  return (
    <Layout>
      <Card className="welcome-card">
        <div>
          <h2>Welcome back, {firstName} 👋</h2>
          <p>Ready to pick up where you left off? Your tutor, quizzes, and study plan are all in one place.</p>
        </div>
      </Card>

      {!isLoading && stats && (
        <Card className="level-card" style={{ marginBottom: '18px' }}>
          <div className="level-badge">{stats.level}</div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '15px' }}>
              Level {stats.level} · {stats.level_title}
            </strong>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '2px 0 0' }}>
              {stats.xp_into_level} / {stats.xp_for_next_level} XP to next level
            </p>
            <div className="xp-progress-track">
              <div className="xp-progress-fill" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <Card key={i} className="stat-card">
                <Skeleton height="40px" width="40px" radius="12px" style={{ marginBottom: '4px' }} />
                <Skeleton height="26px" width="60%" />
                <Skeleton height="13px" width="80%" />
              </Card>
            ))
          : statCards.map((s) => (
              <Card key={s.label} className="stat-card">
                <div className="stat-card-icon" style={{ background: `${s.color}22`, color: s.color }}>
                  <s.icon size={20} />
                </div>
                <div className="stat-card-value">{s.value}</div>
                <div className="stat-card-label">{s.label}</div>
              </Card>
            ))}
      </div>

      <div className="quick-actions">
        {QUICK_ACTIONS.map((a) => (
          <Card as={Link} to={a.to} key={a.label} hoverable className="quick-action-btn" style={{ padding: '18px' }}>
            <a.icon size={22} />
            <span>{a.label}</span>
          </Card>
        ))}
      </div>

      {!isLoading && stats && (
        <Card style={{ marginBottom: '18px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>Progress</h3>
          <div className="period-progress-grid">
            <div className="period-progress-item">
              <span>This week</span>
              <div className="period-progress-value">{stats.weekly_progress.quizzes_completed} quizzes</div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>+{stats.weekly_progress.xp_earned} XP</div>
            </div>
            <div className="period-progress-item">
              <span>This month</span>
              <div className="period-progress-value">{stats.monthly_progress.quizzes_completed} quizzes</div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>+{stats.monthly_progress.xp_earned} XP</div>
            </div>
          </div>
        </Card>
      )}

      {!isLoading && stats && (
        <Card style={{ marginBottom: '18px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>Achievements</h3>
          <div className="achievements-grid">
            {stats.achievements.map((a) => (
              <div key={a.id} className={`achievement-badge ${a.unlocked ? 'unlocked' : ''}`}>
                <div className="achievement-icon">{a.unlocked ? <Award size={17} /> : <Lock size={15} />}</div>
                <span className="achievement-label">{a.label}</span>
                <span className="achievement-desc">{a.description}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="dashboard-columns">
        <Card>
          <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Recent Activity</h3>
          {isLoading ? (
            <>
              <Skeleton height="16px" style={{ margin: '12px 0' }} />
              <Skeleton height="16px" style={{ margin: '12px 0' }} />
              <Skeleton height="16px" style={{ margin: '12px 0' }} />
            </>
          ) : !stats || stats.recent_activity.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={22} />}
              title="No activity yet"
              description="Ask the tutor a question or generate a quiz to get started."
            />
          ) : (
            stats.recent_activity.map((item, i) => {
              const Icon = ACTIVITY_ICONS[item.type] || Sparkles
              return (
                <div className="activity-row" key={i}>
                  <div className="activity-icon">
                    <Icon size={16} />
                  </div>
                  <span>{item.description}</span>
                  <span className="activity-time">{formatRelativeTime(item.timestamp)}</span>
                </div>
              )
            })
          )}
        </Card>

        <Card>
          <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Upcoming Exams</h3>
          {isLoading ? (
            <>
              <Skeleton height="16px" style={{ margin: '12px 0' }} />
              <Skeleton height="16px" style={{ margin: '12px 0' }} />
            </>
          ) : !stats || stats.upcoming_exams.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="No exams scheduled"
              description="Generate a study plan with a target date to see it here."
            />
          ) : (
            stats.upcoming_exams.map((exam, i) => (
              <div className="quiz-upcoming-row" key={i}>
                <span>{exam.subjects}</span>
                <Badge variant={exam.days_until <= 2 ? 'danger' : 'warning'}>{examDueLabel(exam.days_until)}</Badge>
              </div>
            ))
          )}
        </Card>
      </div>
    </Layout>
  )
}

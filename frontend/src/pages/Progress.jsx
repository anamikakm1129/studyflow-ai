import '../styles/dashboard.css'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Flame, Clock, GraduationCap, Award } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'

// NOTE: The backend doesn't persist study-hours, streaks, or quiz-score
// history yet, so everything on this page is sample data illustrating what
// the page will look like once that tracking exists. Nothing here is real.
const STREAK_STATS = [
  { label: 'Study Streak', value: '6 days', icon: Flame, color: 'var(--color-warning)' },
  { label: 'Hours Studied', value: '38.5', icon: Clock, color: 'var(--color-primary)' },
  { label: 'Subjects Completed', value: '3', icon: GraduationCap, color: 'var(--color-success)' },
  { label: 'Avg Quiz Score', value: '82%', icon: Award, color: 'var(--color-primary)' }
]

const WEEKLY_DATA = [
  { day: 'Mon', hours: 2.5 },
  { day: 'Tue', hours: 1.5 },
  { day: 'Wed', hours: 3 },
  { day: 'Thu', hours: 2 },
  { day: 'Fri', hours: 1 },
  { day: 'Sat', hours: 4 },
  { day: 'Sun', hours: 2.5 }
]

const MONTHLY_DATA = [
  { week: 'Wk 1', score: 68 },
  { week: 'Wk 2', score: 74 },
  { week: 'Wk 3', score: 71 },
  { week: 'Wk 4', score: 82 }
]

export default function Progress() {
  return (
    <Layout>
      <div className="page-header">
        <h1>Progress</h1>
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Track how your studying adds up over time. <Badge variant="neutral">Sample data</Badge>
        </p>
      </div>

      <div className="grid grid-cols-4">
        {STREAK_STATS.map((s) => (
          <Card key={s.label} className="stat-card">
            <div className="stat-card-icon" style={{ background: `${s.color}22`, color: s.color }}>
              <s.icon size={20} />
            </div>
            <div className="stat-card-value">{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="dashboard-columns" style={{ marginTop: '18px' }}>
        <Card>
          <h3 style={{ fontSize: '15px', marginBottom: '14px' }}>Hours studied this week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={WEEKLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} />
              <Tooltip
                contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '10px' }}
              />
              <Bar dataKey="hours" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 style={{ fontSize: '15px', marginBottom: '14px' }}>Quiz scores this month</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MONTHLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="week" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} />
              <Tooltip
                contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '10px' }}
              />
              <Line type="monotone" dataKey="score" stroke="var(--color-success)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </Layout>
  )
}

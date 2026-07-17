import '../styles/settings.css'
import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useProfile } from '../context/ProfileContext.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useToast } from '../context/ToastContext.jsx'

function Switch({ checked, onChange, label }) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="switch-track" />
    </label>
  )
}

export default function Settings() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const { classYear, setClassYear } = useProfile()
  // Namespaced per user (by email) so switching accounts on this device
  // never shows someone else's notification preferences.
  const [notifications, setNotifications] = useLocalStorage(
    user ? `studyflow_notifications:${user.email}` : 'studyflow_notifications:guest',
    { quizReminders: true, studyPlanAlerts: true }
  )
  const toast = useToast()

  const [classYearDraft, setClassYearDraft] = useState(classYear)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const saveProfile = (e) => {
    e.preventDefault()
    setClassYear(classYearDraft)
    toast.success('Profile updated')
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    // The backend's auth routes only support register/login today -- there's
    // no change-password endpoint yet, so this can't actually update
    // anything. Being upfront about that here rather than pretending it worked.
    toast.info("Password changes aren't supported by the backend yet -- this form isn't wired up.")
    setCurrentPassword('')
    setNewPassword('')
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your profile, appearance, and preferences.</p>
      </div>

      <div className="settings-page-inner">
        <Card>
          <h3 className="settings-section-title">Appearance</h3>
          <p className="settings-section-desc">Choose how StudyFlow AI looks on this device.</p>
          <div className="settings-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
              <span className="settings-row-label">Dark mode</span>
            </div>
            <Switch checked={theme === 'dark'} onChange={toggleTheme} label="Toggle dark mode" />
          </div>
        </Card>

        <Card as="form" onSubmit={saveProfile}>
          <h3 className="settings-section-title">Profile</h3>
          <p className="settings-section-desc">
            Your name and email come from your account. <Badge variant="neutral">From your account</Badge>
          </p>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Name</label>
            <input type="text" value={user?.full_name || '(not set at sign-up)'} disabled />
          </div>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label>Email</label>
            <input type="text" value={user?.email || ''} disabled />
          </div>
          <div className="field" style={{ marginBottom: '14px' }}>
            <label htmlFor="profile-class">Class / Year</label>
            <input
              id="profile-class"
              type="text"
              value={classYearDraft}
              onChange={(e) => setClassYearDraft(e.target.value)}
              placeholder="e.g. B.Tech, 3rd Year"
            />
            <p className="quiz-hint">Saved on this device only, tied to your account.</p>
          </div>
          <Button type="submit" size="sm">Save class / year</Button>
        </Card>

        <Card as="form" onSubmit={handlePasswordSubmit}>
          <h3 className="settings-section-title">Change password</h3>
          <p className="settings-section-desc">
            Not yet connected to the backend. <Badge variant="warning">Coming soon</Badge>
          </p>
          <div className="field" style={{ marginBottom: '12px' }}>
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: '14px' }}>
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary" size="sm">Update password</Button>
        </Card>

        <Card>
          <h3 className="settings-section-title">Notifications</h3>
          <p className="settings-section-desc">
            Preferences only -- no notifications are sent yet. <Badge variant="neutral">Saved on this device</Badge>
          </p>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Quiz reminders</div>
              <div className="settings-row-desc">Nudge me about upcoming quizzes</div>
            </div>
            <Switch
              checked={notifications.quizReminders}
              onChange={() => setNotifications((n) => ({ ...n, quizReminders: !n.quizReminders }))}
              label="Toggle quiz reminders"
            />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Study plan alerts</div>
              <div className="settings-row-desc">Notify me about study plan milestones</div>
            </div>
            <Switch
              checked={notifications.studyPlanAlerts}
              onChange={() => setNotifications((n) => ({ ...n, studyPlanAlerts: !n.studyPlanAlerts }))}
              label="Toggle study plan alerts"
            />
          </div>
        </Card>
      </div>
    </Layout>
  )
}

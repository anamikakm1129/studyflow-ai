import '../styles/subjects.css'
import { useState } from 'react'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#06B6D4']

export default function Subjects() {
  // NOTE: The backend has no Subjects model yet, so this list lives in the
  // browser's localStorage, namespaced per account (by email) so it can
  // never leak between users on a shared device. It's genuinely yours and
  // persists across visits on this device, but won't sync to another device.
  const { user } = useAuth()
  const [subjects, setSubjects] = useLocalStorage(
    user ? `studyflow_subjects:${user.email}` : 'studyflow_subjects:guest',
    []
  )
  const [draft, setDraft] = useState('')
  const toast = useToast()

  const addSubject = () => {
    const name = draft.trim()
    if (!name) return
    if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error('That subject is already on your list.')
      return
    }
    const color = COLORS[subjects.length % COLORS.length]
    setSubjects((prev) => [...prev, { id: crypto.randomUUID(), name, color }])
    setDraft('')
    toast.success(`Added ${name}`)
  }

  const removeSubject = (id) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>My Subjects</h1>
        <p>
          Keep track of what you're studying. <Badge variant="neutral">Saved on this device</Badge>
        </p>
      </div>

      <form
        className="subjects-add-row"
        onSubmit={(e) => {
          e.preventDefault()
          addSubject()
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Organic Chemistry"
          aria-label="New subject name"
        />
        <Button type="submit">
          <Plus size={16} /> Add subject
        </Button>
      </form>

      {subjects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={26} />}
            title="No subjects yet"
            description="Add the subjects you're studying so they're easy to reference across the app."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-3">
          {subjects.map((s) => (
            <Card key={s.id} className="subject-card">
              <span className="subject-color-dot" style={{ background: s.color }} />
              <span className="subject-card-name">{s.name}</span>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => removeSubject(s.id)}
                aria-label={`Remove ${s.name}`}
              >
                <Trash2 size={15} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  )
}

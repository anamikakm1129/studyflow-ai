import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Tutor from './pages/Tutor.jsx'
import Quiz from './pages/Quiz.jsx'
import StudyPlanner from './pages/StudyPlanner.jsx'
import Subjects from './pages/Subjects.jsx'
import Progress from './pages/Progress.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'
import { useAuth } from './context/AuthContext.jsx'

export default function App() {
  const { token } = useAuth()

  // Keying the whole route tree by the current auth token forces React to
  // fully unmount and remount every page (and therefore every hook's local
  // state -- chat messages, form drafts, in-progress quizzes, etc.) whenever
  // the logged-in identity changes: login, logout, or switching accounts.
  // This is a deliberate belt-and-suspenders guard on top of the per-user
  // localStorage namespacing -- state can't leak between accounts even if
  // a component happens to stay mounted across the transition.
  return (
    <Routes key={token || 'signed-out'}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/tutor" element={<Tutor />} />
      <Route path="/quiz" element={<Quiz />} />
      <Route path="/planner" element={<StudyPlanner />} />
      <Route path="/subjects" element={<Subjects />} />
      <Route path="/progress" element={<Progress />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}

import { useState } from 'react'
import Card from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import { useToast } from '../context/ToastContext.jsx'

const DIFFICULTIES = ['easy', 'medium', 'hard']
const QUESTION_COUNTS = [5, 10, 20, 50]
const QUESTION_TYPES = [
  { value: 'mcq', label: 'MCQ', available: true },
  { value: 'true_false', label: 'True/False', available: false },
  { value: 'short_answer', label: 'Short Answer', available: false }
]

// The backend currently only generates multiple-choice questions and caps
// at 20 questions per quiz (see backend/app/schemas/quiz.py). The extra
// options below are shown for a complete-feeling form, but are clamped or
// disabled rather than silently failing against the API.
const BACKEND_MAX_QUESTIONS = 20

export default function QuizForm({ onGenerate, isGenerating }) {
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [numQuestions, setNumQuestions] = useState(10)
  const [questionType, setQuestionType] = useState('mcq')
  const toast = useToast()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!subject.trim() || !topic.trim() || isGenerating) return

    const requested = numQuestions
    const clamped = Math.min(requested, BACKEND_MAX_QUESTIONS)
    if (requested > BACKEND_MAX_QUESTIONS) {
      toast.info(`Quizzes are currently capped at ${BACKEND_MAX_QUESTIONS} questions -- generating ${BACKEND_MAX_QUESTIONS} instead.`)
    }

    onGenerate({
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      num_questions: clamped
    })
  }

  return (
    <Card as="form" className="quiz-form-card" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="subject">Subject</label>
        <input
          id="subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Biology"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="topic">Topic</label>
        <input
          id="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Cell structure"
          required
        />
      </div>

      <div className="field">
        <label>Difficulty</label>
        <div className="option-group">
          {DIFFICULTIES.map((d) => (
            <button
              type="button"
              key={d}
              className={`option-chip ${difficulty === d ? 'active' : ''}`}
              onClick={() => setDifficulty(d)}
              style={{ textTransform: 'capitalize' }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Number of questions</label>
        <div className="option-group">
          {QUESTION_COUNTS.map((n) => (
            <button
              type="button"
              key={n}
              className={`option-chip ${numQuestions === n ? 'active' : ''}`}
              onClick={() => setNumQuestions(n)}
            >
              {n}
            </button>
          ))}
        </div>
        {numQuestions > BACKEND_MAX_QUESTIONS && (
          <p className="quiz-hint">Quizzes are generated {BACKEND_MAX_QUESTIONS} questions at a time for now.</p>
        )}
      </div>

      <div className="field">
        <label>Question type</label>
        <div className="option-group">
          {QUESTION_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              disabled={!t.available}
              className={`option-chip ${questionType === t.value ? 'active' : ''} ${!t.available ? 'disabled' : ''}`}
              onClick={() => t.available && setQuestionType(t.value)}
              title={!t.available ? 'Coming soon' : undefined}
            >
              {t.label}
              {!t.available && ' · Soon'}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isGenerating} style={{ alignSelf: 'flex-start' }}>
        {isGenerating ? 'Generating quiz…' : 'Generate quiz'}
      </Button>
    </Card>
  )
}

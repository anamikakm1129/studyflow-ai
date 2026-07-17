import '../styles/quiz.css'
import { useEffect, useRef, useState } from 'react'
import { Clock, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import Skeleton from '../components/ui/Skeleton.jsx'
import QuizForm from '../components/QuizForm.jsx'
import QuizQuestionCard from '../components/QuizQuestionCard.jsx'
import QuizNavigator from '../components/QuizNavigator.jsx'
import { generateQuiz, saveQuizAttempt } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'
import { formatDuration } from '../utils/formatters.js'
import { exportQuizResultsToPdf } from '../utils/pdfExport.js'

export default function Quiz() {
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState([])
  const [flagged, setFlagged] = useState(() => new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [finalTime, setFinalTime] = useState(null)
  const timerRef = useRef(null)
  const toast = useToast()

  // A simple elapsed-time stopwatch, not a countdown -- there's no fixed
  // time limit from the backend, so this just shows how long the attempt is
  // taking (and is recorded on the results screen), rather than inventing an
  // arbitrary cutoff that could unfairly fail someone mid-question.
  useEffect(() => {
    if (!quiz || submitted) return
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [quiz, submitted])

  const handleGenerate = async (payload) => {
    setIsGenerating(true)
    try {
      const result = await generateQuiz(payload)
      setQuiz(result)
      setAnswers(new Array(result.questions.length).fill(null))
      setFlagged(new Set())
      setCurrentIndex(0)
      setSubmitted(false)
      setElapsedSeconds(0)
      setFinalTime(null)
    } catch (err) {
      const message = err?.response?.data?.detail || 'Could not generate the quiz. Please try again.'
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSelect = (questionIndex, optionIndex) => {
    if (submitted) return
    setAnswers((prev) => {
      const next = [...prev]
      next[questionIndex] = optionIndex
      return next
    })
  }

  const toggleFlag = (questionIndex) => {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(questionIndex)) next.delete(questionIndex)
      else next.add(questionIndex)
      return next
    })
  }

  const allAnswered = quiz && answers.every((a) => a !== null)
  const score = quiz
    ? quiz.questions.reduce((total, q, i) => (answers[i] === q.correct_index ? total + 1 : total), 0)
    : 0
  const scorePercent = quiz ? Math.round((score / quiz.questions.length) * 100) : 0

  const handleSubmit = () => {
    clearInterval(timerRef.current)
    setFinalTime(elapsedSeconds)
    setSubmitted(true)

    // Fire-and-forget: this powers the dashboard's real stats (quizzes
    // completed, average score, recent activity). A failure here shouldn't
    // block the learner from seeing their results.
    saveQuizAttempt({
      subject: quiz.subject,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      score,
      total_questions: quiz.questions.length,
      time_taken_seconds: elapsedSeconds
    }).catch(() => {
      toast.error("Your score wasn't saved to your dashboard, but here are your results.")
    })
  }

  const handleStartOver = () => {
    setQuiz(null)
    setAnswers([])
    setFlagged(new Set())
    setCurrentIndex(0)
    setSubmitted(false)
  }

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1))
  const goNext = () => setCurrentIndex((i) => Math.min(quiz.questions.length - 1, i + 1))

  const unansweredCount = quiz ? answers.filter((a) => a === null).length : 0

  return (
    <Layout>
      <div className="quiz-page-inner">
        <div className="page-header">
          <h1>Quiz Generator</h1>
          <p>Tell StudyFlow what to quiz you on, and it'll write the questions.</p>
        </div>

        {!quiz && <QuizForm onGenerate={handleGenerate} isGenerating={isGenerating} />}

        {isGenerating && !quiz && (
          <Card style={{ marginTop: '16px' }}>
            <Skeleton height="20px" width="60%" style={{ marginBottom: '12px' }} />
            <Skeleton height="14px" width="90%" style={{ marginBottom: '8px' }} />
            <Skeleton height="14px" width="80%" />
          </Card>
        )}

        {quiz && (
          <div className="quiz-results">
            <Card className="quiz-meta-card">
              <div>
                <strong>{quiz.subject}</strong> · {quiz.topic}
                <div>
                  <Badge variant="primary" style={{ textTransform: 'capitalize' }}>{quiz.difficulty}</Badge>
                </div>
              </div>
              {!submitted && (
                <div className="quiz-timer">
                  <Clock size={15} />
                  {formatDuration(elapsedSeconds)}
                </div>
              )}
            </Card>

            {submitted && (
              <Card className="quiz-score-card">
                <div
                  className="quiz-score-ring"
                  style={{
                    background: scorePercent >= 70 ? 'rgba(34,197,94,0.15)' : scorePercent >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                    color: scorePercent >= 70 ? 'var(--color-success)' : scorePercent >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'
                  }}
                >
                  {scorePercent}%
                </div>
                <div>
                  <strong style={{ fontSize: '16px' }}>
                    You scored {score} out of {quiz.questions.length}
                  </strong>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '13.5px', marginTop: '2px' }}>
                    Completed in {formatDuration(finalTime ?? elapsedSeconds)}. Tap any question below to review it.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => exportQuizResultsToPdf(quiz, answers, score)}
                >
                  <Download size={14} /> PDF
                </Button>
              </Card>
            )}

            <QuizNavigator
              total={quiz.questions.length}
              currentIndex={currentIndex}
              answers={answers}
              flagged={flagged}
              submitted={submitted}
              onJump={setCurrentIndex}
            />

            <div className="quiz-question-position">
              Question {currentIndex + 1} of {quiz.questions.length}
              {!submitted && unansweredCount > 0 && (
                <span className="quiz-unanswered-hint"> · {unansweredCount} unanswered</span>
              )}
            </div>

            <QuizQuestionCard
              index={currentIndex}
              question={quiz.questions[currentIndex]}
              selectedIndex={answers[currentIndex]}
              onSelect={(optionIndex) => handleSelect(currentIndex, optionIndex)}
              submitted={submitted}
              isFlagged={flagged.has(currentIndex)}
              onToggleFlag={() => toggleFlag(currentIndex)}
            />

            <div className="quiz-nav-buttons">
              <Button variant="secondary" onClick={goPrev} disabled={currentIndex === 0}>
                <ChevronLeft size={16} /> Previous
              </Button>

              {!submitted ? (
                currentIndex < quiz.questions.length - 1 ? (
                  <Button onClick={goNext}>
                    Next <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button disabled={!allAnswered} onClick={handleSubmit}>
                    Submit answers
                  </Button>
                )
              ) : currentIndex < quiz.questions.length - 1 ? (
                <Button onClick={goNext}>
                  Next <ChevronRight size={16} />
                </Button>
              ) : (
                <Button onClick={handleStartOver}>Generate another quiz</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

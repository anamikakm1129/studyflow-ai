import '../styles/planner.css'
import { useState } from 'react'
import { Download } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Skeleton from '../components/ui/Skeleton.jsx'
import PlannerForm from '../components/PlannerForm.jsx'
import StudyDayCard from '../components/StudyDayCard.jsx'
import { generateStudyPlan, saveStudyPlan } from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'
import { exportStudyPlanToPdf } from '../utils/pdfExport.js'

export default function StudyPlanner() {
  const [plan, setPlan] = useState(null)
  const [context, setContext] = useState(null)
  const [completedDates, setCompletedDates] = useState(() => new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const toast = useToast()

  const handleGenerate = async (payload, extraContext) => {
    setIsGenerating(true)
    try {
      const result = await generateStudyPlan(payload)
      setPlan(result)
      setContext(extraContext)
      setCompletedDates(new Set())
      toast.success('Your study plan is ready.')

      // Fire-and-forget: this is what makes "upcoming exams" on the
      // dashboard real. A failure here shouldn't block seeing the plan.
      saveStudyPlan({
        subjects: result.subjects,
        exam_date: result.exam_date,
        hours_per_day: result.available_hours_per_day,
        summary: result.summary,
        days: result.days
      }).catch(() => {
        toast.error("This plan wasn't saved to your dashboard, but it's ready below.")
      })
    } catch (err) {
      const message = err?.response?.data?.detail || 'Could not generate the study plan. Please try again.'
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleDay = (date) => {
    setCompletedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const handleStartOver = () => {
    setPlan(null)
    setContext(null)
    setCompletedDates(new Set())
  }

  const daysWithSessions = plan ? plan.days.filter((d) => d.sessions.length > 0) : []
  const completionPercent = daysWithSessions.length
    ? Math.round((daysWithSessions.filter((d) => completedDates.has(d.date)).length / daysWithSessions.length) * 100)
    : 0

  return (
    <Layout>
      <div className="planner-page-inner">
        <div className="page-header">
          <h1>Study Planner</h1>
          <p>Tell StudyFlow about your course and goals, and it'll build a day-by-day timetable.</p>
        </div>

        {!plan && <PlannerForm onGenerate={handleGenerate} isGenerating={isGenerating} />}

        {isGenerating && !plan && (
          <Card style={{ marginTop: '16px' }}>
            <Skeleton height="20px" width="50%" style={{ marginBottom: '12px' }} />
            <Skeleton height="14px" width="90%" style={{ marginBottom: '8px' }} />
            <Skeleton height="14px" width="70%" />
          </Card>
        )}

        {plan && (
          <div className="quiz-results">
            {context && (
              <Card>
                <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>Plan Context</h3>
                <div className="plan-context-grid">
                  <div className="plan-context-item"><span>Course</span>{context.course}</div>
                  <div className="plan-context-item"><span>Year</span>{context.year}</div>
                  <div className="plan-context-item"><span>Goal</span>{context.goal}</div>
                  <div className="plan-context-item"><span>Preferred time</span>{context.studyTime}</div>
                </div>
              </Card>
            )}

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '15px' }}>Strategy</h3>
                <Button variant="secondary" size="sm" onClick={() => exportStudyPlanToPdf(plan)}>
                  <Download size={14} /> PDF
                </Button>
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{plan.summary}</p>
            </Card>

            <Card className="plan-progress-card">
              <div className="plan-progress-ring">{completionPercent}%</div>
              <div>
                <strong style={{ fontSize: '15px' }}>Progress tracker</strong>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13.5px', marginTop: '2px' }}>
                  {completedDates.size} of {daysWithSessions.length} study days completed. Tap a day's marker to check it off.
                </p>
              </div>
            </Card>

            <div className="plan-timeline">
              {plan.days.map((day) => (
                <StudyDayCard
                  key={day.date}
                  day={day}
                  isDone={completedDates.has(day.date)}
                  onToggleDone={() => toggleDay(day.date)}
                />
              ))}
            </div>

            <div>
              <Button onClick={handleStartOver}>Generate another plan</Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

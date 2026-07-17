import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import Card from './ui/Card.jsx'
import Button from './ui/Button.jsx'
import Stepper from './Stepper.jsx'
import { isBlank } from '../utils/formatters.js'
import { useToast } from '../context/ToastContext.jsx'

const COURSES = ['Class 10', 'Class 11', 'Class 12', 'B.Tech', 'BCA', 'MCA', 'MBA', 'Other']
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year']
const GOALS = ['Semester Exam', 'Placement Preparation', 'Competitive Exam', 'Skill Development', 'Revision']
const STUDY_TIMES = ['Morning', 'Afternoon', 'Evening', 'Night']
const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced']

const STEP_LABELS = ['Course', 'Subjects', 'Goal', 'Availability', 'Generate']

export default function PlannerForm({ onGenerate, isGenerating }) {
  const [step, setStep] = useState(1)
  const [furthestStep, setFurthestStep] = useState(1)
  const toast = useToast()

  const [course, setCourse] = useState(COURSES[0])
  const [year, setYear] = useState(YEARS[0])
  const [semester, setSemester] = useState('')
  const [university, setUniversity] = useState('')

  const [subjects, setSubjects] = useState([])
  const [subjectDraft, setSubjectDraft] = useState('')

  const [goal, setGoal] = useState(GOALS[0])

  const [examDate, setExamDate] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState(2)
  const [studyTime, setStudyTime] = useState(STUDY_TIMES[0])
  const [difficultyLevel, setDifficultyLevel] = useState(DIFFICULTY_LEVELS[1])

  const addSubject = () => {
    const value = subjectDraft.trim()
    if (isBlank(value) || subjects.includes(value)) return
    setSubjects((prev) => [...prev, value])
    setSubjectDraft('')
  }

  const removeSubject = (subject) => {
    setSubjects((prev) => prev.filter((s) => s !== subject))
  }

  const handleSubjectKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSubject()
    }
  }

  const goToStep = (target) => {
    setStep(target)
    setFurthestStep((f) => Math.max(f, target))
  }

  const handleNext = () => {
    if (step === 2 && subjects.length === 0) {
      toast.error('Add at least one subject to continue.')
      return
    }
    if (step === 4 && !examDate) {
      toast.error('Set a target completion date to continue.')
      return
    }
    goToStep(Math.min(5, step + 1))
  }

  const handleBack = () => goToStep(Math.max(1, step - 1))

  const handleSubmit = () => {
    if (subjects.length === 0 || !examDate || isGenerating) return
    onGenerate(
      {
        subjects,
        exam_date: examDate,
        available_hours_per_day: Number(hoursPerDay)
      },
      { course, year, semester, university, goal, studyTime, difficultyLevel }
    )
  }

  return (
    <Card className="planner-wizard-card">
      <Stepper steps={STEP_LABELS} currentStep={step} furthestStep={furthestStep} onJump={goToStep} />

      <div className="planner-step-body">
        {step === 1 && (
          <>
            <h3 className="planner-section-title">Course details</h3>
            <div className="field-row">
              <div className="field">
                <label htmlFor="course">Class / Course</label>
                <select id="course" value={course} onChange={(e) => setCourse(e.target.value)}>
                  {COURSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="year">Current year</label>
                <select id="year" value={year} onChange={(e) => setYear(e.target.value)}>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="semester">Semester (if applicable)</label>
                <input id="semester" type="text" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. 5th Semester" />
              </div>
              <div className="field">
                <label htmlFor="university">University or Board</label>
                <input id="university" type="text" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="e.g. CBSE, Delhi University" />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="planner-section-title">What are you studying?</h3>
            <div className="field">
              <label htmlFor="subject-input">Subjects</label>
              <div className="subject-input-row">
                <input
                  id="subject-input"
                  type="text"
                  value={subjectDraft}
                  onChange={(e) => setSubjectDraft(e.target.value)}
                  onKeyDown={handleSubjectKeyDown}
                  placeholder="Type a subject, press Enter"
                  autoFocus
                />
                <Button type="button" variant="secondary" size="sm" onClick={addSubject}>
                  Add
                </Button>
              </div>
              {subjects.length > 0 ? (
                <div className="subject-chips">
                  {subjects.map((s) => (
                    <span key={s} className="subject-chip">
                      {s}
                      <button type="button" onClick={() => removeSubject(s)} aria-label={`Remove ${s}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="quiz-hint">Add each subject you want included in your plan.</p>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="planner-section-title">What's your goal?</h3>
            <div className="field">
              <div className="option-group">
                {GOALS.map((g) => (
                  <button
                    type="button"
                    key={g}
                    className={`option-chip ${goal === g ? 'active' : ''}`}
                    onClick={() => setGoal(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="planner-section-title">Your availability</h3>
            <div className="field-row">
              <div className="field">
                <label htmlFor="exam-date">Target completion date</label>
                <input
                  id="exam-date"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="hours-per-day">Hours available per day</label>
                <input
                  id="hours-per-day"
                  type="number"
                  min={0.5}
                  max={16}
                  step={0.5}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Preferred study time</label>
              <div className="option-group">
                {STUDY_TIMES.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`option-chip ${studyTime === t ? 'active' : ''}`}
                    onClick={() => setStudyTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Difficulty level</label>
              <div className="option-group">
                {DIFFICULTY_LEVELS.map((d) => (
                  <button
                    type="button"
                    key={d}
                    className={`option-chip ${difficultyLevel === d ? 'active' : ''}`}
                    onClick={() => setDifficultyLevel(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h3 className="planner-section-title">Review &amp; generate</h3>
            <div className="planner-review-grid">
              <div className="planner-review-item"><span>Course</span>{course}</div>
              <div className="planner-review-item"><span>Year</span>{year}</div>
              {semester && <div className="planner-review-item"><span>Semester</span>{semester}</div>}
              {university && <div className="planner-review-item"><span>University / Board</span>{university}</div>}
              <div className="planner-review-item"><span>Subjects</span>{subjects.join(', ')}</div>
              <div className="planner-review-item"><span>Goal</span>{goal}</div>
              <div className="planner-review-item"><span>Target date</span>{examDate}</div>
              <div className="planner-review-item"><span>Hours / day</span>{hoursPerDay}</div>
              <div className="planner-review-item"><span>Preferred time</span>{studyTime}</div>
              <div className="planner-review-item"><span>Difficulty</span>{difficultyLevel}</div>
            </div>
          </>
        )}
      </div>

      <div className="planner-step-actions">
        <Button type="button" variant="secondary" onClick={handleBack} disabled={step === 1}>
          <ChevronLeft size={16} /> Back
        </Button>
        {step < 5 ? (
          <Button type="button" onClick={handleNext}>
            Next <ChevronRight size={16} />
          </Button>
        ) : (
          <Button type="button" disabled={isGenerating} onClick={handleSubmit}>
            {isGenerating ? 'Building your timetable…' : 'Generate study plan'}
          </Button>
        )}
      </div>
    </Card>
  )
}

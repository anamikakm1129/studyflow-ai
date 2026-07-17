import { Flag } from 'lucide-react'
import Card from './ui/Card.jsx'

export default function QuizQuestionCard({
  index,
  question,
  selectedIndex,
  onSelect,
  submitted,
  isFlagged,
  onToggleFlag
}) {
  return (
    <Card as="fieldset" className="quiz-question-card">
      <div className="quiz-question-card-header">
        <legend>{question.question}</legend>
        {!submitted && (
          <button
            type="button"
            className={`quiz-flag-btn ${isFlagged ? 'active' : ''}`}
            onClick={onToggleFlag}
            aria-pressed={isFlagged}
            aria-label={isFlagged ? 'Remove flag from this question' : 'Flag this question for review'}
            title={isFlagged ? 'Flagged for review' : 'Flag for review'}
          >
            <Flag size={15} />
          </button>
        )}
      </div>

      <div className="quiz-options">
        {question.options.map((option, i) => {
          const isSelected = selectedIndex === i
          const isCorrect = i === question.correct_index
          let optionClass = 'quiz-option'
          if (submitted) {
            if (isCorrect) optionClass += ' correct'
            else if (isSelected && !isCorrect) optionClass += ' incorrect'
          } else if (isSelected) {
            optionClass += ' selected'
          }

          return (
            <label key={i} className={optionClass}>
              <input
                type="radio"
                name={`question-${index}`}
                checked={isSelected}
                onChange={() => onSelect(i)}
                disabled={submitted}
              />
              <span>{option}</span>
            </label>
          )
        })}
      </div>

      {submitted && question.explanation && (
        <p className="quiz-explanation">{question.explanation}</p>
      )}
    </Card>
  )
}

import { Flag } from 'lucide-react'

export default function QuizNavigator({ total, currentIndex, answers, flagged, submitted, onJump }) {
  return (
    <div className="quiz-navigator">
      {Array.from({ length: total }, (_, i) => {
        const isAnswered = answers[i] !== null
        const isFlagged = flagged.has(i)
        const isCurrent = i === currentIndex

        let className = 'quiz-navigator-dot'
        if (isCurrent) className += ' current'
        if (isFlagged) className += ' flagged'
        else if (isAnswered) className += ' answered'

        return (
          <button
            key={i}
            type="button"
            className={className}
            onClick={() => onJump(i)}
            aria-label={`Question ${i + 1}${isAnswered ? ', answered' : ', unanswered'}${isFlagged ? ', flagged' : ''}`}
            aria-current={isCurrent ? 'true' : undefined}
          >
            {isFlagged && !submitted ? <Flag size={11} /> : i + 1}
          </button>
        )
      })}
    </div>
  )
}

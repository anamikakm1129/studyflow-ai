import { Check } from 'lucide-react'

export default function Stepper({ steps, currentStep, furthestStep, onJump }) {
  return (
    <div className="stepper">
      {steps.map((label, i) => {
        const stepNumber = i + 1
        const isDone = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep
        const isReachable = stepNumber <= furthestStep

        return (
          <div className="stepper-item" key={label}>
            <button
              type="button"
              className={`stepper-dot ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              onClick={() => isReachable && onJump(stepNumber)}
              disabled={!isReachable}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Step ${stepNumber}: ${label}`}
            >
              {isDone ? <Check size={14} /> : stepNumber}
            </button>
            <span className={`stepper-label ${isCurrent ? 'current' : ''}`}>{label}</span>
            {i < steps.length - 1 && <div className={`stepper-line ${isDone ? 'done' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

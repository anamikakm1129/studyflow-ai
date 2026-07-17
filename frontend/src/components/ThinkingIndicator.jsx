export default function ThinkingIndicator() {
  return (
    <div className="thinking-row" role="status" aria-live="polite">
      <div className="thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span>StudyFlow is thinking…</span>
    </div>
  )
}

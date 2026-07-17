import { useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'

export default function FlashcardViewer({ cards, onClose }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const goTo = (nextIndex) => {
    setIndex(nextIndex)
    setFlipped(false)
  }

  return (
    <Modal title={`Flashcards (${index + 1} of ${cards.length})`} onClose={onClose}>
      <div
        className={`flashcard ${flipped ? 'flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setFlipped((f) => !f)}
        aria-label="Flip flashcard"
      >
        <div className="flashcard-face flashcard-front">
          <span className="flashcard-hint">Question</span>
          <p>{cards[index].front}</p>
        </div>
        <div className="flashcard-face flashcard-back">
          <span className="flashcard-hint">Answer</span>
          <p>{cards[index].back}</p>
        </div>
      </div>

      <p className="flashcard-flip-hint">
        <RotateCw size={12} /> Tap the card to flip
      </p>

      <div className="flashcard-nav">
        <Button variant="secondary" size="sm" onClick={() => goTo(Math.max(0, index - 1))} disabled={index === 0}>
          <ChevronLeft size={15} /> Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => goTo(Math.min(cards.length - 1, index + 1))}
          disabled={index === cards.length - 1}
        >
          Next <ChevronRight size={15} />
        </Button>
      </div>
    </Modal>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  SendHorizontal,
  Square,
  Code2,
  BrainCircuit,
  Calculator,
  Cpu,
  Coffee,
  Sigma,
  Briefcase,
  NotebookPen,
  Baby,
  History,
  X
} from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import ThinkingIndicator from './ThinkingIndicator.jsx'
import ChatHistorySidebar from './ChatHistorySidebar.jsx'
import FlashcardViewer from './FlashcardViewer.jsx'
import NotesViewer from './NotesViewer.jsx'
import Card from './ui/Card.jsx'
import { useChat } from '../hooks/useChat.js'
import { useToast } from '../context/ToastContext.jsx'
import { generateFlashcards, generateNotes } from '../services/api.js'
import { isBlank } from '../utils/formatters.js'

const SUGGESTIONS = [
  { icon: Code2, label: 'Explain Python Loops' },
  { icon: BrainCircuit, label: 'Teach Machine Learning' },
  { icon: Sigma, label: 'Explain Linear Algebra' },
  { icon: Briefcase, label: 'Prepare for an Interview' },
  { icon: NotebookPen, label: 'Generate Study Notes' },
  { icon: Calculator, label: 'Solve a Math Problem' },
  { icon: Cpu, label: 'Explain Operating Systems' },
  { icon: Baby, label: "Explain Like I'm 10" },
  { icon: Coffee, label: 'Help with Java' }
]

export default function ChatBox() {
  const {
    messages,
    sessions,
    activeSessionId,
    sendMessage,
    regenerate,
    startNewSession,
    loadSession,
    removeSession,
    stopGenerating,
    giveFeedback,
    isSending,
    isRestoring,
    error
  } = useChat()
  const [draft, setDraft] = useState('')
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [flashcards, setFlashcards] = useState(null)
  const [notes, setNotes] = useState(null)
  const [isGeneratingTool, setIsGeneratingTool] = useState(false)
  const textareaRef = useRef(null)
  const messagesEndRef = useRef(null)
  const toast = useToast()

  const handleGenerateFlashcards = async (content) => {
    if (isGeneratingTool) return
    setIsGeneratingTool(true)
    toast.info('Generating flashcards…')
    try {
      const result = await generateFlashcards(content)
      setFlashcards(result.cards)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not generate flashcards. Please try again.')
    } finally {
      setIsGeneratingTool(false)
    }
  }

  const handleGenerateNotes = async (content) => {
    if (isGeneratingTool) return
    setIsGeneratingTool(true)
    toast.info('Generating notes…')
    try {
      const result = await generateNotes(content)
      setNotes(result.notes)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not generate notes. Please try again.')
    } finally {
      setIsGeneratingTool(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const lastMessage = messages[messages.length - 1]
  const isAwaitingFirstToken =
    isSending && (!lastMessage || lastMessage.role !== 'assistant' || lastMessage.content === '')
  const isStreamingReply = isSending && !isAwaitingFirstToken

  const handleDraftChange = (e) => {
    setDraft(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }

  const submitMessage = (text) => {
    const value = (text ?? draft).trim()
    if (isBlank(value) || isSending) return
    sendMessage(value)
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submitMessage()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
  }

  const handleSelectSession = (id) => {
    loadSession(id)
    setIsHistoryOpen(false)
  }

  const handleNewChat = () => {
    startNewSession()
    setIsHistoryOpen(false)
  }

  return (
    <div className="chat-page-layout">
      <div className={`chat-history-panel-wrap ${isHistoryOpen ? 'open' : ''}`}>
        <ChatHistorySidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onNewChat={handleNewChat}
          onDelete={removeSession}
        />
      </div>
      {isHistoryOpen && (
        <div className="chat-history-overlay" onClick={() => setIsHistoryOpen(false)} aria-hidden="true" />
      )}

      <div className="chat-panel">
        <div className="chat-header">
          <button
            className="btn btn-ghost btn-icon chat-history-toggle"
            onClick={() => setIsHistoryOpen((v) => !v)}
            aria-label={isHistoryOpen ? 'Close conversation history' : 'Open conversation history'}
          >
            {isHistoryOpen ? <X size={19} /> : <History size={19} />}
          </button>
          <div>
            <h1>AI Tutor</h1>
            <p>Ask a question about any subject and get a clear, guided explanation.</p>
          </div>
        </div>

        <div className="chat-messages">
          {isRestoring ? null : messages.length === 0 && (
            <div className="chat-empty">
              <h2>What would you like to learn today?</h2>
              <div className="suggestion-grid">
                {SUGGESTIONS.map((s) => (
                  <Card
                    key={s.label}
                    hoverable
                    className="suggestion-card"
                    onClick={() => submitMessage(s.label)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && submitMessage(s.label)}
                  >
                    <s.icon size={18} />
                    {s.label}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              isStreaming={isStreamingReply && i === messages.length - 1}
              isLast={i === messages.length - 1}
              onRegenerate={!isSending ? regenerate : undefined}
              onCopy={() => toast.success('Copied to clipboard')}
              dbId={m.dbId}
              feedback={m.feedback}
              onFeedback={giveFeedback}
              onGenerateFlashcards={!isSending ? handleGenerateFlashcards : undefined}
              onGenerateNotes={!isSending ? handleGenerateNotes : undefined}
            />
          ))}

          {isAwaitingFirstToken && <ThinkingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {error && <div className="chat-error">{error}</div>}

        <form className="chat-input-bar" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask your tutor anything… (Shift+Enter for a new line)"
            rows={1}
            aria-label="Message the AI tutor"
          />
          <button
            type="submit"
            className="send-button"
            disabled={isSending || isBlank(draft)}
            aria-label="Send message"
            style={{ display: isSending ? 'none' : 'flex' }}
          >
            <SendHorizontal size={19} />
          </button>
          {isSending && (
            <button
              type="button"
              className="send-button stop-button"
              onClick={stopGenerating}
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square size={15} fill="currentColor" />
            </button>
          )}
        </form>
      </div>

      {flashcards && <FlashcardViewer cards={flashcards} onClose={() => setFlashcards(null)} />}
      {notes && <NotesViewer notes={notes} onClose={() => setNotes(null)} />}
    </div>
  )
}

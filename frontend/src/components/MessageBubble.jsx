import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, User, Sparkles, ThumbsUp, ThumbsDown, Layers, NotebookText } from 'lucide-react'
import { useTheme } from '../context/ThemeContext.jsx'

SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('jsx', jsx)
SyntaxHighlighter.registerLanguage('java', java)
SyntaxHighlighter.registerLanguage('c', c)
SyntaxHighlighter.registerLanguage('cpp', cpp)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('sql', sql)

function CodeBlock({ className, children }) {
  const [copied, setCopied] = useState(false)
  const { theme } = useTheme()
  const language = /language-(\w+)/.exec(className || '')?.[1]
  const code = String(children).replace(/\n$/, '')

  // Inline code (no fenced language) renders as a simple <code> tag.
  if (!className) {
    return <code className="inline-code">{code}</code>
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || 'code'}</span>
        <button className="btn btn-ghost btn-sm" onClick={handleCopy} aria-label="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={theme === 'light' ? oneLight : vscDarkPlus}
        customStyle={{ margin: 0, borderRadius: '0 0 10px 10px', fontSize: '13px' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export default function MessageBubble({
  role,
  content,
  isStreaming = false,
  onCopy,
  onRegenerate,
  isLast = false,
  dbId = null,
  feedback = null,
  onFeedback,
  onGenerateFlashcards,
  onGenerateNotes
}) {
  const isTutor = role === 'assistant'
  const [copied, setCopied] = useState(false)

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    onCopy?.()
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`message-row ${role}`}>
      {isTutor && (
        <div className="message-avatar tutor-avatar" aria-hidden="true">
          <Sparkles size={15} />
        </div>
      )}
      <div className="message-bubble">
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{ code: CodeBlock }}
          >
            {content || ' '}
          </ReactMarkdown>
          {isStreaming && <span className="stream-cursor" aria-hidden="true" />}
        </div>

        {isTutor && content && !isStreaming && (
          <div className="message-actions">
            <button className="btn btn-ghost btn-sm" onClick={handleCopyMessage} aria-label="Copy response">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {isLast && onRegenerate && (
              <button className="btn btn-ghost btn-sm" onClick={onRegenerate} aria-label="Regenerate response">
                Regenerate
              </button>
            )}
            {onGenerateFlashcards && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onGenerateFlashcards(content)}
                aria-label="Generate flashcards from this response"
              >
                <Layers size={13} /> Flashcards
              </button>
            )}
            {onGenerateNotes && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onGenerateNotes(content)}
                aria-label="Generate notes from this response"
              >
                <NotebookText size={13} /> Notes
              </button>
            )}
            {dbId && onFeedback && (
              <>
                <button
                  className={`btn btn-ghost btn-sm ${feedback === 'up' ? 'feedback-active-up' : ''}`}
                  onClick={() => onFeedback(dbId, 'up')}
                  aria-label={feedback === 'up' ? 'Remove like' : 'Like this response'}
                  aria-pressed={feedback === 'up'}
                >
                  <ThumbsUp size={13} />
                </button>
                <button
                  className={`btn btn-ghost btn-sm ${feedback === 'down' ? 'feedback-active-down' : ''}`}
                  onClick={() => onFeedback(dbId, 'down')}
                  aria-label={feedback === 'down' ? 'Remove dislike' : 'Dislike this response'}
                  aria-pressed={feedback === 'down'}
                >
                  <ThumbsDown size={13} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {!isTutor && (
        <div className="message-avatar user-avatar" aria-hidden="true">
          <User size={15} />
        </div>
      )}
    </div>
  )
}

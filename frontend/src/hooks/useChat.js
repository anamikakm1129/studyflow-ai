import { useCallback, useEffect, useRef, useState } from 'react'
import {
  streamTutorMessage,
  fetchChatHistory,
  listChatSessions,
  deleteChatSession,
  setMessageFeedback
} from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export function useChat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [error, setError] = useState(null)
  const sessionIdRef = useRef(null)
  const lastUserMessageRef = useRef(null)
  const abortControllerRef = useRef(null)

  const refreshSessions = useCallback(async () => {
    try {
      const list = await listChatSessions()
      setSessions(list)
      return list
    } catch {
      return []
    }
  }, [])

  const loadSession = useCallback(async (sessionId) => {
    setIsRestoring(true)
    setError(null)
    try {
      const data = await fetchChatHistory(sessionId)
      sessionIdRef.current = data.session_id
      setActiveSessionId(data.session_id)
      setMessages(
        data.messages.map((m) => ({
          id: crypto.randomUUID(),
          dbId: m.id,
          role: m.role,
          content: m.content,
          feedback: m.feedback ?? null
        }))
      )
    } catch {
      setError('Could not load that conversation.')
    } finally {
      setIsRestoring(false)
    }
  }, [])

  // On mount (and whenever the logged-in user changes -- this hook fully
  // remounts on login/logout anyway thanks to App.jsx's key={token}, but
  // being explicit here costs nothing), fetch the conversation list and
  // open the most recently active one automatically. This is what powers
  // "Continue Last Session" on the dashboard -- driven entirely by the
  // backend's own record of what's most recent, not a local cache that
  // could go stale or point at someone else's conversation.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await refreshSessions()
      if (cancelled) return
      if (list.length > 0) {
        await loadSession(list[0].id)
      } else {
        setIsRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  const streamReply = useCallback(
    async (text, assistantId) => {
      setIsSending(true)
      setError(null)

      const controller = new AbortController()
      abortControllerRef.current = controller

      const appendToAssistant = (fragment) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + fragment } : m))
        )
      }

      try {
        await streamTutorMessage(
          { message: text, session_id: sessionIdRef.current },
          {
            signal: controller.signal,
            onSession: (sessionId) => {
              const isNewSession = sessionIdRef.current !== sessionId
              sessionIdRef.current = sessionId
              setActiveSessionId(sessionId)
              // A brand new session was just created server-side -- refresh
              // the sidebar list right away so it appears immediately
              // rather than only after the reply finishes.
              if (isNewSession) refreshSessions()
            },
            onChunk: appendToAssistant,
            onDone: (_sessionId, messageId) => {
              // Attach the real backend message id now that it exists, so
              // like/dislike has something stable to reference.
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, dbId: messageId } : m))
              )
              refreshSessions() // picks up the auto-generated title
            },
            onError: (message) => {
              setError(message || 'Could not reach the tutor. Please try again.')
            }
          }
        )
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setError('Could not reach the tutor. Check your connection and try again.')
          setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content))
        }
        // AbortError means the user clicked "Stop generating" -- keep
        // whatever partial content already streamed in, no error shown.
      } finally {
        setIsSending(false)
        abortControllerRef.current = null
      }
    },
    [refreshSessions]
  )

  const stopGenerating = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const sendMessage = useCallback(
    async (text) => {
      const userMessage = { role: 'user', content: text, id: crypto.randomUUID(), dbId: null, feedback: null }
      const assistantId = crypto.randomUUID()
      lastUserMessageRef.current = text

      setMessages((prev) => [
        ...prev,
        userMessage,
        { role: 'assistant', content: '', id: assistantId, dbId: null, feedback: null }
      ])
      await streamReply(text, assistantId)
    },
    [streamReply]
  )

  // Regenerates the last assistant reply by re-sending the last user message
  // as a fresh request (the previous assistant message is replaced, not kept
  // as duplicate history server-side, since it's added as a new turn).
  const regenerate = useCallback(async () => {
    if (!lastUserMessageRef.current || isSending) return
    const assistantId = crypto.randomUUID()
    setMessages((prev) => {
      const withoutLastAssistant = [...prev]
      if (withoutLastAssistant.length && withoutLastAssistant[withoutLastAssistant.length - 1].role === 'assistant') {
        withoutLastAssistant.pop()
      }
      return [...withoutLastAssistant, { role: 'assistant', content: '', id: assistantId, dbId: null, feedback: null }]
    })
    await streamReply(lastUserMessageRef.current, assistantId)
  }, [isSending, streamReply])

  const startNewSession = useCallback(() => {
    sessionIdRef.current = null
    setActiveSessionId(null)
    lastUserMessageRef.current = null
    setMessages([])
    setError(null)
  }, [])

  const removeSession = useCallback(
    async (sessionId) => {
      await deleteChatSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (sessionIdRef.current === sessionId) {
        startNewSession()
      }
    },
    [startNewSession]
  )

  // Sets feedback on a message; clicking the same reaction again clears it
  // (toggle), matching how like/dislike buttons usually behave.
  const giveFeedback = useCallback(async (messageId, reaction) => {
    let previousValue = null
    let nextValue = reaction
    setMessages((prev) =>
      prev.map((m) => {
        if (m.dbId !== messageId) return m
        previousValue = m.feedback
        nextValue = m.feedback === reaction ? null : reaction
        return { ...m, feedback: nextValue }
      })
    )
    try {
      await setMessageFeedback(messageId, nextValue)
    } catch {
      // Revert to whatever it was before this click, since the save failed.
      setMessages((prev) => prev.map((m) => (m.dbId === messageId ? { ...m, feedback: previousValue } : m)))
    }
  }, [])

  return {
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
    error,
    canRegenerate: Boolean(lastUserMessageRef.current)
  }
}

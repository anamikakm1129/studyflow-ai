import axios from 'axios'

// In dev, Vite proxies /api to the FastAPI backend (see vite.config.js).
// In production, VITE_API_BASE_URL should point to the deployed backend
// (e.g. an AWS App Runner service URL).
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ai_tutor_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Sends a tutoring question/message to the backend, which forwards it to Claude.
export async function sendTutorMessage(payload) {
  const { data } = await apiClient.post('/chat', payload)
  return data
}

/**
 * Streams a tutor reply token-by-token from POST /chat/stream.
 *
 * Uses the native fetch API (not axios) because axios can't expose a
 * readable stream of the response body in the browser. Authorization is
 * added manually here since this bypasses the apiClient interceptor.
 *
 * @param {{ message: string, session_id?: number }} payload
 * @param {{
 *   onSession?: (sessionId: number) => void,
 *   onChunk?: (text: string) => void,
 *   onDone?: (sessionId: number, messageId: number | null) => void,
 *   onError?: (message: string) => void,
 *   signal?: AbortSignal
 * }} handlers
 */
export async function streamTutorMessage(payload, handlers = {}) {
  const { onSession, onChunk, onDone, onError, signal } = handlers
  const token = localStorage.getItem('ai_tutor_token')

  const response = await fetch(`${baseURL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload),
    signal
  })

  if (!response.ok || !response.body) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleFrame = (frame) => {
    // Each SSE frame looks like:
    //   event: chunk
    //   data: {"text": "..."}
    const lines = frame.split('\n')
    let eventName = 'message'
    let dataLine = ''

    for (const line of lines) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) dataLine = line.slice(5).trim()
    }
    if (!dataLine) return

    const data = JSON.parse(dataLine)
    if (eventName === 'session') onSession?.(data.session_id)
    else if (eventName === 'chunk') onChunk?.(data.text)
    else if (eventName === 'done') onDone?.(data.session_id, data.message_id)
    else if (eventName === 'error') onError?.(data.message)
  }

  // SSE frames are separated by a blank line ("\n\n").
  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() // last piece may be incomplete; keep it for next read

    for (const frame of frames) {
      if (frame.trim()) handleFrame(frame)
    }
  }
}

// Fetches the authenticated user's chat/session history.
export async function fetchChatHistory(sessionId) {
  const { data } = await apiClient.get(`/chat/history/${sessionId}`)
  return data
}

// Lists the authenticated user's conversations, most recently active first.
export async function listChatSessions() {
  const { data } = await apiClient.get('/chat/sessions')
  return data
}

// Permanently deletes a conversation and its messages.
export async function deleteChatSession(sessionId) {
  await apiClient.delete(`/chat/sessions/${sessionId}`)
}

// Sets (feedback: "up"/"down") or clears (feedback: null) a like/dislike on
// a specific assistant message.
export async function setMessageFeedback(messageId, feedback) {
  const { data } = await apiClient.patch(`/chat/messages/${messageId}/feedback`, { feedback })
  return data
}

// Authenticates a user and returns a token.
export async function loginUser(credentials) {
  const { data } = await apiClient.post('/auth/login', credentials)
  return data
}

// Fetches the currently authenticated user's real profile from the backend.
// This is the single source of truth for "who is logged in" -- never cache
// this across accounts, always refetch on login.
export async function fetchCurrentUser() {
  const { data } = await apiClient.get('/users/me')
  return data
}

// Creates a new account. Does not log the user in -- call loginUser() after.
export async function registerUser(payload) {
  const { data } = await apiClient.post('/auth/register', payload)
  return data
}

// Requests a generated quiz from the backend, which asks Claude to write it.
export async function generateQuiz(payload) {
  const { data } = await apiClient.post('/quiz/generate', payload)
  return data
}

// Records a completed quiz attempt (called once, after the learner submits).
export async function saveQuizAttempt(payload) {
  const { data } = await apiClient.post('/quiz/attempts', payload)
  return data
}

// Requests a generated study timetable from the backend, which asks Claude to write it.
export async function generateStudyPlan(payload) {
  const { data } = await apiClient.post('/planner/generate', payload)
  return data
}

// Saves a generated study plan (called once, right after generation).
export async function saveStudyPlan(payload) {
  const { data } = await apiClient.post('/planner/plans', payload)
  return data
}

// Fetches real, aggregated dashboard stats for the authenticated user.
export async function fetchDashboardStats() {
  const { data } = await apiClient.get('/dashboard/stats')
  return data
}

// Turns a piece of text (e.g. a tutor reply) into a flashcard set.
export async function generateFlashcards(content, count = 8) {
  const { data } = await apiClient.post('/tools/flashcards', { content, count })
  return data
}

// Turns a piece of text (e.g. a tutor reply) into structured study notes.
export async function generateNotes(content) {
  const { data } = await apiClient.post('/tools/notes', { content })
  return data
}

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message, variant = 'info', duration = 3500) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, message, variant }])
      if (duration) {
        setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  const toast = {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    info: (msg) => show(msg, 'info')
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant] || Info
          return (
            <div key={t.id} className={`toast toast-${t.variant}`} role="status">
              <Icon size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

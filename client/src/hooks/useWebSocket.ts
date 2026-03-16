import { useEffect, useRef, useState, useCallback } from 'react'

interface WebSocketMessage {
  type: string
  payload: unknown
}

export function useWebSocket(docId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentDocId = useRef<string | null>(null)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      if (currentDocId.current) {
        ws.send(JSON.stringify({ type: 'subscribe', docId: currentDocId.current }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WebSocketMessage
        setLastMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      reconnectTimeout.current = setTimeout(() => {
        connect()
      }, 2000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect])

  useEffect(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (currentDocId.current) {
        ws.send(JSON.stringify({ type: 'unsubscribe' }))
      }
      if (docId) {
        ws.send(JSON.stringify({ type: 'subscribe', docId }))
      }
    }
    currentDocId.current = docId
  }, [docId])

  return { lastMessage }
}

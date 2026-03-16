import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import DocumentList from './components/DocumentList'
import Editor from './components/Editor'
import CommentPanel from './components/CommentPanel'
import { useWebSocket } from './hooks/useWebSocket'
import type { Thread } from './types'
import type { PendingComment } from './components/CommentPanel'

function getDocIdFromHash(): string | null {
  const hash = window.location.hash
  const match = hash.match(/^#\/(.+)$/)
  return match ? match[1] : null
}

function setHash(docId: string | null) {
  const newHash = docId ? `#/${docId}` : '#/'
  if (window.location.hash !== newHash) {
    window.location.hash = newHash
  }
}

export default function App() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(getDocIdFromHash)
  const [docContent, setDocContent] = useState<Record<string, unknown> | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [docText, setDocText] = useState('')
  const [docListRefresh, setDocListRefresh] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Comment creation state (lifted from Editor so CommentPanel can render the input)
  const [commentAnchor, setCommentAnchor] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const commentInputTopRef = useRef<number>(0)

  useEffect(() => {
    const onHashChange = () => setSelectedDocId(getDocIdFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const { lastMessage } = useWebSocket(selectedDocId)

  const fetchDocContent = useCallback(async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`)
      if (res.ok) {
        const doc = await res.json()
        setDocContent(doc.content)
        setDocText(extractText(doc.content))
      }
    } catch (err) {
      console.error('Failed to fetch document:', err)
    }
  }, [])

  const fetchThreads = useCallback(async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/threads`)
      if (res.ok) {
        const data = await res.json()
        setThreads(data)
      }
    } catch (err) {
      console.error('Failed to fetch threads:', err)
    }
  }, [])

  useEffect(() => {
    if (!selectedDocId) {
      setDocContent(null)
      setThreads([])
      setDocText('')
      return
    }
    fetchDocContent(selectedDocId)
    fetchThreads(selectedDocId)
  }, [selectedDocId, fetchDocContent, fetchThreads])

  useEffect(() => {
    if (!lastMessage) return

    const { type, payload } = lastMessage as { type: string; payload: Record<string, unknown> }

    switch (type) {
      case 'doc_update':
        if (payload.doc_id === selectedDocId && payload.content) {
          setDocContent(payload.content as Record<string, unknown>)
          setDocText(extractText(payload.content as Record<string, unknown>))
        }
        setDocListRefresh((n) => n + 1)
        break

      case 'threads_update':
        if (payload.doc_id === selectedDocId && selectedDocId) {
          fetchThreads(selectedDocId)
        }
        break

      case 'open_doc':
        if (payload.doc_id && typeof payload.doc_id === 'string') {
          setHash(payload.doc_id)
        }
        break
    }
  }, [lastMessage, selectedDocId, fetchThreads])

  const handleSelectDoc = useCallback((docId: string) => {
    setHash(docId)
  }, [])

  const handleContentChange = useCallback(() => {
    if (selectedDocId) {
      fetchThreads(selectedDocId)
    }
    setDocListRefresh((n) => n + 1)
  }, [selectedDocId, fetchThreads])

  const handleThreadsChange = useCallback(() => {
    if (selectedDocId) {
      fetchThreads(selectedDocId)
    }
  }, [selectedDocId, fetchThreads])

  const resetCommentState = useCallback(() => {
    setCommentAnchor(null)
    setCommentBody('')
    setCommentError(null)
  }, [])

  const handleStartComment = useCallback((anchorText: string) => {
    // Capture selection rect synchronously before React re-renders and focus shifts
    const container = scrollContainerRef.current
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && container) {
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      commentInputTopRef.current = rect.top - containerRect.top + container.scrollTop
    }
    setCommentAnchor(anchorText)
    setCommentBody('')
    setCommentError(null)
  }, []) // scrollContainerRef is a stable ref

  const handleSubmitComment = useCallback(async () => {
    if (isSubmittingComment) return
    if (!commentAnchor || !commentBody.trim() || !selectedDocId) return
    setIsSubmittingComment(true)
    try {
      const res = await fetch(`/api/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: selectedDocId,
          anchor_text: commentAnchor,
          author: 'You',
          body: commentBody.trim(),
        }),
      })
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({ error: 'Failed to create comment' }))
        setCommentError(data.error || 'Failed to create comment')
        return
      }
      resetCommentState()
      handleThreadsChange()
    } catch (err) {
      console.error('Failed to create comment:', err)
      setCommentError('Network error — could not create comment')
    } finally {
      setIsSubmittingComment(false)
    }
  }, [isSubmittingComment, commentAnchor, commentBody, selectedDocId, handleThreadsChange, resetCommentState])

  const editorThreads = useMemo(
    () => threads.map((t) => ({ id: t.id, anchor_text: t.anchor_text, status: t.status })),
    [threads]
  )

  const pendingComment = useMemo<PendingComment | null>(
    () => commentAnchor ? {
      anchor: commentAnchor,
      body: commentBody,
      error: commentError,
      top: commentInputTopRef.current,
      isSubmitting: isSubmittingComment,
      onBodyChange: setCommentBody,
      onSubmit: handleSubmitComment,
      onCancel: resetCommentState,
    } : null,
    [commentAnchor, commentBody, commentError, isSubmittingComment, handleSubmitComment, resetCommentState]
  )

  const handleClear = useCallback(async () => {
    try {
      const res = await fetch('/api/clear', { method: 'POST' })
      if (res.ok) {
        setHash(null)
        setDocContent(null)
        setThreads([])
        setDocText('')
        setDocListRefresh((n) => n + 1)
      }
    } catch (err) {
      console.error('Failed to clear:', err)
    }
  }, [])

  return (
    <div className="app-layout">
      <DocumentList
        selectedDocId={selectedDocId}
        onSelectDoc={handleSelectDoc}
        onClear={handleClear}
        refreshTrigger={docListRefresh}
      />

      <div className="editor-with-comments" ref={scrollContainerRef}>
        {selectedDocId && docContent ? (
          <>
            <main className="main-content">
              <Editor
                docId={selectedDocId}
                content={docContent}
                threads={editorThreads}
                onContentChange={handleContentChange}
                onStartComment={handleStartComment}
              />
            </main>

            <CommentPanel
              docId={selectedDocId}
              threads={threads}
              docText={docText}
              onThreadsChange={handleThreadsChange}
              scrollContainerRef={scrollContainerRef}
              pendingComment={pendingComment}
            />
          </>
        ) : (
          <div className="no-doc-selected">
            <div className="no-doc-message">
              <h2>Ezra</h2>
              <p>Select a document from the sidebar to begin editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function extractText(content: Record<string, unknown>): string {
  const lines: string[] = []
  if (Array.isArray(content.content)) {
    for (const block of content.content) {
      const b = block as Record<string, unknown>
      let line = ''
      if (Array.isArray(b.content)) {
        for (const inline of b.content) {
          const n = inline as Record<string, unknown>
          if (typeof n.text === 'string') line += n.text
        }
      }
      lines.push(line)
    }
  }
  return lines.join('\n')
}

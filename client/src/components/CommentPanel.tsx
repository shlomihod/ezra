import React, { useEffect, useState, useRef, useCallback } from 'react'
import CommentThread from './CommentThread'
import type { Thread } from '../types'

interface AnchorPosition {
  threadId: string
  top: number
}

export interface PendingComment {
  anchor: string
  body: string
  error: string | null
  top: number
  isSubmitting: boolean
  onBodyChange: (body: string) => void
  onSubmit: () => void
  onCancel: () => void
}

interface CommentPanelProps {
  docId: string | null
  threads: Thread[]
  docText: string
  onThreadsChange: () => void
  scrollContainerRef: React.RefObject<HTMLElement | null>
  pendingComment: PendingComment | null
}

const MIN_GAP = 8

export default function CommentPanel({ docId, threads, docText, onThreadsChange, scrollContainerRef, pendingComment }: CommentPanelProps) {
  const [positions, setPositions] = useState<Map<string, number>>(new Map())
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const threadRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const rafId = useRef<number>(0)
  const activeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const computePositions = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Find all anchor decorations in the editor DOM
    const anchors = container.querySelectorAll<HTMLElement>('[data-thread-id]')
    const containerRect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop

    // Get raw Y positions for each thread from its first anchor element
    const rawPositions: AnchorPosition[] = []
    const seen = new Set<string>()
    anchors.forEach((el) => {
      const threadId = el.getAttribute('data-thread-id')
      if (!threadId || seen.has(threadId)) return
      seen.add(threadId)
      const rect = el.getBoundingClientRect()
      // Position relative to scroll container content (not viewport)
      const top = rect.top - containerRect.top + scrollTop
      rawPositions.push({ threadId, top })
    })

    // Sort by document position
    rawPositions.sort((a, b) => a.top - b.top)

    // Resolve overlaps: push threads down so they don't stack on top of each other
    const resolved = new Map<string, number>()
    let lastBottom = 0
    for (const { threadId, top } of rawPositions) {
      const threadEl = threadRefs.current.get(threadId)
      const threadHeight = threadEl?.offsetHeight ?? 120
      const adjustedTop = Math.max(top, lastBottom + MIN_GAP)
      resolved.set(threadId, adjustedTop)
      lastBottom = adjustedTop + threadHeight
    }

    setPositions(resolved)
  }, [scrollContainerRef])

  const scheduleCompute = useCallback(() => {
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(computePositions)
  }, [computePositions])

  // Listen for comment-focus events from clicking anchors in the editor
  useEffect(() => {
    const handler = (e: Event) => {
      const { threadId } = (e as CustomEvent).detail
      setActiveThreadId(threadId)
      const el = threadRefs.current.get(threadId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
      if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current)
      activeTimeoutRef.current = setTimeout(() => setActiveThreadId(null), 1500)
    }
    document.addEventListener('comment-focus', handler)
    return () => {
      document.removeEventListener('comment-focus', handler)
      if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current)
    }
  }, [])

  // Recompute after a short delay to let the editor DOM settle on thread changes
  useEffect(() => {
    const timer = setTimeout(computePositions, 100)
    return () => clearTimeout(timer)
  }, [threads, docText, computePositions])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const onScroll = () => scheduleCompute()
    container.addEventListener('scroll', onScroll, { passive: true })

    const observer = new ResizeObserver(() => scheduleCompute())
    observer.observe(container)

    return () => {
      container.removeEventListener('scroll', onScroll)
      observer.disconnect()
      cancelAnimationFrame(rafId.current)
    }
  }, [scrollContainerRef, scheduleCompute])

  if (!docId) {
    return (
      <aside className="comment-panel">
        <div className="comment-gutter-empty">
          <span className="empty-text">Select a document to view comments</span>
        </div>
      </aside>
    )
  }

  const openThreads = threads.filter((t) => t.status === 'open')
  const resolvedThreads = threads.filter((t) => t.status === 'resolved')
  // Threads whose anchor is found get positioned; orphaned ones go to the bottom
  const positionedThreads = openThreads.filter((t) => positions.has(t.id))
  const orphanedThreads = openThreads.filter((t) => !positions.has(t.id))

  return (
    <aside className="comment-panel">
      <div className="comment-gutter" ref={gutterRef}>
        {pendingComment && (
          <div
            className="comment-thread-positioned comment-input-card"
            style={{ top: pendingComment.top }}
          >
            <div className="comment-input-bar">
              <div className="comment-input-anchor">
                On: <em>&ldquo;{pendingComment.anchor.length > 60 ? pendingComment.anchor.slice(0, 60) + '...' : pendingComment.anchor}&rdquo;</em>
              </div>
              {pendingComment.error && (
                <div className="comment-input-error">{pendingComment.error}</div>
              )}
              <div className="comment-input-row">
                <input
                  className="comment-input-field"
                  type="text"
                  placeholder="Write a comment..."
                  value={pendingComment.body}
                  onChange={(e) => pendingComment.onBodyChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') pendingComment.onSubmit(); if (e.key === 'Escape') pendingComment.onCancel() }}
                  ref={(el) => { if (el && document.activeElement !== el) el.focus() }}
                />
                <button className="btn-solid" onClick={pendingComment.onSubmit} disabled={!pendingComment.body.trim() || pendingComment.isSubmitting}>
                  Post
                </button>
                <button className="btn-ghost" onClick={pendingComment.onCancel}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {positionedThreads.map((thread) => (
          <div
            key={thread.id}
            className="comment-thread-positioned"
            style={{ top: positions.get(thread.id) ?? 0 }}
            ref={(el) => {
              if (el) threadRefs.current.set(thread.id, el)
              else threadRefs.current.delete(thread.id)
            }}
          >
            <CommentThread
              thread={thread}
              anchorFound={true}
              isActive={activeThreadId === thread.id}
              onResolve={onThreadsChange}
              onReply={onThreadsChange}
              onClick={() => document.dispatchEvent(new CustomEvent('anchor-focus', { detail: { threadId: thread.id } }))}
            />
          </div>
        ))}

        {orphanedThreads.length > 0 && orphanedThreads.map((thread) => (
          <div
            key={thread.id}
            className="comment-thread-orphaned"
            ref={(el) => {
              if (el) threadRefs.current.set(thread.id, el)
              else threadRefs.current.delete(thread.id)
            }}
          >
            <CommentThread
              thread={thread}
              anchorFound={false}
              isActive={activeThreadId === thread.id}
              onResolve={onThreadsChange}
              onReply={onThreadsChange}
              onClick={() => document.dispatchEvent(new CustomEvent('anchor-focus', { detail: { threadId: thread.id } }))}
            />
          </div>
        ))}

        {resolvedThreads.length > 0 && (
          <div className="comment-resolved-section">
            <details className="resolved-section">
              <summary className="resolved-summary">
                {resolvedThreads.length} resolved
              </summary>
              {resolvedThreads.map((thread) => (
                <CommentThread
                  key={thread.id}
                  thread={thread}
                  anchorFound={docText.includes(thread.anchor_text)}
                  isActive={activeThreadId === thread.id}
                  onResolve={onThreadsChange}
                  onReply={onThreadsChange}
                  onClick={() => document.dispatchEvent(new CustomEvent('anchor-focus', { detail: { threadId: thread.id } }))}
                />
              ))}
            </details>
          </div>
        )}
      </div>
    </aside>
  )
}

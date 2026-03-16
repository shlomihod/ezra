import React, { useState } from 'react'
import type { Thread } from '../types'

interface CommentThreadProps {
  thread: Thread
  anchorFound: boolean
  isActive?: boolean
  onResolve: () => void
  onReply: () => void
  onClick?: () => void
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z')
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return d.toLocaleDateString()
}

export default function CommentThread({ thread, anchorFound, isActive, onResolve, onReply, onClick }: CommentThreadProps) {
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [showReply, setShowReply] = useState(false)

  const handleResolve = async () => {
    if (resolving) return
    setResolving(true)
    try {
      await fetch(`/api/threads/${encodeURIComponent(thread.id)}/resolve`, { method: 'POST' })
      onResolve()
    } catch (err) {
      console.error('Failed to resolve thread:', err)
    } finally {
      setResolving(false)
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || submitting) return

    setSubmitting(true)
    try {
      await fetch(`/api/threads/${encodeURIComponent(thread.id)}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: 'You', body: replyText.trim() }),
      })
      setReplyText('')
      setShowReply(false)
      onReply()
    } catch (err) {
      console.error('Failed to submit reply:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const isResolved = thread.status === 'resolved'

  return (
    <div
      className={`comment-thread ${isResolved ? 'comment-thread-resolved' : ''} ${isActive ? 'comment-thread-active' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      <div className="anchor-quote">
        <span className="anchor-text">{thread.anchor_text}</span>
        {!anchorFound && (
          <span className="anchor-missing">anchor not found</span>
        )}
      </div>

      <div className="replies-list">
        {thread.replies.map((reply) => (
          <div key={reply.id} className="reply">
            <div className="reply-header">
              <span className="reply-author">{reply.author}</span>
              <span className="reply-time">{timeAgo(reply.created_at)}</span>
            </div>
            <div className="reply-body">{reply.body}</div>
          </div>
        ))}
      </div>

      {!isResolved && (
        <div className="thread-actions">
          {showReply ? (
            <form className="reply-form" onSubmit={handleSubmitReply}>
              <textarea
                className="reply-input"
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="reply-form-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setShowReply(false); setReplyText('') }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-solid"
                  disabled={!replyText.trim() || submitting}
                >
                  Reply
                </button>
              </div>
            </form>
          ) : (
            <div className="thread-action-bar">
              <button className="btn-ghost" onClick={() => setShowReply(true)}>Reply</button>
              <button className="btn-ghost btn-resolve" onClick={handleResolve}>Resolve</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

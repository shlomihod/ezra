import React, { useEffect, useState } from 'react'

interface Document {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface DocumentListProps {
  selectedDocId: string | null
  onSelectDoc: (docId: string) => void
  onClear?: () => void
  refreshTrigger: number
}

export default function DocumentList({ selectedDocId, onSelectDoc, onClear, refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDocuments()
  }, [refreshTrigger])

  async function fetchDocuments() {
    try {
      const res = await fetch('/api/documents')
      if (res.ok) {
        const docs = await res.json()
        setDocuments(docs)
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleNewDocument() {
    const title = prompt('Document title:')
    if (!title?.trim()) return
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })
      if (res.ok) {
        const doc = await res.json()
        await fetchDocuments()
        onSelectDoc(doc.id)
      }
    } catch (err) {
      console.error('Failed to create document:', err)
    }
  }

  return (
    <aside className="document-list">
      <div className="sidebar-brand">
        <span className="brand-name">Ezra</span>
        <span className="brand-preview-label">Research Preview</span>
      </div>
      <div className="sidebar-section-label">
        Documents
        <button className="btn-new-doc" onClick={handleNewDocument} title="New Document">+</button>
      </div>
      <div className="doc-list-items">
        {loading && <div className="loading-text">Loading...</div>}
        {!loading && documents.length === 0 && (
          <div className="empty-text">No documents</div>
        )}
        {documents.map((doc) => (
          <a
            key={doc.id}
            href={`/#/${doc.id}`}
            className={`doc-item ${selectedDocId === doc.id ? 'doc-item-selected' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              onSelectDoc(doc.id)
            }}
          >
            <span className="doc-title">{doc.title}</span>
            <span className="doc-date">
              {new Date(doc.updated_at).toLocaleDateString()}
            </span>
          </a>
        ))}
      </div>
      {documents.length > 0 && (
        <div className="sidebar-footer">
          <button
            className="btn-clear-db"
            onClick={() => {
              if (confirm('Delete all documents? This cannot be undone.')) {
                onClear?.()
              }
            }}
          >
            Clear all
          </button>
        </div>
      )}
      <div className="sidebar-credits">
        <span>Made by <a href="https://shlomi.hod.xyz" target="_blank" rel="noopener noreferrer">Shlomi Hod</a></span>
        <span className="sidebar-credits-sep">·</span>
        <a href="https://ezra.tools" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </div>
    </aside>
  )
}
